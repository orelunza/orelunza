import type { VoxelWorld, LoadedWaterColumnProfile } from '../VoxelWorld';
import {
	HydraulicErosionSystem,
	type HydraulicErosionCell
} from '../erosion/HydraulicErosionSystem';
import type { HydraulicErosionSaveState } from '../erosion/ErosionState';
import { chunkKey, worldToChunk, type ChunkCoordinate } from '../voxel-types';
import {
	createEmptyNaturalWaterCycleSaveState,
	isLocalWaterSaveState,
	type LocalWaterCellSaveState,
	type LocalWaterDiagnosticsSnapshot,
	type LocalWaterForcing,
	type NaturalWaterCycleSaveState,
	type LocalWaterSaveState
} from './LocalWaterState';
import {
	ShallowWaterSolver,
	type ShallowWaterCellInitialization,
	type ShallowWaterStepResult
} from './ShallowWaterSolver';
import {
	classifyNaturalWaterBody,
	erosionPotential,
	stepSnowpack,
	type NaturalWaterBodyKind
} from './NaturalWaterCycle';

export interface LocalWaterUpdateResult {
	changedChunks: ChunkCoordinate[];
	persistenceDirty: boolean;
}

export interface LocalWaterSystemOptions {
	activeRadius?: number;
	simulationStepSeconds?: number;
	maximumSubsteps?: number;
	recenterDistance?: number;
}

export interface LocalWaterDebugApi {
	getDiagnostics(): LocalWaterDiagnosticsSnapshot;
	getCycleState(): NaturalWaterCycleSaveState;
	getErosionState(): HydraulicErosionSaveState;
	addWater(x: number, z: number, depth?: number): boolean;
	drainWater(x: number, z: number, depth?: number): boolean;
	addWaterAtPlayer(depth?: number): boolean;
	drainWaterAtPlayer(depth?: number): boolean;
	getActiveCenter(): { x: number; z: number };
	pause(): void;
	resume(): void;
	setRainScale(scale: number): void;
	setPrecipitationScale(scale: number): void;
	setErosionScale(scale: number): void;
}

interface ActiveCellMetadata {
	x: number;
	z: number;
	profile: LoadedWaterColumnProfile;
	waterBody: NaturalWaterBodyKind;
}

interface NaturalCycleFrameAggregate {
	snowAdded: number;
	snowMelted: number;
	riverExchange: number;
	lakeExchange: number;
	oceanExchange: number;
	waterBudgetResidual: number;
}

const DEFAULT_ACTIVE_RADIUS = 24;
const DEFAULT_SIMULATION_STEP_SECONDS = 0.1;
const DEFAULT_MAXIMUM_SUBSTEPS = 3;
const DEFAULT_RECENTER_DISTANCE = 8;
const MAXIMUM_FRAME_ACCUMULATION = 0.35;
const STRUCTURE_REBUILD_DELAY_SECONDS = 0.15;
const SAVE_DIRTY_INTERVAL_SECONDS = 2;
const RENDER_DEPTH_QUANTUM = 0.02;
const SAVED_DEPTH_EPSILON = 0.015;
const SAVED_SPEED_EPSILON = 0.02;
const SAVED_SNOW_EPSILON = 0.00001;
const MAXIMUM_SAVED_CELLS = 20_000;
const CHUNK_REFRESH_INTERVAL_SECONDS = 0.12;
const MAXIMUM_CHUNK_REFRESHES_PER_INTERVAL = 1;
const EROSION_STEP_SECONDS = 1;

/**
 * Couples the conservative shallow-water solver to the loaded voxel surface.
 *
 * Only a square window around the player is active. Cells outside that window
 * are serialized and put to sleep; natural river/lake/ocean columns return to
 * their generated representation until the window reaches them again.
 */
