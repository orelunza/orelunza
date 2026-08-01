export interface GameLoopHandlers {
	update: (deltaSeconds: number) => void;
	render: () => void;
}

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.18;

export class GameLoop {
	private frame = 0;
	private lastTime = 0;
	private accumulator = 0;
	private running = false;

	constructor(private readonly handlers: GameLoopHandlers) {}

	start(): void {
		if (this.running) {
			return;
		}

		this.running = true;
		this.lastTime = performance.now();
		this.frame = requestAnimationFrame(this.tick);
	}

	stop(): void {
		this.running = false;
		cancelAnimationFrame(this.frame);
	}

	private readonly tick = (time: number): void => {
		if (!this.running) {
			return;
		}

		const delta = Math.min((time - this.lastTime) / 1000, MAX_ACCUMULATED);
		this.lastTime = time;
		this.accumulator = Math.min(this.accumulator + delta, MAX_ACCUMULATED);

		while (this.accumulator >= FIXED_STEP) {
			this.handlers.update(FIXED_STEP);
			this.accumulator -= FIXED_STEP;
		}

		this.handlers.render();
		this.frame = requestAnimationFrame(this.tick);
	};
}
