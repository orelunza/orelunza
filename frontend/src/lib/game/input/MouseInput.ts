export interface MouseDelta {
	x: number;
	y: number;
}

export type MouseAction = 'break' | 'place';

export class MouseInput {
	private deltaX = 0;
	private deltaY = 0;
	private queuedAction: MouseAction | null = null;
	private wheelDelta = 0;

	private readonly handleMove = (event: MouseEvent): void => {
		if (document.pointerLockElement !== this.canvas) {
			return;
		}

		this.deltaX += event.movementX;
		this.deltaY += event.movementY;
	};

	private readonly handlePointerDown = (event: PointerEvent): void => {
		this.canvas.focus();

		if (document.pointerLockElement !== this.canvas) {
			void this.canvas.requestPointerLock();
			return;
		}

		if (event.button === 0) {
			this.queuedAction = 'break';
		} else if (event.button === 2) {
			this.queuedAction = 'place';
		}
	};

	private readonly handleContextMenu = (event: MouseEvent): void => {
		event.preventDefault();
	};

	private readonly handleWheel = (event: WheelEvent): void => {
		this.wheelDelta += event.deltaY;
	};

	constructor(private readonly canvas: HTMLCanvasElement) {
		window.addEventListener('mousemove', this.handleMove);
		canvas.addEventListener('pointerdown', this.handlePointerDown);
		canvas.addEventListener('contextmenu', this.handleContextMenu);
		canvas.addEventListener('wheel', this.handleWheel, { passive: true });
	}

	consumeDelta(): MouseDelta {
		const delta = {
			x: this.deltaX,
			y: this.deltaY
		};

		this.deltaX = 0;
		this.deltaY = 0;

		return delta;
	}

	consumeAction(): MouseAction | null {
		const action = this.queuedAction;
		this.queuedAction = null;

		return action;
	}

	consumeWheel(): number {
		const delta = this.wheelDelta;
		this.wheelDelta = 0;

		return delta;
	}

	destroy(): void {
		window.removeEventListener('mousemove', this.handleMove);
		this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
		this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
		this.canvas.removeEventListener('wheel', this.handleWheel);
	}
}
