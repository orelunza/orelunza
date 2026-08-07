import type {
	BlockCollisionBox,
	BlockCoordinate,
	BlockDefinition,
	BlockFacing,
	BlockState,
	BlockType,
	VoxelBlock
} from './voxel-types';

const FULL_COLLISION: BlockCollisionBox = {
	minX: 0,
	maxX: 1,
	minY: 0,
	maxY: 1,
	minZ: 0,
	maxZ: 1
};

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
		hardness: 0,
		shape: 'cube'
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
		hardness: 0.45,
		shape: 'grass'
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
		hardness: 0.4,
		shape: 'cube'
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
		hardness: 0.9,
		shape: 'cube'
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
		hardness: 0.35,
		shape: 'cube'
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
		hardness: 0,
		shape: 'cube'
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
		hardness: 0.7,
		shape: 'trunk'
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
		hardness: 0.2,
		shape: 'leaves'
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
		hardness: 0.1,
		shape: 'flower',
		placement: 'floor'
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
		hardness: 0.65,
		shape: 'cube'
	},
	glass: {
		type: 'glass',
		label: 'Glass',
		description: 'A transparent full building block for glass walls.',
		category: 'construction',
		color: 0x9bc7c6,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25,
		shape: 'cube'
	},
	brick: {
		type: 'brick',
		label: 'Brick',
		description: 'A strong masonry block for houses and city structures.',
		category: 'construction',
		color: 0x9f4f3f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.85,
		shape: 'cube'
	},
	concrete: {
		type: 'concrete',
		label: 'Concrete',
		description: 'Clean structural concrete for foundations, towers and modern facades.',
		category: 'construction',
		color: 0xa9aca8,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 1,
		shape: 'cube'
	},
	marble: {
		type: 'marble',
		label: 'Marble',
		description: 'Polished pale stone for civic halls, hotels and detailed interiors.',
		category: 'construction',
		color: 0xe1ded3,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.95,
		shape: 'cube'
	},
	glass_panel: {
		type: 'glass_panel',
		label: 'Glass Panel',
		description: 'A thin framed glass panel for real windows and glazed facades.',
		category: 'construction',
		color: 0x9fd1d6,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25,
		shape: 'glass-panel',
		placement: 'any',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0.04, maxY: 0.96, minZ: 0.45, maxZ: 0.55 }
	},
	wooden_door: {
		type: 'wooden_door',
		label: 'Wooden Door',
		description: 'A full-height interactive wooden door. Press E to open or close it.',
		category: 'utility',
		color: 0x9b6a43,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.65,
		shape: 'door',
		placement: 'floor',
		interaction: 'door',
		orientable: true,
		defaultState: { facing: 'north', open: false },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.42, maxZ: 0.58 }
	},
	stone_slab: {
		type: 'stone_slab',
		label: 'Stone Slab',
		description: 'A half-height stone slab for floors, terraces and architectural detailing.',
		category: 'construction',
		color: 0x858b87,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.85,
		shape: 'slab',
		placement: 'floor',
		collision: { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 }
	},
	stone_stairs: {
		type: 'stone_stairs',
		label: 'Stone Stairs',
		description:
			'Architectural stone steps for houses, public buildings and multi-storey interiors.',
		category: 'construction',
		color: 0x858b87,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.85,
		shape: 'stairs',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	wood_fence: {
		type: 'wood_fence',
		label: 'Wood Fence',
		description: 'A warm wooden post-and-rail fence for gardens and residential plots.',
		category: 'construction',
		color: 0x9a7048,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.55,
		shape: 'wood-fence',
		placement: 'floor',
		collision: { minX: 0.08, maxX: 0.92, minY: 0, maxY: 1, minZ: 0.08, maxZ: 0.92 }
	},
	metal_fence: {
		type: 'metal_fence',
		label: 'Metal Fence',
		description: 'A slim metal fence for city properties, balconies and secure boundaries.',
		category: 'construction',
		color: 0x50565b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 1,
		shape: 'metal-fence',
		placement: 'floor',
		collision: { minX: 0.08, maxX: 0.92, minY: 0, maxY: 1, minZ: 0.08, maxZ: 0.92 }
	},
	brick_fence: {
		type: 'brick_fence',
		label: 'Brick Fence',
		description: 'A low brick boundary wall for courtyards, villas and civic landscaping.',
		category: 'construction',
		color: 0x9f4f3f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.8,
		shape: 'brick-fence',
		placement: 'floor',
		collision: { minX: 0, maxX: 1, minY: 0, maxY: 0.72, minZ: 0.08, maxZ: 0.92 }
	},
	table: {
		type: 'table',
		label: 'Table',
		description: 'A real table-shaped furnishing for homes, restaurants and offices.',
		category: 'decoration',
		color: 0x8f6745,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.45,
		shape: 'table',
		placement: 'floor',
		collision: { minX: 0.05, maxX: 0.95, minY: 0, maxY: 0.78, minZ: 0.05, maxZ: 0.95 }
	},
	bed: {
		type: 'bed',
		label: 'Bed',
		description: 'A furnished bed. Press E to rest when the human can safely sleep.',
		category: 'decoration',
		color: 0xb9b4a7,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.35,
		shape: 'bed',
		placement: 'floor',
		interaction: 'bed',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.42, minZ: 0.04, maxZ: 0.96 }
	},
	mattress: {
		type: 'mattress',
		label: 'Mattress',
		description: 'A low mattress for bedrooms and simple sleeping spaces.',
		category: 'decoration',
		color: 0xd9d1bd,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.2,
		shape: 'mattress',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.24, minZ: 0.04, maxZ: 0.96 }
	},
	curtain: {
		type: 'curtain',
		label: 'Curtain',
		description: 'A wall-mounted curtain that can be opened and closed with E.',
		category: 'decoration',
		color: 0x8d4f58,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.15,
		shape: 'curtain',
		placement: 'wall',
		interaction: 'curtain',
		orientable: true,
		defaultState: { facing: 'north', open: false }
	},
	wardrobe: {
		type: 'wardrobe',
		label: 'Wardrobe',
		description: 'A wardrobe for changing civilian outfits and shoes. Press E to change style.',
		category: 'utility',
		color: 0x7c583d,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.55,
		shape: 'wardrobe',
		placement: 'floor',
		interaction: 'wardrobe',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.18, maxZ: 0.82 }
	},
	clothes_rack: {
		type: 'clothes_rack',
		label: 'Clothes Rack',
		description: 'A lightweight rack for displaying clothes inside homes and shops.',
		category: 'decoration',
		color: 0x6b7074,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25,
		shape: 'clothes-rack',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	shoe_rack: {
		type: 'shoe_rack',
		label: 'Shoe Rack',
		description: 'A compact rack for shoes in homes, changing rooms and shops.',
		category: 'decoration',
		color: 0x80634a,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.35,
		shape: 'shoe-rack',
		placement: 'floor',
		collision: { minX: 0.08, maxX: 0.92, minY: 0, maxY: 0.52, minZ: 0.12, maxZ: 0.88 }
	},
	floor_lamp: {
		type: 'floor_lamp',
		label: 'Floor Lamp',
		description: 'An electric floor lamp. Press E to switch it on or off.',
		category: 'light',
		color: 0xe2c47e,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.2,
		shape: 'floor-lamp',
		placement: 'floor',
		interaction: 'lamp',
		defaultState: { lit: false, powered: true },
		light: { color: 0xffd78b, intensity: 2.1, distance: 8 },
		heatCelsius: 0.3
	},
	fire_pit: {
		type: 'fire_pit',
		label: 'Fire Pit',
		description:
			'A controllable fire source for light, warmth and drying. Press E to ignite or extinguish.',
		category: 'light',
		color: 0x6f5b4a,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.5,
		shape: 'fire-pit',
		placement: 'floor',
		interaction: 'fire',
		defaultState: { lit: false },
		collision: { minX: 0.08, maxX: 0.92, minY: 0, maxY: 0.24, minZ: 0.08, maxZ: 0.92 },
		light: { color: 0xff8c3a, intensity: 2.8, distance: 9 },
		heatCelsius: 8
	}
};