export class LocalWaterSystem {
	private readonly activeRadius: number;
	private readonly simulationStepSeconds: number;
	private readonly maximumSubsteps: number;
	private readonly recenterDistance: number;
	private readonly savedCells = new Map<string, LocalWaterCellSaveState>();
	private readonly pendingChunkRefreshes = new Map<string, ChunkCoordinate>();
	private solver: ShallowWaterSolver | null = null;
	private metadata: ActiveCellMetadata[] = [];
	private renderedDepth = new Float64Array(0);
	private snowWaterEquivalent = new Float64Array(0);
	private cycle: NaturalWaterCycleSaveState = createEmptyNaturalWaterCycleSaveState();
	private readonly erosion: HydraulicErosionSystem;
	private erosionAccumulator = 0;
	private centerX = 0;
	private centerZ = 0;
	private originX = 0;
	private originZ = 0;
	private accumulator = 0;
	private dirtyElapsed = 0;
	private chunkRefreshElapsed = 0;
	private structureRebuildElapsed = 0;
	private observedWorldVersion = -1;
	private needsRebuild = true;
	private paused = false;
	private rainScale = 1;
	private solverSteps = 0;
	private diagnosticsState: LocalWaterDiagnosticsSnapshot;

	constructor(
		private readonly world: VoxelWorld,
		options: Readonly<LocalWaterSystemOptions> = {}
	) {
		this.activeRadius = normalizeInteger(options.activeRadius, DEFAULT_ACTIVE_RADIUS, 8, 48);
		this.simulationStepSeconds = normalizeNumber(
			options.simulationStepSeconds,
			DEFAULT_SIMULATION_STEP_SECONDS,
			0.05,
			0.25
		);
		this.maximumSubsteps = normalizeInteger(
			options.maximumSubsteps,
			DEFAULT_MAXIMUM_SUBSTEPS,
			1,
			6
		);
		this.recenterDistance = normalizeInteger(
			options.recenterDistance,
			DEFAULT_RECENTER_DISTANCE,
			2,
			this.activeRadius
		);
		this.diagnosticsState = emptyDiagnostics(this.activeRadius);
		this.erosion = new HydraulicErosionSystem(this.world);
	}

	activate(position: Readonly<{ x: number; z: number }>): ChunkCoordinate[] {
		const changed = new Map<string, ChunkCoordinate>();
		for (const chunk of this.rebuild(position)) changed.set(chunkKey(chunk), chunk);
		for (const chunk of this.synchronizeAllRenderedCells()) changed.set(chunkKey(chunk), chunk);
		this.pendingChunkRefreshes.clear();
		return [...changed.values()];
	}

