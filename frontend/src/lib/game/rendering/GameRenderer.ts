import {
	ACESFilmicToneMapping,
	PCFSoftShadowMap,
	SRGBColorSpace,
	Scene,
	WebGLRenderer,
	type Camera,
	type Vector3
} from 'three';
import { PlacementPreview } from './PlacementPreview';
import { SelectionOutline } from './SelectionOutline';
import {
	resolveQualitySettings,
	type QualitySettings,
	type RenderQuality
} from './QualitySettings';
import { BlockMeshFactory, type BlockInstanceLookup } from '../world/BlockMeshFactory';
import type { VoxelWorld } from '../world/VoxelWorld';
import { chunkKey, type BlockCoordinate, type ChunkCoordinate } from '../world/voxel-types';
import type { ChunkStreamingChanges } from '../world/ChunkStreamingSystem';
import { TallGrassRenderer } from './TallGrassRenderer';
import { GroundFoliageRenderer } from './GroundFoliageRenderer';
import { VegetationSelectionOutline } from './VegetationSelectionOutline';
import {
	VegetationInteractionIndex,
	type VegetationInteractionInstance
} from '../vegetation/VegetationInteractionIndex';
import { VegetationRemovalState } from '../vegetation/VegetationRemovalState';
import type { SurfaceWeatherFrameState } from '../environment/surface/SurfaceWeatherState';
import { WorldFixtureRenderer } from './WorldFixtureRenderer';
import { UrbanElevatorRenderer } from './UrbanElevatorRenderer';
import { urbanTypeVisible } from './UrbanLodSystem';
import type { UrbanElevatorSnapshot } from '../world/civilization/UrbanElevatorSystem';

export class GameRenderer {
	readonly scene = new Scene();
	readonly renderer: WebGLRenderer;
	readonly selection = new SelectionOutline();
	readonly placementPreview = new PlacementPreview();
	readonly vegetationSelection = new VegetationSelectionOutline();
	readonly vegetationInteractions = new VegetationInteractionIndex();

	readonly quality: QualitySettings;

	private readonly tallGrass: TallGrassRenderer;
	private readonly groundFoliage: GroundFoliageRenderer;
	private readonly meshFactory = new BlockMeshFactory();
	private readonly fixtures = new WorldFixtureRenderer(this.scene);
	private readonly urbanElevator = new UrbanElevatorRenderer(this.scene);
	private readonly meshesByChunk = new Map<string, BlockInstanceLookup[]>();
	/** Mesh work is intentionally separate from world generation. */
	private readonly pendingChunkRefreshes = new Map<string, ChunkCoordinate>();
	private blockMeshes: BlockInstanceLookup[] = [];
	private lastUrbanLodX = Number.POSITIVE_INFINITY;
	private lastUrbanLodZ = Number.POSITIVE_INFINITY;
	private pendingChunkWorkMs = 0;
	private lastShadowUpdateAt = Number.NEGATIVE_INFINITY;
	private shadowAnchorX = Number.POSITIVE_INFINITY;
	private shadowAnchorZ = Number.POSITIVE_INFINITY;

	get lastPendingChunkWorkMs(): number {
		return this.pendingChunkWorkMs;
	}

