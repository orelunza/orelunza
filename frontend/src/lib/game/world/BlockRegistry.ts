import type { BlockCoordinate, BlockDefinition, BlockType, VoxelBlock } from './voxel-types';

const BLOCKS: Record<BlockType, BlockDefinition> = {
	air: {
		type: 'air',
		label: 'Air',
		description: 'An empty space.',
		category: 'terrain',
		color: 0x000000,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0
	},
	grass: {
		type: 'grass',
		label: 'Grass',
		description: 'A natural grass block for fields and gardens.',
		category: 'terrain',
		color: 0x73783c,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.45
	},
	dirt: {
		type: 'dirt',
		label: 'Dirt',
		description: 'A basic terrain block for shaping the ground.',
		category: 'terrain',
		color: 0x73543b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.4
	},
	stone: {
		type: 'stone',
		label: 'Stone',
		description: 'A strong natural block for foundations and paths.',
		category: 'terrain',
		color: 0x7f8782,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.9
	},
	sand: {
		type: 'sand',
		label: 'Sand',
		description: 'A light terrain block for beaches and riverbanks.',
		category: 'terrain',
		color: 0xc7b67a,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.35
	},
	water: {
		type: 'water',
		label: 'Water',
		description: 'A transparent water block for rivers and ponds.',
		category: 'nature',
		color: 0x4d87a4,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: true,
		hardness: 0
	},
	wood: {
		type: 'wood',
		label: 'Wood',
		description: 'A natural trunk block for trees and rustic structures.',
		category: 'nature',
		color: 0x8b643f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.7
	},
	leaves: {
		type: 'leaves',
		label: 'Leaves',
		description: 'A soft foliage block for trees, bushes and gardens.',
		category: 'nature',
		color: 0x3e592c,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.2
	},
	flower: {
		type: 'flower',
		label: 'Flower',
		description: 'A small decorative flower for gardens and homes.',
		category: 'decoration',
		color: 0xf29f5a,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.1
	},
	wooden_plank: {
		type: 'wooden_plank',
		label: 'Wooden Plank',
		description: 'A warm building block for floors, walls and furniture.',
		category: 'construction',
		color: 0xb98556,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.65
	},
	glass: {
		type: 'glass',
		label: 'Glass',
		description: 'A transparent building block for windows and walls.',
		category: 'construction',
		color: 0x9bc7c6,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25
	},
	brick: {
		type: 'brick',
		label: 'Brick',
		description: 'A strong building block for houses and city structures.',
		category: 'construction',
		color: 0x9f4f3f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.85
	}
};

export class BlockRegistry {
	static get(type: BlockType): BlockDefinition {
		return BLOCKS[type];
	}

	static all(): BlockDefinition[] {
		return Object.values(BLOCKS);
	}

	static create(type: BlockType, position: BlockCoordinate): VoxelBlock {
		const definition = this.get(type);

		return {
			type,
			position,
			solid: definition.solid,
			passable: definition.passable,
			collectable: definition.collectable,
			transparent: definition.transparent
		};
	}
}
