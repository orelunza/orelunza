<script lang="ts">
	import type { CatalogEntry } from '$lib/game/build/build-catalog';
	import { BUILD_CATEGORY_LABELS } from '$lib/game/build/build-types';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BlockIcon from './BlockIcon.svelte';
	import BlockTooltip from './BlockTooltip.svelte';

	interface Props {
		entries: CatalogEntry[];
		selectedBlock: BlockType | null;
		columns: number;
		favorites: readonly BlockType[];
		quantities: ReadonlyMap<BlockType, number>;
		onSelect: (type: BlockType) => void;
		onToggleFavorite: (type: BlockType) => void;
		onPin: (type: BlockType) => void;
	}

	let {
		entries,
		selectedBlock,
		columns,
		favorites,
		quantities,
		onSelect,
		onToggleFavorite,
		onPin
	}: Props = $props();

	let activeIndex = $state(0);
	let hoveredIndex = $state<number | null>(null);
	let cells: HTMLButtonElement[] = $state([]);

	$effect(() => {
		if (activeIndex > entries.length - 1) {
			activeIndex = Math.max(0, entries.length - 1);
		}
	});

	function focusCell(index: number): void {
		const clamped = Math.max(0, Math.min(entries.length - 1, index));
		activeIndex = clamped;
		cells[clamped]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number): void {
		switch (event.key) {
			case 'ArrowRight':
				event.preventDefault();
				focusCell(index + 1);
				break;
			case 'ArrowLeft':
				event.preventDefault();
				focusCell(index - 1);
				break;
			case 'ArrowDown':
				event.preventDefault();
				focusCell(index + columns);
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusCell(index - columns);
				break;
			case 'Home':
				event.preventDefault();
				focusCell(0);
				break;
			case 'End':
				event.preventDefault();
				focusCell(entries.length - 1);
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				onSelect(entries[index].type);
				break;
		}
	}

	function handleDragStart(event: DragEvent, type: BlockType): void {
		if (!event.dataTransfer) {
			return;
		}

		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('application/x-orelunza-block', type);
		event.dataTransfer.setData('text/plain', type);
	}

	let tooltipEntry = $derived(hoveredIndex === null ? null : (entries[hoveredIndex] ?? null));
</script>

<div
	class="grid"
	role="listbox"
	aria-label="Creation catalog"
	aria-orientation="horizontal"
	style="--columns: {columns};"
>
	{#each entries as entry, index (entry.type)}
		{@const selected = entry.type === selectedBlock}
		{@const favorite = favorites.includes(entry.type)}
		{@const quantity = quantities.get(entry.type) ?? 0}
		<div class="cell" class:selected>
			<button
				bind:this={cells[index]}
				type="button"
				class="creation-button"
				role="option"
				aria-selected={selected}
				aria-label={`${entry.label} — ${BUILD_CATEGORY_LABELS[entry.category] ?? entry.category}`}
				tabindex={index === activeIndex ? 0 : -1}
				draggable="true"
				onclick={() => onSelect(entry.type)}
				onkeydown={(event) => handleKeydown(event, index)}
				ondragstart={(event) => handleDragStart(event, entry.type)}
				onfocus={() => {
					activeIndex = index;
					hoveredIndex = index;
				}}
				onmouseenter={() => (hoveredIndex = index)}
				onmouseleave={() => {
					if (hoveredIndex === index) {
						hoveredIndex = null;
					}
				}}
				onblur={() => {
					if (hoveredIndex === index) {
						hoveredIndex = null;
					}
				}}
			>
				<BlockIcon type={entry.type} size={31} />
				{#if quantity > 0}
					<span class="quantity" aria-label={`Quantity ${quantity}`}>{quantity}</span>
				{/if}
			</button>

			<button
				type="button"
				class="cell-action favorite"
				class:active={favorite}
				aria-label={favorite
					? `Remove ${entry.label} from favorites`
					: `Add ${entry.label} to favorites`}
				title={favorite ? 'Remove favorite' : 'Add favorite'}
				onclick={() => onToggleFavorite(entry.type)}
			>
				<span aria-hidden="true">★</span>
			</button>

			<button
				type="button"
				class="cell-action pin"
				aria-label={`Pin ${entry.label} to the active palette`}
				title="Pin to active palette"
				onclick={() => onPin(entry.type)}
			>
				<span aria-hidden="true">+</span>
			</button>

			{#if tooltipEntry === entry}
				<span class="tooltip-anchor">
					<BlockTooltip {entry} />
				</span>
			{/if}
		</div>
	{/each}

	{#if entries.length === 0}
		<p class="empty">Nothing matches this collection yet.</p>
	{/if}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: 0.28rem;
	}

	.cell {
		position: relative;
		aspect-ratio: 1;
		min-height: 40px;
		border: 1px solid rgba(244, 241, 234, 0.075);
		border-radius: 0.42rem;
		background: rgba(244, 241, 234, 0.028);
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			transform 0.12s ease;
	}

	.cell:hover {
		z-index: 4;
		transform: translateY(-1px);
		border-color: rgba(244, 241, 234, 0.18);
		background: rgba(244, 241, 234, 0.07);
	}

	.cell.selected {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.15);
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.46);
	}

	.creation-button {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		border: 0;
		background: transparent;
		cursor: grab;
	}

	.creation-button:active {
		cursor: grabbing;
	}

	.creation-button:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.cell-action {
		position: absolute;
		z-index: 2;
		display: grid;
		width: 0.92rem;
		height: 0.92rem;
		place-items: center;
		border: 0;
		border-radius: 0.25rem;
		background: rgba(20, 23, 26, 0.84);
		color: rgba(244, 241, 234, 0.34);
		font-size: 0.58rem;
		line-height: 1;
		opacity: 0;
		cursor: pointer;
		transition:
			opacity 0.1s ease,
			color 0.1s ease,
			background 0.1s ease;
	}

	.cell:hover .cell-action,
	.cell-action:focus-visible,
	.cell-action.active {
		opacity: 1;
	}

	.cell-action:hover,
	.cell-action:focus-visible {
		background: rgba(249, 115, 22, 0.18);
		color: #fb923c;
		outline: none;
	}

	.favorite {
		top: 0.12rem;
		right: 0.12rem;
	}

	.favorite.active {
		color: #fbbf24;
	}

	.pin {
		right: 0.12rem;
		bottom: 0.12rem;
		font-size: 0.72rem;
	}

	.quantity {
		position: absolute;
		right: 0.18rem;
		bottom: 0.12rem;
		min-width: 0.8rem;
		text-align: right;
		font-size: 0.52rem;
		font-weight: 700;
		color: rgba(244, 241, 234, 0.82);
		text-shadow: 0 1px 2px #000;
		pointer-events: none;
	}

	.cell:hover .quantity {
		display: none;
	}

	.tooltip-anchor {
		position: absolute;
		bottom: calc(100% + 7px);
		left: 50%;
		z-index: 8;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.empty {
		grid-column: 1 / -1;
		margin: 0;
		padding: 2rem 0.5rem;
		text-align: center;
		font-size: 0.7rem;
		color: rgba(244, 241, 234, 0.42);
	}
</style>
