<script lang="ts">
	import type { GameSnapshot } from '$lib/game/game-types';
	import Hotbar from './Hotbar.svelte';
	import InteractionPrompt from './InteractionPrompt.svelte';

	interface Props {
		snapshot: GameSnapshot;
		onHotbarSelect?: (index: number) => void;
		onPause?: () => void;
	}

	let { snapshot, onHotbarSelect, onPause }: Props = $props();

	let selectedSlot = $derived(snapshot.inventory.hotbar[snapshot.selectedHotbarIndex] ?? null);
</script>

<div class="pointer-events-none absolute inset-0 z-20 text-white" aria-label="Game HUD">
	<div
		class="absolute top-3 left-3 rounded-sm border border-white/10 bg-[#1a1e22]/76 px-3 py-2 text-xs backdrop-blur-md"
	>
		<p class="m-0 font-semibold">{snapshot.regionName}</p>
		<p class="m-0 text-white/52">
			{snapshot.saveStatus === 'saved'
				? 'Saved'
				: snapshot.saveStatus === 'saving'
					? 'Saving'
					: snapshot.saveStatus}
		</p>
	</div>

	<button
		type="button"
		class="pointer-events-auto absolute top-3 right-3 rounded-sm border border-white/10 bg-[#1a1e22]/76 px-3 py-2 text-xs backdrop-blur-md hover:bg-white/10"
		aria-label="Open pause menu"
		onclick={onPause}
	>
		Menu
	</button>

	<div
		class="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2"
		aria-label="Crosshair"
	>
		<span class="absolute top-1/2 left-0 h-px w-full bg-white/78"></span>
		<span class="absolute top-0 left-1/2 h-full w-px bg-white/78"></span>
	</div>

	{#if snapshot.mobileLimited}
		<div
			class="absolute top-16 left-3 rounded-sm border border-[#f97316]/30 bg-[#1a1e22]/80 px-3 py-2 text-xs text-white/70 backdrop-blur-md"
		>
			Desktop controls are the current focus.
		</div>
	{/if}

	<div class="absolute bottom-24 left-1/2 -translate-x-1/2">
		<InteractionPrompt
			target={snapshot.targetedBlock}
			{selectedSlot}
			pointerLocked={snapshot.pointerLocked}
		/>
	</div>

	<div class="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2">
		<Hotbar
			slots={snapshot.inventory.hotbar}
			selectedIndex={snapshot.selectedHotbarIndex}
			onSelect={onHotbarSelect}
		/>
	</div>
</div>
