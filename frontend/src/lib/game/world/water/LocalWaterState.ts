export interface LocalWaterCellSaveState {
	x: number;
	z: number;
	waterDepth: number;
	velocityX: number;
	velocityZ: number;
}

export interface LocalWaterSaveState {
	version: 1;
	cells: LocalWaterCellSaveState[];
}

export interface LocalWaterForcing {
	rainIntensity: number;
	rainShelter: number;
	precipitationType: 'none' | 'rain' | 'snow' | 'mixed' | string;
	temperatureCelsius: number;
	humidity: number;
	daylight: number;
	windStrength: number;
}

export interface LocalWaterDiagnosticsSnapshot {
	activeCells: number;
	wetCells: number;
	activeRadius: number;
	solverSteps: number;
	totalVolume: number;
	maximumDepth: number;
	maximumSpeed: number;
	rainAdded: number;
	evaporated: number;
	sourceInflow: number;
	boundaryOutflow: number;
	changedChunks: number;
	lastStepMilliseconds: number;
	sleeping: boolean;
}

export function createEmptyLocalWaterSaveState(): LocalWaterSaveState {
	return {
		version: 1,
		cells: []
	};
}

export function isLocalWaterSaveState(value: unknown): value is LocalWaterSaveState {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<LocalWaterSaveState>;

	return (
		candidate.version === 1 &&
		Array.isArray(candidate.cells) &&
		candidate.cells.every((cell) => {
			if (!cell || typeof cell !== 'object') {
				return false;
			}

			const entry = cell as Partial<LocalWaterCellSaveState>;
			return (
				Number.isFinite(entry.x) &&
				Number.isFinite(entry.z) &&
				Number.isFinite(entry.waterDepth) &&
				Number.isFinite(entry.velocityX) &&
				Number.isFinite(entry.velocityZ) &&
				(entry.waterDepth ?? -1) >= 0
			);
		})
	);
}
