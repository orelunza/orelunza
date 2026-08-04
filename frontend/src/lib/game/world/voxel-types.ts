import type { BuildCategory } from '../build/build-types';

export type BlockType =
	| 'air'
	| 'grass'
	| 'dirt'
	| 'stone'
	| 'sand'
	| 'water'
	| 'wood'
	| 'leaves'
	| 'flower'
	| 'wooden_plank'
	| 'glass'
	| 'brick';

export interface BlockCoordinate {
	x: number;
	y: number;
	z: number;
}

export interface ChunkCoordinate {
	x: number;
	z: number;
}

export interface WorldCoordinate {
	x: number;
	y: number;
	z: number;
}

export interface VoxelBlock {
	type: BlockType;
	position: BlockCoordinate;
	solid: boolean;
	passable: boolean;
	collectable: boolean;
	transparent: boolean;
}

export interface BlockDefinition {
	type: BlockType;
	label: string;
	description: string;
	category: BuildCategory;
	color: number;
	solid: boolean;
	passable: boolean;
	collectable: boolean;
	transparent: boolean;
	placeable: boolean;
	hardness: number;
}

export interface BlockChange {
	type: 'placed' | 'removed';
	block: BlockCoordinate;
	blockType: BlockType;
	updatedAt: number;
}

export const CHUNK_SIZE = 16;
export const WORLD_MIN_Y = 0;
export const WORLD_MAX_Y = 32;
export const WATER_LEVEL = 7;
export const STARTER_WORLD_SEED = 'orelunza-world-v2';
export const WORLD_SPAWN = { x: 0.5, y: 0, z: 0.5 };
export const CENTRAL_CITY_CENTER = { x: 0, z: -82 };

export function blockKey(block: BlockCoordinate): string {
	return `${block.x},${block.y},${block.z}`;
}

export function parseBlockKey(key: string): BlockCoordinate {
	const [x = '0', y = '0', z = '0'] = key.split(',');

	return {
		x: Number.parseInt(x, 10),
		y: Number.parseInt(y, 10),
		z: Number.parseInt(z, 10)
	};
}

export function chunkKey(chunk: ChunkCoordinate): string {
	return `${chunk.x},${chunk.z}`;
}

export function worldToChunk(position: Pick<WorldCoordinate, 'x' | 'z'>): ChunkCoordinate {
	return {
		x: Math.floor(position.x / CHUNK_SIZE),
		z: Math.floor(position.z / CHUNK_SIZE)
	};
}

export function chunkToWorld(chunk: ChunkCoordinate): BlockCoordinate {
	return {
		x: chunk.x * CHUNK_SIZE,
		y: 0,
		z: chunk.z * CHUNK_SIZE
	};
}
