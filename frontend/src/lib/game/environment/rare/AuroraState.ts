export interface AuroraSaveState {
	elapsedSeconds: number;
	intensity: number;
	phase: number;
	forcedSeconds: number;
	paused: boolean;
}

export interface AuroraFrameState {
	elapsedSeconds: number;
	intensity: number;
	phase: number;
	latitudeBias: number;
	paused: boolean;
}

export function createAuroraFrameState(): AuroraFrameState {
	return {
		elapsedSeconds: 0,
		intensity: 0,
		phase: 0,
		latitudeBias: 0,
		paused: false
	};
}
