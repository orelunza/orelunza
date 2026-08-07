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
	private readonly meshesByChunk = new Map<string, BlockInstanceLookup[]>();
	private blockMeshes: BlockInstanceLookup[] = [];

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

			this.replaceChunk(world, chunk);
		}

		this.rebuildLookupCache();
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

	updateCivilization(cameraPosition: Readonly<Vector3>, daylight = 0): void {
		this.fixtures.update(cameraPosition, daylight);
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

	render(camera: Camera): void {
		this.renderer.render(this.scene, camera);
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
	}
}
