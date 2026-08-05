import type { BlockType } from '../world/voxel-types';

export const BUILD_PALETTE_SIZE = 9;
export const BUILD_RECENT_LIMIT = 18;
export const BUILD_WORKSPACE_STORAGE_KEY = 'orelunza.build-workspace.v1';
export const BUILD_WORKSPACE_CHANGE_EVENT = 'orelunza:build-workspace-change';

export interface BuildWorkspaceState {
	palette: Array<BlockType | null>;
	activeSlotIndex: number;
	lastSelectedBlock: BlockType | null;
	favorites: BlockType[];
	recent: BlockType[];
}

export function createBuildWorkspaceState(
	initialPalette: readonly (BlockType | null)[] = [],
	activeSlotIndex = 0,
	lastSelectedBlock: BlockType | null = null
): BuildWorkspaceState {
	const palette = normalizePalette(initialPalette);
	const resolvedIndex = normalizePaletteIndex(activeSlotIndex);
	const selected =
		lastSelectedBlock ?? palette[resolvedIndex] ?? palette.find((type) => type !== null) ?? null;
	let selectedIndex = selected ? palette.indexOf(selected) : resolvedIndex;

	if (selected && selectedIndex < 0) {
		palette[resolvedIndex] = selected;
		selectedIndex = resolvedIndex;
	}

	return {
		palette,
		activeSlotIndex: selectedIndex >= 0 ? selectedIndex : resolvedIndex,
		lastSelectedBlock: selected,
		favorites: [],
		recent: []
	};
}

export function parseBuildWorkspaceState(
	serialized: string | null,
	validTypes: ReadonlySet<BlockType>,
	fallbackPalette: readonly (BlockType | null)[] = []
): BuildWorkspaceState {
	if (!serialized) {
		return createBuildWorkspaceState(fallbackPalette);
	}

	try {
		const parsed: unknown = JSON.parse(serialized);
		return normalizeBuildWorkspaceState(parsed, validTypes, fallbackPalette);
	} catch {
		return createBuildWorkspaceState(fallbackPalette);
	}
}

export function normalizeBuildWorkspaceState(
	value: unknown,
	validTypes: ReadonlySet<BlockType>,
	fallbackPalette: readonly (BlockType | null)[] = []
): BuildWorkspaceState {
	if (!value || typeof value !== 'object') {
		return createBuildWorkspaceState(fallbackPalette);
	}

	const candidate = value as Partial<BuildWorkspaceState>;
	const paletteSource = Array.isArray(candidate.palette) ? candidate.palette : fallbackPalette;
	const favoritesSource = Array.isArray(candidate.favorites) ? candidate.favorites : [];
	const recentSource = Array.isArray(candidate.recent) ? candidate.recent : [];
	const palette = normalizePalette(
		paletteSource.map((type) => (isValidBlockType(type, validTypes) ? type : null))
	);
	const persistedSelection = isValidBlockType(candidate.lastSelectedBlock, validTypes)
		? candidate.lastSelectedBlock
		: null;
	const persistedIndex = normalizePaletteIndex(candidate.activeSlotIndex);
	let selectedIndex = persistedSelection ? palette.indexOf(persistedSelection) : -1;

	if (persistedSelection && selectedIndex < 0) {
		palette[persistedIndex] = persistedSelection;
		selectedIndex = persistedIndex;
	}

	const activeSlotIndex = selectedIndex >= 0 ? selectedIndex : persistedIndex;
	const lastSelectedBlock =
		persistedSelection ?? palette[activeSlotIndex] ?? palette.find((type) => type !== null) ?? null;
	const resolvedActiveIndex = lastSelectedBlock
		? Math.max(0, palette.indexOf(lastSelectedBlock))
		: activeSlotIndex;

	return {
		palette,
		activeSlotIndex: resolvedActiveIndex,
		lastSelectedBlock,
		favorites: uniqueValidTypes(favoritesSource, validTypes),
		recent: uniqueValidTypes(recentSource, validTypes).slice(0, BUILD_RECENT_LIMIT)
	};
}

export function serializeBuildWorkspaceState(state: BuildWorkspaceState): string {
	return JSON.stringify(state);
}

export function loadBuildWorkspaceState(
	validTypes: ReadonlySet<BlockType>,
	fallbackPalette: readonly (BlockType | null)[] = []
): BuildWorkspaceState {
	if (typeof window === 'undefined') {
		return createBuildWorkspaceState(fallbackPalette);
	}

	return parseBuildWorkspaceState(
		window.localStorage.getItem(BUILD_WORKSPACE_STORAGE_KEY),
		validTypes,
		fallbackPalette
	);
}

export function persistBuildWorkspaceState(state: BuildWorkspaceState): void {
	if (typeof window === 'undefined') {
		return;
	}

	const serialized = serializeBuildWorkspaceState(state);

	if (window.localStorage.getItem(BUILD_WORKSPACE_STORAGE_KEY) === serialized) {
		return;
	}

	window.localStorage.setItem(BUILD_WORKSPACE_STORAGE_KEY, serialized);
	window.dispatchEvent(
		new CustomEvent<BuildWorkspaceState>(BUILD_WORKSPACE_CHANGE_EVENT, {
			detail: state
		})
	);
}