	constructor(
		readonly canvas: HTMLCanvasElement,
		quality: RenderQuality = 'medium',
		private readonly vegetationRemovals = new VegetationRemovalState()
	) {
		this.quality = resolveQualitySettings(quality);
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance'
		});

		this.renderer.setPixelRatio(this.quality.pixelRatio);

		// Tone mapping and colour space give the atmospheric sky its dynamic
		// range; exposure is then driven per frame by the environment system.
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1;

		// Shadow casting is toggled by the environment lighting according to the
		// quality profile; configure the type once here.
		this.renderer.shadowMap.enabled = this.quality.shadows;
		this.renderer.shadowMap.type = PCFSoftShadowMap;
		// A camera yaw does not change the light-space contents. Three otherwise
		// redraws the full directional shadow map on every render, which is an
		// especially expensive duplicate pass for a static voxel world.
		this.renderer.shadowMap.autoUpdate = false;
		this.renderer.shadowMap.needsUpdate = this.quality.shadows;
		this.tallGrass = new TallGrassRenderer(
			this.scene,
			this.quality,
			this.vegetationInteractions,
			this.vegetationRemovals
		);
		this.groundFoliage = new GroundFoliageRenderer(
			this.scene,
			this.quality,
			this.vegetationInteractions,
			this.vegetationRemovals
		);

		// Lighting is owned by EnvironmentLighting (dynamic sun/moon), so the
		// renderer no longer adds static lights of its own.
		this.scene.add(
			this.selection.object,
			this.placementPreview.object,
			this.vegetationSelection.object
		);
	}

	get lookups(): BlockInstanceLookup[] {
		return this.blockMeshes;
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
	}

	/**
	 * Full rebuild is reserved for initial startup and rare global changes.
	 */
	rebuildWorld(world: VoxelWorld): void {
		this.clearChunkMeshes();
		this.tallGrass.clear();
		this.groundFoliage.clear();
		this.fixtures.clear();

		for (const chunk of world.getLoadedChunks()) {
			this.replaceChunk(world, chunk);
		}

		this.rebuildLookupCache();
		this.lastUrbanLodX = Number.POSITIVE_INFINITY;
		this.lastUrbanLodZ = Number.POSITIVE_INFINITY;
	}

	/**
	 * Applies streaming changes incrementally.
	 *
	 * Cardinal neighbours are refreshed because loading or unloading a chunk
	 * changes which boundary blocks are exposed.
	 */
	applyStreamingChanges(world: VoxelWorld, changes: ChunkStreamingChanges): void {
		if (!changes.changed) {
			return;
		}

		const unloadedKeys = new Set(changes.unloaded.map((chunk) => chunkKey(chunk)));
		const refresh = new Map<string, ChunkCoordinate>();

		for (const chunk of changes.unloaded) {
			this.removeChunkInternal(chunk);
			this.addNeighbours(refresh, chunk);
		}

		for (const chunk of changes.loaded) {
			refresh.set(chunkKey(chunk), { ...chunk });
			this.addNeighbours(refresh, chunk);
		}

		for (const [key, chunk] of refresh) {
			if (unloadedKeys.has(key) || !world.hasChunk(chunk)) {
				continue;
			}
			this.pendingChunkRefreshes.set(key, { ...chunk });
		}
	}

	/**
	 * Upload at most one chunk mesh per frame. `replaceChunk` includes visible
	 * block discovery, instancing, foliage and fixtures, so checking a clock
	 * after it completes cannot prevent the hitch it caused.
	 */
	processPendingChunkWork(
		world: VoxelWorld,
		timeBudgetMs = 2.5,
		priorityChunk?: ChunkCoordinate
	): boolean {
		const startedAt = performance.now();
		let changed = false;
		const priorityKey = priorityChunk ? chunkKey(priorityChunk) : null;
		const priority = priorityKey ? this.pendingChunkRefreshes.get(priorityKey) : undefined;
		if (priority && priorityKey) {
			this.pendingChunkRefreshes.delete(priorityKey);
			if (world.hasChunk(priority)) {
				this.replaceChunk(world, priority);
				changed = true;
			}
		}
		for (const [key, chunk] of this.pendingChunkRefreshes) {
			if (changed) break;
			this.pendingChunkRefreshes.delete(key);
			if (world.hasChunk(chunk)) {
				this.replaceChunk(world, chunk);
				changed = true;
			}
			// One indivisible mesh build is the upper bound. The budget prevents a
			// second one from being added to the same frame on fast hardware.
			if (performance.now() - startedAt >= timeBudgetMs || changed) break;
		}
		if (changed) {
			this.rebuildLookupCache();
			this.lastUrbanLodX = Number.POSITIVE_INFINITY;
			this.lastUrbanLodZ = Number.POSITIVE_INFINITY;
		}
		this.pendingChunkWorkMs = performance.now() - startedAt;
		return changed;
	}

	/**
	 * Refreshes one edited chunk and its four horizontal neighbours.
	 */
	refreshChunk(world: VoxelWorld, chunk: ChunkCoordinate): void {
		const refresh = new Map<string, ChunkCoordinate>();
		refresh.set(chunkKey(chunk), { ...chunk });
		this.addNeighbours(refresh, chunk);

		for (const candidate of refresh.values()) {
			if (world.hasChunk(candidate)) {
				this.replaceChunk(world, candidate);
			}
		}

		this.rebuildLookupCache();
		this.lastUrbanLodX = Number.POSITIVE_INFINITY;
		this.lastUrbanLodZ = Number.POSITIVE_INFINITY;
	}

	removeChunk(chunk: ChunkCoordinate): void {
		this.removeChunkInternal(chunk);
		this.rebuildLookupCache();
	}

	setSelection(block: BlockCoordinate | null): void {
		this.selection.setTarget(block);
	}

	setPlacementPreview(block: BlockCoordinate | null, allowed = false): void {
		this.placementPreview.setTarget(block, allowed);
	}

	setVegetationSelection(target: VegetationInteractionInstance | null): void {
		this.vegetationSelection.setTarget(target);
	}

	removeVegetation(world: VoxelWorld, instanceId: string): VegetationInteractionInstance | null {
		const instance = this.vegetationInteractions.get(instanceId);

		if (!instance || !this.vegetationRemovals.markRemoved(instanceId)) {
			return null;
		}

		if (instance.layer === 'tall-grass') {
			this.tallGrass.replaceChunk(world, instance.chunk);
		} else {
			this.groundFoliage.replaceChunk(world, instance.chunk);
		}

		this.vegetationSelection.setTarget(null);
		return instance;
	}

	updateSurfaceWeather(
		state: Readonly<Pick<SurfaceWeatherFrameState, 'wetness' | 'snowCoverage' | 'frost'>>
	): void {
		this.meshFactory.updateSurfaceWeather(state);
		this.tallGrass.updateSurfaceWeather(state);
		this.groundFoliage.updateSurfaceWeather(state);
	}

	updateCivilization(
		cameraPosition: Readonly<Vector3>,
		daylight = 0,
		elevator?: UrbanElevatorSnapshot
	): void {
		this.fixtures.update(cameraPosition, daylight);
		if (elevator) this.urbanElevator.update(elevator, cameraPosition);
		this.updateUrbanLod(cameraPosition);
	}

	updateVegetation(
		cameraPosition: Readonly<Vector3>,
		deltaSeconds: number,
		windDirection = 0,
		windStrength = 0
	): void {
		this.meshFactory.updateVegetationWind(deltaSeconds, windDirection, windStrength);
		this.tallGrass.update(cameraPosition, deltaSeconds, windDirection, windStrength);
		this.groundFoliage.update(cameraPosition, deltaSeconds, windDirection, windStrength);
	}

	private updateUrbanLod(cameraPosition: Readonly<Vector3>): void {
		const dx = cameraPosition.x - this.lastUrbanLodX;
		const dz = cameraPosition.z - this.lastUrbanLodZ;
		if (Number.isFinite(this.lastUrbanLodX) && dx * dx + dz * dz < 16) return;
		this.lastUrbanLodX = cameraPosition.x;
		this.lastUrbanLodZ = cameraPosition.z;
		for (const [key, lookups] of this.meshesByChunk) {
			const [x, z] = key.split(',').map(Number);
			const chunk = { x, z };
			for (const lookup of lookups) {
				lookup.mesh.visible = urbanTypeVisible(
					lookup.type,
					chunk,
					cameraPosition.x,
					cameraPosition.z
				);
			}
		}
	}

	render(camera: Camera): void {
		this.renderer.render(this.scene, camera);
	}

	/** Refresh light-space only as the player/light context moves, never for yaw. */
	updateShadowMap(cameraPosition: Readonly<Vector3>): void {
		if (!this.quality.shadows || !this.renderer.shadowMap.enabled) return;
		const now = performance.now();
		const dx = cameraPosition.x - this.shadowAnchorX;
		const dz = cameraPosition.z - this.shadowAnchorZ;
		if (now - this.lastShadowUpdateAt < 250 && dx * dx + dz * dz < 1) return;
		this.lastShadowUpdateAt = now;
		this.shadowAnchorX = cameraPosition.x;
		this.shadowAnchorZ = cameraPosition.z;
		this.renderer.shadowMap.needsUpdate = true;
	}

	dispose(): void {
		this.clearChunkMeshes();
		this.blockMeshes = [];
		this.selection.dispose();
		this.placementPreview.dispose();
		this.vegetationSelection.dispose();
		this.tallGrass.dispose();
		this.groundFoliage.dispose();
		this.fixtures.dispose();
		this.urbanElevator.dispose();
		this.meshFactory.dispose();
		this.renderer.dispose();
	}

	private replaceChunk(world: VoxelWorld, chunk: ChunkCoordinate): void {
		this.removeChunkInternal(chunk);

		const lookups = this.meshFactory.createMeshes(world.getVisibleBlocksInChunk(chunk), world);
		this.tallGrass.replaceChunk(world, chunk);
		this.groundFoliage.replaceChunk(world, chunk);
		this.fixtures.replaceChunk(world, chunk);
		this.meshesByChunk.set(chunkKey(chunk), lookups);

		for (const lookup of lookups) {
			this.scene.add(lookup.mesh);
		}
	}

	private removeChunkInternal(chunk: ChunkCoordinate): void {
		const key = chunkKey(chunk);
		this.pendingChunkRefreshes.delete(key);
		const lookups = this.meshesByChunk.get(key);

		this.tallGrass.removeChunk(chunk);
		this.groundFoliage.removeChunk(chunk);
		this.fixtures.removeChunk(chunk);

		if (!lookups) {
			return;
		}

		for (const lookup of lookups) {
			this.scene.remove(lookup.mesh);
		}

		this.meshesByChunk.delete(key);
	}

	private addNeighbours(target: Map<string, ChunkCoordinate>, chunk: ChunkCoordinate): void {
		const neighbours: ChunkCoordinate[] = [
			{ x: chunk.x + 1, z: chunk.z },
			{ x: chunk.x - 1, z: chunk.z },
			{ x: chunk.x, z: chunk.z + 1 },
			{ x: chunk.x, z: chunk.z - 1 }
		];

		for (const neighbour of neighbours) {
			target.set(chunkKey(neighbour), neighbour);
		}
	}

	private rebuildLookupCache(): void {
		const lookups: BlockInstanceLookup[] = [];

		for (const chunkLookups of this.meshesByChunk.values()) {
			lookups.push(...chunkLookups);
		}

		this.blockMeshes = lookups;
	}

	private clearChunkMeshes(): void {
		for (const lookups of this.meshesByChunk.values()) {
			for (const lookup of lookups) {
				this.scene.remove(lookup.mesh);
			}
		}

		this.meshesByChunk.clear();
		this.pendingChunkRefreshes.clear();
	}
}
