import type { WorldPoint } from '$lib/world/types';

export interface InputSystemCallbacks {
	onDirectionStart?: () => void;
	onInteract?: () => void;
	onDestination?: (destination: WorldPoint) => void;
}

export interface InputSystemOptions extends InputSystemCallbacks {
	target: HTMLElement;
	screenToWorld: (point: WorldPoint) => WorldPoint;
}

const DIRECTION_KEYS = new Map<string, WorldPoint>([
	['w', { x: 0, y: -1 }],
	['arrowup', { x: 0, y: -1 }],
	['a', { x: -1, y: 0 }],
	['arrowleft', { x: -1, y: 0 }],
	['s', { x: 0, y: 1 }],
	['arrowdown', { x: 0, y: 1 }],
	['d', { x: 1, y: 0 }],
	['arrowright', { x: 1, y: 0 }]
]);

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	const tagName = target.tagName.toLowerCase();

	return (
		tagName === 'input' ||
		tagName === 'textarea' ||
		tagName === 'select' ||
		target.isContentEditable
	);
}

export class InputSystem {
	private readonly target: HTMLElement;
	private readonly screenToWorld: (point: WorldPoint) => WorldPoint;
	private readonly callbacks: InputSystemCallbacks;
	private readonly activeKeys = new Set<string>();

	private destroyed = false;

	constructor(options: InputSystemOptions) {
		this.target = options.target;
		this.screenToWorld = options.screenToWorld;
		this.callbacks = {
			onDirectionStart: options.onDirectionStart,
			onInteract: options.onInteract,
			onDestination: options.onDestination
		};

		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('keyup', this.handleKeyUp);
		window.addEventListener('blur', this.handleBlur);
		this.target.addEventListener('pointerdown', this.handlePointerDown);
	}

	get direction(): WorldPoint {
		let x = 0;
		let y = 0;

		for (const key of this.activeKeys) {
			const contribution = DIRECTION_KEYS.get(key);

			if (!contribution) {
				continue;
			}

			x += contribution.x;
			y += contribution.y;
		}

		const magnitude = Math.hypot(x, y);

		if (magnitude <= 0) {
			return { x: 0, y: 0 };
		}

		return {
			x: x / magnitude,
			y: y / magnitude
		};
	}

	get hasDirection(): boolean {
		return this.activeKeys.size > 0;
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}

		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
		window.removeEventListener('blur', this.handleBlur);
		this.target.removeEventListener('pointerdown', this.handlePointerDown);
		this.activeKeys.clear();
		this.destroyed = true;
	}

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (isEditableTarget(event.target)) {
			return;
		}

		const key = event.key.toLowerCase();

		if (key === 'e') {
			this.callbacks.onInteract?.();
			return;
		}

		if (!DIRECTION_KEYS.has(key)) {
			return;
		}

		const wasIdle = this.activeKeys.size === 0;

		this.activeKeys.add(key);
		event.preventDefault();

		if (wasIdle) {
			this.callbacks.onDirectionStart?.();
		}
	};

	private readonly handleKeyUp = (event: KeyboardEvent): void => {
		const key = event.key.toLowerCase();

		if (DIRECTION_KEYS.has(key)) {
			this.activeKeys.delete(key);
		}
	};

	private readonly handleBlur = (): void => {
		this.activeKeys.clear();
	};

	private readonly handlePointerDown = (event: PointerEvent): void => {
		if (event.button !== 0 || isEditableTarget(event.target)) {
			return;
		}

		const bounds = this.target.getBoundingClientRect();

		this.callbacks.onDestination?.(
			this.screenToWorld({
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top
			})
		);
	};
}
