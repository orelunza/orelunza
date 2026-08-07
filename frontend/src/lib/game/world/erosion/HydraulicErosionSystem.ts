import { chunkKey, worldToChunk, type BlockType, type ChunkCoordinate } from '../voxel-types';
import { erosionPotential, type NaturalWaterBodyKind } from '../water/NaturalWaterCycle';
import {
	isHydraulicErosionSaveState,
	type HydraulicErosionDiagnosticsSnapshot,
	type HydraulicErosionSaveState
} from './ErosionState';

export interface HydraulicErosionCell {
	x: number;
	z: number;
	active: boolean;
	groundHeight: number;
	waterDepth: number;
	velocityX: number;
	velocityZ: number;
	groundSlope: number;
	waterBody: NaturalWaterBodyKind;
}

export interface HydraulicErosionStepResult {
	changedChunks: ChunkCoordinate[];
	stateChanged: boolean;
	terrainChanged: boolean;
	erodedVoxels: number;
	depositedVoxels: number;
}

export interface HydraulicErosionOptions {
	erosionScale?: number;
	maximumTerrainChangesPerStep?: number;
}

interface MutableErosionCell {
	sediment: number;
	wear: number;
}

interface ErosionWorldSurface {
	loaded: boolean;
	protectedByPlayer: boolean;
	surfaceY: number;
	type: BlockType;
}

export interface HydraulicErosionWorld {
	getErosionSurfaceProfile?(x: number, z: number): ErosionWorldSurface;
	erodeNaturalSurface?(
		x: number,
		z: number
	): { position: { x: number; y: number; z: number } } | null;
	depositNaturalSurface?(
		x: number,
		z: number,
		type: 'dirt' | 'sand'
	): { position: { x: number; y: number; z: number } } | null;
	exportNaturalTerrainEdits?(): HydraulicErosionSaveState['terrainEdits'];
	loadNaturalTerrainEdits?(edits: HydraulicErosionSaveState['terrainEdits']): void;
}

const MINIMUM_WATER_DEPTH = 0.035;
const MINIMUM_FLOW_SPEED = 0.035;
const MINIMUM_EROSION_SLOPE = 0.035;
const DEFAULT_EROSION_SCALE = 1;
const BASE_WEAR_RATE_PER_SECOND = 0.0012;
const DEFAULT_MAXIMUM_TERRAIN_CHANGES_PER_STEP = 2;
const SEDIMENT_TRANSPORT_RATE = 0.7;
const DEPOSITION_SPEED = 0.18;
const DEPOSITION_DEPTH = 0.08;
const CELL_EPSILON = 1e-8;
const MAXIMUM_SAVED_CELLS = 20_000;

/**
 * Slow, voxel-budgeted hydraulic erosion coupled to the local shallow-water grid.
 *
 * The water solver remains conservative and continuous. Terrain mutation is much
 * slower: a cell accumulates fractional wear until one whole natural voxel can
 * be detached. Detached material becomes suspended sediment, is transported in
 * the horizontal flow direction, then deposits only when the water loses enough
 * carrying capacity. Player-modified columns are never touched.
 */
export class HydraulicErosionSystem {
	private readonly cells = new Map<string, MutableErosionCell>();
	private erosionScale: number;
	private readonly maximumTerrainChangesPerStep: number;
	private totalErodedVoxels = 0;
	private totalDepositedVoxels = 0;
	private diagnosticsState = emptyDiagnostics();

	constructor(
		private readonly world: HydraulicErosionWorld,
		options: Readonly<HydraulicErosionOptions> = {}
	) {
		this.erosionScale = clamp(options.erosionScale ?? DEFAULT_EROSION_SCALE, 0, 1000);
		this.maximumTerrainChangesPerStep = Math.max(
			0,
			Math.min(
				16,
				Math.floor(
					Number.isFinite(options.maximumTerrainChangesPerStep)
						? (options.maximumTerrainChangesPerStep as number)
						: DEFAULT_MAXIMUM_TERRAIN_CHANGES_PER_STEP
				)
			)
		);
	}

	setScale(scale: number): void {
		this.erosionScale = clamp(Number.isFinite(scale) ? scale : 1, 0, 1000);
	}

