import type { BlockType } from '../world/voxel-types';

/** Compact catalogue silhouette for every placeable city/nature block. */
export type BlockIconShape =
	| 'empty'
	| 'grass-block'
	| 'dirt-block'
	| 'stone-rock'
	| 'sand-pile'
	| 'water-tile'
	| 'wood-log'
	| 'leaf-cluster'
	| 'flower-stem'
	| 'wooden-boards'
	| 'glass-pane'
	| 'brick-wall'
	| 'concrete-block'
	| 'marble-block'
	| 'glass-panel'
	| 'wooden-door'
	| 'stone-slab'
	| 'stone-stairs'
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
	| 'fire-pit';

const BLOCK_ICON_SHAPES: Record<BlockType, BlockIconShape> = {
	air: 'empty',
	grass: 'grass-block',
	dirt: 'dirt-block',
	stone: 'stone-rock',
	sand: 'sand-pile',
	water: 'water-tile',
	wood: 'wood-log',
	leaves: 'leaf-cluster',
	flower: 'flower-stem',
	wooden_plank: 'wooden-boards',
	glass: 'glass-pane',
	brick: 'brick-wall',
	concrete: 'concrete-block',
	marble: 'marble-block',
	glass_panel: 'glass-panel',
	wooden_door: 'wooden-door',
	stone_slab: 'stone-slab',
	stone_stairs: 'stone-stairs',
	wood_fence: 'wood-fence',
	metal_fence: 'metal-fence',
	brick_fence: 'brick-fence',
	table: 'table',
	bed: 'bed',
	mattress: 'mattress',
	curtain: 'curtain',
	wardrobe: 'wardrobe',
	clothes_rack: 'clothes-rack',
	shoe_rack: 'shoe-rack',
	floor_lamp: 'floor-lamp',
	fire_pit: 'fire-pit'
};

export function blockIconShape(type: BlockType): BlockIconShape {
	return BLOCK_ICON_SHAPES[type];
}
