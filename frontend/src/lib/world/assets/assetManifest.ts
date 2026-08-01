/**
 * Public directory containing the visual assets of the world.
 */
export const WORLD_ASSET_BASE_PATH = '/assets/world';

/**
 * Stable aliases used by the renderer.
 */
export type WorldAssetId =
	| 'citizen.default'
	| 'place.marker'
	| 'place.marker.current'
	| 'place.marker.selected'
	| 'terrain.grass'
	| 'terrain.forest'
	| 'terrain.water'
	| 'object.tree'
	| 'object.rock'
	| 'object.flower'
	| 'ui.shadow';

/**
 * Logical asset groups.
 */
export type WorldAssetBundleId = 'core' | 'terrain' | 'nature';

/**
 * Supported external asset formats.
 */
export type WorldAssetKind = 'texture' | 'spritesheet';

/**
 * Generated fallback shape used when an optional file is not yet present.
 */
export type WorldAssetFallbackShape =
	'circle' | 'rounded-rectangle' | 'diamond' | 'tree' | 'rock' | 'grass' | 'water' | 'shadow';

/**
 * Description of the procedural fallback for an asset.
 */
export interface WorldAssetFallback {
	shape: WorldAssetFallbackShape;

	width: number;
	height: number;

	color: number;
	borderColor?: number;
	borderWidth?: number;

	radius?: number;
	alpha?: number;
}

/**
 * One asset exposed by the Orelunza manifest.
 */
export interface WorldAssetEntry {
	id: WorldAssetId;
	bundle: WorldAssetBundleId;

	src: string;
	kind: WorldAssetKind;

	required: boolean;

	anchor?: {
		x: number;
		y: number;
	};

	fallback: WorldAssetFallback;
}

/**
 * Public representation consumed by an asset loader.
 */
export interface WorldAssetSource {
	alias: WorldAssetId;
	src: string;
}

/**
 * Resolve one file path inside the public world asset directory.
 */
function worldAssetPath(path: string): string {
	const normalizedPath = path.replace(/^\/+/, '');

	return `${WORLD_ASSET_BASE_PATH}/${normalizedPath}`;
}

/**
 * Stable registry of all world assets.
 *
 * The files are optional during the first implementation phase. The renderer
 * can generate the declared fallback when a source image is not available.
 */
