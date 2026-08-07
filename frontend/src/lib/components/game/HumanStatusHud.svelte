<script lang="ts">
	import type { HumanConditionSnapshot } from '$lib/game/human/HumanConditionState';

	interface Props {
		human: HumanConditionSnapshot;
	}

	let { human }: Props = $props();

	let healthPercent = $derived(Math.max(0, Math.min(100, human.health)));
	let staminaPercent = $derived(Math.max(0, Math.min(100, human.stamina)));
	let oxygenLow = $derived(human.oxygen < 35);
	let hydrationLow = $derived(human.hydration < 25);
	let nutritionLow = $derived(human.nutrition < 20);
	let cold = $derived(human.bodyTemperatureCelsius < 35.5);
	let hot = $derived(human.bodyTemperatureCelsius > 39);
	let wet = $derived(human.wetness > 0.65);
	let tired = $derived(human.fatigue >= 55 && human.fatigue < 85);
	let exhausted = $derived(human.fatigue >= 85);
	let bleeding = $derived(human.effects.some((effect) => effect.id === 'bleeding'));
	let injured = $derived(human.effects.some((effect) => effect.id === 'injured'));
	let sick = $derived(human.effects.some((effect) => effect.id === 'sick'));
	let fever = $derived(human.effects.some((effect) => effect.id === 'fever'));
	let poisoned = $derived(human.effects.some((effect) => effect.id === 'poisoned'));
	let recovering = $derived(human.effects.some((effect) => effect.id === 'recovering'));
	let protectedAfterRespawn = $derived(human.respawnProtectionSeconds > 0.05);
</script>

<div class="absolute bottom-5 left-4 flex w-48 flex-col gap-2" aria-label="Human condition">
	<div class="rounded-sm border border-white/10 bg-[#15191d]/76 p-2 backdrop-blur-md">
		<div class="flex items-center justify-between text-[0.65rem] font-semibold text-white/66">
			<span>Health</span>
			<span>{Math.round(human.health)}</span>
		</div>
		<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-black/36">
			<div
				class="h-full rounded-full bg-[#ef6a63] transition-[width] duration-200"
				style={`width: ${healthPercent}%`}
			></div>
		</div>

		<div class="mt-2 flex items-center justify-between text-[0.65rem] font-semibold text-white/66">
			<span>Stamina</span>
			<span>{Math.round(human.stamina)}</span>
		</div>
		<div class="mt-1 h-1 overflow-hidden rounded-full bg-black/36">
			<div
				class="h-full rounded-full bg-[#e4b55d] transition-[width] duration-200"
				style={`width: ${staminaPercent}%`}
			></div>
		</div>
	</div>

	{#if human.lifeState !== 'alive' || human.sleeping || tired || exhausted || oxygenLow || hydrationLow || nutritionLow || cold || hot || wet || bleeding || injured || sick || fever || poisoned || recovering || protectedAfterRespawn}
		<div class="flex flex-wrap gap-1.5 text-[0.62rem] font-semibold">
			{#if human.lifeState === 'critical'}
				<span class="rounded-sm border border-red-400/30 bg-red-950/62 px-2 py-1 text-red-200"
					>Critical</span
				>
			{:else if human.lifeState === 'unconscious'}
				<span class="rounded-sm border border-red-400/30 bg-red-950/72 px-2 py-1 text-red-100"
					>Unconscious</span
				>
			{:else if human.lifeState === 'dead'}
				<span class="rounded-sm border border-red-400/30 bg-black/80 px-2 py-1 text-red-100"
					>Dead</span
				>
			{/if}
			{#if human.sleeping}
				<span
					class="rounded-sm border border-indigo-300/25 bg-indigo-950/68 px-2 py-1 text-indigo-100"
					>Sleeping · N to wake</span
				>
			{:else if exhausted}
				<span
					class="rounded-sm border border-violet-300/25 bg-violet-950/62 px-2 py-1 text-violet-100"
					>Exhausted</span
				>
			{:else if tired}
				<span
					class="rounded-sm border border-violet-300/20 bg-violet-950/55 px-2 py-1 text-violet-100"
					>Tired</span
				>
			{/if}
			{#if (tired || exhausted) && !human.sleeping}
				{#if human.canSleep}
					<span class="rounded-sm border border-white/12 bg-black/45 px-2 py-1 text-white/70"
						>N · Sleep</span
					>
				{:else if human.sleepBlockedReason === 'needs-shelter'}
					<span class="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-white/56"
						>Find shelter to sleep</span
					>
				{/if}
			{/if}
			{#if bleeding}
				<span class="rounded-sm border border-red-300/25 bg-red-950/68 px-2 py-1 text-red-100">
					Bleeding
				</span>
			{/if}
			{#if injured}
				<span
					class="rounded-sm border border-orange-300/20 bg-orange-950/60 px-2 py-1 text-orange-100"
				>
					Injured{human.injuries.length > 1 ? ` · ${human.injuries.length}` : ''}
				</span>
			{/if}
			{#if poisoned}
				<span class="rounded-sm border border-lime-300/20 bg-lime-950/60 px-2 py-1 text-lime-100">
					Food poisoning
				</span>
			{:else if sick}
				<span
					class="rounded-sm border border-emerald-300/20 bg-emerald-950/60 px-2 py-1 text-emerald-100"
				>
					Sick
				</span>
			{/if}
			{#if fever}
				<span class="rounded-sm border border-rose-300/20 bg-rose-950/60 px-2 py-1 text-rose-100">
					Fever
				</span>
			{/if}
			{#if recovering && !sick}
				<span
					class="rounded-sm border border-emerald-200/15 bg-emerald-950/45 px-2 py-1 text-emerald-100"
				>
					Recovering
				</span>
			{/if}
			{#if protectedAfterRespawn}
				<span class="rounded-sm border border-white/12 bg-black/45 px-2 py-1 text-white/72">
					Protected · {Math.ceil(human.respawnProtectionSeconds)}s
				</span>
			{/if}
			{#if oxygenLow}
				<span class="rounded-sm border border-sky-300/25 bg-sky-950/66 px-2 py-1 text-sky-100"
					>Low oxygen</span
				>
			{/if}
			{#if hydrationLow}
				<span class="rounded-sm border border-blue-300/20 bg-blue-950/60 px-2 py-1 text-blue-100"
					>Thirsty</span
				>
			{/if}
			{#if nutritionLow}
				<span class="rounded-sm border border-amber-300/20 bg-amber-950/60 px-2 py-1 text-amber-100"
					>Hungry</span
				>
			{/if}
			{#if cold}
				<span class="rounded-sm border border-cyan-200/20 bg-cyan-950/60 px-2 py-1 text-cyan-100"
					>Cold</span
				>
			{/if}
			{#if hot}
				<span
					class="rounded-sm border border-orange-300/20 bg-orange-950/60 px-2 py-1 text-orange-100"
					>Overheated</span
				>
			{/if}
			{#if wet}
				<span class="rounded-sm border border-blue-200/20 bg-blue-950/55 px-2 py-1 text-blue-100"
					>Wet</span
				>
			{/if}
		</div>
	{/if}
</div>
