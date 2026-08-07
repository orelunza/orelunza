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
	| 'brick'
	| 'concrete'
	| 'marble'
	| 'glass_panel'
	| 'wooden_door'
	| 'stone_slab'
	| 'stone_stairs'
	| 'wood_fence'
	| 'metal_fence'
	| 'brick_fence'
	| 'table'
	| 'bed'
	| 'mattress'
	| 'curtain'
	| 'wardrobe'
	| 'clothes_rack'
	| 'shoe_rack'
	| 'floor_lamp'
	| 'fire_pit'
	| 'chair'
	| 'sofa'
	| 'kitchen_counter'
	| 'kitchen_cabinet'
	| 'refrigerator'
	| 'sink'
	| 'toilet'
	| 'shower'
	| 'mirror'
	| 'radio'
	| 'bookshelf'
	| 'rug'
	| 'cooking_pot'
	| 'frying_pan'
	| 'plate_stack'
	| 'glass_cup'
	| 'fruit_bowl'
	| 'bread_loaf'
	| 'fresh_fruit'
	| 'rice_meal'
	| 'bottled_water';

export type BlockFacing = 'north' | 'east' | 'south' | 'west';

/** Persistent state carried by player-placed civilization blocks. */
export interface BlockState {
	facing?: BlockFacing;
	open?: boolean;
	lit?: boolean;
	powered?: boolean;
	/** Doors/containers with finite supplies preserve their remaining contents. */
	stock?: number;
	/** Running state for taps, showers and radios. */
	running?: boolean;
}

export type BlockInteractionKind =
	| 'door'
	| 'curtain'
	| 'lamp'
	| 'fire'
	| 'bed'
	| 'wardrobe'
	| 'container'
	| 'water'
	| 'shower'
	| 'toilet'
	| 'radio'
	| 'food';
export type BlockPlacementRule = 'any' | 'floor' | 'wall';
export type BlockRenderShape =
	| 'cube'
	| 'grass'
	| 'trunk'
	| 'leaves'
	| 'flower'
	| 'glass-panel'
	| 'door'
	| 'slab'
	| 'stairs'
	| 'wood-fence'
	| 'metal-fence'
	| 'brick-fence'
	| 'table'
	| 'bed'
	| 'mattress'
	| 'curtain'
	| 'wardrobe'
	| 'clothes-rack'
	| 'shoe-rack'
	| 'floor-lamp'
	| 'fire-pit'
	| 'chair'
	| 'sofa'
	| 'kitchen-counter'
	| 'kitchen-cabinet'
	| 'refrigerator'
	| 'sink'
	| 'toilet'
	| 'shower'
	| 'mirror'
	| 'radio'
	| 'bookshelf'
	| 'rug'
	| 'cooking-pot'
	| 'frying-pan'
	| 'plate-stack'
	| 'glass-cup'
	| 'fruit-bowl';

/** Local AABB in a voxel cell. Values stay in [0, 1]. */
export interface BlockCollisionBox {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

export interface BlockLightDefinition {
	color: number;
	intensity: number;
	distance: number;
}

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
	/** Fractional vertical fill used by the local shallow-water renderer. */
	fillLevel?: number;
	/** Optional persistent state for doors, lamps, fire, curtains and orientation. */
	state?: BlockState;
}

export interface PlacedBlockSaveState {
	position: BlockCoordinate;
	type: BlockType;
	/** Optional so every pre-city save remains valid. */
	state?: BlockState;
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
	shape?: BlockRenderShape;
	placement?: BlockPlacementRule;
	interaction?: BlockInteractionKind;
	orientable?: boolean;
	defaultState?: BlockState;
	collision?: BlockCollisionBox;
	light?: BlockLightDefinition;
	/** Local heat contribution used by the human thermoregulation system. */
	heatCelsius?: number;
	/** Optional item dispensed when an interactive container is opened. */
	providesItem?: BlockType;
	/** Direct nutrition/hydration supplied by edible or water fixtures. */
	nutrition?: number;
	hydration?: number;
}

export interface BlockChange {
	type: 'placed' | 'removed';
	block: BlockCoordinate;
	blockType: BlockType;
	/** State is optional for backward compatibility with every old change log. */
	state?: BlockState;
	updatedAt: number;
}

export const CHUNK_SIZE = 16;
export const WORLD_MIN_Y = 0;
// Sparse voxel storage keeps tall player constructions affordable.
// 512 removes the former two-block wall cap while retaining a finite safety bound.
export const WORLD_MAX_Y = 512;
export const WATER_LEVEL = 7;
export const STARTER_WORLD_SEED = 'orelunza-world-v2';
export const WORLD_SPAWN = { x: 0.5, y: 0, z: 0.5 };
// The native city is intentionally close enough for its first buildings to be
// loaded from the landing meadow. Larger city LODs can extend this visibility
// farther later without moving the canonical city anchor.
export const NATIVE_CITY_PREFERRED_DISTANCE = 31;
export const CENTRAL_CITY_CENTER = { x: 0, z: -NATIVE_CITY_PREFERRED_DISTANCE };

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