	update(
		position: Readonly<{ x: number; z: number }>,
		deltaSeconds: number,
		forcing: Readonly<LocalWaterForcing>
	): LocalWaterUpdateResult {
		const dt = Math.max(0, Math.min(MAXIMUM_FRAME_ACCUMULATION, finiteOr(deltaSeconds, 0)));
		if (this.paused || dt <= 0) {
			this.diagnosticsState.sleeping = true;
			return { changedChunks: [], persistenceDirty: false };
		}

		this.diagnosticsState.sleeping = false;
		const moved =
			!this.solver ||
			Math.abs(Math.floor(position.x) - this.centerX) >= this.recenterDistance ||
			Math.abs(Math.floor(position.z) - this.centerZ) >= this.recenterDistance;

		if (moved) {
			this.needsRebuild = true;
			this.structureRebuildElapsed = STRUCTURE_REBUILD_DELAY_SECONDS;
		}

		if (this.world.modificationVersion !== this.observedWorldVersion) {
			this.needsRebuild = true;
			this.structureRebuildElapsed += dt;
		}

		const changedChunks = new Map<string, ChunkCoordinate>();
		if (this.needsRebuild && this.structureRebuildElapsed >= STRUCTURE_REBUILD_DELAY_SECONDS) {
			for (const chunk of this.rebuild(position)) {
				changedChunks.set(chunkKey(chunk), chunk);
			}
			for (const chunk of this.synchronizeAllRenderedCells()) {
				changedChunks.set(chunkKey(chunk), chunk);
			}
		}

		for (const chunk of changedChunks.values()) {
			this.pendingChunkRefreshes.set(chunkKey(chunk), chunk);
		}
		changedChunks.clear();

		const solver = this.solver;
		if (!solver) {
			return { changedChunks: this.drainChunkRefreshes(dt), persistenceDirty: false };
		}

		this.accumulator = Math.min(MAXIMUM_FRAME_ACCUMULATION, this.accumulator + dt);
		this.dirtyElapsed += dt;
		let substeps = 0;
		let changed = false;
		let aggregate: ShallowWaterStepResult | null = null;
		const cycleFrame = emptyNaturalCycleFrameAggregate();
		const startedAt = nowMilliseconds();

		while (this.accumulator >= this.simulationStepSeconds && substeps < this.maximumSubsteps) {
			const scaledForcing: LocalWaterForcing = {
				...forcing,
				rainIntensity: clamp01(forcing.rainIntensity) * this.rainScale,
				snowIntensity: clamp01(forcing.snowIntensity) * this.rainScale
			};
			const storedBefore = this.totalStoredWater(solver);
			const snowResult = this.advanceSnowpack(this.simulationStepSeconds, scaledForcing);
			const exchanges = { river: 0, lake: 0, ocean: 0 };

			const result = solver.step(this.simulationStepSeconds, scaledForcing, {
				allowBoundaryOutflow: true,
				worldOriginX: this.originX,
				worldOriginZ: this.originZ,
				boundaryGroundAt: (x, z) => this.boundaryProfile(x, z).groundSurfaceY,
				boundaryWaterDepthAt: (x, z) => this.boundaryProfile(x, z).generatedWaterDepth,
				onSourceInflow: (index, amount) => {
					this.recordWaterBodyExchange(exchanges, this.metadata[index]?.waterBody, amount);
				},
				onBoundaryOutflow: (x, z, amount) => {
					this.recordWaterBodyExchange(exchanges, this.waterBodyAt(x, z), amount);
				}
			});

			const changedIndices = new Set(result.changedIndices);
			for (const index of snowResult.meltedIndices) changedIndices.add(index);
			for (const index of changedIndices) {
				if (this.synchronizeRenderedCell(index)) {
					const cell = this.metadata[index];
					if (cell) {
						const chunk = worldToChunk(cell);
						this.pendingChunkRefreshes.set(chunkKey(chunk), chunk);
					}
				}
			}

			const storedAfter = result.totalVolume + this.totalSnowWaterEquivalent();
			const expectedChange =
				result.rainAdded +
				snowResult.snowAdded +
				result.sourceInflow -
				result.evaporated -
				result.boundaryOutflow;
			cycleFrame.snowAdded += snowResult.snowAdded;
			cycleFrame.snowMelted += snowResult.snowMelted;
			cycleFrame.riverExchange += exchanges.river;
			cycleFrame.lakeExchange += exchanges.lake;
			cycleFrame.oceanExchange += exchanges.ocean;
			cycleFrame.waterBudgetResidual += storedAfter - storedBefore - expectedChange;

			this.cycle.elapsedSeconds += this.simulationStepSeconds;
			this.cycle.rainfallAdded += result.rainAdded;
			this.cycle.snowfallAdded += snowResult.snowAdded;
			this.cycle.snowmeltReleased += snowResult.snowMelted;
			this.cycle.evaporated += result.evaporated;
			this.cycle.sourceInflow += result.sourceInflow;
			this.cycle.boundaryOutflow += result.boundaryOutflow;
			this.cycle.runoffTransferred += result.runoffTransferred;

			this.erosionAccumulator += this.simulationStepSeconds;
			if (this.erosionAccumulator >= EROSION_STEP_SECONDS) {
				const erosionResult = this.erosion.step(this.erosionAccumulator, this.buildErosionCells());
				this.erosionAccumulator = 0;
				for (const chunk of erosionResult.changedChunks) {
					this.pendingChunkRefreshes.set(chunkKey(chunk), chunk);
				}
				if (erosionResult.stateChanged) changed = true;
				if (erosionResult.terrainChanged) {
					this.needsRebuild = true;
					this.structureRebuildElapsed = STRUCTURE_REBUILD_DELAY_SECONDS;
				}
			}

			changed =
				changed || changedIndices.size > 0 || snowResult.snowAdded > 0 || snowResult.snowMelted > 0;
			aggregate = aggregate
				? mergeStepResults(aggregate, result)
				: { ...result, changedIndices: [...result.changedIndices] };
			this.accumulator -= this.simulationStepSeconds;
			substeps += 1;
			this.solverSteps += 1;
		}

		if (aggregate) {
			this.updateDiagnostics(
				aggregate,
				cycleFrame,
				this.pendingChunkRefreshes.size,
				nowMilliseconds() - startedAt
			);
		}

		let persistenceDirty = false;
		if (changed && this.dirtyElapsed >= SAVE_DIRTY_INTERVAL_SECONDS) {
			this.persistCurrentCells();
			this.dirtyElapsed = 0;
			persistenceDirty = true;
		}

		return {
			changedChunks: this.drainChunkRefreshes(dt),
			persistenceDirty
		};
	}