export class BlockRegistry {
	static get(type: BlockType): BlockDefinition {
		return BLOCKS[type];
	}

	static all(): BlockDefinition[] {
		return Object.values(BLOCKS);
	}

	static create(
		type: BlockType,
		position: BlockCoordinate,
		fillLevel?: number,
		state?: BlockState
	): VoxelBlock {
		const definition = this.get(type);
		const normalizedState = this.normalizeState(type, state);
		const openDoor = definition.interaction === 'door' && normalizedState?.open === true;

		return {
			type,
			position,
			solid: openDoor ? false : definition.solid,
			passable: openDoor ? true : definition.passable,
			collectable: definition.collectable,
			transparent: definition.transparent,
			fillLevel:
				type === 'water' && Number.isFinite(fillLevel)
					? Math.max(0.005, Math.min(1, fillLevel as number))
					: undefined,
			state: normalizedState
		};
	}

	static normalizeState(type: BlockType, state?: BlockState | null): BlockState | undefined {
		const definition = this.get(type);
		const source = { ...(definition.defaultState ?? {}), ...(state ?? {}) };
		const result: BlockState = {};

		if (definition.orientable || definition.defaultState?.facing) {
			result.facing = isFacing(source.facing) ? source.facing : 'north';
		}
		if (definition.interaction === 'door' || definition.interaction === 'curtain') {
			result.open = source.open === true;
		}
		if (definition.interaction === 'lamp' || definition.interaction === 'fire') {
			result.lit = source.lit === true;
		}
		if (definition.interaction === 'lamp') {
			result.powered = source.powered !== false;
		}

		return Object.keys(result).length > 0 ? result : undefined;
	}

	static defaultState(type: BlockType): BlockState | undefined {
		return this.normalizeState(type, undefined);
	}

	static isInteractive(type: BlockType): boolean {
		return this.get(type).interaction !== undefined;
	}

	static isLit(block: Pick<VoxelBlock, 'type' | 'state'>): boolean {
		const definition = this.get(block.type);
		if (!definition.light) return false;
		if (definition.interaction === 'lamp') {
			return block.state?.powered !== false && block.state?.lit === true;
		}
		return block.state?.lit === true;
	}

	static collisionBox(
		block: Pick<VoxelBlock, 'type' | 'state' | 'solid' | 'passable'>
	): BlockCollisionBox | null {
		if (!block.solid || block.passable) return null;
		const definition = this.get(block.type);
		const base = definition.collision ?? FULL_COLLISION;
		return rotateCollisionForFacing(base, block.state?.facing);
	}
}

function isFacing(value: unknown): value is BlockFacing {
	return value === 'north' || value === 'east' || value === 'south' || value === 'west';
}

function rotateCollisionForFacing(
	box: BlockCollisionBox,
	facing: BlockFacing | undefined
): BlockCollisionBox {
	if (facing !== 'east' && facing !== 'west') return { ...box };
	return {
		minX: box.minZ,
		maxX: box.maxZ,
		minY: box.minY,
		maxY: box.maxY,
		minZ: box.minX,
		maxZ: box.maxX
	};
}
