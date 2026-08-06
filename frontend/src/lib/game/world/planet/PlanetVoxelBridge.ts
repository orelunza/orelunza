import { Vector3 } from 'three';
import type { BlockCoordinate, BlockType } from '../voxel-types';
import { VoxelWorld } from '../VoxelWorld';
import type { PlanetLocalCoordinateSystem } from '../../planet/surface/PlanetLocalCoordinateSystem';
import { PlanetTerrainEditStore } from './PlanetTerrainEditStore';
import type { PlanetTerrainGenerator } from './PlanetTerrainGenerator';

export class PlanetVoxelBridge {
	readonly world: VoxelWorld;
	readonly edits: PlanetTerrainEditStore;

	constructor(
		readonly coordinates: PlanetLocalCoordinateSystem,
		readonly generator: PlanetTerrainGenerator,
		seed = generator.anchor.id
	) {
		this.world = new VoxelWorld(seed, generator);
		this.edits = new PlanetTerrainEditStore(generator.anchor.id);
	}

	ensureChunksAround(position: Readonly<{ x: number; z: number }>, radius = 2): boolean {
		return this.world.ensureChunksAround(position, radius);
	}

	removeBlock(position: Readonly<BlockCoordinate>): BlockType | null {
		const original = this.world.getBlock(position).type;
		const removed = this.world.removeBlock(position);
		if (removed) {
			this.edits.record(position, original, null);
		}
		return removed;
	}

	placeBlock(position: Readonly<BlockCoordinate>, type: BlockType): boolean {
		const original = this.world.getBlock(position).type;
		const changed = this.world.setBlock(position, type);
		if (changed) {
			this.edits.record(position, original, type);
		}
		return changed;
	}

	blockToGeodetic(position: Readonly<BlockCoordinate>) {
		return this.coordinates.toGeodeticFromLocal(
			new Vector3(
				position.x + 0.5,
				position.y + 0.5 - this.generator.baseSurfaceY,
				position.z + 0.5
			)
		);
	}
}
