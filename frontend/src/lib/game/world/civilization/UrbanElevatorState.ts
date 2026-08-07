export interface UrbanElevatorSaveState {
	version: 1;
	currentFloor: number;
}

const MIN_FLOOR = 1;
const MAX_FLOOR = 128;

export function isUrbanElevatorSaveState(value: unknown): value is UrbanElevatorSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<UrbanElevatorSaveState>;
	return (
		candidate.version === 1 &&
		Number.isInteger(candidate.currentFloor) &&
		(candidate.currentFloor ?? 0) >= MIN_FLOOR &&
		(candidate.currentFloor ?? 0) <= MAX_FLOOR
	);
}
