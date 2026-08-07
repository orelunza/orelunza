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
		collision: { minX: -0.17, maxX: 1.17, minY: 0, maxY: 0.78, minZ: 0.05, maxZ: 0.95 }
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
		collision: { minX: -0.225, maxX: 1.225, minY: 0, maxY: 0.42, minZ: -0.45, maxZ: 1.45 }
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
		collision: { minX: -0.19, maxX: 1.19, minY: 0, maxY: 0.24, minZ: -0.41, maxZ: 1.41 }
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
		collision: { minX: -0.14, maxX: 1.14, minY: 0, maxY: 1, minZ: 0.19, maxZ: 0.81 }
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
		defaultState: { facing: 'north' },
		collision: { minX: 0.07, maxX: 0.93, minY: 0, maxY: 1, minZ: 0.27, maxZ: 0.73 }
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
		collision: { minX: 0.29, maxX: 0.71, minY: 0, maxY: 1, minZ: 0.29, maxZ: 0.71 },
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
	},
	chair: {
		type: 'chair',
		label: 'Chair',
		description: 'A dining or desk chair for homes, cafés and offices.',
		category: 'decoration',
		color: 0x8b684b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.35,
		shape: 'chair',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.12, maxX: 0.88, minY: 0, maxY: 0.72, minZ: 0.12, maxZ: 0.88 }
	},
	sofa: {
		type: 'sofa',
		label: 'Sofa',
		description: 'A cushioned city sofa for living rooms, lounges and hotel interiors.',
		category: 'decoration',
		color: 0x66727b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.35,
		shape: 'sofa',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: -0.39, maxX: 1.39, minY: 0, maxY: 0.7, minZ: 0.12, maxZ: 0.88 }
	},
	kitchen_counter: {
		type: 'kitchen_counter',
		label: 'Kitchen Counter',
		description: 'A fitted counter for complete kitchens and service areas.',
		category: 'decoration',
		color: 0xb8aa92,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.55,
		shape: 'kitchen-counter',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.02, maxX: 0.98, minY: 0, maxY: 0.92, minZ: 0.05, maxZ: 0.95 }
	},
	kitchen_cabinet: {
		type: 'kitchen_cabinet',
		label: 'Kitchen Cabinet',
		description: 'An opening kitchen cabinet stocked with basic dry food.',
		category: 'utility',
		color: 0x8c6e53,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.5,
		shape: 'kitchen-cabinet',
		placement: 'floor',
		interaction: 'container',
		orientable: true,
		defaultState: { facing: 'north', open: false, stock: 5 },
		providesItem: 'bread_loaf',
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.96, minZ: 0.1, maxZ: 0.9 }
	},
	refrigerator: {
		type: 'refrigerator',
		label: 'Refrigerator',
		description: 'A powered refrigerator that stores fresh food. Open it with E.',
		category: 'utility',
		color: 0xd9dedf,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.65,
		shape: 'refrigerator',
		placement: 'floor',
		interaction: 'container',
		orientable: true,
		defaultState: { facing: 'north', open: false, powered: true, stock: 6 },
		providesItem: 'fresh_fruit',
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.08, maxZ: 0.92 }
	},
	sink: {
		type: 'sink',
		label: 'Kitchen Sink',
		description: 'A working sink with drinkable tap water.',
		category: 'utility',
		color: 0x9da8a9,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.55,
		shape: 'sink',
		placement: 'floor',
		interaction: 'water',
		orientable: true,
		defaultState: { facing: 'north', running: false },
		hydration: 18,
		collision: { minX: 0.05, maxX: 0.95, minY: 0, maxY: 0.88, minZ: 0.08, maxZ: 0.92 }
	},
	toilet: {
		type: 'toilet',
		label: 'Toilet',
		description: 'A ceramic toilet fixture for bathrooms and public facilities.',
		category: 'utility',
		color: 0xe4e4df,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.5,
		shape: 'toilet',
		placement: 'floor',
		interaction: 'toilet',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.12, maxX: 0.88, minY: 0, maxY: 0.75, minZ: 0.1, maxZ: 0.9 }
	},
	shower: {
		type: 'shower',
		label: 'Shower',
		description: 'A working shower fixture that can be switched on and off.',
		category: 'utility',
		color: 0xb8ced2,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.4,
		shape: 'shower',
		placement: 'floor',
		interaction: 'shower',
		orientable: true,
		defaultState: { facing: 'north', running: false }
	},
	mirror: {
		type: 'mirror',
		label: 'Mirror',
		description: 'A thin wall mirror for bathrooms, bedrooms and shops.',
		category: 'decoration',
		color: 0xaec6ca,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25,
		shape: 'mirror',
		placement: 'wall',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	radio: {
		type: 'radio',
		label: 'Radio',
		description: 'A powered tabletop radio with a local procedural broadcast tone.',
		category: 'utility',
		color: 0x4e443c,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.3,
		shape: 'radio',
		placement: 'floor',
		interaction: 'radio',
		orientable: true,
		defaultState: { facing: 'north', powered: true, running: false },
		light: { color: 0xf08a4b, intensity: 0.35, distance: 2.4 }
	},
	bookshelf: {
		type: 'bookshelf',
		label: 'Bookshelf',
		description: 'A tall shelf of books for homes, libraries, offices and shops.',
		category: 'decoration',
		color: 0x765640,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.45,
		shape: 'bookshelf',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.18, maxZ: 0.82 }
	},
	rug: {
		type: 'rug',
		label: 'Rug',
		description: 'A thin interior rug for living rooms, bedrooms and lobbies.',
		category: 'decoration',
		color: 0x8c5145,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.1,
		shape: 'rug',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	cooking_pot: {
		type: 'cooking_pot',
		label: 'Cooking Pot',
		description: 'A small cooking pot for kitchens and restaurants.',
		category: 'decoration',
		color: 0x565b5c,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.2,
		shape: 'cooking-pot',
		placement: 'floor'
	},
	frying_pan: {
		type: 'frying_pan',
		label: 'Frying Pan',
		description: 'A frying pan prop for kitchens and food shops.',
		category: 'decoration',
		color: 0x45494a,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.2,
		shape: 'frying-pan',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	plate_stack: {
		type: 'plate_stack',
		label: 'Plate Stack',
		description: 'A compact stack of plates for kitchens, restaurants and cafés.',
		category: 'decoration',
		color: 0xe1ded4,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.15,
		shape: 'plate-stack',
		placement: 'floor'
	},
	glass_cup: {
		type: 'glass_cup',
		label: 'Glass Cup',
		description: 'A small drinking glass for tables, kitchens and cafés.',
		category: 'decoration',
		color: 0xb6d9dc,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.1,
		shape: 'glass-cup',
		placement: 'floor'
	},
	fruit_bowl: {
		type: 'fruit_bowl',
		label: 'Fruit Bowl',
		description: 'A bowl of fresh fruit that can be eaten with E.',
		category: 'decoration',
		color: 0xb56c3e,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.15,
		shape: 'fruit-bowl',
		placement: 'floor',
		interaction: 'food',
		defaultState: { stock: 5 },
		nutrition: 10
	},
	asphalt: {
		type: 'asphalt',
		label: 'Asphalt',
		description: 'Dark road surfacing for avenues, parking areas and urban streets.',
		category: 'construction',
		color: 0x34383b,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.8,
		shape: 'cube'
	},
	sidewalk: {
		type: 'sidewalk',
		label: 'Sidewalk',
		description: 'Pale urban paving for sidewalks, plazas and pedestrian spaces.',
		category: 'construction',
		color: 0xb7b4ad,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.72,
		shape: 'cube'
	},
	road_marking: {
		type: 'road_marking',
		label: 'Road Marking',
		description: 'A thin road stripe for lanes, crossings and parking bays.',
		category: 'construction',
		color: 0xf0ead6,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.08,
		shape: 'road-marking',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	glass_door: {
		type: 'glass_door',
		label: 'Glass Door',
		description: 'A modern transparent shop entrance that opens automatically as you approach.',
		category: 'construction',
		color: 0x92bbc1,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.38,
		shape: 'glass-door',
		placement: 'floor',
		interaction: 'door',
		orientable: true,
		defaultState: { facing: 'north', open: false },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.42, maxZ: 0.58 }
	},
	street_lamp: {
		type: 'street_lamp',
		label: 'Street Lamp',
		description: 'A tall powered street light for roads, parks and public plazas.',
		category: 'light',
		color: 0x51575a,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.55,
		shape: 'street-lamp',
		placement: 'floor',
		interaction: 'lamp',
		defaultState: { lit: true, powered: true },
		collision: { minX: 0.31, maxX: 0.69, minY: 0, maxY: 1, minZ: 0.31, maxZ: 0.69 },
		light: { color: 0xffd9a0, intensity: 2.45, distance: 11 }
	},
	bench: {
		type: 'bench',
		label: 'Public Bench',
		description: 'A durable bench for streets, parks, plazas and pool decks.',
		category: 'decoration',
		color: 0x806046,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.5,
		shape: 'bench',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.62, minZ: 0.16, maxZ: 0.84 }
	},
	trash_bin: {
		type: 'trash_bin',
		label: 'Trash Bin',
		description: 'A compact public waste bin for sidewalks and public spaces.',
		category: 'utility',
		color: 0x4d5752,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.45,
		shape: 'trash-bin',
		placement: 'floor',
		collision: { minX: 0.18, maxX: 0.82, minY: 0, maxY: 0.78, minZ: 0.18, maxZ: 0.82 }
	},
	bollard: {
		type: 'bollard',
		label: 'Bollard',
		description: 'A short protective street post for pedestrian areas and storefronts.',
		category: 'construction',
		color: 0x555b5d,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.75,
		shape: 'bollard',
		placement: 'floor',
		collision: { minX: 0.3, maxX: 0.7, minY: 0, maxY: 0.82, minZ: 0.3, maxZ: 0.7 }
	},
	bus_shelter: {
		type: 'bus_shelter',
		label: 'Bus Shelter',
		description: 'A glass-and-metal roadside shelter for future public transport stops.',
		category: 'construction',
		color: 0x789398,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.55,
		shape: 'bus-shelter',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	store_shelf: {
		type: 'store_shelf',
		label: 'Store Shelf',
		description: 'A stocked supermarket shelf. Open it with E to take a basic grocery item.',
		category: 'utility',
		color: 0x8a8175,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.45,
		shape: 'store-shelf',
		placement: 'floor',
		interaction: 'container',
		orientable: true,
		defaultState: { facing: 'north', open: false, stock: 8 },
		providesItem: 'rice_meal',
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.18, maxZ: 0.82 }
	},
	produce_crate: {
		type: 'produce_crate',
		label: 'Produce Crate',
		description: 'A market crate stocked with fresh fruit.',
		category: 'utility',
		color: 0x8d6745,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.3,
		shape: 'produce-crate',
		placement: 'floor',
		interaction: 'container',
		defaultState: { open: false, stock: 10 },
		providesItem: 'fresh_fruit',
		collision: { minX: 0.06, maxX: 0.94, minY: 0, maxY: 0.55, minZ: 0.06, maxZ: 0.94 }
	},
	drink_cooler: {
		type: 'drink_cooler',
		label: 'Drink Cooler',
		description: 'A glass-fronted cooler stocked with bottled water.',
		category: 'utility',
		color: 0x8fb2b8,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.5,
		shape: 'drink-cooler',
		placement: 'floor',
		interaction: 'container',
		orientable: true,
		defaultState: { facing: 'north', open: false, powered: true, stock: 8 },
		providesItem: 'bottled_water',
		collision: { minX: 0.05, maxX: 0.95, minY: 0, maxY: 1, minZ: 0.12, maxZ: 0.88 }
	},
	checkout_counter: {
		type: 'checkout_counter',
		label: 'Checkout Counter',
		description: 'A supermarket checkout counter and register. Economic transactions come later.',
		category: 'utility',
		color: 0x6d7376,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.55,
		shape: 'checkout-counter',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.03, maxX: 0.97, minY: 0, maxY: 0.86, minZ: 0.08, maxZ: 0.92 }
	},
	shopping_cart: {
		type: 'shopping_cart',
		label: 'Shopping Cart',
		description: 'A lightweight supermarket trolley for commercial interiors.',
		category: 'decoration',
		color: 0x70797b,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.25,
		shape: 'shopping-cart',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.08, maxX: 0.92, minY: 0, maxY: 0.8, minZ: 0.2, maxZ: 0.8 }
	},
	store_sign: {
		type: 'store_sign',
		label: 'Store Sign',
		description: 'A projecting urban sign for shops, supermarkets and public buildings.',
		category: 'decoration',
		color: 0xd77a42,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.22,
		shape: 'store-sign',
		placement: 'wall',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	pool_tile: {
		type: 'pool_tile',
		label: 'Pool Tile',
		description: 'Water-resistant ceramic tile for pools, showers and public leisure areas.',
		category: 'construction',
		color: 0xc7e0df,
		solid: true,
		passable: false,
		collectable: true,
		transparent: false,
		placeable: true,
		hardness: 0.7,
		shape: 'cube'
	},
	pool_ladder: {
		type: 'pool_ladder',
		label: 'Pool Ladder',
		description: 'A stainless pool ladder for public and private swimming areas.',
		category: 'utility',
		color: 0xb9c4c5,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.5,
		shape: 'pool-ladder',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' }
	},
	changing_bench: {
		type: 'changing_bench',
		label: 'Changing Bench',
		description: 'A simple changing-room bench for pools, gyms and public facilities.',
		category: 'decoration',
		color: 0x92704f,
		solid: true,
		passable: false,
		collectable: true,
		transparent: true,
		placeable: true,
		hardness: 0.42,
		shape: 'bench',
		placement: 'floor',
		orientable: true,
		defaultState: { facing: 'north' },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 0.58, minZ: 0.16, maxZ: 0.84 }
	},
	bread_loaf: {
		type: 'bread_loaf',
		label: 'Bread',
		description: 'A simple edible bread item.',
		category: 'utility',
		color: 0xb9824f,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0,
		nutrition: 14
	},
	fresh_fruit: {
		type: 'fresh_fruit',
		label: 'Fresh Fruit',
		description: 'Fresh fruit from a refrigerator or market.',
		category: 'utility',
		color: 0xc95e45,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0,
		nutrition: 11,
		hydration: 3
	},
	rice_meal: {
		type: 'rice_meal',
		label: 'Rice Meal',
		description: 'A prepared bowl of rice for a substantial meal.',
		category: 'utility',
		color: 0xe1d8b4,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0,
		nutrition: 22
	},

	ceiling_light: {
		type: 'ceiling_light',
		label: 'Ceiling Light',
		description: 'A compact powered ceiling fixture used throughout multi-storey buildings.',
		category: 'light',
		color: 0xe8ddb6,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0.1,
		shape: 'ceiling-light',
		interaction: 'lamp',
		defaultState: { lit: true, powered: true },
		light: { color: 0xffe7ba, intensity: 1.75, distance: 7 }
	},
	elevator_door: {
		type: 'elevator_door',
		label: 'Elevator Door',
		description: 'A powered sliding landing door controlled by the elevator safety system.',
		category: 'utility',
		color: 0x7c858b,
		solid: true,
		passable: false,
		collectable: false,
		transparent: false,
		placeable: false,
		hardness: 1.2,
		shape: 'elevator-door',
		interaction: 'elevator-door',
		orientable: true,
		defaultState: { facing: 'north', open: false, powered: true },
		collision: { minX: 0.04, maxX: 0.96, minY: 0, maxY: 1, minZ: 0.43, maxZ: 0.57 }
	},
	elevator_call_button: {
		type: 'elevator_call_button',
		label: 'Elevator Call Button',
		description: 'Calls the building elevator to this landing.',
		category: 'utility',
		color: 0x5e666c,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: false,
		hardness: 0.2,
		shape: 'elevator-button',
		interaction: 'elevator-call',
		orientable: true,
		defaultState: { facing: 'north', powered: true }
	},
	elevator_panel: {
		type: 'elevator_panel',
		label: 'Elevator Floor Panel',
		description: 'Opens the elevator floor selector while the cabin is at the landing.',
		category: 'utility',
		color: 0x373e43,
		solid: false,
		passable: true,
		collectable: true,
		transparent: true,
		placeable: false,
		hardness: 0.2,
		shape: 'elevator-panel',
		interaction: 'elevator-panel',
		orientable: true,
		defaultState: { facing: 'south', powered: true }
	},
	power_panel: {
		type: 'power_panel',
		label: 'Building Power Panel',
		description: 'Controls the simple electrical service for one native-city building.',
		category: 'utility',
		color: 0x4d5559,
		solid: true,
		passable: false,
		collectable: false,
		transparent: false,
		placeable: false,
		hardness: 1,
		shape: 'power-panel',
		interaction: 'power',
		orientable: true,
		defaultState: { facing: 'north', powered: true },
		collision: { minX: 0.12, maxX: 0.88, minY: 0, maxY: 1, minZ: 0.32, maxZ: 0.68 }
	},
	elevator_platform: {
		type: 'elevator_platform',
		label: 'Elevator Platform',
		description: 'Internal runtime collision platform for a moving elevator cabin.',
		category: 'utility',
		color: 0x4f565a,
		solid: true,
		passable: false,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 999,
		shape: 'slab',
		collision: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
	},
	bottled_water: {
		type: 'bottled_water',
		label: 'Bottled Water',
		description: 'Clean drinking water carried in the inventory.',
		category: 'utility',
		color: 0x6aaec8,
		solid: false,
		passable: true,
		collectable: false,
		transparent: true,
		placeable: false,
		hardness: 0,
		hydration: 24
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
		const openDoor =
			(definition.interaction === 'door' || definition.interaction === 'elevator-door') &&
			normalizedState?.open === true;

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
		if (
			definition.interaction === 'door' ||
			definition.interaction === 'curtain' ||
			definition.interaction === 'container' ||
			definition.interaction === 'elevator-door'
		) {
			result.open = source.open === true;
		}
		if (definition.interaction === 'lamp' || definition.interaction === 'fire') {
			result.lit = source.lit === true;
		}
		if (
			definition.interaction === 'lamp' ||
			definition.interaction === 'radio' ||
			type === 'refrigerator' ||
			type === 'drink_cooler' ||
			type === 'glass_door' ||
			type === 'elevator_door' ||
			type === 'elevator_call_button' ||
			type === 'elevator_panel' ||
			type === 'power_panel'
		) {
			result.powered = source.powered !== false;
		}
		if (
			definition.interaction === 'water' ||
			definition.interaction === 'shower' ||
			definition.interaction === 'radio'
		) {
			result.running = source.running === true;
		}
		if (definition.interaction === 'container' || definition.interaction === 'food') {
			const fallback = definition.defaultState?.stock ?? 0;
			result.stock = Math.max(
				0,
				Math.floor(Number.isFinite(source.stock) ? (source.stock as number) : fallback)
			);
		}
		if (type === 'elevator_panel') {
			if (Number.isFinite(source.floor))
				result.floor = Math.max(1, Math.floor(source.floor as number));
			if (Number.isFinite(source.targetFloor))
				result.targetFloor = Math.max(1, Math.floor(source.targetFloor as number));
			result.moving = source.moving === true;
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
		if (definition.interaction === 'radio') {
			return block.state?.powered !== false && block.state?.running === true;
		}
		return block.state?.lit === true;
	}

	static collisionBox(
		block: Pick<VoxelBlock, 'type' | 'state' | 'solid' | 'passable'>
	): BlockCollisionBox | null {
		const definition = this.get(block.type);
		if (
			(definition.interaction === 'door' || definition.interaction === 'elevator-door') &&
			block.state?.open === true
		)
			return null;
		// Explicit fixture collision is independent from voxel solidity. This lets
		// narrow props such as lamps and clothes racks block the human without
		// turning their whole voxel into a roof/rain occluder or terrain surface.
		if (!definition.collision && (!block.solid || block.passable)) return null;
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
