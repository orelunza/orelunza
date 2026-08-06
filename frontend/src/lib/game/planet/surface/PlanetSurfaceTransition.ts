export type PlanetExplorationMode = 'globe' | 'descending' | 'surface' | 'ascending';

export interface PlanetSurfaceTransitionSnapshot {
	mode: PlanetExplorationMode;
	progress: number;
	durationSeconds: number;
}

export class PlanetSurfaceTransition {
	private modeState: PlanetExplorationMode = 'globe';
	private elapsedSeconds = 0;
	private durationSeconds = 2.4;

	get snapshot(): PlanetSurfaceTransitionSnapshot {
		return {
			mode: this.modeState,
			progress:
				this.modeState === 'globe'
					? 0
					: this.modeState === 'surface'
						? 1
						: clamp01(this.elapsedSeconds / this.durationSeconds),
			durationSeconds: this.durationSeconds
		};
	}

	beginDescent(durationSeconds = 2.4): void {
		this.start('descending', durationSeconds);
	}

	beginAscent(durationSeconds = 2.4): void {
		this.start('ascending', durationSeconds);
	}

	cancel(): void {
		this.modeState = this.modeState === 'ascending' ? 'surface' : 'globe';
		this.elapsedSeconds = 0;
	}

	update(deltaSeconds: number): PlanetSurfaceTransitionSnapshot {
		if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
			return this.snapshot;
		}
		if (this.modeState !== 'descending' && this.modeState !== 'ascending') {
			return this.snapshot;
		}
		this.elapsedSeconds = Math.min(this.durationSeconds, this.elapsedSeconds + deltaSeconds);
		if (this.durationSeconds - this.elapsedSeconds <= 1e-9) {
			this.modeState = this.modeState === 'descending' ? 'surface' : 'globe';
			this.elapsedSeconds = 0;
		}
		return this.snapshot;
	}

	force(mode: 'globe' | 'surface'): void {
		this.modeState = mode;
		this.elapsedSeconds = 0;
	}

	private start(mode: 'descending' | 'ascending', durationSeconds: number): void {
		if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
			throw new RangeError('Surface transition duration must be finite and positive.');
		}
		this.modeState = mode;
		this.elapsedSeconds = 0;
		this.durationSeconds = durationSeconds;
	}
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
