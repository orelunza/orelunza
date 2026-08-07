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
		elevatorReady?: boolean;
	}

	let {
		target,
		selectedSlot,
		pointerLocked,
		buildMode = false,
		elevatorReady = false
	}: Props = $props();
	let interaction = $derived(target ? BlockRegistry.get(target.type).interaction : undefined);

	function interactionText(kind: typeof interaction, currentTarget: TargetedBlock | null): string {
		switch (kind) {
			case 'door':
				return currentTarget?.open === true ? 'Close' : 'Open';
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
			case 'container':
				return 'Open / close storage';
			case 'water':
				return 'Use tap';
			case 'shower':
				return 'Switch shower';
			case 'toilet':
				return 'Flush toilet';
			case 'radio':
				return 'Switch radio';
			case 'food':
				return 'Eat';
			case 'elevator-door':
				return 'Use call button';
			case 'elevator-call':
				return 'Call elevator';
			case 'elevator-panel':
				return 'Choose floor';
			case 'power':
				return 'Toggle building power';
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
		<span
			class="inline-flex items-center gap-2 rounded-sm border border-[#f97316]/24 bg-[#1a1e22]/80 px-3 py-2 backdrop-blur-md"
		>
			{#if target.type === 'glass_door'}
				<span
					class="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white/82"
					>AUTO</span
				>
				<span>{target.open === true ? 'Open' : 'Approach'}</span>
				<span class="text-white/35">·</span>
				<span
					class="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white/82"
					>E</span
				>
				<span>{target.open === true ? 'Close' : 'Open'}</span>
			{:else}
				<span
					class="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white/82"
					>E</span
				>
				<span>{interactionText(interaction, target)}</span>
			{/if}
		</span>
	{:else if !buildMode && !target && elevatorReady}
		<span
			class="inline-flex items-center gap-2 rounded-sm border border-[#f97316]/24 bg-[#1a1e22]/80 px-3 py-2 backdrop-blur-md"
		>
			<span
				class="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white/82"
				>E</span
			>
			<span>Choose elevator floor</span>
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