	serialize(): LocalWaterSaveState {
		this.persistCurrentCells();

		return {
			version: 3,
			cells: [...this.savedCells.values()]
				.map((cell) => ({ ...cell }))
				.sort((left, right) => left.x - right.x || left.z - right.z),
			cycle: { ...this.cycle },
			erosion: this.erosion.serialize()
		};
	}

	restore(save: LocalWaterSaveState | null | undefined): void {
		this.savedCells.clear();
		this.cycle = createEmptyNaturalWaterCycleSaveState();
		if (save && isLocalWaterSaveState(save)) {
			for (const cell of save.cells) {
				this.savedCells.set(cellKey(cell.x, cell.z), {
					x: Math.floor(cell.x),
					z: Math.floor(cell.z),
					waterDepth: Math.max(0, finiteOr(cell.waterDepth, 0)),
					velocityX: finiteOr(cell.velocityX, 0),
					velocityZ: finiteOr(cell.velocityZ, 0),
					snowWaterEquivalent: Math.max(0, finiteOr(cell.snowWaterEquivalent, 0))
				});
			}
			if (save.cycle) this.cycle = { ...save.cycle };
			this.erosion.restore(save.erosion);
		} else {
			this.erosion.restore(undefined);
		}
		this.erosionAccumulator = 0;
		this.needsRebuild = true;
		this.structureRebuildElapsed = STRUCTURE_REBUILD_DELAY_SECONDS;
	}

	dispose(): void {
		this.persistCurrentCells();
		for (const cell of this.metadata) this.world.clearTransientWaterColumn(cell.x, cell.z);
		this.metadata = [];
		this.solver = null;
		this.renderedDepth = new Float64Array(0);
		this.snowWaterEquivalent = new Float64Array(0);
		this.pendingChunkRefreshes.clear();
		this.diagnosticsState.sleeping = true;
	}

	get diagnostics(): LocalWaterDiagnosticsSnapshot {
		return { ...this.diagnosticsState };
	}

	createDebugApi(): LocalWaterDebugApi {
		return {
			getDiagnostics: () => this.diagnostics,
			getCycleState: () => ({ ...this.cycle }),
			getErosionState: () => this.erosion.serialize(),
			addWater: (x, z, depth = 1) => this.changeWaterAt(x, z, Math.abs(depth)),
			drainWater: (x, z, depth = 1) => this.changeWaterAt(x, z, -Math.abs(depth)),
			addWaterAtPlayer: (depth = 1) =>
				this.changeWaterAt(this.centerX, this.centerZ, Math.abs(depth)),
			drainWaterAtPlayer: (depth = 1) =>
				this.changeWaterAt(this.centerX, this.centerZ, -Math.abs(depth)),
			getActiveCenter: () => ({ x: this.centerX, z: this.centerZ }),
			pause: () => {
				this.paused = true;
			},
			resume: () => {
				this.paused = false;
			},
			setRainScale: (scale) => {
				this.rainScale = Math.max(0, Math.min(20, finiteOr(scale, 1)));
			},
			setPrecipitationScale: (scale) => {
				this.rainScale = Math.max(0, Math.min(20, finiteOr(scale, 1)));
			},
			setErosionScale: (scale) => {
				this.erosion.setScale(scale);
			}
		};
	}