export const WORLD_ASSET_MANIFEST = {
	'citizen.default': {
		id: 'citizen.default',
		bundle: 'core',
		src: worldAssetPath('characters/citizen-default.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 0.9
		},
		fallback: {
			shape: 'rounded-rectangle',
			width: 42,
			height: 54,
			color: 0x8fc7a2,
			borderColor: 0xd8efe0,
			borderWidth: 3,
			radius: 14
		}
	},

	'place.marker': {
		id: 'place.marker',
		bundle: 'core',
		src: worldAssetPath('ui/place-marker.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'diamond',
			width: 34,
			height: 42,
			color: 0x91a39a,
			borderColor: 0xf1f6f3,
			borderWidth: 2
		}
	},

	'place.marker.current': {
		id: 'place.marker.current',
		bundle: 'core',
		src: worldAssetPath('ui/place-marker-current.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'diamond',
			width: 38,
			height: 46,
			color: 0x8fc7a2,
			borderColor: 0xf1f6f3,
			borderWidth: 3
		}
	},

	'place.marker.selected': {
		id: 'place.marker.selected',
		bundle: 'core',
		src: worldAssetPath('ui/place-marker-selected.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'diamond',
			width: 40,
			height: 48,
			color: 0xb6dfc1,
			borderColor: 0xffffff,
			borderWidth: 3
		}
	},

	'terrain.grass': {
		id: 'terrain.grass',
		bundle: 'terrain',
		src: worldAssetPath('tiles/grass.png'),
		kind: 'texture',
		required: false,
		fallback: {
			shape: 'grass',
			width: 96,
			height: 96,
			color: 0x203b2c,
			alpha: 1
		}
	},

	'terrain.forest': {
		id: 'terrain.forest',
		bundle: 'terrain',
		src: worldAssetPath('tiles/forest-ground.png'),
		kind: 'texture',
		required: false,
		fallback: {
			shape: 'grass',
			width: 96,
			height: 96,
			color: 0x172b20,
			alpha: 1
		}
	},

	'terrain.water': {
		id: 'terrain.water',
		bundle: 'terrain',
		src: worldAssetPath('tiles/water.png'),
		kind: 'texture',
		required: false,
		fallback: {
			shape: 'water',
			width: 96,
			height: 96,
			color: 0x3d756c,
			alpha: 0.9
		}
	},

	'object.tree': {
		id: 'object.tree',
		bundle: 'nature',
		src: worldAssetPath('objects/tree.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'tree',
			width: 56,
			height: 88,
			color: 0x315f43,
			borderColor: 0x183321,
			borderWidth: 2
		}
	},

	'object.rock': {
		id: 'object.rock',
		bundle: 'nature',
		src: worldAssetPath('objects/rock.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'rock',
			width: 42,
			height: 30,
			color: 0x68776f,
			borderColor: 0x3f4d46,
			borderWidth: 2
		}
	},

	'object.flower': {
		id: 'object.flower',
		bundle: 'nature',
		src: worldAssetPath('objects/flower.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 1
		},
		fallback: {
			shape: 'circle',
			width: 18,
			height: 18,
			color: 0xe5c07b,
			borderColor: 0xf1f6f3,
			borderWidth: 1
		}
	},

	'ui.shadow': {
		id: 'ui.shadow',
		bundle: 'core',
		src: worldAssetPath('ui/entity-shadow.png'),
		kind: 'texture',
		required: false,
		anchor: {
			x: 0.5,
			y: 0.5
		},
		fallback: {
			shape: 'shadow',
			width: 46,
			height: 18,
			color: 0x000000,
			alpha: 0.24
		}
	}
} as const satisfies Record<WorldAssetId, WorldAssetEntry>;

/**
 * Asset IDs grouped by loading bundle.
 */
export const WORLD_ASSET_BUNDLES = {
	core: [
		'citizen.default',
		'place.marker',
		'place.marker.current',
		'place.marker.selected',
		'ui.shadow'
	],

	terrain: ['terrain.grass', 'terrain.forest', 'terrain.water'],

	nature: ['object.tree', 'object.rock', 'object.flower']
} as const satisfies Record<WorldAssetBundleId, readonly WorldAssetId[]>;

/**
 * Return one asset definition.
 */
export function getWorldAsset(id: WorldAssetId): WorldAssetEntry {
	return WORLD_ASSET_MANIFEST[id];
}

/**
 * Return all definitions belonging to one bundle.
 */
export function getWorldAssetBundle(bundleId: WorldAssetBundleId): readonly WorldAssetEntry[] {
	return WORLD_ASSET_BUNDLES[bundleId].map((id) => WORLD_ASSET_MANIFEST[id]);
}

/**
 * Return every asset in stable manifest order.
 */
export function listWorldAssets(): readonly WorldAssetEntry[] {
	return Object.values(WORLD_ASSET_MANIFEST) as WorldAssetEntry[];
}

/**
 * Return a minimal source list suitable for a texture loader.
 */
export function getWorldAssetSources(bundleId?: WorldAssetBundleId): readonly WorldAssetSource[] {
	const entries = bundleId ? getWorldAssetBundle(bundleId) : listWorldAssets();

	return entries.map((entry) => ({
		alias: entry.id,
		src: entry.src
	}));
}

/**
 * Test whether a string is a registered asset identifier.
 */
export function isWorldAssetId(value: string): value is WorldAssetId {
	return Object.prototype.hasOwnProperty.call(WORLD_ASSET_MANIFEST, value);
}
