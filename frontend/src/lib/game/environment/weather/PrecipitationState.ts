export interface PrecipitationSaveState {
	elapsedSeconds: number;
	paused: boolean;
	visibleIntensity: number;
	visibleRainIntensity?: number;
	visibleSnowIntensity?: number;
}

export interface PrecipitationFrameState {
	elapsedSeconds: number;
	paused: boolean;
	kind: 'none' | 'rain' | 'snow' | 'mixed';
	/** Total scheduled precipitation in [0, 1]. */
	intensity: number;
	rainIntensity: number;
	snowIntensity: number;
	/** Total locally visible precipitation after shelter. */
	visibleIntensity: number;
	visibleRainIntensity: number;
	visibleSnowIntensity: number;
	shelter: number;
	windX: number;
	windZ: number;
	fallSpeed: number;
	snowFallSpeed: number;
	splashIntensity: number;
}

export function createPrecipitationFrameState(): PrecipitationFrameState {
	return {
		elapsedSeconds: 0,
		paused: false,
		kind: 'none',
		intensity: 0,
		rainIntensity: 0,
		snowIntensity: 0,
		visibleIntensity: 0,
		visibleRainIntensity: 0,
		visibleSnowIntensity: 0,
		shelter: 0,
		windX: 0,
		windZ: 0,
		fallSpeed: 18,
		snowFallSpeed: 3.4,
		splashIntensity: 0
	};
}
