import {
	isHydraulicErosionSaveState,
	type HydraulicErosionSaveState
} from '../erosion/ErosionState';

export interface LocalWaterCellSaveState {
	x: number;
	z: number;
	waterDepth: number;
	velocityX: number;
	velocityZ: number;
	/** Water-equivalent depth stored as snow on this surface cell. Added in Lot 8. */
	snowWaterEquivalent?: number;
}

export interface NaturalWaterCycleSaveState {
	elapsedSeconds: number;
	rainfallAdded: number;
	snowfallAdded: number;
	snowmeltReleased: number;
	evaporated: number;
	sourceInflow: number;
	boundaryOutflow: number;
	runoffTransferred: number;
}

export interface LocalWaterSaveState {
	/** V1: liquid; V2: snow/cycle; V3: persistent hydraulic erosion and sediment. */
	version: 1 | 2 | 3;
	cells: LocalWaterCellSaveState[];
	cycle?: NaturalWaterCycleSaveState;
	erosion?: HydraulicErosionSaveState;
}

export interface LocalWaterForcing {
	rainIntensity: number;
	snowIntensity: number;
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
	snowCells: number;
	activeRadius: number;
	solverSteps: number;
	totalVolume: number;
	snowWaterEquivalent: number;
	totalStoredWater: number;
	maximumDepth: number;
	maximumSpeed: number;
	rainAdded: number;
	snowAdded: number;
	snowMelted: number;
	evaporated: number;
	sourceInflow: number;
	boundaryOutflow: number;
	runoffTransferred: number;
	riverExchange: number;
	lakeExchange: number;
	oceanExchange: number;
	maximumErosionPotential: number;
	erosionSediment: number;
	erodedVoxels: number;
	depositedVoxels: number;
	erosionTerrainChanges: number;
	erosionProtectedColumns: number;
	sedimentMassResidual: number;
	waterBudgetResidual: number;
	changedChunks: number;
	lastStepMilliseconds: number;
	sleeping: boolean;
}

export function createEmptyNaturalWaterCycleSaveState(): NaturalWaterCycleSaveState {
	return {
		elapsedSeconds: 0,
		rainfallAdded: 0,
		snowfallAdded: 0,
		snowmeltReleased: 0,
		evaporated: 0,
		sourceInflow: 0,
		boundaryOutflow: 0,
		runoffTransferred: 0
	};
}

export function createEmptyLocalWaterSaveState(): LocalWaterSaveState {
	return {
		version: 3,
		cells: [],
		cycle: createEmptyNaturalWaterCycleSaveState()
	};
}

export function isLocalWaterSaveState(value: unknown): value is LocalWaterSaveState {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<LocalWaterSaveState>;
	if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3) return false;

	return (
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
				(entry.waterDepth ?? -1) >= 0 &&
				(entry.snowWaterEquivalent === undefined ||
					(Number.isFinite(entry.snowWaterEquivalent) && (entry.snowWaterEquivalent ?? -1) >= 0))
			);
		}) &&
		(candidate.cycle === undefined || isNaturalWaterCycleSaveState(candidate.cycle)) &&
		(candidate.erosion === undefined || isHydraulicErosionSaveState(candidate.erosion))
	);
}

export function isNaturalWaterCycleSaveState(value: unknown): value is NaturalWaterCycleSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<NaturalWaterCycleSaveState>;
	return [
		candidate.elapsedSeconds,
		candidate.rainfallAdded,
		candidate.snowfallAdded,
		candidate.snowmeltReleased,
		candidate.evaporated,
		candidate.sourceInflow,
		candidate.boundaryOutflow,
		candidate.runoffTransferred
	].every((entry) => Number.isFinite(entry) && (entry ?? -1) >= 0);
}
