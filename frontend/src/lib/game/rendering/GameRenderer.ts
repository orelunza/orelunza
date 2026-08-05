import { Scene, WebGLRenderer, type Camera } from 'three';
import { addWorldLighting } from './Lighting';
import { SelectionOutline } from './SelectionOutline';
import { BlockMeshFactory, type BlockInstanceLookup } from '../world/BlockMeshFactory';
import type { VoxelWorld } from '../world/VoxelWorld';
import { chunkKey, type BlockCoordinate, type ChunkCoordinate } from '../world/voxel-types';
import type { ChunkStreamingChanges } from '../world/ChunkStreamingSystem';

export class GameRenderer {
	readonly scene = new Scene();
	readonly renderer: WebGLRenderer;
	readonly selection = new SelectionOutline();

	private readonly meshFactory = new BlockMeshFactory();
	private readonly meshesByChunk = new Map<string, BlockInstanceLookup[]>();
	private blockMeshes: BlockInstanceLookup[] = [];

	constructor(readonly canvas: HTMLCanvasElement) {
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance'
		});

		this.renderer.setPixelRatio(1);
		this.renderer.shadowMap.enabled = false;

		addWorldLighting(this.scene);
		this.scene.add(this.selection.object);
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

	render(camera: Camera): void {
		this.renderer.render(this.scene, camera);
	}

	dispose(): void {
		this.clearChunkMeshes();
		this.blockMeshes = [];
		this.selection.dispose();
		this.meshFactory.dispose();
		this.renderer.dispose();
	}

	private replaceChunk(world: VoxelWorld, chunk: ChunkCoordinate): void {
		this.removeChunkInternal(chunk);

		const lookups = this.meshFactory.createMeshes(world.getVisibleBlocksInChunk(chunk));
		this.meshesByChunk.set(chunkKey(chunk), lookups);

		for (const lookup of lookups) {
			this.scene.add(lookup.mesh);
		}
	}

	private removeChunkInternal(chunk: ChunkCoordinate): void {
		const key = chunkKey(chunk);
		const lookups = this.meshesByChunk.get(key);

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
