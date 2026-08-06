import type { BlockCoordinate, ChunkCoordinate } from '../../world/voxel-types';

export interface PlanetSurfaceChunkId extends ChunkCoordinate {
	anchorId: string;
}

export function planetSurfaceChunkKey(chunk: Readonly<PlanetSurfaceChunkId>): string {
	if (!chunk.anchorId || !Number.isInteger(chunk.x) || !Number.isInteger(chunk.z)) {
		throw new RangeError('Invalid planet surface chunk identifier.');
	}
	return `${chunk.anchorId}/chunk/${chunk.x}/${chunk.z}`;
}

export function planetSurfaceBlockKey(anchorId: string, block: Readonly<BlockCoordinate>): string {
	if (!anchorId || ![block.x, block.y, block.z].every(Number.isFinite)) {
		throw new RangeError('Invalid planet surface block identifier.');
	}
	return `${anchorId}/block/${Math.floor(block.x)}/${Math.floor(block.y)}/${Math.floor(block.z)}`;
}
