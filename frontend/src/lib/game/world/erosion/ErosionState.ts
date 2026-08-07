import type { BlockCoordinate, BlockType } from '../voxel-types';

export type ErosionDepositType = Extract<BlockType, 'dirt' | 'sand'>;
export type NaturalTerrainOverrideType = Extract<
	BlockType,
	'air' | 'grass' | 'dirt' | 'stone' | 'sand'
>;

export interface ErosionCellSaveState {
	x: number;
	z: number;
	/** Suspended sediment measured in voxel-volume equivalents. */
	sediment: number;
	/** Fractional mechanical weathering accumulated before a full voxel is detached. */
	wear: number;
}

export interface NaturalTerrainEditSaveState {
	position: BlockCoordinate;
	type: NaturalTerrainOverrideType;
}

export interface HydraulicErosionSaveState {
	version: 1;
	cells: ErosionCellSaveState[];
	terrainEdits: NaturalTerrainEditSaveState[];
	totalErodedVoxels: number;
	totalDepositedVoxels: number;
}

export interface HydraulicErosionDiagnosticsSnapshot {
	activeCells: number;
	sedimentCells: number;
	totalSediment: number;
	maximumSediment: number;
	maximumCapacity: number;
	erodedVoxels: number;
	depositedVoxels: number;
	terrainChanges: number;
	protectedColumns: number;
	sedimentMassResidual: number;
	lastStepMilliseconds: number;
}

export function createEmptyHydraulicErosionSaveState(): HydraulicErosionSaveState {
	return {
		version: 1,
		cells: [],
		terrainEdits: [],
		totalErodedVoxels: 0,
		totalDepositedVoxels: 0
	};
}

export function isHydraulicErosionSaveState(value: unknown): value is HydraulicErosionSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HydraulicErosionSaveState>;
	return (
		candidate.version === 1 &&
		Array.isArray(candidate.cells) &&
		candidate.cells.every(isErosionCellSaveState) &&
		Array.isArray(candidate.terrainEdits) &&
		candidate.terrainEdits.every(isNaturalTerrainEditSaveState) &&
		isNonNegativeFinite(candidate.totalErodedVoxels) &&
		isNonNegativeFinite(candidate.totalDepositedVoxels)
	);
}

function isErosionCellSaveState(value: unknown): value is ErosionCellSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<ErosionCellSaveState>;
	return (
		Number.isFinite(candidate.x) &&
		Number.isFinite(candidate.z) &&
		isNonNegativeFinite(candidate.sediment) &&
		isNonNegativeFinite(candidate.wear)
	);
}

function isNaturalTerrainEditSaveState(value: unknown): value is NaturalTerrainEditSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<NaturalTerrainEditSaveState>;
	const position = candidate.position;
	return (
		!!position &&
		Number.isFinite(position.x) &&
		Number.isFinite(position.y) &&
		Number.isFinite(position.z) &&
		(candidate.type === 'air' ||
			candidate.type === 'grass' ||
			candidate.type === 'dirt' ||
			candidate.type === 'stone' ||
			candidate.type === 'sand')
	);
}

function isNonNegativeFinite(value: number | undefined): boolean {
	return Number.isFinite(value) && (value ?? -1) >= 0;
}
