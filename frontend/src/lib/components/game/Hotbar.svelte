<script lang="ts">
	import { ItemRegistry } from '$lib/game/inventory/ItemRegistry';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { InventorySlot } from '$lib/game/inventory/Inventory';

	interface Props {
		slots: InventorySlot[];
		selectedIndex: number;
		onSelect?: (index: number) => void;
	}

	const HOTBAR_INDICES = Array.from({ length: 9 }, (_value, index) => index);

	let { slots, selectedIndex, onSelect }: Props = $props();
</script>

<div class="flex items-end justify-center gap-1.5" aria-label="Hotbar">
	{#each HOTBAR_INDICES as index (index)}
		{@const slot = slots[index] ?? { stack: null }}
		{@const block = slot.stack ? BlockRegistry.get(slot.stack.type) : null}
		<button
			type="button"
			class={`relative grid size-12 place-items-center rounded-sm border bg-[#1a1e22]/82 text-xs text-white shadow-[0_8px_34px_rgba(0,0,0,0.44)] backdrop-blur-md transition ${
				index === selectedIndex
					? 'border-[#f97316] ring-2 ring-[#f97316]/35'
					: 'border-white/14 hover:border-white/30'
			}`}
			aria-label={`Hotbar slot ${index + 1}${slot.stack ? ` ${ItemRegistry.get(slot.stack.type).label}` : ''}`}
			aria-pressed={index === selectedIndex}
			onclick={() => onSelect?.(index)}
		>
			<span class="absolute top-0.5 left-1 text-[0.62rem] text-white/38">{index + 1}</span>

			{#if block && slot.stack}
				<span
					class="size-6 rounded-[2px] border border-black/20"
					style={`background-color:#${block.color.toString(16).padStart(6, '0')}`}
				></span>
				<span class="absolute right-1 bottom-0.5 text-[0.62rem] font-semibold text-white/78">
					{slot.stack.quantity}
				</span>
			{/if}
		</button>
	{/each}
</div>
