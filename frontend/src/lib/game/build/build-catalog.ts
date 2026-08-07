import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockDefinition, BlockType } from '../world/voxel-types';
import { BUILD_CATEGORY_DESCRIPTORS, type BuildCategory } from './build-types';

export type CreationKind =
	'material' | 'object' | 'vegetation' | 'effect' | 'terrain-tool' | 'blueprint';

export type CreationPlacementMode =
	'voxel' | 'surface' | 'free' | 'wall' | 'ceiling' | 'brush' | 'procedural';

/**
 * Current catalog entry. Blocks are the first creation kind supported by the
 * game, but the metadata already follows the universal creation catalog model
 * so furniture, vegetation, lights and procedural tools can join later without
 * redesigning the dock.
 */
export interface CatalogEntry {
	type: BlockType;
	label: string;
	description: string;
	category: BuildCategory;
	kind: CreationKind;
	placementMode: CreationPlacementMode;
	tags: readonly string[];
	synonyms: readonly string[];
}

export type CatalogSpecialFilter = 'all' | 'owned' | 'favorites' | 'recent';
export type CatalogFilter = CatalogSpecialFilter | BuildCategory;

export interface CatalogCategoryOption {
	id: CatalogFilter;
	label: string;
}

export type CatalogIconId =
	| 'all'
	| 'owned'
	| 'favorites'
	| 'recent'
	| 'terrain'
	| 'nature'
	| 'construction'
	| 'decoration'
	| 'light'
	| 'utility';

export interface CatalogFilterContext {
	owned?: readonly BlockType[];
	favorites?: readonly BlockType[];
	recent?: readonly BlockType[];
}

const CATEGORY_SEARCH_METADATA: Record<BuildCategory, readonly string[]> = {
	terrain: ['ground', 'landscape', 'soil', 'earth', 'path'],
	nature: ['garden', 'plant', 'tree', 'forest', 'water', 'outdoor'],
	construction: ['architecture', 'house', 'wall', 'floor', 'building'],
	decoration: ['decor', 'interior', 'home', 'ornament'],
	light: ['lamp', 'fire', 'illumination', 'glow'],
	utility: ['tool', 'functional', 'mechanism']
};

/** A block appears when it is explicitly placeable and is not air. */
export function isCatalogBlock(definition: BlockDefinition): boolean {
	return definition.placeable && definition.type !== 'air';
}

