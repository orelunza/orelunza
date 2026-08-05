import { describe, expect, test } from 'vitest';

import type { BlockType } from '../world/voxel-types';
import {
	BUILD_PALETTE_SIZE,
	createBuildWorkspaceState,
	cycleBuildPaletteSlot,
	normalizeBuildWorkspaceState,
	parseBuildWorkspaceState,
	pinBuildBlock,
	recordRecentBuildBlock,
	removeBuildPaletteSlot,
	resolveSelectedBuildBlock,
	selectBuildPaletteSlot,
	selectBuildWorkspaceBlock,
	toggleBuildFavorite
} from './build-workspace';

const validTypes = new Set<BlockType>(['grass', 'stone', 'brick', 'wood', 'flower']);

describe('build workspace state', () => {
	test('creates a fixed nine-slot palette with a persistent selection', () => {
		const state = createBuildWorkspaceState(['grass', 'stone']);

		expect(state.palette).toHaveLength(BUILD_PALETTE_SIZE);
		expect(state.palette.slice(0, 3)).toEqual(['grass', 'stone', null]);
		expect(state.activeSlotIndex).toBe(0);
		expect(state.lastSelectedBlock).toBe('grass');
	});

	test('pins blocks into explicit slots and makes the target slot active', () => {
		let state = createBuildWorkspaceState(['grass', 'stone']);
		state = pinBuildBlock(state, 'grass', 4);

		expect(state.palette[0]).toBeNull();
		expect(state.palette[4]).toBe('grass');
		expect(state.activeSlotIndex).toBe(4);
		expect(resolveSelectedBuildBlock(state)).toBe('grass');
	});

	test('uses the first empty slot when no slot is requested', () => {
		let state = createBuildWorkspaceState(['grass', null, 'stone']);
		state = pinBuildBlock(state, 'brick');

		expect(state.palette[1]).toBe('brick');
		expect(state.activeSlotIndex).toBe(1);
	});

	test('catalog selection occupies the active slot when the creation is not pinned yet', () => {
		let state = createBuildWorkspaceState(['grass', 'stone'], 1);
		state = selectBuildWorkspaceBlock(state, 'flower');

		expect(state.palette[1]).toBe('flower');
		expect(state.activeSlotIndex).toBe(1);
		expect(state.lastSelectedBlock).toBe('flower');
	});

	test('selects palette slots and cycles only through populated slots', () => {
		let state = createBuildWorkspaceState(['grass', null, 'stone', null, 'wood']);
		state = selectBuildPaletteSlot(state, 2);
		expect(resolveSelectedBuildBlock(state)).toBe('stone');

		state = cycleBuildPaletteSlot(state, 1);
		expect(state.activeSlotIndex).toBe(4);
		expect(resolveSelectedBuildBlock(state)).toBe('wood');

		state = cycleBuildPaletteSlot(state, -1);
		expect(state.activeSlotIndex).toBe(2);
	});

	test('removing the active slot selects the next populated slot', () => {
		let state = createBuildWorkspaceState(['grass', 'stone', 'wood'], 1, 'stone');
		state = removeBuildPaletteSlot(state, 1);

		expect(state.palette[1]).toBeNull();
		expect(state.activeSlotIndex).toBe(2);
		expect(state.lastSelectedBlock).toBe('wood');
	});

	test('toggles favorites deterministically', () => {
		let state = createBuildWorkspaceState();
		state = toggleBuildFavorite(state, 'brick');
		state = toggleBuildFavorite(state, 'wood');
		state = toggleBuildFavorite(state, 'brick');

		expect(state.favorites).toEqual(['wood']);
	});

	test('keeps recent blocks unique and newest first', () => {
		let state = createBuildWorkspaceState();
		state = recordRecentBuildBlock(state, 'stone');
		state = recordRecentBuildBlock(state, 'brick');
		state = recordRecentBuildBlock(state, 'stone');

		expect(state.recent).toEqual(['stone', 'brick']);
	});

	test('sanitizes persisted state and restores the selected slot', () => {
		const state = normalizeBuildWorkspaceState(
			{
				palette: ['grass', 'unknown', 'brick'],
				activeSlotIndex: 2,
				lastSelectedBlock: 'brick',
				favorites: ['stone', 'stone', 'unknown'],
				recent: ['flower', 'unknown', 'wood']
			},
			validTypes
		);

		expect(state.palette.slice(0, 3)).toEqual(['grass', null, 'brick']);
		expect(state.activeSlotIndex).toBe(2);
		expect(state.lastSelectedBlock).toBe('brick');
		expect(state.favorites).toEqual(['stone']);
		expect(state.recent).toEqual(['flower', 'wood']);
	});

	test('migrates the previous workspace shape without losing its palette', () => {
		const state = normalizeBuildWorkspaceState(
			{
				palette: ['grass', 'stone'],
				favorites: [],
				recent: []
			},
			validTypes
		);

		expect(state.activeSlotIndex).toBe(0);
		expect(state.lastSelectedBlock).toBe('grass');
	});

	test('falls back safely when persisted JSON is invalid', () => {
		const state = parseBuildWorkspaceState('{broken', validTypes, ['grass']);

		expect(state.palette[0]).toBe('grass');
		expect(state.lastSelectedBlock).toBe('grass');
		expect(state.favorites).toEqual([]);
	});
});
