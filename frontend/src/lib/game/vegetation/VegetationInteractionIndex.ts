import type { GroundSpeciesId, VegetationFamily } from './VegetationFamily';
import { CHUNK_SIZE, chunkKey, type ChunkCoordinate } from '../world/voxel-types';

export type VegetationInteractionLayer = 'tall-grass' | 'ground-foliage';

export interface VegetationInteractionInstance {
	instanceId: string;
	layer: VegetationInteractionLayer;
	speciesId: GroundSpeciesId | 'tall_grass';
	label: string;
	family: Exclude<VegetationFamily, 'tree'>;
	chunk: ChunkCoordinate;
	position: { x: number; y: number; z: number };
	halfExtents: { x: number; y: number; z: number };
}

/**
 * Chunked, renderer-independent lookup used by build interaction.
 *
 * The index stores only lightweight bounds. It never raycasts every rendered
 * triangle and never depends on transient InstancedMesh instance indexes.
 */
export class VegetationInteractionIndex {
	private readonly layers = new Map<string, VegetationInteractionInstance[]>();
	private readonly byId = new Map<string, VegetationInteractionInstance>();

	get size(): number {
		return this.byId.size;
	}

	get(instanceId: string): VegetationInteractionInstance | null {
		return this.byId.get(instanceId) ?? null;
	}

	replaceChunk(
		layer: VegetationInteractionLayer,
		chunk: ChunkCoordinate,
		instances: readonly VegetationInteractionInstance[]
	): void {
		const key = layerChunkKey(layer, chunk);
		this.removeLayerKey(key);

		if (instances.length === 0) {
			return;
		}

		const stable = instances.map(cloneInstance);
		this.layers.set(key, stable);

		for (const instance of stable) {
			this.byId.set(instance.instanceId, instance);
		}
	}

	removeChunk(layer: VegetationInteractionLayer, chunk: ChunkCoordinate): void {
		this.removeLayerKey(layerChunkKey(layer, chunk));
	}

	clear(): void {
		this.layers.clear();
		this.byId.clear();
	}

	/** Returns instances from chunks crossed by the ray and their neighbours. */
	candidatesAlongRay(
		origin: Readonly<{ x: number; y: number; z: number }>,
		direction: Readonly<{ x: number; y: number; z: number }>,
		minimumDistance: number,
		maximumDistance: number
	): VegetationInteractionInstance[] {
		const minimum = Math.max(0, finiteOr(minimumDistance, 0));
		const maximum = Math.max(minimum, finiteOr(maximumDistance, minimum));
		const chunkKeys = new Set<string>();
		const step = Math.max(1, CHUNK_SIZE * 0.35);

		for (let distance = minimum; distance <= maximum + step; distance += step) {
			const clampedDistance = Math.min(maximum, distance);
			const x = origin.x + direction.x * clampedDistance;
			const z = origin.z + direction.z * clampedDistance;
			const chunkX = Math.floor(x / CHUNK_SIZE);
			const chunkZ = Math.floor(z / CHUNK_SIZE);

			// Include neighbours because vegetation bounds can straddle a chunk edge.
			for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
				for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
					chunkKeys.add(chunkKey({ x: chunkX + offsetX, z: chunkZ + offsetZ }));
				}
			}

			if (clampedDistance === maximum) {
				break;
			}
		}

		const result: VegetationInteractionInstance[] = [];

		for (const [key, instances] of this.layers) {
			const separator = key.indexOf('|');
			const worldChunkKey = separator >= 0 ? key.slice(separator + 1) : key;

			if (chunkKeys.has(worldChunkKey)) {
				result.push(...instances);
			}
		}

		return result;
	}

	private removeLayerKey(key: string): void {
		const previous = this.layers.get(key);

		if (!previous) {
			return;
		}

		for (const instance of previous) {
			this.byId.delete(instance.instanceId);
		}

		this.layers.delete(key);
	}
}

function layerChunkKey(layer: VegetationInteractionLayer, chunk: ChunkCoordinate): string {
	return `${layer}|${chunkKey(chunk)}`;
}

function cloneInstance(instance: VegetationInteractionInstance): VegetationInteractionInstance {
	return {
		...instance,
		chunk: { ...instance.chunk },
		position: { ...instance.position },
		halfExtents: { ...instance.halfExtents }
	};
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