	step(deltaSeconds: number, cells: readonly HydraulicErosionCell[]): HydraulicErosionStepResult {
		const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 1);
		if (dt <= 0 || this.erosionScale <= 0 || !supportsErosion(this.world)) {
			this.diagnosticsState = this.inspect(cells, 0, 0, 0, nowMilliseconds(), nowMilliseconds());
			return {
				changedChunks: [],
				stateChanged: false,
				terrainChanged: false,
				erodedVoxels: 0,
				depositedVoxels: 0
			};
		}

		const startedAt = nowMilliseconds();
		const activeByKey = new Map<string, HydraulicErosionCell>();
		for (const cell of cells) {
			if (cell.active) activeByKey.set(cellKey(cell.x, cell.z), cell);
		}

		let stateChanged = this.transportSediment(dt, activeByKey);

		const changedChunks = new Map<string, ChunkCoordinate>();
		let terrainChanges = 0;
		let erodedVoxels = 0;
		let depositedVoxels = 0;
		let protectedColumns = 0;
		let maximumCapacity = 0;

		const ordered = [...activeByKey.values()].sort(
			(left, right) => left.x - right.x || left.z - right.z
		);
		for (const cell of ordered) {
			const state = this.cellState(cell.x, cell.z);
			const speed = Math.hypot(cell.velocityX, cell.velocityZ);
			const potential = erosionPotential(cell.waterDepth, speed, cell.groundSlope);
			const capacity = sedimentCapacity(cell.waterDepth, speed, cell.groundSlope);
			maximumCapacity = Math.max(maximumCapacity, capacity);

			const surface = this.world.getErosionSurfaceProfile(cell.x, cell.z);
			if (!surface.loaded) continue;
			if (surface.protectedByPlayer) {
				protectedColumns += 1;
				state.wear = Math.min(state.wear, 0.25);
				continue;
			}

			if (
				terrainChanges < this.maximumTerrainChangesPerStep &&
				cell.waterDepth >= MINIMUM_WATER_DEPTH &&
				speed >= MINIMUM_FLOW_SPEED &&
				cell.groundSlope >= MINIMUM_EROSION_SLOPE &&
				state.sediment + CELL_EPSILON < capacity
			) {
				const erodibility = erodibilityForBlock(surface.type);
				const wearAdded =
					BASE_WEAR_RATE_PER_SECOND * this.erosionScale * dt * potential * erodibility;
				state.wear += wearAdded;
				if (wearAdded > CELL_EPSILON) stateChanged = true;
				if (state.wear >= 1) {
					const mutation = this.world.erodeNaturalSurface(cell.x, cell.z);
					if (mutation) {
						state.wear -= 1;
						state.sediment += 1;
						terrainChanges += 1;
						erodedVoxels += 1;
						this.totalErodedVoxels += 1;
						stateChanged = true;
						const chunk = worldToChunk(mutation.position);
						changedChunks.set(chunkKey(chunk), chunk);
					}
				}
			}

			if (
				terrainChanges < this.maximumTerrainChangesPerStep &&
				state.sediment >= 1 &&
				shouldDeposit(cell, speed, state.sediment, capacity)
			) {
				const depositType = depositionType(cell.waterBody, cell.groundSlope);
				const mutation = this.world.depositNaturalSurface(cell.x, cell.z, depositType);
				if (mutation) {
					state.sediment -= 1;
					terrainChanges += 1;
					depositedVoxels += 1;
					this.totalDepositedVoxels += 1;
					stateChanged = true;
					const chunk = worldToChunk(mutation.position);
					changedChunks.set(chunkKey(chunk), chunk);
				}
			}
		}

