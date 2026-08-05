<script lang="ts">
	import { onMount } from 'svelte';

	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';
	import {
		buildCatalogEntries,
		buildCategoryOptions,
		catalogFilterIcon,
		catalogFilterLabel,
		filterCatalogEntries,
		type CatalogCategoryOption,
		type CatalogFilter
	} from '$lib/game/build/build-catalog';
	import {
		createBuildWorkspaceState,
		loadBuildWorkspaceState,
		persistBuildWorkspaceState,
		pinBuildBlock,
		recordRecentBuildBlock,
		removeBuildPaletteSlot,
		selectBuildPaletteSlot,
		selectBuildWorkspaceBlock,
		subscribeBuildWorkspaceState,
		toggleBuildFavorite,
		type BuildWorkspaceState
	} from '$lib/game/build/build-workspace';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BlockGrid from './BlockGrid.svelte';
	import BlockIcon from './BlockIcon.svelte';
	import BuildPalette from './BuildPalette.svelte';
	import CatalogCategoryIcon from './CatalogCategoryIcon.svelte';

	interface Props {
		inventory: InventorySnapshot;
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
		onClose: () => void;
	}

	let { inventory, selectedBlock, onSelect, onClose }: Props = $props();

	const allEntries = buildCatalogEntries();
	const validTypes = new Set<BlockType>(allEntries.map((entry) => entry.type));
	const categoryOptions: CatalogCategoryOption[] = [
		{ id: 'all', label: 'All creations' },
		{ id: 'owned', label: 'Owned' },
		{ id: 'favorites', label: 'Favorites' },
		{ id: 'recent', label: 'Recent' },
		...buildCategoryOptions(allEntries).filter((option) => option.id !== 'all')
	];

	let query = $state('');
	let category = $state<CatalogFilter>('all');
	let columns = $state(9);
	let searchInput = $state<HTMLInputElement | null>(null);
	let storageReady = $state(false);
	let workspace = $state<BuildWorkspaceState>(
		createBuildWorkspaceState(inventory.hotbar.map((slot) => slot.stack?.type ?? null))
	);

	let quantities = $derived.by(() => {
		const result = new Map<BlockType, number>();

		for (const slot of inventory.slots) {
			if (!slot.stack) {
				continue;
			}

			result.set(slot.stack.type, (result.get(slot.stack.type) ?? 0) + slot.stack.quantity);
		}

		return result;
	});

	let ownedTypes = $derived([...quantities.keys()]);
	let filterContext = $derived({
		owned: ownedTypes,
		favorites: workspace.favorites,
		recent: workspace.recent
	});
	let visibleEntries = $derived(filterCatalogEntries(allEntries, category, query, filterContext));
	let selectedEntry = $derived(
		selectedBlock ? (allEntries.find((entry) => entry.type === selectedBlock) ?? null) : null
	);
	let categoryCounts = $derived.by(() => {
		const counts = new Map<CatalogFilter, number>();

		for (const option of categoryOptions) {
			counts.set(option.id, filterCatalogEntries(allEntries, option.id, '', filterContext).length);
		}

		return counts;
	});

	onMount(() => {
		const fallback = inventory.hotbar.map((slot) => slot.stack?.type ?? null);
		workspace = loadBuildWorkspaceState(validTypes, fallback);
		storageReady = true;
		searchInput?.focus();

		return subscribeBuildWorkspaceState(validTypes, fallback, (state) => {
			workspace = state;
		});
	});

	$effect(() => {
		if (!storageReady) {
			return;
		}

		persistBuildWorkspaceState(workspace);
	});

	function setWorkspace(next: BuildWorkspaceState): void {
		workspace = next;

		if (storageReady) {
			persistBuildWorkspaceState(next);
		}
	}

	function updateColumns(width: number): void {
		if (width < 340) {
			columns = 6;
		} else if (width < 390) {
			columns = 7;
		} else if (width < 445) {
			columns = 8;
		} else {
			columns = 9;
		}
	}

	function selectBlock(type: BlockType): void {
		setWorkspace(recordRecentBuildBlock(selectBuildWorkspaceBlock(workspace, type), type));
		onSelect(type);
	}

	function selectPaletteBlock(type: BlockType, index: number): void {
		setWorkspace(recordRecentBuildBlock(selectBuildPaletteSlot(workspace, index), type));
		onSelect(type);
	}

	function pinBlock(type: BlockType, index?: number): void {
		setWorkspace(pinBuildBlock(workspace, type, index));
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	function columnObserver(node: HTMLElement, update: (width: number) => void) {
		let callback = update;
		callback(node.clientWidth);

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				callback(entry.contentRect.width);
			}
		});

		observer.observe(node);

		return {
			update(next: (width: number) => void) {
				callback = next;
				callback(node.clientWidth);
			},
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="catalog" aria-label="Orelunza creation catalog">
	<header class="header">
		<div class="titles">
			<span class="eyebrow">Orelunza builder</span>
			<div class="title-row">
				<h2>Create</h2>
				<span class="count">{visibleEntries.length}</span>
			</div>
		</div>
		<button type="button" class="close" aria-label="Close creation catalog" onclick={onClose}>
			✕
		</button>
	</header>

	<div class="workspace">
		<nav class="category-rail" aria-label="Creation categories">
			{#each categoryOptions as option (option.id)}
				<button
					type="button"
					class="category"
					class:active={category === option.id}
					aria-label={catalogFilterLabel(option.id)}
					aria-pressed={category === option.id}
					title={catalogFilterLabel(option.id)}
					onclick={() => (category = option.id)}
				>
					<CatalogCategoryIcon icon={catalogFilterIcon(option.id)} size={17} />
					{#if (categoryCounts.get(option.id) ?? 0) > 0}
						<span class="category-count">{categoryCounts.get(option.id)}</span>
					{/if}
				</button>
			{/each}
		</nav>

		<div class="catalog-main">
			<div class="search-row">
				<div class="search">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="11" cy="11" r="6.5" />
						<path d="m16 16 4 4" />
					</svg>
					<input
						bind:this={searchInput}
						bind:value={query}
						type="search"
						placeholder="Search materials, nature, windows…"
						aria-label="Search creations"
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				<span class="collection-name">{catalogFilterLabel(category)}</span>
			</div>

			<BuildPalette
				palette={workspace.palette}
				activeSlotIndex={workspace.activeSlotIndex}
				{selectedBlock}
				onSelect={selectPaletteBlock}
				onPin={(type, index) => pinBlock(type, index)}
				onRemove={(index) => {
					setWorkspace(removeBuildPaletteSlot(workspace, index));
				}}
			/>

			<div class="catalog-section-heading">
				<div>
					<h3>{catalogFilterLabel(category)}</h3>
					<p>Click to use · star to favorite · plus to pin · drag into the palette</p>
				</div>
				<span>{visibleEntries.length} items</span>
			</div>

			<div class="grid-scroll" use:columnObserver={updateColumns}>
				<BlockGrid
					entries={visibleEntries}
					{selectedBlock}
					{columns}
					favorites={workspace.favorites}
					{quantities}
					onSelect={selectBlock}
					onToggleFavorite={(type) => {
						setWorkspace(toggleBuildFavorite(workspace, type));
					}}
					onPin={(type) => pinBlock(type)}
				/>
			</div>

			<footer class="selection">
				{#if selectedEntry}
					<BlockIcon type={selectedEntry.type} size={31} />
					<div class="selection-copy">
						<strong>{selectedEntry.label}</strong>
						<span>{selectedEntry.description}</span>
					</div>
					<div class="selection-meta">
						<span>{selectedEntry.kind}</span>
						<span>{selectedEntry.placementMode}</span>
					</div>
				{:else}
					<span class="selection-empty">Choose a creation to start building.</span>
				{/if}
			</footer>
		</div>
	</div>
</section>

<style>
	.catalog {
		display: flex;
		width: clamp(440px, 37vw, 560px);
		height: min(760px, calc(100vh - 2rem));
		max-height: calc(100vh - 2rem);
		flex-direction: column;
		box-sizing: border-box;
		border: 1px solid rgba(249, 115, 22, 0.22);
		border-radius: 0.95rem;
		background: rgba(18, 21, 24, 0.92);
		box-shadow: 0 22px 60px rgba(0, 0, 0, 0.56);
		backdrop-filter: blur(16px);
		color: #f4f1ea;
		overflow: hidden;
		pointer-events: auto;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3.75rem;
		padding: 0.68rem 0.78rem 0.62rem 0.9rem;
		border-bottom: 1px solid rgba(244, 241, 234, 0.08);
	}

	.titles {
		display: grid;
		gap: 0.08rem;
	}

	.eyebrow {
		font-size: 0.52rem;
		font-weight: 650;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: #fb923c;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 0.48rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		letter-spacing: 0.015em;
	}

	.count {
		font-size: 0.62rem;
		color: rgba(244, 241, 234, 0.4);
	}

	.close {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 0.42rem;
		background: transparent;
		color: rgba(244, 241, 234, 0.68);
		font-size: 0.72rem;
		cursor: pointer;
	}

	.close:hover {
		border-color: rgba(249, 115, 22, 0.35);
		background: rgba(249, 115, 22, 0.1);
		color: #fb923c;
	}

	.close:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.workspace {
		display: grid;
		grid-template-columns: 3.2rem minmax(0, 1fr);
		min-height: 0;
		flex: 1;
	}

	.category-rail {
		display: flex;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		gap: 0.32rem;
		border-right: 1px solid rgba(244, 241, 234, 0.07);
		padding: 0.55rem 0.38rem;
		background: rgba(0, 0, 0, 0.12);
		overflow-y: auto;
	}

	.category {
		position: relative;
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		flex: none;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: rgba(244, 241, 234, 0.48);
		cursor: pointer;
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.category:hover {
		border-color: rgba(244, 241, 234, 0.1);
		background: rgba(244, 241, 234, 0.055);
		color: rgba(244, 241, 234, 0.9);
	}

	.category.active {
		border-color: rgba(249, 115, 22, 0.42);
		background: rgba(249, 115, 22, 0.15);
		color: #fb923c;
	}

	.category:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.category-count {
		position: absolute;
		right: 0.06rem;
		bottom: 0.02rem;
		min-width: 0.72rem;
		border-radius: 999px;
		background: rgba(10, 12, 14, 0.86);
		padding: 0.04rem 0.14rem;
		font-size: 0.42rem;
		line-height: 1.15;
		color: rgba(244, 241, 234, 0.42);
	}

	.catalog-main {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.62rem 0.72rem 0.52rem;
	}

	.search {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		gap: 0.42rem;
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 0.5rem;
		background: rgba(244, 241, 234, 0.035);
		padding: 0 0.52rem;
	}

	.search:focus-within {
		border-color: rgba(249, 115, 22, 0.58);
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.24);
	}

	.search svg {
		width: 0.82rem;
		height: 0.82rem;
		flex: none;
		fill: none;
		stroke: rgba(244, 241, 234, 0.35);
		stroke-width: 1.8;
	}

	.search input {
		min-width: 0;
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		padding: 0.43rem 0;
		color: #f4f1ea;
		font-size: 0.71rem;
	}

	.search input::placeholder {
		color: rgba(244, 241, 234, 0.34);
	}

	.collection-name {
		max-width: 7rem;
		overflow: hidden;
		font-size: 0.58rem;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: rgba(244, 241, 234, 0.38);
	}

	.catalog-section-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.58rem 0.72rem 0.42rem;
	}

	.catalog-section-heading h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 650;
	}

	.catalog-section-heading p {
		margin: 0.1rem 0 0;
		font-size: 0.53rem;
		color: rgba(244, 241, 234, 0.34);
	}

	.catalog-section-heading > span {
		flex: none;
		font-size: 0.54rem;
		color: rgba(244, 241, 234, 0.35);
	}

	.grid-scroll {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		overflow-x: visible;
		padding: 0.18rem 0.72rem 0.72rem;
	}

	.grid-scroll::-webkit-scrollbar,
	.category-rail::-webkit-scrollbar {
		width: 6px;
	}

	.grid-scroll::-webkit-scrollbar-thumb,
	.category-rail::-webkit-scrollbar-thumb {
		border-radius: 999px;
		background: rgba(244, 241, 234, 0.14);
	}

	.selection {
		display: flex;
		min-height: 3.4rem;
		align-items: center;
		gap: 0.58rem;
		border-top: 1px solid rgba(244, 241, 234, 0.075);
		padding: 0.48rem 0.72rem;
		background: rgba(0, 0, 0, 0.1);
	}

	.selection-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.08rem;
	}

	.selection-copy strong {
		font-size: 0.67rem;
		font-weight: 650;
	}

	.selection-copy span {
		overflow: hidden;
		font-size: 0.54rem;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: rgba(244, 241, 234, 0.4);
	}

	.selection-meta {
		display: grid;
		justify-items: end;
		gap: 0.1rem;
		font-size: 0.48rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(244, 241, 234, 0.33);
	}

	.selection-empty {
		font-size: 0.6rem;
		color: rgba(244, 241, 234, 0.35);
	}

	@media (max-width: 620px) {
		.catalog {
			width: min(100%, 520px);
			height: calc(100vh - 1.2rem);
			max-height: calc(100vh - 1.2rem);
		}

		.collection-name,
		.catalog-section-heading p {
			display: none;
		}
	}
</style>
