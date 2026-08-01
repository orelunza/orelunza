import { STARTER_WORLD_SEED } from './voxel-types';
import { VoxelWorld } from './VoxelWorld';

export function createStarterWorld(seed = STARTER_WORLD_SEED): VoxelWorld {
	const world = new VoxelWorld(seed);

	world.ensureChunksAround({ x: 0, z: 0 }, 2);

	return world;
}
