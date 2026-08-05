export interface ShootingStarEventState {
	active: boolean;
	id: number;
	ageSeconds: number;
	durationSeconds: number;
	azimuthRadians: number;
	elevationRadians: number;
	lengthRadians: number;
	brightness: number;
}

export interface ShootingStarSaveState {
	elapsedSeconds: number;
	nextEventAtSeconds: number;
	eventIndex: number;
	activeEvents: ShootingStarEventState[];
	paused: boolean;
}

export interface ShootingStarFrameState {
	elapsedSeconds: number;
	activeCount: number;
	visibility: number;
	paused: boolean;
	readonly events: readonly ShootingStarEventState[];
}

export function createShootingStarEventState(): ShootingStarEventState {
	return {
		active: false,
		id: 0,
		ageSeconds: 0,
		durationSeconds: 0.8,
		azimuthRadians: 0,
		elevationRadians: 0.65,
		lengthRadians: 0.18,
		brightness: 0
	};
}
