import type { BlockDefinition, BlockType, VoxelBlock, BlockCoordinate } from './voxel-types';

const BLOCKS: Record<BlockType, BlockDefinition> = {
	air: {
		type: 'air',
		label: 'Air',
		color: 0x000000,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		hardness: 0
	},
	grass: {
		type: 'grass',
		label: 'Grass',
		color: 0x4f8f4b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.45
	},
	dirt: {
		type: 'dirt',
		label: 'Dirt',
		color: 0x73543b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.4
	},
	stone: {
		type: 'stone',
		label: 'Stone',
		color: 0x7f8782,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.9
	},
	sand: {
		type: 'sand',
		label: 'Sand',
		color: 0xc7b67a,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.35
	},
	water: {
		type: 'water',
		label: 'Water',
		color: 0x4d87a4,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		hardness: 0
	},
	wood: {
		type: 'wood',
		label: 'Wood',
		color: 0x8b643f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.7
	},
	leaves: {
		type: 'leaves',
		label: 'Leaves',
		color: 0x3f7f50,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		hardness: 0.2
	},
	flower: {
		type: 'flower',
		label: 'Flower',
		color: 0xf29f5a,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		hardness: 0.1
	},
	wooden_plank: {
		type: 'wooden_plank',
		label: 'Wooden Plank',
		color: 0xb98556,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		hardness: 0.65
	},
	glass: {
		type: 'glass',
		label: 'Glass',
		color: 0x9bc7c6,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		hardness: 0.25
	},
	brick: {
		type: 'brick',
		label: 'Brick',
		color: 0x9f4f3f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
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