		this.compactCells();
		this.diagnosticsState = this.inspect(
			cells,
			terrainChanges,
			protectedColumns,
			maximumCapacity,
			startedAt,
			nowMilliseconds()
		);
		return {
			changedChunks: [...changedChunks.values()],
			stateChanged,
			terrainChanged: terrainChanges > 0,
			erodedVoxels,
			depositedVoxels
		};
	}

	serialize(): HydraulicErosionSaveState {
		const capable = supportsErosion(this.world) ? this.world : null;
		return {
			version: 1,
			cells: [...this.cells.entries()]
				.map(([key, state]) => {
					const [x = '0', z = '0'] = key.split(',');
					return {
						x: Number.parseInt(x, 10),
						z: Number.parseInt(z, 10),
						sediment: Math.max(0, state.sediment),
						wear: Math.max(0, state.wear)
					};
				})
				.filter((cell) => cell.sediment > CELL_EPSILON || cell.wear > CELL_EPSILON)
				.sort((left, right) => left.x - right.x || left.z - right.z),
			terrainEdits: capable?.exportNaturalTerrainEdits?.() ?? [],
			totalErodedVoxels: this.totalErodedVoxels,
			totalDepositedVoxels: this.totalDepositedVoxels
		};
	}

	restore(save: HydraulicErosionSaveState | null | undefined): void {
		this.cells.clear();
		this.totalErodedVoxels = 0;
		this.totalDepositedVoxels = 0;
		const capable = supportsErosion(this.world) ? this.world : null;
		if (!save || !isHydraulicErosionSaveState(save)) {
			capable?.loadNaturalTerrainEdits?.([]);
			this.diagnosticsState = emptyDiagnostics();
			return;
		}

		for (const cell of save.cells) {
			this.cells.set(cellKey(cell.x, cell.z), {
				sediment: Math.max(0, cell.sediment),
				wear: Math.max(0, cell.wear)
			});
		}
		capable?.loadNaturalTerrainEdits?.(save.terrainEdits);
		this.totalErodedVoxels = Math.max(0, save.totalErodedVoxels);
		this.totalDepositedVoxels = Math.max(0, save.totalDepositedVoxels);
		this.diagnosticsState = emptyDiagnostics();
	}

	get diagnostics(): HydraulicErosionDiagnosticsSnapshot {
		return { ...this.diagnosticsState };
	}

	private cellState(x: number, z: number): MutableErosionCell {
		const key = cellKey(x, z);
		let state = this.cells.get(key);
		if (!state) {
			state = { sediment: 0, wear: 0 };
			this.cells.set(key, state);
		}
		return state;
	}

	private transportSediment(
		deltaSeconds: number,
		activeByKey: ReadonlyMap<string, HydraulicErosionCell>
	): boolean {
		const delta = new Map<string, number>();
		for (const [key, cell] of activeByKey) {
			const state = this.cells.get(key);
			if (!state || state.sediment <= CELL_EPSILON) continue;
			const speed = Math.hypot(cell.velocityX, cell.velocityZ);
			if (speed <= MINIMUM_FLOW_SPEED) continue;
			const target = downstreamCell(cell);
			const targetKey = cellKey(target.x, target.z);
			if (!activeByKey.has(targetKey)) continue;
			const amount = Math.min(
				state.sediment,
				state.sediment * Math.min(0.45, speed * SEDIMENT_TRANSPORT_RATE * deltaSeconds)
			);
			if (amount <= CELL_EPSILON) continue;
			delta.set(key, (delta.get(key) ?? 0) - amount);
			delta.set(targetKey, (delta.get(targetKey) ?? 0) + amount);
		}
		for (const [key, amount] of delta) {
			const [x = '0', z = '0'] = key.split(',');
			const state = this.cellState(Number.parseInt(x, 10), Number.parseInt(z, 10));
			state.sediment = Math.max(0, state.sediment + amount);
		}
		return delta.size > 0;
	}

	private compactCells(): void {
		for (const [key, state] of this.cells) {
			if (state.sediment <= CELL_EPSILON && state.wear <= CELL_EPSILON) this.cells.delete(key);
		}
		if (this.cells.size <= MAXIMUM_SAVED_CELLS) return;

		// Suspended material is real conserved mass and must never be discarded to
		// satisfy a save-size budget. Only fractional wear-only cells may be pruned.
		const sedimentEntries = [...this.cells.entries()].filter(
			([, state]) => state.sediment > CELL_EPSILON
		);
		const wearOnlyEntries = [...this.cells.entries()]
			.filter(([, state]) => state.sediment <= CELL_EPSILON)
			.sort(([, left], [, right]) => right.wear - left.wear);
		const wearBudget = Math.max(0, MAXIMUM_SAVED_CELLS - sedimentEntries.length);
		this.cells.clear();
		for (const [key, state] of sedimentEntries) this.cells.set(key, state);
		for (const [key, state] of wearOnlyEntries.slice(0, wearBudget)) this.cells.set(key, state);
	}

	private inspect(
		cells: readonly HydraulicErosionCell[],
		terrainChanges: number,
		protectedColumns: number,
		maximumCapacity: number,
		startedAt: number,
		endedAt: number
	): HydraulicErosionDiagnosticsSnapshot {
		let sedimentCells = 0;
		let totalSediment = 0;
		let maximumSediment = 0;
		for (const state of this.cells.values()) {
			if (state.sediment > CELL_EPSILON) sedimentCells += 1;
			totalSediment += Math.max(0, state.sediment);
			maximumSediment = Math.max(maximumSediment, state.sediment);
		}
		return {
			activeCells: cells.reduce((count, cell) => count + (cell.active ? 1 : 0), 0),
			sedimentCells,
			totalSediment,
			maximumSediment,
			maximumCapacity,
			erodedVoxels: this.totalErodedVoxels,
			depositedVoxels: this.totalDepositedVoxels,
			terrainChanges,
			protectedColumns,
			sedimentMassResidual: this.totalErodedVoxels - this.totalDepositedVoxels - totalSediment,
			lastStepMilliseconds: Math.max(0, endedAt - startedAt)
		};
	}
}