export function subscribeBuildWorkspaceState(
	validTypes: ReadonlySet<BlockType>,
	fallbackPalette: readonly (BlockType | null)[],
	listener: (state: BuildWorkspaceState) => void
): () => void {
	if (typeof window === 'undefined') {
		return () => undefined;
	}

	const handleWorkspaceChange = (event: Event): void => {
		const customEvent = event as CustomEvent<unknown>;
		listener(normalizeBuildWorkspaceState(customEvent.detail, validTypes, fallbackPalette));
	};
	const handleStorage = (event: StorageEvent): void => {
		if (event.key !== BUILD_WORKSPACE_STORAGE_KEY) {
			return;
		}

		listener(parseBuildWorkspaceState(event.newValue, validTypes, fallbackPalette));
	};

	window.addEventListener(BUILD_WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
	window.addEventListener('storage', handleStorage);

	return () => {
		window.removeEventListener(BUILD_WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
		window.removeEventListener('storage', handleStorage);
	};
}

export function pinBuildBlock(
	state: BuildWorkspaceState,
	type: BlockType,
	requestedIndex?: number
): BuildWorkspaceState {
	const palette = [...state.palette];
	const existingIndex = palette.indexOf(type);

	if (existingIndex >= 0) {
		palette[existingIndex] = null;
	}

	const targetIndex = resolvePaletteIndex(palette, requestedIndex);
	palette[targetIndex] = type;

	return {
		...state,
		palette,
		activeSlotIndex: targetIndex,
		lastSelectedBlock: type
	};
}

export function selectBuildWorkspaceBlock(
	state: BuildWorkspaceState,
	type: BlockType
): BuildWorkspaceState {
	const existingIndex = state.palette.indexOf(type);

	if (existingIndex >= 0) {
		return {
			...state,
			activeSlotIndex: existingIndex,
			lastSelectedBlock: type
		};
	}

	return pinBuildBlock(state, type, state.activeSlotIndex);
}

export function selectBuildPaletteSlot(
	state: BuildWorkspaceState,
	index: number
): BuildWorkspaceState {
	if (!Number.isInteger(index) || index < 0 || index >= BUILD_PALETTE_SIZE) {
		return state;
	}

	return {
		...state,
		activeSlotIndex: index,
		lastSelectedBlock: state.palette[index] ?? null
	};
}

export function cycleBuildPaletteSlot(
	state: BuildWorkspaceState,
	direction: number
): BuildWorkspaceState {
	const step = direction >= 0 ? 1 : -1;

	for (let offset = 1; offset <= BUILD_PALETTE_SIZE; offset += 1) {
		const index =
			(state.activeSlotIndex + step * offset + BUILD_PALETTE_SIZE * 2) % BUILD_PALETTE_SIZE;

		if (state.palette[index]) {
			return selectBuildPaletteSlot(state, index);
		}
	}

	return state;
}

export function removeBuildPaletteSlot(
	state: BuildWorkspaceState,
	index: number
): BuildWorkspaceState {
	if (!Number.isInteger(index) || index < 0 || index >= BUILD_PALETTE_SIZE) {
		return state;
	}

	const palette = [...state.palette];
	palette[index] = null;

	if (index !== state.activeSlotIndex) {
		return {
			...state,
			palette
		};
	}

	const nextIndex = findNextFilledSlot(palette, index);

	return {
		...state,
		palette,
		activeSlotIndex: nextIndex,
		lastSelectedBlock: palette[nextIndex] ?? null
	};
}

export function toggleBuildFavorite(
	state: BuildWorkspaceState,
	type: BlockType
): BuildWorkspaceState {
	const favorites = state.favorites.includes(type)
		? state.favorites.filter((candidate) => candidate !== type)
		: [...state.favorites, type];

	return {
		...state,
		favorites
	};
}

export function recordRecentBuildBlock(
	state: BuildWorkspaceState,
	type: BlockType
): BuildWorkspaceState {
	return {
		...state,
		recent: [type, ...state.recent.filter((candidate) => candidate !== type)].slice(
			0,
			BUILD_RECENT_LIMIT
		)
	};
}

export function resolveSelectedBuildBlock(state: BuildWorkspaceState): BlockType | null {
	return state.lastSelectedBlock ?? state.palette[state.activeSlotIndex] ?? null;
}

function normalizePalette(values: readonly (BlockType | null)[]): Array<BlockType | null> {
	const palette = values.slice(0, BUILD_PALETTE_SIZE);

	while (palette.length < BUILD_PALETTE_SIZE) {
		palette.push(null);
	}

	return palette;
}

function normalizePaletteIndex(value: unknown): number {
	return Number.isInteger(value) && Number(value) >= 0 && Number(value) < BUILD_PALETTE_SIZE
		? Number(value)
		: 0;
}

function resolvePaletteIndex(
	palette: readonly (BlockType | null)[],
	requestedIndex?: number
): number {
	if (
		Number.isInteger(requestedIndex) &&
		requestedIndex !== undefined &&
		requestedIndex >= 0 &&
		requestedIndex < BUILD_PALETTE_SIZE
	) {
		return requestedIndex;
	}

	const emptyIndex = palette.indexOf(null);
	return emptyIndex >= 0 ? emptyIndex : BUILD_PALETTE_SIZE - 1;
}

function findNextFilledSlot(palette: readonly (BlockType | null)[], fromIndex: number): number {
	for (let offset = 1; offset <= BUILD_PALETTE_SIZE; offset += 1) {
		const index = (fromIndex + offset) % BUILD_PALETTE_SIZE;

		if (palette[index]) {
			return index;
		}
	}

	return fromIndex;
}

function uniqueValidTypes(
	values: readonly unknown[],
	validTypes: ReadonlySet<BlockType>
): BlockType[] {
	const result: BlockType[] = [];

	for (const value of values) {
		if (!isValidBlockType(value, validTypes) || result.includes(value)) {
			continue;
		}

		result.push(value);
	}

	return result;
}

function isValidBlockType(value: unknown, validTypes: ReadonlySet<BlockType>): value is BlockType {
	return typeof value === 'string' && validTypes.has(value as BlockType);
}
