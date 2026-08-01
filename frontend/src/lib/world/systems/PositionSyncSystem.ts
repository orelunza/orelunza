import type { MoveHumanRequest } from '$lib/api/contracts/world';

import { distanceBetweenPoints, type WorldPoint } from '$lib/world/types';

export type PositionSyncStatus = 'idle' | 'dirty' | 'syncing' | 'synced' | 'error';

export interface PositionSyncSnapshot {
	status: PositionSyncStatus;
	error: Error | null;
	pending: MoveHumanRequest | null;
	lastSynced: MoveHumanRequest | null;
}

export interface PositionSyncSystemOptions {
	sync: (request: MoveHumanRequest) => Promise<unknown>;
	minIntervalMs?: number;
	minDistance?: number;
	onStatusChange?: (snapshot: PositionSyncSnapshot) => void;
	now?: () => number;
	setTimer?: (handler: () => void, delay: number) => ReturnType<typeof setTimeout>;
	clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

const DEFAULT_MIN_INTERVAL_MS = 1_200;
const DEFAULT_MIN_DISTANCE = 4;

export class PositionSyncSystem {
	private readonly sync: (request: MoveHumanRequest) => Promise<unknown>;
	private readonly minIntervalMs: number;
	private readonly minDistance: number;
	private readonly onStatusChange?: (snapshot: PositionSyncSnapshot) => void;
	private readonly now: () => number;
	private readonly setTimer: (handler: () => void, delay: number) => ReturnType<typeof setTimeout>;
	private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;

	private statusValue: PositionSyncStatus = 'idle';
	private errorValue: Error | null = null;
	private pendingValue: MoveHumanRequest | null = null;
	private lastSyncedValue: MoveHumanRequest | null = null;
	private lastSyncAt = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private syncing = false;
	private destroyed = false;

	constructor(options: PositionSyncSystemOptions) {
		this.sync = options.sync;
		this.minIntervalMs = this.normalizeNonNegative(
			options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
			'minimum sync interval'
		);
		this.minDistance = this.normalizeNonNegative(
			options.minDistance ?? DEFAULT_MIN_DISTANCE,
			'minimum sync distance'
		);
		this.onStatusChange = options.onStatusChange;
		this.now = options.now ?? (() => Date.now());
		this.setTimer = options.setTimer ?? ((handler, delay) => setTimeout(handler, delay));
		this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
	}

	get snapshot(): PositionSyncSnapshot {
		return {
			status: this.statusValue,
			error: this.errorValue,
			pending: this.pendingValue ? { ...this.pendingValue } : null,
			lastSynced: this.lastSyncedValue ? { ...this.lastSyncedValue } : null
		};
	}

	notePosition(request: MoveHumanRequest): void {
		if (this.destroyed || !this.shouldSync(request)) {
			return;
		}

		this.pendingValue = { ...request };
		this.setStatus('dirty', null);
		this.schedule();
	}

	noteStopped(request: MoveHumanRequest): void {
		if (this.destroyed) {
			return;
		}

		if (this.shouldSync(request)) {
			this.pendingValue = { ...request };
			this.setStatus('dirty', null);
		}

		void this.flush();
	}

	async flush(): Promise<void> {
		if (this.destroyed || this.syncing || !this.pendingValue) {
			return;
		}

		this.cancelTimer();

		const request = { ...this.pendingValue };

		this.syncing = true;
		this.setStatus('syncing', null);

		try {
			await this.sync(request);
			this.lastSyncedValue = request;
			this.lastSyncAt = this.now();

			if (this.sameRequest(this.pendingValue, request)) {
				this.pendingValue = null;
			}

			this.setStatus(this.pendingValue ? 'dirty' : 'synced', null);

			if (this.pendingValue) {
				this.schedule();
			}
		} catch (error) {
			this.setStatus('error', error instanceof Error ? error : new Error('Position sync failed.'));
		} finally {
			this.syncing = false;
		}
	}

	destroy(): void {
		this.destroyed = true;
		this.cancelTimer();
	}

	private schedule(): void {
		if (this.timer || this.syncing) {
			return;
		}

		const delay = Math.max(0, this.minIntervalMs - (this.now() - this.lastSyncAt));

		this.timer = this.setTimer(() => {
			this.timer = null;
			void this.flush();
		}, delay);
	}

	private shouldSync(request: MoveHumanRequest): boolean {
		const previous = this.pendingValue ?? this.lastSyncedValue;

		if (!previous) {
			return true;
		}

		if (previous.region_id !== request.region_id || previous.place_id !== request.place_id) {
			return true;
		}

		return (
			distanceBetweenPoints(this.requestPoint(previous), this.requestPoint(request)) >=
			this.minDistance
		);
	}

	private sameRequest(first: MoveHumanRequest | null, second: MoveHumanRequest): boolean {
		return (
			first !== null &&
			first.region_id === second.region_id &&
			first.place_id === second.place_id &&
			first.position_x === second.position_x &&
			first.position_y === second.position_y
		);
	}

	private requestPoint(request: Pick<MoveHumanRequest, 'position_x' | 'position_y'>): WorldPoint {
		return {
			x: request.position_x,
			y: request.position_y
		};
	}

	private setStatus(status: PositionSyncStatus, error: Error | null): void {
		this.statusValue = status;
		this.errorValue = error;
		this.onStatusChange?.(this.snapshot);
	}

	private cancelTimer(): void {
		if (!this.timer) {
			return;
		}

		this.clearTimer(this.timer);
		this.timer = null;
	}

	private normalizeNonNegative(value: number, label: string): number {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`The ${label} must be a non-negative finite number.`);
		}

		return value;
	}
}
