<script lang="ts">
	import type { MiniMapSnapshot } from '$lib/game/game-types';

	interface Props {
		snapshot: MiniMapSnapshot;
		onOpen?: () => void;
	}
	let { snapshot, onOpen }: Props = $props();
	const grid = $derived(`repeat(${snapshot.size}, minmax(0, 1fr))`);
</script>

<button
	type="button"
	class="relative grid size-24 overflow-hidden rounded-full border-2 border-white/25 bg-[#12212b] shadow-lg"
	style:grid-template-columns={grid}
	style:grid-template-rows={grid}
	aria-label="Open world map"
	onclick={onOpen}
>
	{#each snapshot.cells as cell (`${cell.x}:${cell.z}`)}
		<span class:water={cell.terrain === 'water'} class:land={cell.terrain === 'land'}></span>
	{/each}
	<span class="north">N</span>
	<span class="player" style:transform={`translate(-50%, -50%) rotate(${snapshot.playerYaw}rad)`}
		>▲</span
	>
	<span
		class="absolute right-0 bottom-1 left-0 truncate px-2 text-[9px] font-semibold text-white/90"
		>{snapshot.zoneName}</span
	>
</button>

<style>
	.land {
		background: #5a8a55;
	}
	.water {
		background: #256f9a;
	}
	.north {
		position: absolute;
		top: 5px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		font-weight: 800;
		text-shadow: 0 1px 2px #000;
	}
	.player {
		position: absolute;
		top: 50%;
		left: 50%;
		color: #fff3b0;
		font-size: 19px;
		line-height: 1;
		text-shadow: 0 1px 3px #000;
	}
</style>
