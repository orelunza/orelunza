<script lang="ts">
	import type { HumanConditionSnapshot } from '$lib/game/human/HumanConditionState';
	import { humanDamageCauseLabel } from '$lib/game/human/HumanDeathSystem';
	import { deriveHumanFeedback } from '$lib/game/human/HumanFeedback';

	interface Props {
		human: HumanConditionSnapshot;
		onRespawn?: () => void;
	}

	let { human, onRespawn }: Props = $props();
	let feedback = $derived(deriveHumanFeedback(human));
	let deathCause = $derived(humanDamageCauseLabel(human.lastDeathCause ?? human.lastDamageCause));
	let dangerOpacity = $derived(
		Math.min(0.48, feedback.lowHealth * 0.34 + feedback.bleeding * 0.12)
	);
	let damageOpacity = $derived(Math.min(0.2, feedback.damagePulse * 0.2));
	let oxygenOpacity = $derived(Math.min(0.48, feedback.oxygenLoss * 0.48));
	let coldOpacity = $derived(Math.min(0.16, feedback.coldStress * 0.16));
	let heatOpacity = $derived(Math.min(0.14, feedback.heatStress * 0.14));
	let illnessOpacity = $derived(Math.min(0.1, feedback.illness * 0.1));
</script>

<div class="pointer-events-none absolute inset-0 z-40" aria-live="polite">
	{#if dangerOpacity > 0}
		<div class="danger-vignette absolute inset-0" style:opacity={dangerOpacity}></div>
	{/if}
	{#if damageOpacity > 0}
		<div class="damage-pulse absolute inset-0" style:opacity={damageOpacity}></div>
	{/if}
	{#if oxygenOpacity > 0}
		<div class="oxygen-vignette absolute inset-0" style:opacity={oxygenOpacity}></div>
	{/if}
	{#if coldOpacity > 0}
		<div class="cold-wash absolute inset-0" style:opacity={coldOpacity}></div>
	{/if}
	{#if heatOpacity > 0}
		<div class="heat-wash absolute inset-0" style:opacity={heatOpacity}></div>
	{/if}
	{#if illnessOpacity > 0}
		<div class="illness-wash absolute inset-0" style:opacity={illnessOpacity}></div>
	{/if}

	{#if human.lifeState === 'unconscious'}
		<div class="absolute inset-0 flex items-center justify-center bg-black/48 backdrop-blur-[1px]">
			<div
				class="rounded-sm border border-white/10 bg-black/48 px-6 py-4 text-center text-white/82"
			>
				<p class="m-0 text-lg font-semibold">Unconscious</p>
				<p class="mt-1 mb-0 text-xs text-white/52">Your body cannot act.</p>
			</div>
		</div>
	{:else if human.lifeState === 'dead'}
		<div
			class="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/72 backdrop-blur-[2px]"
		>
			<div
				class="w-[min(24rem,calc(100vw-2rem))] rounded-sm border border-white/12 bg-[#111416]/92 p-6 text-center text-white shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-label="Death"
			>
				<p class="m-0 text-xs font-semibold tracking-[0.18em] text-white/42 uppercase">Orelunza</p>
				<h2 class="mt-2 mb-0 text-2xl font-semibold">You died</h2>
				<p class="mt-2 mb-0 text-sm text-white/58">{deathCause}</p>
				{#if human.deathCount > 1}
					<p class="mt-1 mb-0 text-xs text-white/34">Deaths in this world: {human.deathCount}</p>
				{/if}
				<button
					type="button"
					class="mt-6 rounded-sm border border-white/14 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
					onclick={onRespawn}
				>
					Respawn · Enter
				</button>
				<p class="mt-3 mb-0 text-[0.68rem] text-white/36">Your inventory stays with you.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.danger-vignette {
		background: radial-gradient(circle at center, transparent 48%, rgba(90, 0, 0, 0.82) 100%);
	}

	.damage-pulse {
		background: rgba(150, 12, 12, 0.5);
	}

	.oxygen-vignette {
		background: radial-gradient(circle at center, transparent 34%, rgba(0, 6, 14, 0.92) 100%);
	}

	.cold-wash {
		background: rgba(75, 145, 190, 0.5);
	}

	.heat-wash {
		background: rgba(180, 78, 32, 0.48);
	}

	.illness-wash {
		background: rgba(87, 116, 72, 0.42);
	}
</style>
