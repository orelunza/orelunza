<script lang="ts">
	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BlockIcon from './BlockIcon.svelte';

	interface Props {
		palette: readonly (BlockType | null)[];
		selectedIndex: number;
		selectedBlock: BlockType | null;
		inventory: InventorySnapshot;
		creative: boolean;
		onSelect?: (index: number) => void;
	}

	let { palette, selectedIndex, selectedBlock, inventory, creative, onSelect }: Props = $props();

	let selectedDefinition = $derived(selectedBlock ? BlockRegistry.get(selectedBlock) : null);

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
</script>

<div class="hotbar-shell">
	{#if selectedDefinition}
		<span class="selected-label">{selectedDefinition.label}</span>
	{/if}

	<div class="build-hotbar" aria-label="Build palette">
		{#each palette as type, index (index)}
			{@const definition = type ? BlockRegistry.get(type) : null}
			<button
				type="button"
				class="slot"
				class:selected={index === selectedIndex && type !== null && type === selectedBlock}
				class:empty={type === null}
				aria-label={definition
					? `Select ${definition.label} from build slot ${index + 1}`
					: `Empty build slot ${index + 1}`}
				disabled={type === null}
				onclick={() => onSelect?.(index)}
			>
				<span class="number">{index + 1}</span>

				{#if type && definition}
					<BlockIcon {type} size={31} />
					<span class="quantity">{creative ? '∞' : (quantities.get(type) ?? 0)}</span>
				{:else}
					<span class="empty-mark" aria-hidden="true">·</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.hotbar-shell {
		display: grid;
		justify-items: center;
		gap: 0.34rem;
	}

	.selected-label {
		border: 1px solid rgba(244, 241, 234, 0.09);
		border-radius: 999px;
		background: rgba(16, 19, 22, 0.72);
		padding: 0.22rem 0.58rem;
		font-size: 0.62rem;
		font-weight: 600;
		color: rgba(244, 241, 234, 0.82);
		backdrop-filter: blur(8px);
	}

	.build-hotbar {
		display: grid;
		grid-template-columns: repeat(9, 3.15rem);
		gap: 0.22rem;
		padding: 0.28rem;
		border: 1px solid rgba(244, 241, 234, 0.1);
		border-radius: 0.55rem;
		background: rgba(16, 19, 22, 0.8);
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
		backdrop-filter: blur(10px);
	}

	.slot {
		position: relative;
		display: grid;
		width: 3.15rem;
		height: 3.15rem;
		place-items: center;
		border: 1px solid rgba(244, 241, 234, 0.11);
		border-radius: 0.38rem;
		background: rgba(244, 241, 234, 0.045);
		color: #f4f1ea;
		cursor: pointer;
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			transform 0.12s ease;
	}

	.slot:hover:not(:disabled) {
		border-color: rgba(244, 241, 234, 0.24);
		background: rgba(244, 241, 234, 0.085);
		transform: translateY(-1px);
	}

	.slot.selected {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.16);
		box-shadow:
			0 0 0 1px rgba(249, 115, 22, 0.48),
			0 0 16px rgba(249, 115, 22, 0.12);
	}

	.slot:focus-visible {
		outline: 2px solid #fb923c;
		outline-offset: 2px;
	}

	.slot.empty {
		border-style: dashed;
		background: rgba(0, 0, 0, 0.12);
		cursor: default;
	}

	.number {
		position: absolute;
		top: 0.12rem;
		left: 0.2rem;
		font-size: 0.52rem;
		color: rgba(244, 241, 234, 0.44);
	}

	.quantity {
		position: absolute;
		right: 0.2rem;
		bottom: 0.1rem;
		font-size: 0.57rem;
		font-weight: 650;
		color: rgba(244, 241, 234, 0.8);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
	}

	.empty-mark {
		font-size: 1rem;
		color: rgba(244, 241, 234, 0.18);
	}

	@media (max-width: 640px) {
		.build-hotbar {
			grid-template-columns: repeat(9, minmax(2.2rem, 1fr));
			width: min(calc(100vw - 1rem), 29rem);
		}

		.slot {
			width: 100%;
			height: 2.65rem;
		}
	}
</style>
