import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockDefinition, BlockType } from '../world/voxel-types';
import type { BuildCategoryFilter } from './build-types';

const DEFAULT_PAGE_SIZE = 48;

export class BuildCatalog {
	private query = '';
	private category: BuildCategoryFilter = 'all';
	private page = 0;
	private selectedType: BlockType | null = null;

	constructor(private readonly pageSize = DEFAULT_PAGE_SIZE) {
		if (!Number.isInteger(pageSize) || pageSize <= 0) {
			throw new Error('Build catalog page size must be a positive integer.');
		}
	}

	get searchQuery(): string {
		return this.query;
	}

	get selectedCategory(): BuildCategoryFilter {
		return this.category;
	}

	get selectedBlockType(): BlockType | null {
		return this.selectedType;
	}

	get currentPage(): number {
		return this.page;
	}

	get items(): BlockDefinition[] {
		return BlockRegistry.all().filter((block) => block.type !== 'air' && block.placeable);
	}

	get filteredItems(): BlockDefinition[] {
		const normalizedQuery = this.query.trim().toLowerCase();

		return this.items.filter((block) => {
			if (this.category !== 'all' && block.category !== this.category) {
				return false;
			}

			if (!normalizedQuery) {
				return true;
			}

			const searchableText = [block.type, block.label, block.description, block.category]
				.join(' ')
				.toLowerCase();

			return searchableText.includes(normalizedQuery);
		});
	}

	get visibleItems(): BlockDefinition[] {
		const start = this.page * this.pageSize;

		return this.filteredItems.slice(start, start + this.pageSize);
	}

	get pageCount(): number {
		return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
	}

	setSearchQuery(query: string): void {
		this.query = query;
		this.page = 0;
	}

	setCategory(category: BuildCategoryFilter): void {
		this.category = category;
		this.page = 0;
	}

	selectBlock(type: BlockType): boolean {
		const block = BlockRegistry.get(type);

		if (block.type === 'air' || !block.placeable) {
			return false;
		}

		this.selectedType = type;

		return true;
	}

	setPage(page: number): void {
		this.page = Math.max(0, Math.min(this.pageCount - 1, Math.floor(page)));
	}

	nextPage(): void {
		this.setPage(this.page + 1);
	}

	previousPage(): void {
		this.setPage(this.page - 1);
	}

	reset(): void {
		this.query = '';
		this.category = 'all';
		this.page = 0;
	}
}
