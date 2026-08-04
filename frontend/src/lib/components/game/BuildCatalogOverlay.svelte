<script lang="ts">
	import { onMount } from 'svelte';

	import { BuildCatalog } from '$lib/game/build/BuildCatalog';
	import { BUILD_CATEGORIES, type BuildCategoryFilter } from '$lib/game/build/build-types';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { BlockType } from '$lib/game/world/voxel-types';

	import BuildBlockIcon from './BuildBlockIcon.svelte';

	interface Props {
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
		onClose: () => void;
	}

	let { selectedBlock, onSelect, onClose }: Props = $props();

	const PAGE_SIZE = 40;
	const FILTERS: BuildCategoryFilter[] = ['all', ...BUILD_CATEGORIES];

	const CATEGORY_LABELS: Record<BuildCategoryFilter, string> = {
		all: 'All',
		terrain: 'Terrain',
		nature: 'Nature',
		construction: 'Building',
		decoration: 'Decoration'
	};

	let query = $state('');
	let category = $state<BuildCategoryFilter>('all');
	let page = $state(0);
	let hoveredType = $state<BlockType | null>(null);
	let searchInput: HTMLInputElement | null = null;

	let view = $derived.by(() => {
		const catalog = new BuildCatalog(PAGE_SIZE);

		catalog.setSearchQuery(query);
		catalog.setCategory(category);
		catalog.setPage(page);

		return {
			items: catalog.visibleItems,
			totalItems: catalog.filteredItems.length,
			currentPage: catalog.currentPage,
			pageCount: catalog.pageCount
		};
	});

	let activeType = $derived(hoveredType ?? selectedBlock ?? view.items[0]?.type ?? null);

	let activeDefinition = $derived(activeType ? BlockRegistry.get(activeType) : null);

	function selectCategory(nextCategory: BuildCategoryFilter): void {
		category = nextCategory;
		page = 0;
	}

	function selectBlock(type: BlockType): void {
		onSelect(type);
	}

	function previousPage(): void {
		page = Math.max(0, view.currentPage - 1);
	}

	function nextPage(): void {
		page = Math.min(view.pageCount - 1, view.currentPage + 1);
	}

	onMount(() => {
		requestAnimationFrame(() => {
			searchInput?.focus();
		});
	});
</script>

<div
	class="fixed inset-0 z-[80] grid place-items-center bg-black/68 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-label="Build catalog"
