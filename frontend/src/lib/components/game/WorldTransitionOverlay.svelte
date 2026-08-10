<script lang="ts">
	import {
		firstSpawnPhase,
		type WorldTransitionPhase
	} from '$lib/game/world/transition/WorldTransition';
	interface Props {
		startedAt?: number;
		ready?: boolean;
	}
	let { startedAt = performance.now(), ready = false }: Props = $props();
	let phase = $state<WorldTransitionPhase>('focusing');
	let timer: number | null = null;
	$effect(() => {
		const update = () => {
			phase = firstSpawnPhase(
				performance.now() - startedAt,
				ready,
				matchMedia('(prefers-reduced-motion: reduce)').matches
			);
			timer = phase === 'revealing' ? null : requestAnimationFrame(update);
		};
		update();
		return () => {
			if (timer !== null) cancelAnimationFrame(timer);
		};
	});
</script>

<div
	class="pointer-events-none absolute inset-0 z-[90] grid place-items-center bg-[#071018]/80 text-center text-white transition-opacity duration-700 motion-reduce:duration-0"
>
	<div class="animate-[pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none">
		<p class="m-0 text-xs font-semibold tracking-[.22em] text-amber-200 uppercase">{phase}</p>
		<p class="mt-2 mb-0 text-lg font-semibold">Arriving at your new home</p>
		<p class="mt-1 text-sm text-white/60">
			{phase === 'focusing'
				? 'Focusing on your home…'
				: phase === 'descending'
					? 'Descending through the atmosphere…'
					: 'Preparing the local world…'}
		</p>
	</div>
</div>