	private rebuild(position: Readonly<{ x: number; z: number }>): ChunkCoordinate[] {
		this.persistCurrentCells();
		const clearedChunks = new Map<string, ChunkCoordinate>();
		for (const cell of this.metadata) {
			if (!this.world.clearTransientWaterColumn(cell.x, cell.z)) continue;
			const chunk = worldToChunk(cell);
			clearedChunks.set(chunkKey(chunk), chunk);
		}

		this.centerX = Math.floor(position.x);
		this.centerZ = Math.floor(position.z);
		this.originX = this.centerX - this.activeRadius;
		this.originZ = this.centerZ - this.activeRadius;
		const diameter = this.activeRadius * 2 + 1;
		const initialization: ShallowWaterCellInitialization[] = [];
		const snowWaterEquivalent: number[] = [];
		const metadata: ActiveCellMetadata[] = [];

		for (let localZ = 0; localZ < diameter; localZ += 1) {
			for (let localX = 0; localX < diameter; localX += 1) {
				const x = this.originX + localX;
				const z = this.originZ + localZ;
				const profile = this.world.getLoadedWaterColumnProfile(x, z);
				const saved = this.savedCells.get(cellKey(x, z));
				initialization.push({
					groundHeight: profile.groundSurfaceY,
					waterDepth: saved?.waterDepth ?? profile.generatedWaterDepth,
					sourceDepth: profile.generatedWaterDepth,
					velocityX: saved?.velocityX ?? 0,
					velocityZ: saved?.velocityZ ?? 0,
					active: profile.loaded
				});
				snowWaterEquivalent.push(Math.max(0, finiteOr(saved?.snowWaterEquivalent, 0)));
				metadata.push({ x, z, profile, waterBody: this.waterBodyAt(x, z, profile) });
			}
		}

		this.solver = new ShallowWaterSolver(diameter, diameter, initialization);
		this.metadata = metadata;
		this.snowWaterEquivalent = Float64Array.from(snowWaterEquivalent);
		this.renderedDepth = new Float64Array(metadata.length);
		this.renderedDepth.fill(Number.NaN);
		this.observedWorldVersion = this.world.modificationVersion;
		this.needsRebuild = false;
		this.structureRebuildElapsed = 0;
		this.accumulator = 0;
		return [...clearedChunks.values()];
	}

	private persistCurrentCells(): void {
		const solver = this.solver;
		if (!solver) return;

		for (let index = 0; index < solver.length; index += 1) {
			const cell = this.metadata[index];
			if (!cell || !solver.active[index]) continue;
			const depth = Math.max(0, solver.waterDepth[index]);
			const velocityX = finiteOr(solver.velocityX[index], 0);
			const velocityZ = finiteOr(solver.velocityZ[index], 0);
			const snowWaterEquivalent = Math.max(0, finiteOr(this.snowWaterEquivalent[index], 0));
			const differsFromNatural = Math.abs(depth - solver.sourceDepth[index]) > SAVED_DEPTH_EPSILON;
			const moving = Math.hypot(velocityX, velocityZ) > SAVED_SPEED_EPSILON;
			const storesSnow = snowWaterEquivalent > SAVED_SNOW_EPSILON;
			const key = cellKey(cell.x, cell.z);

			if (!differsFromNatural && !moving && !storesSnow) {
				this.savedCells.delete(key);
				continue;
			}

			this.savedCells.set(key, {
				x: cell.x,
				z: cell.z,
				waterDepth: depth,
				velocityX,
				velocityZ,
				snowWaterEquivalent
			});
		}

		if (this.savedCells.size > MAXIMUM_SAVED_CELLS) {
			const ordered = [...this.savedCells.values()].sort(
				(left, right) =>
					Math.hypot(left.x - this.centerX, left.z - this.centerZ) -
					Math.hypot(right.x - this.centerX, right.z - this.centerZ)
			);
			this.savedCells.clear();
			for (const cell of ordered.slice(0, MAXIMUM_SAVED_CELLS)) {
				this.savedCells.set(cellKey(cell.x, cell.z), cell);
			}
		}
	}

