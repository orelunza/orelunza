<script lang="ts">
	import { ItemRegistry } from '$lib/game/inventory/ItemRegistry';
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { TargetedBlock } from '$lib/game/game-types';
	import type { InventorySlot } from '$lib/game/inventory/Inventory';

	interface Props {
		target: TargetedBlock | null;
		selectedSlot: InventorySlot | null;
		pointerLocked: boolean;
		buildMode?: boolean;
	}

	let { target, selectedSlot, pointerLocked, buildMode = false }: Props = $props();
	let interaction = $derived(target ? BlockRegistry.get(target.type).interaction : undefined);

	function interactionText(kind: typeof interaction): string {
		switch (kind) {
			case 'door':
				return 'Open / close door';
			case 'curtain':
				return 'Open / close curtain';
			case 'lamp':
				return 'Switch lamp';
			case 'fire':
				return 'Light / extinguish fire';
			case 'bed':
				return 'Rest in bed';
			case 'wardrobe':
				return 'Change outfit';
			default:
				return 'Use';
		}
	}
</script>

<div class="pointer-events-none text-center text-xs text-white/70">
	{#if !pointerLocked}
		<span class="rounded-sm border border-white/10 bg-[#1a1e22]/75 px-3 py-2 backdrop-blur-md">
			Click to lock pointer
		</span>
	{:else if !buildMode && target && interaction}
		<span class="rounded-sm border border-[#f97316]/24 bg-[#1a1e22]/80 px-3 py-2 backdrop-blur-md">
			E: {interactionText(interaction)}
		</span>
	{:else if buildMode && target}
		<span class="rounded-sm border border-white/10 bg-[#1a1e22]/75 px-3 py-2 backdrop-blur-md">
			Left click: collect {target.type} · Right click: place
			{selectedSlot?.stack ? ItemRegistry.get(selectedSlot.stack.type).label : 'nothing'}
		</span>
	{:else}
		<span class="rounded-sm border border-white/10 bg-[#1a1e22]/75 px-3 py-2 backdrop-blur-md">
			E: Use · B: Build Mode · I: Inventory · Escape: Menu
		</span>
	{/if}
</div>
