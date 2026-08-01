import type { BlockCoordinate, BlockType, ChunkCoordinate } from './voxel-types';

export class Chunk {
	readonly blocks = new Map<string, BlockType>();

	constructor(readonly coordinate: ChunkCoordinate) {}

	setBlock(position: BlockCoordinate, type: BlockType): void {
		this.blocks.set(`${position.x},${position.y},${position.z}`, type);
	}
}
