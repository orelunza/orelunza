export class PointerLockController {
	private locked = false;
	private readonly handleChange = (): void => {
		this.locked = document.pointerLockElement === this.canvas;
		this.onChange?.(this.locked);
	};

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly onChange?: (locked: boolean) => void
	) {
		document.addEventListener('pointerlockchange', this.handleChange);
	}

	get isLocked(): boolean {
		return this.locked;
	}

	request(): void {
		void this.canvas.requestPointerLock();
	}

	exit(): void {
		if (document.pointerLockElement) {
			document.exitPointerLock();
		}
	}

	destroy(): void {
		document.removeEventListener('pointerlockchange', this.handleChange);
	}
}
