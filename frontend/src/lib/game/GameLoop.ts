export interface GameLoopHandlers {
	update: (deltaSeconds: number) => void;
	/** Runs once per animation frame, after fixed simulation and before render. */
	background?: () => void;
	render: () => void;
}

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.18;

export class GameLoop {
	private frame: number | null = null;
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
		if (!this.running && this.frame === null) {
			return;
		}

		this.running = false;
		this.accumulator = 0;

		if (this.frame !== null) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
	}

	get isRunning(): boolean {
		return this.running;
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

		// Streaming must not run once for every catch-up simulation step. A long
		// frame otherwise turns into several synchronous chunk jobs before the
		// browser gets a chance to paint again.
		this.handlers.background?.();
		this.handlers.render();
		this.frame = requestAnimationFrame(this.tick);
	};
}
