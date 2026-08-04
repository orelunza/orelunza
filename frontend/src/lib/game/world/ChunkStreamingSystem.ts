import { chunkKey, type ChunkCoordinate, worldToChunk } from './voxel-types';

export interface ChunkStreamingPosition {
	x: number;
	z: number;
}

export interface ChunkStreamingOptions {
	visibleRadius?: number;
	retainRadius?: number;
	maxLoadsPerUpdate?: number;
	maxUnloadsPerUpdate?: number;
	timeBudgetMs?: number;
	loadChunk: (chunk: ChunkCoordinate) => boolean | void;
	unloadChunk: (chunk: ChunkCoordinate) => boolean | void;
}

export interface ChunkStreamingSnapshot {
	center: ChunkCoordinate | null;
	loadedChunks: number;
	pendingLoads: number;
	visibleRadius: number;
	retainRadius: number;
	ready: boolean;
}

const DEFAULT_VISIBLE_RADIUS = 2;
const DEFAULT_RETAIN_RADIUS = 3;
const DEFAULT_MAX_LOADS_PER_UPDATE = 1;
const DEFAULT_MAX_UNLOADS_PER_UPDATE = 2;
const DEFAULT_TIME_BUDGET_MS = 2.5;

export class ChunkStreamingSystem {
	private readonly visibleRadius: number;
	private readonly retainRadius: number;
	private readonly maxLoadsPerUpdate: number;
	private readonly maxUnloadsPerUpdate: number;
	private readonly timeBudgetMs: number;
	private readonly loadChunk: ChunkStreamingOptions['loadChunk'];
	private readonly unloadChunk: ChunkStreamingOptions['unloadChunk'];

	private readonly loaded = new Map<string, ChunkCoordinate>();
	private readonly pendingLoadKeys = new Set<string>();
	private pendingLoads: ChunkCoordinate[] = [];
	private center: ChunkCoordinate | null = null;
	private disposed = false;