export function sedimentCapacity(waterDepth: number, speed: number, slope: number): number {
	const depth = Math.max(0, Number.isFinite(waterDepth) ? waterDepth : 0);
	const velocity = Math.max(0, Number.isFinite(speed) ? speed : 0);
	const gradient = Math.max(0, Number.isFinite(slope) ? slope : 0);
	return Math.min(8, depth * velocity * (0.35 + Math.min(2, gradient)) * 2.4);
}

export function erodibilityForBlock(type: BlockType): number {
	switch (type) {
		case 'sand':
			return 1.4;
		case 'dirt':
			return 1;
		case 'grass':
			return 0.72;
		case 'stone':
			return 0.055;
		default:
			return 0;
	}
}

function shouldDeposit(
	cell: Readonly<HydraulicErosionCell>,
	speed: number,
	sediment: number,
	capacity: number
): boolean {
	if (sediment < 1) return false;
	if (cell.waterBody === 'ocean' || cell.waterBody === 'lake') {
		return speed <= 0.35 || sediment > capacity + 1;
	}
	return (
		(speed <= DEPOSITION_SPEED && cell.waterDepth <= DEPOSITION_DEPTH) ||
		sediment > Math.max(1.25, capacity * 1.8)
	);
}

function depositionType(kind: NaturalWaterBodyKind, slope: number): 'dirt' | 'sand' {
	return kind === 'river' || kind === 'lake' || kind === 'ocean' || slope < 0.18 ? 'sand' : 'dirt';
}

function downstreamCell(cell: Readonly<HydraulicErosionCell>): { x: number; z: number } {
	if (Math.abs(cell.velocityX) >= Math.abs(cell.velocityZ)) {
		return { x: cell.x + Math.sign(cell.velocityX), z: cell.z };
	}
	return { x: cell.x, z: cell.z + Math.sign(cell.velocityZ) };
}

function supportsErosion(world: HydraulicErosionWorld): world is Required<HydraulicErosionWorld> {
	return (
		typeof world.getErosionSurfaceProfile === 'function' &&
		typeof world.erodeNaturalSurface === 'function' &&
		typeof world.depositNaturalSurface === 'function' &&
		typeof world.exportNaturalTerrainEdits === 'function' &&
		typeof world.loadNaturalTerrainEdits === 'function'
	);
}

function cellKey(x: number, z: number): string {
	return `${Math.floor(x)},${Math.floor(z)}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function nowMilliseconds(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function emptyDiagnostics(): HydraulicErosionDiagnosticsSnapshot {
	return {
		activeCells: 0,
		sedimentCells: 0,
		totalSediment: 0,
		maximumSediment: 0,
		maximumCapacity: 0,
		erodedVoxels: 0,
		depositedVoxels: 0,
		terrainChanges: 0,
		protectedColumns: 0,
		sedimentMassResidual: 0,
		lastStepMilliseconds: 0
	};
}
