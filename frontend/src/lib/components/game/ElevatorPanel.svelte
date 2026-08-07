<script lang="ts">
	import type { UrbanElevatorSnapshot } from '$lib/game/world/civilization/UrbanElevatorSystem';

	interface Props {
		elevator: UrbanElevatorSnapshot;
		onSelect?: (floor: number) => void;
		onClose?: () => void;
	}
	let { elevator, onSelect, onClose }: Props = $props();
</script>

<div
	class="pointer-events-auto absolute inset-0 grid place-items-center bg-black/28 backdrop-blur-[1px]"
>
	<section
		class="w-[min(24rem,calc(100vw-2rem))] rounded-md border border-white/12 bg-[#171c20]/94 p-4 shadow-2xl"
	>
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="m-0 text-sm font-semibold">{elevator.label}</p>
				<p class="mt-1 mb-0 text-xs text-white/50">
					Floor {elevator.currentFloor} · {elevator.powered ? 'Powered' : 'No power'}
				</p>
			</div>
			<button
				type="button"
				class="rounded border border-white/12 px-2 py-1 text-xs"
				onclick={onClose}>Close</button
			>
		</div>
		<div class="mt-4 grid grid-cols-5 gap-2">
			{#each elevator.floors as floor}
				<button
					type="button"
					disabled={!elevator.powered || elevator.phase === 'moving'}
					class="rounded border px-3 py-2 text-sm disabled:opacity-35 {floor ===
					elevator.currentFloor
						? 'border-[#f97316]/70 bg-[#f97316]/16'
						: 'border-white/12 bg-white/5 hover:bg-white/10'}"
					onclick={() => onSelect?.(floor)}
				>
					{floor}
				</button>
			{/each}
		</div>
	</section>
</div>
