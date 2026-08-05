/** Serializable deterministic wind timeline state. */
export interface WindSaveState {
	elapsedSeconds: number;
	paused?: boolean;
	weatherStrength?: number;
}

/** Allocation-free wind snapshot shared by clouds, vegetation and later rain. */
export interface WindFrameState {
	directionRadians: number;
	directionX: number;
	directionZ: number;
	strength: number;
	gust: number;
	elapsedSeconds: number;
	paused: boolean;
}

export function createWindFrameState(): WindFrameState {
	return {
		directionRadians: 0,
		directionX: 1,
		directionZ: 0,
		strength: 0.15,
		gust: 0,
		elapsedSeconds: 0,
		paused: false
	};
}
