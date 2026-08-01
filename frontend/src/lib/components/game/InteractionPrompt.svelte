<script lang="ts">
	import { ItemRegistry } from '$lib/game/inventory/ItemRegistry';
	import type { TargetedBlock } from '$lib/game/game-types';
	import type { InventorySlot } from '$lib/game/inventory/Inventory';

	interface Props {
		target: TargetedBlock | null;
		selectedSlot: InventorySlot | null;
		pointerLocked: boolean;
	}

	let { target, selectedSlot, pointerLocked }: Props = $props();
</script>

<div class="pointer-events-none text-center text-xs text-white/70">
	{#if !pointerLocked}
		<span class="rounded-sm border border-white/10 bg-[#1a1e22]/75 px-3 py-2 backdrop-blur-md">
			Click to lock pointer
		</span>
	{:else if target}
		<span class="rounded-sm border border-white/10 bg-[#1a1e22]/75 px-3 py-2 backdrop-blur-md">
			Left click: collect {target.type} · Right click: place
			{selectedSlot?.stack ? ItemRegistry.get(selectedSlot.stack.type).label : 'nothing'}
		</span>
	{/if}
</div>
