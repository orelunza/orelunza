<script lang="ts">
	import { ItemRegistry } from '$lib/game/inventory/ItemRegistry';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { InventorySnapshot } from '$lib/game/inventory/Inventory';

	interface Props {
		inventory: InventorySnapshot;
		onClose?: () => void;
	}

	let { inventory, onClose }: Props = $props();
</script>

<div
	class="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-black/34 px-4 backdrop-blur-[2px]"
	role="dialog"
	aria-label="Inventory"
	aria-modal="true"
>
	<div
		class="w-[min(40rem,calc(100vw-2rem))] rounded-md border border-white/12 bg-[#1a1e22]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
	>
		<div class="mb-4 flex items-center justify-between gap-4">
			<h2 class="m-0 text-lg font-semibold">Inventory</h2>
			<button
				type="button"
				class="rounded-sm border border-white/12 px-3 py-1.5 text-sm text-white/72 hover:bg-white/8"
				onclick={onClose}
			>
				Close
			</button>
		</div>

		<div class="grid grid-cols-9 gap-2" aria-label="Inventory slots">
			{#each inventory.slots as slot, index (index)}
				{@const block = slot.stack ? BlockRegistry.get(slot.stack.type) : null}
				<div
					class="relative grid aspect-square place-items-center rounded-sm border border-white/10 bg-black/18"
				>
					<span class="absolute top-1 left-1 text-[0.6rem] text-white/30">{index + 1}</span>
					{#if block && slot.stack}
						<span
							class="size-7 rounded-[2px] border border-black/25"
							title={ItemRegistry.get(slot.stack.type).label}
							style={`background-color:#${block.color.toString(16).padStart(6, '0')}`}
						></span>
						<span class="absolute right-1 bottom-0.5 text-[0.65rem] font-semibold">
							{slot.stack.quantity}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
