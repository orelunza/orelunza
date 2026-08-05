<script lang="ts">
	import type { BlockType } from '$lib/game/world/voxel-types';
	import {
		buildCatalogEntries,
		buildCategoryOptions,
		filterCatalogEntries,
		type CatalogFilter
	} from '$lib/game/build/build-catalog';
	import BlockGrid from './BlockGrid.svelte';

	interface Props {
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
		onClose: () => void;
	}

	let { selectedBlock, onSelect, onClose }: Props = $props();

	let query = $state('');
	let category = $state<CatalogFilter>('all');
	let columns = $state(9);
	let searchInput = $state<HTMLInputElement | null>(null);

	// Liste générée depuis le registre : stable, calculée une seule fois par
	// montage. Aucun bloc n'est déclaré à la main dans ce composant.
	const allEntries = buildCatalogEntries();
	const categories = buildCategoryOptions(allEntries);

	// Valeur dérivée : le filtrage est recalculé uniquement quand la recherche
	// ou la catégorie change, jamais à chaque frame du jeu.
	let visibleEntries = $derived(filterCatalogEntries(allEntries, category, query));

	function updateColumns(width: number): void {
		if (width < 340) {
			columns = 6;
		} else if (width < 420) {
			columns = 7;
		} else if (width < 480) {
			columns = 8;
		} else {
			columns = 9;
		}
	}

	// Fermeture au clavier (Échap) et focus initial sur la recherche.
	$effect(() => {
		searchInput?.focus();
	});

	function handlePanelKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	// Action Svelte : observe la largeur du conteneur de la grille pour ajuster
	// le nombre de colonnes sans dépendre de media queries globales.
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

<div
	class="catalog"
	role="region"
	aria-label="Available build blocks"
	onkeydown={handlePanelKeydown}
	tabindex="-1"
>
	<header class="header">
		<div class="titles">
			<h2 class="title">Available blocks</h2>
			<span class="count">{visibleEntries.length} blocks</span>
		</div>
		<button type="button" class="close" aria-label="Close build catalog" onclick={onClose}>
			✕
		</button>
	</header>

	<div class="search">
		<input
			bind:this={searchInput}
			bind:value={query}
			type="search"
			class="search-input"
			placeholder="Search blocks"
			aria-label="Search blocks"
			autocomplete="off"
			spellcheck="false"
		/>
	</div>

	<div class="categories" role="tablist" aria-label="Block categories">
		{#each categories as option (option.id)}
			<button
				type="button"
				class="category"
				class:active={category === option.id}
				role="tab"
				aria-selected={category === option.id}
				onclick={() => (category = option.id)}
			>
				{option.label}
			</button>
		{/each}
	</div>

	<div class="grid-scroll" use:columnObserver={updateColumns}>
		<BlockGrid entries={visibleEntries} {selectedBlock} {columns} {onSelect} />
	</div>
</div>

<style>
	.catalog {
		display: flex;
		flex-direction: column;
		width: 100%;
		box-sizing: border-box;
		max-height: 66vh;
		border: 1px solid rgba(249, 115, 22, 0.22);
		border-radius: 0.9rem;
		background: rgba(20, 23, 26, 0.82);
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(14px);
		color: #f4f1ea;
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.85rem 0.55rem;
		border-bottom: 1px solid rgba(244, 241, 234, 0.08);
	}

	.titles {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.count {
		font-size: 0.68rem;
		color: rgba(244, 241, 234, 0.5);
	}

	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 0.4rem;
		background: transparent;
		color: rgba(244, 241, 234, 0.7);
		font-size: 0.78rem;
		cursor: pointer;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}

	.close:hover {
		background: rgba(244, 241, 234, 0.08);
		color: #f4f1ea;
	}

	.close:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.search {
		padding: 0.6rem 0.85rem 0.4rem;
	}

	.search-input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(244, 241, 234, 0.12);
		border-radius: 0.5rem;
		background: rgba(244, 241, 234, 0.04);
		padding: 0.42rem 0.6rem;
		color: #f4f1ea;
		font-size: 0.8rem;
	}

	.search-input::placeholder {
		color: rgba(244, 241, 234, 0.4);
	}

	.search-input:focus-visible {
		outline: none;
		border-color: #f97316;
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.4);
	}

	.categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0.2rem 0.85rem 0.6rem;
	}

	.category {
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 999px;
		background: transparent;
		padding: 0.24rem 0.62rem;
		color: rgba(244, 241, 234, 0.66);
		font-size: 0.7rem;
		cursor: pointer;
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.category:hover {
		color: #f4f1ea;
		border-color: rgba(244, 241, 234, 0.2);
	}

	.category.active {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.16);
		color: #f97316;
	}

	.category:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.grid-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.2rem 0.85rem 0.85rem;
	}

	.grid-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.grid-scroll::-webkit-scrollbar-thumb {
		background: rgba(244, 241, 234, 0.16);
		border-radius: 999px;
	}
</style>