>
	<section
		class="grid h-[min(46rem,calc(100dvh-2rem))] w-[min(76rem,calc(100vw-2rem))] grid-rows-[auto_1fr_auto] overflow-hidden rounded-md border border-white/12 bg-[#1a1e22]/96 text-white shadow-[0_32px_120px_rgba(0,0,0,0.72)]"
	>
		<header class="flex items-center gap-4 border-b border-white/10 px-5 py-4">
			<div class="min-w-0 flex-1">
				<p class="m-0 text-xs font-semibold tracking-[0.18em] text-[#f97316] uppercase">Orelunza</p>
				<h2 class="m-0 mt-1 text-xl font-semibold">Build catalog</h2>
			</div>

			<label class="relative block w-[min(24rem,42vw)]">
				<span class="sr-only">Search blocks</span>

				<input
					bind:this={searchInput}
					value={query}
					type="search"
					placeholder="Search blocks..."
					class="w-full rounded-sm border border-white/12 bg-black/24 px-4 py-2.5 pr-10 text-sm text-white outline-none placeholder:text-white/32 focus:border-[#f97316]"
					oninput={(event) => {
						query = event.currentTarget.value;
						page = 0;
					}}
				/>

				<span
					class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-white/34"
					aria-hidden="true"
				>
					⌕
				</span>
			</label>

			<button
				type="button"
				class="grid size-10 place-items-center rounded-sm border border-white/12 bg-white/5 text-xl text-white/64 transition hover:border-[#f97316]/60 hover:bg-[#f97316]/12 hover:text-white"
				aria-label="Close build catalog"
				onclick={onClose}
			>
				×
			</button>
		</header>

		<div class="grid min-h-0 md:grid-cols-[15rem_1fr]">
			<aside class="hidden min-h-0 border-r border-white/10 bg-black/12 p-5 md:flex md:flex-col">
				<div class="grid min-h-40 place-items-center rounded-md border border-white/10 bg-black/20">
					{#if activeDefinition}
						<BuildBlockIcon
							type={activeDefinition.type}
							size={112}
							selected={activeDefinition.type === selectedBlock}
						/>
					{/if}
				</div>

				{#if activeDefinition}
					<div class="mt-5">
						<p class="m-0 text-xs font-semibold tracking-wider text-[#f97316] uppercase">
							{CATEGORY_LABELS[activeDefinition.category]}
						</p>

						<h3 class="m-0 mt-1 text-lg font-semibold">
							{activeDefinition.label}
						</h3>

						<p class="m-0 mt-2 text-sm leading-6 text-white/54">
							{activeDefinition.description}
						</p>
					</div>
				{/if}

				<div class="mt-auto pt-5 text-xs leading-5 text-white/34">
					<p class="m-0">Click a block to select it.</p>
					<p class="m-0">Press B or Escape to close.</p>
				</div>
			</aside>

			<div class="flex min-h-0 flex-col">
				<nav
					class="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3"
					aria-label="Build categories"
				>
					{#each FILTERS as filter}
						<button
							type="button"
							class={[
								'rounded-sm border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
								category === filter
									? 'border-[#f97316] bg-[#f97316] text-black'
									: 'border-white/10 bg-white/5 text-white/56 hover:border-white/20 hover:bg-white/8 hover:text-white'
							]}
							aria-pressed={category === filter}
							onclick={() => selectCategory(filter)}
						>
							{CATEGORY_LABELS[filter]}
						</button>
					{/each}
				</nav>

				<div class="min-h-0 flex-1 overflow-y-auto p-4">
					{#if view.items.length > 0}
						<div
							class="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2"
							aria-label="Available blocks"
						>
							{#each view.items as block (block.type)}
								<button
									type="button"
									class={[
										'group relative grid min-h-24 place-items-center rounded-sm border p-2 transition',
										selectedBlock === block.type
											? 'border-[#f97316] bg-[#f97316]/14 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.4)]'
											: 'border-white/10 bg-black/18 hover:-translate-y-0.5 hover:border-white/28 hover:bg-white/7'
									]}
									aria-label={`Select ${block.label}`}
									aria-pressed={selectedBlock === block.type}
									onmouseenter={() => {
										hoveredType = block.type;
									}}
									onmouseleave={() => {
										hoveredType = null;
									}}
									onfocus={() => {
										hoveredType = block.type;
									}}
									onclick={() => selectBlock(block.type)}
								>
									<BuildBlockIcon
										type={block.type}
										size={48}
										selected={selectedBlock === block.type}
									/>

									<span
										class="mt-1 max-w-full truncate text-[0.7rem] font-medium text-white/62 group-hover:text-white"
									>
										{block.label}
									</span>

									{#if selectedBlock === block.type}
										<span
											class="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-[#f97316] text-[0.6rem] font-bold text-black"
											aria-hidden="true"
										>
											✓
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{:else}
						<div class="grid h-full min-h-52 place-items-center text-center">
							<div>
								<p class="m-0 text-base font-semibold">No blocks found</p>
								<p class="m-0 mt-1 text-sm text-white/42">Try another search or category.</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<footer
			class="flex min-h-14 items-center justify-between gap-4 border-t border-white/10 px-5 py-3"
		>
			<p class="m-0 text-xs text-white/40">
				{view.totalItems}
				{view.totalItems === 1 ? 'block' : 'blocks'}
			</p>

			<div class="flex items-center gap-3">
				<button
					type="button"
					class="rounded-sm border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/62 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					disabled={view.currentPage <= 0}
					onclick={previousPage}
				>
					Previous
				</button>

				<span class="min-w-20 text-center text-xs text-white/46">
					{view.currentPage + 1} / {view.pageCount}
				</span>

				<button
					type="button"
					class="rounded-sm border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/62 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					disabled={view.currentPage >= view.pageCount - 1}
					onclick={nextPage}
				>
					Next
				</button>
			</div>
		</footer>
	</section>
</div>
