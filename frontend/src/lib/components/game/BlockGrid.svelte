<script lang="ts">
	import type { BlockType } from '$lib/game/world/voxel-types';
	import type { CatalogEntry } from '$lib/game/build/build-catalog';
	import { BUILD_CATEGORY_LABELS } from '$lib/game/build/build-types';
	import BlockIcon from './BlockIcon.svelte';
	import BlockTooltip from './BlockTooltip.svelte';

	interface Props {
		entries: CatalogEntry[];
		selectedBlock: BlockType | null;
		columns: number;
		onSelect: (type: BlockType) => void;
	}

	let { entries, selectedBlock, columns, onSelect }: Props = $props();

	// Index de la case focusable (roving tabindex). Une seule case est dans
	// l'ordre de tabulation ; les flèches déplacent le focus.
	let activeIndex = $state(0);
	let hoveredIndex = $state<number | null>(null);
	let cells: HTMLButtonElement[] = $state([]);

	// Garde l'index actif dans les bornes quand la liste filtrée change.
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

	let tooltipEntry = $derived(hoveredIndex === null ? null : (entries[hoveredIndex] ?? null));
</script>

<div
	class="grid"
	role="listbox"
	aria-label="Available blocks"
	aria-orientation="horizontal"
	style="--columns: {columns};"
>
	{#each entries as entry, index (entry.type)}
		{@const selected = entry.type === selectedBlock}
		<button
			bind:this={cells[index]}
			type="button"
			class="cell"
			class:selected
			role="option"
			aria-selected={selected}
			aria-label={`${entry.label} — ${BUILD_CATEGORY_LABELS[entry.category] ?? entry.category}`}
			tabindex={index === activeIndex ? 0 : -1}
			onclick={() => onSelect(entry.type)}
			onfocus={() => {
				activeIndex = index;
				hoveredIndex = index;
			}}
			onblur={() => {
				if (hoveredIndex === index) {
					hoveredIndex = null;
				}
			}}
			onmouseenter={() => (hoveredIndex = index)}
			onmouseleave={() => {
				if (hoveredIndex === index) {
					hoveredIndex = null;
				}
			}}
		>
			<BlockIcon type={entry.type} size={34} />
			{#if tooltipEntry === entry}
				<span class="tooltip-anchor">
					<BlockTooltip {entry} />
				</span>
			{/if}
		</button>
	{/each}

	{#if entries.length === 0}
		<p class="empty">No blocks match your search.</p>
	{/if}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), 1fr);
		gap: 0.3rem;
	}

	.cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		min-height: 40px;
		border: 1px solid rgba(244, 241, 234, 0.08);
		border-radius: 0.4rem;
		background: rgba(244, 241, 234, 0.03);
		cursor: pointer;
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			transform 0.12s ease;
	}

	.cell:hover {
		background: rgba(244, 241, 234, 0.07);
		border-color: rgba(244, 241, 234, 0.16);
	}

	.cell:focus-visible {
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.cell.selected {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.16);
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.55);
	}

	.tooltip-anchor {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
	}

	.empty {
		grid-column: 1 / -1;
		margin: 0;
		padding: 1.4rem 0;
		text-align: center;
		font-size: 0.8rem;
		color: rgba(244, 241, 234, 0.5);
	}
</style>