	private synchronizeAllRenderedCells(): ChunkCoordinate[] {
		const changed = new Map<string, ChunkCoordinate>();
		for (let index = 0; index < this.metadata.length; index += 1) {
			if (!this.solver?.active[index] || !this.synchronizeRenderedCell(index)) continue;
			const chunk = worldToChunk(this.metadata[index]);
			changed.set(chunkKey(chunk), chunk);
		}
		return [...changed.values()];
	}

	private synchronizeRenderedCell(index: number): boolean {
		const solver = this.solver;
		const cell = this.metadata[index];
		if (!solver || !cell || !solver.active[index]) return false;
		const depth = Math.max(0, solver.waterDepth[index]);
		const previous = this.renderedDepth[index];
		if (
			Number.isFinite(previous) &&
			Math.abs(depth - previous) < RENDER_DEPTH_QUANTUM &&
			Math.floor(depth) === Math.floor(previous)
		) {
			return false;
		}

		const changed = this.world.setTransientWaterColumn(
			cell.x,
			cell.z,
			solver.groundHeight[index],
			depth,
			cell.profile.generatedWaterBottomY,
			cell.profile.generatedWaterSurfaceY
		);
		this.renderedDepth[index] = depth;
		return changed;
	}

	private boundaryProfile(x: number, z: number): LoadedWaterColumnProfile {
		return this.world.getLoadedWaterColumnProfile(x, z);
	}

	private changeWaterAt(x: number, z: number, delta: number): boolean {
		const solver = this.solver;
		if (!solver) return false;
		const localX = Math.floor(x) - this.originX;
		const localZ = Math.floor(z) - this.originZ;
		const index = solver.indexAt(localX, localZ);
		if (index < 0 || !solver.active[index]) return false;
		solver.waterDepth[index] = Math.max(0, solver.waterDepth[index] + delta);
		this.renderedDepth[index] = Number.NaN;
		if (this.synchronizeRenderedCell(index)) {
			const cell = this.metadata[index];
			if (cell) {
				const chunk = worldToChunk(cell);
				this.pendingChunkRefreshes.set(chunkKey(chunk), chunk);
			}
		}
		this.dirtyElapsed = SAVE_DIRTY_INTERVAL_SECONDS;
		return true;
	}

	private advanceSnowpack(
		deltaSeconds: number,
		forcing: Readonly<LocalWaterForcing>
	): { snowAdded: number; snowMelted: number; meltedIndices: number[] } {
		const solver = this.solver;
		if (!solver) return { snowAdded: 0, snowMelted: 0, meltedIndices: [] };

		let snowAdded = 0;
		let snowMelted = 0;
		const meltedIndices: number[] = [];
		for (let index = 0; index < solver.length; index += 1) {
			if (!solver.active[index]) continue;
			const result = stepSnowpack(this.snowWaterEquivalent[index] ?? 0, deltaSeconds, forcing);
			this.snowWaterEquivalent[index] = result.snowWaterEquivalent;
			snowAdded += result.snowfallAdded;
			snowMelted += result.meltReleased;
			if (result.meltReleased > 0) {
				solver.waterDepth[index] += result.meltReleased;
				this.renderedDepth[index] = Number.NaN;
				meltedIndices.push(index);
			}
		}

		return { snowAdded, snowMelted, meltedIndices };
	}

	private totalStoredWater(solver: Readonly<ShallowWaterSolver>): number {
		let liquid = 0;
		for (let index = 0; index < solver.length; index += 1) {
			if (solver.active[index]) liquid += Math.max(0, solver.waterDepth[index]);
		}
		return liquid + this.totalSnowWaterEquivalent();
	}

	private totalSnowWaterEquivalent(): number {
		const solver = this.solver;
		let total = 0;
		for (let index = 0; index < this.snowWaterEquivalent.length; index += 1) {
			if (!solver || solver.active[index])
				total += Math.max(0, this.snowWaterEquivalent[index] ?? 0);
		}
		return total;
	}

	private waterBodyAt(
		x: number,
		z: number,
		profile: LoadedWaterColumnProfile = this.boundaryProfile(x, z)
	): NaturalWaterBodyKind {
		const generator = (
			this.world as VoxelWorld & {
				terrainGenerator?: { zoneAt?: (x: number, z: number) => string };
			}
		).terrainGenerator;
		const zone = generator?.zoneAt?.(x, z);
		return classifyNaturalWaterBody(zone, profile.generatedWaterDepth);
	}

