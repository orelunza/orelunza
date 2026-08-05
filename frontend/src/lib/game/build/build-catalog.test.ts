import { describe, expect, test } from 'vitest';

import { BlockRegistry } from '../world/BlockRegistry';
import {
	buildCatalogEntries,
	buildCategoryOptions,
	filterCatalogEntries,
	isCatalogBlock,
	normalizeQuery
} from './build-catalog';

describe('build catalog helper', () => {
	test('excludes air from the catalog', () => {
		const entries = buildCatalogEntries();

		expect(entries.some((entry) => entry.type === 'air')).toBe(false);
	});

	test('excludes non-placeable blocks', () => {
		const nonPlaceable = BlockRegistry.all().filter((definition) => !definition.placeable);
		const entries = buildCatalogEntries();

		for (const definition of nonPlaceable) {
			expect(entries.some((entry) => entry.type === definition.type)).toBe(false);
		}

		expect(nonPlaceable.some((definition) => isCatalogBlock(definition))).toBe(false);
	});

	test('includes every placeable, non-air block automatically', () => {
		const expected = BlockRegistry.all()
			.filter((definition) => definition.placeable && definition.type !== 'air')
			.map((definition) => definition.type)
			.sort();

		const actual = buildCatalogEntries()
			.map((entry) => entry.type)
			.sort();

		expect(actual).toEqual(expected);
	});

	test('searches by label', () => {
		const entries = buildCatalogEntries();
		const result = filterCatalogEntries(entries, 'all', 'wooden plank');

		expect(result.some((entry) => entry.type === 'wooden_plank')).toBe(true);
		expect(result.every((entry) => entry.type !== 'stone')).toBe(true);
	});

	test('searches by technical type', () => {
		const entries = buildCatalogEntries();
		const result = filterCatalogEntries(entries, 'all', 'wooden_plank');

		expect(result.map((entry) => entry.type)).toContain('wooden_plank');
	});

	test('searches by category name', () => {
		const entries = buildCatalogEntries();
		const result = filterCatalogEntries(entries, 'all', 'construction');

		expect(result.length).toBeGreaterThan(0);
		expect(result.every((entry) => entry.category === 'construction')).toBe(true);
	});

	test('search is case and whitespace insensitive', () => {
		const entries = buildCatalogEntries();
		const result = filterCatalogEntries(entries, 'all', '   STONE  ');

		expect(result.some((entry) => entry.type === 'stone')).toBe(true);
		expect(normalizeQuery('  Wooden   Plank ')).toBe('wooden plank');
	});

	test('category filter narrows the list', () => {
		const entries = buildCatalogEntries();
		const nature = filterCatalogEntries(entries, 'nature', '');

		expect(nature.length).toBeGreaterThan(0);
		expect(nature.every((entry) => entry.category === 'nature')).toBe(true);
	});

	test('category options only expose categories that contain blocks', () => {
		const entries = buildCatalogEntries();
		const options = buildCategoryOptions(entries);

		expect(options[0]).toEqual({ id: 'all', label: 'All' });

		const present = new Set(entries.map((entry) => entry.category));

		for (const option of options.slice(1)) {
			expect(present.has(option.id as (typeof entries)[number]['category'])).toBe(true);
		}
	});

	test('list is deterministic across calls', () => {
		const first = buildCatalogEntries().map((entry) => entry.type);
		const second = buildCatalogEntries().map((entry) => entry.type);

		expect(first).toEqual(second);
	});

	test('selecting an entry returns the correct BlockType', () => {
		const entries = buildCatalogEntries();
		const target = entries.find((entry) => entry.type === 'brick');

		expect(target).toBeDefined();
		expect(target?.type).toBe('brick');
		expect(BlockRegistry.get(target!.type).placeable).toBe(true);
	});
});