	constructor(options: ChunkStreamingOptions) {
		this.visibleRadius = normalizeRadius(
			options.visibleRadius ?? DEFAULT_VISIBLE_RADIUS,
			'visibleRadius'
		);
		this.retainRadius = normalizeRadius(
			options.retainRadius ?? DEFAULT_RETAIN_RADIUS,
			'retainRadius'
		);

		if (this.retainRadius < this.visibleRadius) {
			throw new Error('retainRadius must be greater than or equal to visibleRadius.');
		}

		this.maxLoadsPerUpdate = normalizeLimit(
			options.maxLoadsPerUpdate ?? DEFAULT_MAX_LOADS_PER_UPDATE,
			'maxLoadsPerUpdate'
		);
		this.maxUnloadsPerUpdate = normalizeLimit(
			options.maxUnloadsPerUpdate ?? DEFAULT_MAX_UNLOADS_PER_UPDATE,
			'maxUnloadsPerUpdate'
		);
		this.timeBudgetMs = normalizeBudget(options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
		this.loadChunk = options.loadChunk;
		this.unloadChunk = options.unloadChunk;
	}

	synchronizeLoaded(chunks: readonly ChunkCoordinate[]): void {
		this.assertUsable();
		this.loaded.clear();

		for (const chunk of chunks) {
			const normalized = normalizeChunk(chunk);
			this.loaded.set(chunkKey(normalized), normalized);
		}

		if (this.center) {
			this.rebuildLoadQueue();
		}
	}

	markLoaded(chunk: ChunkCoordinate): void {
		this.assertUsable();
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		this.loaded.set(key, normalized);
		this.pendingLoadKeys.delete(key);
		this.pendingLoads = this.pendingLoads.filter((candidate) => chunkKey(candidate) !== key);
	}

	markUnloaded(chunk: ChunkCoordinate): void {
		this.assertUsable();
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		this.loaded.delete(key);

		if (this.center && isInsideRadius(normalized, this.center, this.visibleRadius)) {
			this.enqueueLoad(normalized);
			this.sortLoadQueue();
		}
	}

	update(position: ChunkStreamingPosition): boolean {
		this.assertUsable();

		const nextCenter = worldToChunk(position);
		let changed = false;

		if (!sameChunk(this.center, nextCenter)) {
			this.center = nextCenter;
			this.rebuildLoadQueue();
		}

		const startedAt = now();
		let unloadAttempts = 0;

		for (const [key, chunk] of this.loaded) {
			if (unloadAttempts >= this.maxUnloadsPerUpdate || this.overBudget(startedAt)) {
				break;
			}

			if (isInsideRadius(chunk, nextCenter, this.retainRadius)) {
				continue;
			}

			unloadAttempts += 1;

			if (this.unloadChunk(chunk) === false) {
				continue;
			}

			this.loaded.delete(key);
			changed = true;
		}

		let loadAttempts = 0;

		while (
			this.pendingLoads.length > 0 &&
			loadAttempts < this.maxLoadsPerUpdate &&
			!this.overBudget(startedAt)
		) {
			const chunk = this.pendingLoads.shift();

			if (!chunk) {
				break;
			}

			const key = chunkKey(chunk);
			this.pendingLoadKeys.delete(key);

			if (this.loaded.has(key)) {
				continue;
			}

			loadAttempts += 1;

			if (this.loadChunk(chunk) === false) {
				this.enqueueLoad(chunk);
				continue;
			}

			this.loaded.set(key, chunk);
			changed = true;
		}

		return changed;
	}

	get snapshot(): ChunkStreamingSnapshot {
		return {
			center: this.center ? { ...this.center } : null,
			loadedChunks: this.loaded.size,
			pendingLoads: this.pendingLoads.length,
			visibleRadius: this.visibleRadius,
			retainRadius: this.retainRadius,
			ready: this.pendingLoads.length === 0
		};
	}

	get loadedChunks(): ChunkCoordinate[] {
		return Array.from(this.loaded.values(), (chunk) => ({ ...chunk }));
	}

	reset(): void {
		this.assertUsable();
		this.loaded.clear();
		this.pendingLoads = [];
		this.pendingLoadKeys.clear();
		this.center = null;
	}

	dispose(): void {
		this.disposed = true;
		this.loaded.clear();
		this.pendingLoads = [];
		this.pendingLoadKeys.clear();
		this.center = null;
	}

	private rebuildLoadQueue(): void {
		if (!this.center) {
			return;
		}

		this.pendingLoads = [];
		this.pendingLoadKeys.clear();

		for (
			let x = this.center.x - this.visibleRadius;
			x <= this.center.x + this.visibleRadius;
			x += 1
		) {
			for (
				let z = this.center.z - this.visibleRadius;
				z <= this.center.z + this.visibleRadius;
				z += 1
			) {
				this.enqueueLoad({ x, z });
			}
		}

		this.sortLoadQueue();
	}

	private enqueueLoad(chunk: ChunkCoordinate): void {
		const normalized = normalizeChunk(chunk);
		const key = chunkKey(normalized);

		if (this.loaded.has(key) || this.pendingLoadKeys.has(key)) {
			return;
		}

		this.pendingLoadKeys.add(key);
		this.pendingLoads.push(normalized);
	}

	private sortLoadQueue(): void {
		if (!this.center) {
			return;
		}

		const center = this.center;

		this.pendingLoads.sort((left, right) => {
			const leftDistance = distanceSquared(left, center);
			const rightDistance = distanceSquared(right, center);

			if (leftDistance !== rightDistance) {
				return leftDistance - rightDistance;
			}

			const leftManhattan = Math.abs(left.x - center.x) + Math.abs(left.z - center.z);
			const rightManhattan = Math.abs(right.x - center.x) + Math.abs(right.z - center.z);

			if (leftManhattan !== rightManhattan) {
				return leftManhattan - rightManhattan;
			}

			return left.x - right.x || left.z - right.z;
		});
	}

	private overBudget(startedAt: number): boolean {
		return now() - startedAt >= this.timeBudgetMs;
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('ChunkStreamingSystem has been disposed.');
		}
	}
}

function normalizeRadius(value: number, name: string): number {
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`${name} must be a non-negative integer.`);
	}

	return value;
}

function normalizeLimit(value: number, name: string): number {
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be an integer greater than zero.`);
	}

	return value;
}

function normalizeBudget(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error('timeBudgetMs must be greater than zero.');
	}

	return value;
}

function normalizeChunk(chunk: ChunkCoordinate): ChunkCoordinate {
	if (!Number.isFinite(chunk.x) || !Number.isFinite(chunk.z)) {
		throw new Error('Chunk coordinates must be finite.');
	}

	return {
		x: Math.trunc(chunk.x),
		z: Math.trunc(chunk.z)
	};
}

function sameChunk(left: ChunkCoordinate | null, right: ChunkCoordinate): boolean {
	return left?.x === right.x && left.z === right.z;
}

function isInsideRadius(chunk: ChunkCoordinate, center: ChunkCoordinate, radius: number): boolean {
	return Math.abs(chunk.x - center.x) <= radius && Math.abs(chunk.z - center.z) <= radius;
}

function distanceSquared(left: ChunkCoordinate, right: ChunkCoordinate): number {
	const x = left.x - right.x;
	const z = left.z - right.z;

	return x * x + z * z;
}

function now(): number {
	return globalThis.performance?.now() ?? Date.now();
}
