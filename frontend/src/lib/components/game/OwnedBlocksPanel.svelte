<script lang="ts">
	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import BlockIcon from './BlockIcon.svelte';

	interface Props {
		inventory: InventorySnapshot;
		selectedBlock: BlockType | null;
		onSelect: (type: BlockType) => void;
	}

	let { inventory, selectedBlock, onSelect }: Props = $props();

	let occupiedSlots = $derived(inventory.slots.filter((slot) => slot.stack !== null).length);
	let totalItems = $derived(
		inventory.slots.reduce((total, slot) => total + (slot.stack?.quantity ?? 0), 0)
	);
</script>

<section class="owned-panel" aria-label="Blocks in your possession">
	<header class="header">
		<div>
			<h2>Your blocks</h2>
			<p>{occupiedSlots} occupied slots · {totalItems} items</p>
		</div>
		<span class="inventory-label">Inventory</span>
	</header>

	<div class="inventory-grid" role="listbox" aria-label="Owned blocks">
		{#each inventory.slots as slot, index (index)}
			{@const stack = slot.stack}
			{@const definition = stack ? BlockRegistry.get(stack.type) : null}

			{#if stack && definition}
				<button
					type="button"
					class="slot"
					class:selected={stack.type === selectedBlock}
					class:hotbar={index < 9}
					role="option"
					aria-selected={stack.type === selectedBlock}
					aria-label={`${definition.label}, quantity ${stack.quantity}`}
					title={`${definition.label} · ${stack.quantity}`}
					onclick={() => onSelect(stack.type)}
				>
					{#if index < 9}
						<span class="slot-number">{index + 1}</span>
					{/if}
					<BlockIcon type={stack.type} size={38} />
					<span class="quantity">{stack.quantity}</span>
				</button>
			{:else}
				<div class="slot empty" class:hotbar={index < 9} aria-hidden="true">
					{#if index < 9}
						<span class="slot-number">{index + 1}</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<footer class="hint">
		Select a block you own, or choose any available block from the catalog.
	</footer>
</section>

<style>
	.owned-panel {
		display: flex;
		width: min(390px, 100%);
		max-height: 66vh;
		flex-direction: column;
		box-sizing: border-box;
		border: 1px solid rgba(244, 241, 234, 0.12);
		border-radius: 0.9rem;
		background: rgba(20, 23, 26, 0.9);
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
		backdrop-filter: blur(14px);
		color: #f4f1ea;
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0.9rem 0.7rem;
		border-bottom: 1px solid rgba(244, 241, 234, 0.08);
	}

	h2 {
		margin: 0;
		font-size: 0.96rem;
		font-weight: 650;
		letter-spacing: 0.02em;
	}

	p {
		margin: 0.2rem 0 0;
		font-size: 0.68rem;
		color: rgba(244, 241, 234, 0.48);
	}

	.inventory-label {
		border: 1px solid rgba(249, 115, 22, 0.28);
		border-radius: 999px;
		padding: 0.22rem 0.55rem;
		background: rgba(249, 115, 22, 0.1);
		color: #fb923c;
		font-size: 0.65rem;
	}

	.inventory-grid {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: 0.32rem;
		padding: 0.85rem;
		overflow-y: auto;
	}

	.slot {
		position: relative;
		display: grid;
		aspect-ratio: 1;
		min-width: 0;
		place-items: center;
		border: 1px solid rgba(244, 241, 234, 0.09);
		border-radius: 0.42rem;
		background: rgba(244, 241, 234, 0.035);
		color: #f4f1ea;
	}

	button.slot {
		cursor: pointer;
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			transform 0.12s ease;
	}

	button.slot:hover {
		z-index: 1;
		transform: translateY(-1px);
		border-color: rgba(244, 241, 234, 0.22);
		background: rgba(244, 241, 234, 0.08);
	}

	button.slot:focus-visible {
		z-index: 2;
		outline: 2px solid #f97316;
		outline-offset: 2px;
	}

	.slot.hotbar {
		border-bottom-color: rgba(249, 115, 22, 0.28);
	}

	.slot.selected {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.16);
		box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.52);
	}

	.slot.empty {
		background: rgba(0, 0, 0, 0.13);
	}

	.slot-number {
		position: absolute;
		top: 0.16rem;
		left: 0.24rem;
		font-size: 0.52rem;
		color: rgba(244, 241, 234, 0.32);
	}

	.quantity {
		position: absolute;
		right: 0.22rem;
		bottom: 0.12rem;
		min-width: 1rem;
		text-align: right;
		font-size: 0.62rem;
		font-weight: 700;
		text-shadow: 0 1px 2px #000;
	}

	.hint {
		margin-top: auto;
		border-top: 1px solid rgba(244, 241, 234, 0.07);
		padding: 0.65rem 0.9rem 0.75rem;
		font-size: 0.68rem;
		line-height: 1.45;
		color: rgba(244, 241, 234, 0.46);
	}

	@media (max-width: 760px) {
		.owned-panel {
			width: 100%;
			max-height: none;
		}

		.inventory-grid {
			grid-template-columns: repeat(9, minmax(30px, 1fr));
		}
	}
</style>