	private recordWaterBodyExchange(
		exchanges: { river: number; lake: number; ocean: number },
		kind: NaturalWaterBodyKind | undefined,
		amount: number
	): void {
		if (!Number.isFinite(amount) || amount <= 0 || !kind || kind === 'land') return;
		exchanges[kind] += amount;
	}

	private groundSlopeAt(index: number): number {
		const solver = this.solver;
		if (!solver || index < 0 || index >= solver.length) return 0;
		const x = index % solver.width;
		const z = Math.floor(index / solver.width);
		const centre = solver.groundHeight[index] ?? 0;
		let maximum = 0;
		for (const [dx, dz] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1]
		] as const) {
			const neighbour = solver.indexAt(x + dx, z + dz);
			if (neighbour < 0 || !solver.active[neighbour]) continue;
			maximum = Math.max(maximum, Math.abs(centre - (solver.groundHeight[neighbour] ?? centre)));
		}
		return maximum;
	}

	private buildErosionCells(): HydraulicErosionCell[] {
		const solver = this.solver;
		if (!solver) return [];
		const cells: HydraulicErosionCell[] = [];
		for (let index = 0; index < solver.length; index += 1) {
			const metadata = this.metadata[index];
			if (!metadata) continue;
			cells.push({
				x: metadata.x,
				z: metadata.z,
				active: solver.active[index] === 1,
				groundHeight: solver.groundHeight[index] ?? 0,
				waterDepth: Math.max(0, solver.waterDepth[index] ?? 0),
				velocityX: finiteOr(solver.velocityX[index], 0),
				velocityZ: finiteOr(solver.velocityZ[index], 0),
				groundSlope: this.groundSlopeAt(index),
				waterBody: metadata.waterBody
			});
		}
		return cells;
	}

	private drainChunkRefreshes(deltaSeconds: number): ChunkCoordinate[] {
		this.chunkRefreshElapsed += Math.max(0, deltaSeconds);
		if (
			this.chunkRefreshElapsed < CHUNK_REFRESH_INTERVAL_SECONDS ||
			this.pendingChunkRefreshes.size === 0
		) {
			return [];
		}

		this.chunkRefreshElapsed = 0;
		const result: ChunkCoordinate[] = [];
		for (const [key, chunk] of this.pendingChunkRefreshes) {
			result.push(chunk);
			this.pendingChunkRefreshes.delete(key);
			if (result.length >= MAXIMUM_CHUNK_REFRESHES_PER_INTERVAL) break;
		}
		return result;
	}

	private updateDiagnostics(
		result: Readonly<ShallowWaterStepResult>,
		cycleFrame: Readonly<NaturalCycleFrameAggregate>,
		changedChunks: number,
		lastStepMilliseconds: number
	): void {
		const solver = this.solver;
		let wetCells = 0;
		let snowCells = 0;
		let maximumErosionPotential = 0;
		if (solver) {
			for (let index = 0; index < solver.length; index += 1) {
				if (!solver.active[index]) continue;
				const depth = solver.waterDepth[index] ?? 0;
				if (depth > 0.001) wetCells += 1;
				if ((this.snowWaterEquivalent[index] ?? 0) > SAVED_SNOW_EPSILON) snowCells += 1;
				maximumErosionPotential = Math.max(
					maximumErosionPotential,
					erosionPotential(
						depth,
						Math.hypot(solver.velocityX[index] ?? 0, solver.velocityZ[index] ?? 0),
						this.groundSlopeAt(index)
					)
				);
			}
		}

		const snowWaterEquivalent = this.totalSnowWaterEquivalent();
		const erosionDiagnostics = this.erosion.diagnostics;
		this.diagnosticsState = {
			activeCells: solver ? countActive(solver.active) : 0,
			wetCells,
			snowCells,
			activeRadius: this.activeRadius,
			solverSteps: this.solverSteps,
			totalVolume: result.totalVolume,
			snowWaterEquivalent,
			totalStoredWater: result.totalVolume + snowWaterEquivalent,
			maximumDepth: result.maximumDepth,
			maximumSpeed: result.maximumSpeed,
			rainAdded: result.rainAdded,
			snowAdded: cycleFrame.snowAdded,
			snowMelted: cycleFrame.snowMelted,
			evaporated: result.evaporated,
			sourceInflow: result.sourceInflow,
			boundaryOutflow: result.boundaryOutflow,
			runoffTransferred: result.runoffTransferred,
			riverExchange: cycleFrame.riverExchange,
			lakeExchange: cycleFrame.lakeExchange,
			oceanExchange: cycleFrame.oceanExchange,
			maximumErosionPotential,
			erosionSediment: erosionDiagnostics.totalSediment,
			erodedVoxels: erosionDiagnostics.erodedVoxels,
			depositedVoxels: erosionDiagnostics.depositedVoxels,
			erosionTerrainChanges: erosionDiagnostics.terrainChanges,
			erosionProtectedColumns: erosionDiagnostics.protectedColumns,
			sedimentMassResidual: erosionDiagnostics.sedimentMassResidual,
			waterBudgetResidual: cycleFrame.waterBudgetResidual,
			changedChunks,
			lastStepMilliseconds,
			sleeping: this.paused
		};
	}
}

