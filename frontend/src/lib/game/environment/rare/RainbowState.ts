export interface RainbowSaveState {
	elapsedSeconds: number;
	rainMemory: number;
	drySeconds: number;
	intensity: number;
	forcedSeconds: number;
	paused: boolean;
}

export interface RainbowFrameState {
	elapsedSeconds: number;
	intensity: number;
	azimuthRadians: number;
	elevationRadians: number;
	rainMemory: number;
	drySeconds: number;
	paused: boolean;
}

export function createRainbowFrameState(): RainbowFrameState {
	return {
		elapsedSeconds: 0,
		intensity: 0,
		azimuthRadians: 0,
		elevationRadians: 0.2,
		rainMemory: 0,
		drySeconds: 0,
		paused: false
	};
}
