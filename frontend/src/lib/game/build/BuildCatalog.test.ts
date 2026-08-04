import { describe, expect, test } from 'vitest';

import { BuildCatalog } from './BuildCatalog';

describe('BuildCatalog', () => {
	test('excludes air and non-placeable blocks', () => {
		const catalog = new BuildCatalog();

		expect(catalog.items.length).toBeGreaterThan(0);
		expect(catalog.items.every((block) => block.type !== 'air')).toBe(true);
		expect(catalog.items.every((block) => block.placeable)).toBe(true);
	});

	test('searches blocks by label, type and description', () => {
		const catalog = new BuildCatalog();

		catalog.setSearchQuery('brick');

		expect(catalog.filteredItems.map((block) => block.type)).toEqual(['brick']);

		catalog.setSearchQuery('window');

		expect(catalog.filteredItems.map((block) => block.type)).toContain('glass');
	});

	test('filters blocks by category', () => {
		const catalog = new BuildCatalog();

		catalog.setCategory('nature');

		expect(catalog.filteredItems.length).toBeGreaterThan(0);
		expect(catalog.filteredItems.every((block) => block.category === 'nature')).toBe(true);
		expect(catalog.filteredItems.map((block) => block.type)).toEqual(
			expect.arrayContaining(['water', 'wood', 'leaves'])
		);
	});

	test('paginates blocks and keeps pages within bounds', () => {
		const catalog = new BuildCatalog(4);

		expect(catalog.currentPage).toBe(0);
		expect(catalog.visibleItems).toHaveLength(4);
		expect(catalog.pageCount).toBeGreaterThan(1);

		catalog.nextPage();

		expect(catalog.currentPage).toBe(1);

		catalog.setPage(999);

		expect(catalog.currentPage).toBe(catalog.pageCount - 1);

		catalog.previousPage();

		expect(catalog.currentPage).toBe(catalog.pageCount - 2);
	});

	test('returns to the first page after search or category changes', () => {
		const catalog = new BuildCatalog(2);

		catalog.nextPage();
		expect(catalog.currentPage).toBe(1);

		catalog.setSearchQuery('stone');
		expect(catalog.currentPage).toBe(0);

		catalog.setPage(1);
		catalog.setCategory('construction');

		expect(catalog.currentPage).toBe(0);
	});

	test('selects only placeable blocks', () => {
		const catalog = new BuildCatalog();

		expect(catalog.selectBlock('brick')).toBe(true);
		expect(catalog.selectedBlockType).toBe('brick');

		expect(catalog.selectBlock('air')).toBe(false);
		expect(catalog.selectedBlockType).toBe('brick');
	});

	test('resets search, category and pagination', () => {
		const catalog = new BuildCatalog(2);

		catalog.setSearchQuery('wood');
		catalog.setCategory('construction');
		catalog.nextPage();
		catalog.reset();

		expect(catalog.searchQuery).toBe('');
		expect(catalog.selectedCategory).toBe('all');
		expect(catalog.currentPage).toBe(0);
	});

	test('rejects invalid page sizes', () => {
		expect(() => new BuildCatalog(0)).toThrow(
			'Build catalog page size must be a positive integer.'
		);
		expect(() => new BuildCatalog(1.5)).toThrow(
			'Build catalog page size must be a positive integer.'
		);
	});
});