/** Build the deterministic block-backed portion of the universal catalog. */
export function buildCatalogEntries(): CatalogEntry[] {
	const order = new Map<BuildCategory, number>(
		BUILD_CATEGORY_DESCRIPTORS.map((descriptor, index) => [descriptor.id, index])
	);

	return BlockRegistry.all()
		.filter(isCatalogBlock)
		.map((definition): CatalogEntry => ({
			type: definition.type,
			label: definition.label,
			description: definition.description,
			category: definition.category,
			kind:
				definition.category === 'nature'
					? 'vegetation'
					: definition.category === 'decoration' || definition.category === 'utility'
						? 'object'
						: definition.category === 'light'
							? 'effect'
							: 'material',
			placementMode:
				definition.placement === 'wall'
					? 'wall'
					: definition.placement === 'floor'
						? 'surface'
						: 'voxel',
			tags: CATEGORY_SEARCH_METADATA[definition.category],
			synonyms: buildSynonyms(definition)
		}))
		.sort((a, b) => {
			const categoryDelta =
				(order.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
				(order.get(b.category) ?? Number.MAX_SAFE_INTEGER);

			if (categoryDelta !== 0) {
				return categoryDelta;
			}

			const labelDelta = a.label.localeCompare(b.label);

			if (labelDelta !== 0) {
				return labelDelta;
			}

			return a.type.localeCompare(b.type);
		});
}

/** `All` followed by build categories containing at least one entry. */
export function buildCategoryOptions(entries: CatalogEntry[]): CatalogCategoryOption[] {
	const present = new Set<BuildCategory>(entries.map((entry) => entry.category));
	const options: CatalogCategoryOption[] = [{ id: 'all', label: 'All' }];

	for (const descriptor of BUILD_CATEGORY_DESCRIPTORS) {
		if (present.has(descriptor.id)) {
			options.push({ id: descriptor.id, label: descriptor.label });
		}
	}

	return options;
}

export function catalogFilterLabel(filter: CatalogFilter): string {
	switch (filter) {
		case 'all':
			return 'All creations';
		case 'owned':
			return 'Owned';
		case 'favorites':
			return 'Favorites';
		case 'recent':
			return 'Recent';
		default:
			return (
				BUILD_CATEGORY_DESCRIPTORS.find((descriptor) => descriptor.id === filter)?.label ?? filter
			);
	}
}

export function catalogFilterIcon(filter: CatalogFilter): CatalogIconId {
	return filter;
}

/** Lowercase, trim and collapse whitespace for stable matching. */
export function normalizeQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Filter by special collection or build category, then search across human and
 * technical metadata. Recent results retain their usage order.
 */
export function filterCatalogEntries(
	entries: CatalogEntry[],
	category: CatalogFilter,
	query: string,
	context: CatalogFilterContext = {}
): CatalogEntry[] {
	const normalizedQuery = normalizeQuery(query);
	const owned = new Set(context.owned ?? []);
	const favorites = new Set(context.favorites ?? []);
	const recentOrder = new Map((context.recent ?? []).map((type, index) => [type, index]));

	const filtered = entries.filter((entry) => {
		if (category === 'owned' && !owned.has(entry.type)) {
			return false;
		}

		if (category === 'favorites' && !favorites.has(entry.type)) {
			return false;
		}

		if (category === 'recent' && !recentOrder.has(entry.type)) {
			return false;
		}

		if (
			category !== 'all' &&
			category !== 'owned' &&
			category !== 'favorites' &&
			category !== 'recent' &&
			entry.category !== category
		) {
			return false;
		}

		return matchesQuery(entry, normalizedQuery);
	});

	if (category === 'recent') {
		return filtered.sort(
			(left, right) =>
				(recentOrder.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
				(recentOrder.get(right.type) ?? Number.MAX_SAFE_INTEGER)
		);
	}

	return filtered;
}

function matchesQuery(entry: CatalogEntry, normalizedQuery: string): boolean {
	if (normalizedQuery.length === 0) {
		return true;
	}

	const haystack = [
		entry.label,
		entry.type,
		entry.description,
		entry.category,
		entry.kind,
		entry.placementMode,
		...entry.tags,
		...entry.synonyms
	]
		.join(' ')
		.toLowerCase();

	if (normalizedQuery.includes(' ')) return haystack.includes(normalizedQuery);
	const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(?:^|[^a-z0-9])${escaped}`, 'i').test(haystack);
}

function buildSynonyms(definition: BlockDefinition): readonly string[] {
	switch (definition.type) {
		case 'wooden_plank':
			return ['plank', 'board', 'timber', 'floor'];
		case 'wood':
			return ['trunk', 'log', 'branch', 'tree stem'];
		case 'leaves':
			return ['foliage', 'canopy', 'bush'];
		case 'flower':
			return ['blossom', 'garden flower'];
		case 'grass':
			return ['lawn', 'meadow', 'turf'];
		case 'brick':
			return ['masonry', 'wall'];
		case 'glass':
			return ['window', 'transparent wall'];
		case 'water':
			return ['river', 'pond', 'lake'];
		case 'concrete':
			return ['cement', 'modern wall', 'tower'];
		case 'marble':
			return ['polished stone', 'luxury', 'hotel', 'civic'];
		case 'glass_panel':
			return ['window', 'pane', 'facade', 'glass wall'];
		case 'wooden_door':
			return ['door', 'entrance', 'gate', 'interactive'];
		case 'stone_slab':
			return ['slab', 'half block', 'terrace'];
		case 'stone_stairs':
			return ['stairs', 'steps', 'staircase', 'floor'];
		case 'wood_fence':
		case 'metal_fence':
		case 'brick_fence':
			return ['fence', 'boundary', 'railing', 'garden'];
		case 'table':
			return ['desk', 'dining', 'furniture'];
		case 'bed':
			return ['sleep', 'bedroom', 'furniture'];
		case 'mattress':
			return ['sleep', 'bedroom', 'cushion'];
		case 'curtain':
			return ['curtain', 'drape', 'window covering', 'rideau'];
		case 'wardrobe':
			return ['closet', 'clothes', 'outfit', 'shoes', 'penderie'];
		case 'clothes_rack':
			return ['clothes', 'fashion', 'hanger', 'shop'];
		case 'shoe_rack':
			return ['shoes', 'sneakers', 'boots', 'shop'];
		case 'floor_lamp':
			return ['lamp', 'electric light', 'interior light'];
		case 'fire_pit':
			return ['fire', 'heat', 'warmth', 'campfire'];
		case 'chair':
			return ['seat', 'dining chair', 'office chair', 'furniture'];
		case 'sofa':
			return ['couch', 'seat', 'living room', 'lounge'];
		case 'kitchen_counter':
			return ['countertop', 'kitchen', 'worktop'];
		case 'kitchen_cabinet':
			return ['cabinet', 'cupboard', 'pantry', 'kitchen storage'];
		case 'refrigerator':
			return ['fridge', 'food storage', 'kitchen appliance'];
		case 'sink':
			return ['tap', 'faucet', 'water', 'kitchen'];
		case 'toilet':
			return ['bathroom', 'wc', 'restroom'];
		case 'shower':
			return ['bathroom', 'wash', 'water'];
		case 'mirror':
			return ['bathroom mirror', 'wall mirror', 'reflection'];
		case 'radio':
			return ['music', 'audio', 'speaker', 'broadcast'];
		case 'bookshelf':
			return ['books', 'library', 'shelf', 'bookcase'];
		case 'rug':
			return ['carpet', 'mat', 'floor decor'];
		case 'cooking_pot':
			return ['pot', 'cookware', 'kitchen'];
		case 'frying_pan':
			return ['pan', 'cookware', 'kitchen'];
		case 'plate_stack':
			return ['plates', 'dishes', 'kitchen'];
		case 'glass_cup':
			return ['glass', 'cup', 'drinkware'];
		case 'fruit_bowl':
			return ['fruit', 'food', 'bowl', 'kitchen'];
		default:
			return [];
	}
}