function mergeStepResults(
	left: Readonly<ShallowWaterStepResult>,
	right: Readonly<ShallowWaterStepResult>
): ShallowWaterStepResult {
	return {
		changedIndices: [...left.changedIndices, ...right.changedIndices],
		rainAdded: left.rainAdded + right.rainAdded,
		evaporated: left.evaporated + right.evaporated,
		sourceInflow: left.sourceInflow + right.sourceInflow,
		boundaryOutflow: left.boundaryOutflow + right.boundaryOutflow,
		runoffTransferred: left.runoffTransferred + right.runoffTransferred,
		totalVolume: right.totalVolume,
		maximumDepth: Math.max(left.maximumDepth, right.maximumDepth),
		maximumSpeed: Math.max(left.maximumSpeed, right.maximumSpeed)
	};
}

function emptyNaturalCycleFrameAggregate(): NaturalCycleFrameAggregate {
	return {
		snowAdded: 0,
		snowMelted: 0,
		riverExchange: 0,
		lakeExchange: 0,
		oceanExchange: 0,
		waterBudgetResidual: 0
	};
}

function emptyDiagnostics(activeRadius: number): LocalWaterDiagnosticsSnapshot {
	return {
		activeCells: 0,
		wetCells: 0,
		snowCells: 0,
		activeRadius,
		solverSteps: 0,
		totalVolume: 0,
		snowWaterEquivalent: 0,
		totalStoredWater: 0,
		maximumDepth: 0,
		maximumSpeed: 0,
		rainAdded: 0,
		snowAdded: 0,
		snowMelted: 0,
		evaporated: 0,
		sourceInflow: 0,
		boundaryOutflow: 0,
		runoffTransferred: 0,
		riverExchange: 0,
		lakeExchange: 0,
		oceanExchange: 0,
		maximumErosionPotential: 0,
		erosionSediment: 0,
		erodedVoxels: 0,
		depositedVoxels: 0,
		erosionTerrainChanges: 0,
		erosionProtectedColumns: 0,
		sedimentMassResidual: 0,
		waterBudgetResidual: 0,
		changedChunks: 0,
		lastStepMilliseconds: 0,
		sleeping: true
	};
}

function cellKey(x: number, z: number): string {
	return `${Math.floor(x)},${Math.floor(z)}`;
}

function countActive(active: Uint8Array): number {
	let count = 0;
	for (const value of active) count += value ? 1 : 0;
	return count;
}

function normalizeInteger(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number
): number {
	const finite = Number.isFinite(value) ? Math.floor(value as number) : fallback;
	return Math.max(minimum, Math.min(maximum, finite));
}

function normalizeNumber(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number
): number {
	const finite = Number.isFinite(value) ? (value as number) : fallback;
	return Math.max(minimum, Math.min(maximum, finite));
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function nowMilliseconds(): number {
	return typeof performance === 'undefined' ? Date.now() : performance.now();
}
