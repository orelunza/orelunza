export interface MovementInput {
	forward: number;
	right: number;
	jump: boolean;
	sprint: boolean;
}

export interface KeyboardCommands {
	inventory: boolean;
	pause: boolean;
	hotbarIndex: number | null;
}

export class KeyboardInput {
	private readonly keys = new Set<string>();
	private inventoryPressed = false;
	private pausePressed = false;
	private hotbarPressed: number | null = null;
	private readonly handleKeydown = (event: KeyboardEvent): void => {
		this.keys.add(event.code);

		if (event.code === 'KeyE' || event.code === 'KeyI') {
			this.inventoryPressed = true;
		}

		if (event.code === 'Escape') {
			this.pausePressed = true;
		}

		if (/^Digit[1-9]$/.test(event.code)) {
			this.hotbarPressed = Number.parseInt(event.code.replace('Digit', ''), 10) - 1;
		}
	};
	private readonly handleKeyup = (event: KeyboardEvent): void => {
		this.keys.delete(event.code);
	};
	private readonly handleBlur = (): void => {
		this.keys.clear();
	};

	constructor(private readonly target: Window = window) {
		target.addEventListener('keydown', this.handleKeydown);
		target.addEventListener('keyup', this.handleKeyup);
		target.addEventListener('blur', this.handleBlur);
	}

	getMovement(): MovementInput {
		const forward =
			(this.has('KeyW') || this.has('KeyZ') || this.has('ArrowUp') ? 1 : 0) -
			(this.has('KeyS') || this.has('ArrowDown') ? 1 : 0);
		const right =
			(this.has('KeyD') || this.has('ArrowRight') ? 1 : 0) -
			(this.has('KeyA') || this.has('KeyQ') || this.has('ArrowLeft') ? 1 : 0);

		if (forward !== 0 && right !== 0) {
			const normalized = 1 / Math.SQRT2;

			return {
				forward: forward * normalized,
				right: right * normalized,
				jump: this.has('Space'),
				sprint: this.has('ShiftLeft') || this.has('ShiftRight')
			};
		}

		return {
			forward,
			right,
			jump: this.has('Space'),
			sprint: this.has('ShiftLeft') || this.has('ShiftRight')
		};
	}

	consumeCommands(): KeyboardCommands {
		const commands = {
			inventory: this.inventoryPressed,
			pause: this.pausePressed,
			hotbarIndex: this.hotbarPressed
		};

		this.inventoryPressed = false;
		this.pausePressed = false;
		this.hotbarPressed = null;

		return commands;
	}

	private has(code: string): boolean {
		return this.keys.has(code);
	}

	destroy(): void {
		this.target.removeEventListener('keydown', this.handleKeydown);
		this.target.removeEventListener('keyup', this.handleKeyup);
		this.target.removeEventListener('blur', this.handleBlur);
	}
}
