export interface SurfaceWeatherSaveState {
	elapsedSeconds: number;
	paused: boolean;
	wetness: number;
	snowCoverage: number;
	frost: number;
}

/** Local material response to precipitation and cold. */
export interface SurfaceWeatherFrameState {
	elapsedSeconds: number;
	paused: boolean;
	wetness: number;
	snowCoverage: number;
	frost: number;
}

export function createSurfaceWeatherFrameState(): SurfaceWeatherFrameState {
	return {
		elapsedSeconds: 0,
		paused: false,
		wetness: 0,
		snowCoverage: 0,
		frost: 0
	};
}
