import type { BlockType } from '../world/voxel-types';

/**
 * Silhouette used by the compact creation catalog.
 *
 * Every currently placeable block owns a different shape. Colour alone is not
 * enough at 31 px: the silhouette must communicate what will be selected before
 * the player reads a tooltip.
 */
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
	| 'brick-wall';

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
	brick: 'brick-wall'
};

export function blockIconShape(type: BlockType): BlockIconShape {
	return BLOCK_ICON_SHAPES[type];
}
