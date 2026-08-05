<script lang="ts">
	import type { GameSnapshot } from '$lib/game/game-types';
	import { buildCalendarMonth } from '$lib/game/environment/time/WorldCalendar';
	import {
		describeLunarPhase,
		formatSeason,
		formatWeatherLabel
	} from '$lib/game/environment/time/WorldTimeFormatter';
	import { WEEKDAY_NAMES } from '$lib/game/environment/time/WorldDate';

	interface Props {
		snapshot: GameSnapshot;
		onClose?: () => void;
	}

	let { snapshot, onClose }: Props = $props();

	let time = $derived(snapshot.environment.time);
	let month = $derived(buildCalendarMonth(time.year, time.month, time.dayNumber));
</script>

<div
	class="absolute inset-0 z-50 flex items-center justify-center bg-black/58 p-4 backdrop-blur-sm"
	role="presentation"
>
	<section
		class="w-[min(46rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-white/12 bg-[#171c20]/96 text-white shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="World calendar"
	>
		<header class="flex items-start justify-between border-b border-white/8 px-5 py-4">
			<div>
				<p class="m-0 text-xs font-semibold tracking-[0.16em] text-[#f97316] uppercase">
					Orelunza Calendar
				</p>
				<h2 class="mt-1 mb-0 text-2xl font-semibold">{month.monthName} — Year {month.year}</h2>
				<p class="mt-1 mb-0 text-sm text-white/54">Day {time.dayNumber + 1} since world creation</p>
			</div>

			<button
				type="button"
				class="rounded-sm border border-white/10 px-3 py-2 text-xs text-white/72 hover:bg-white/8"
				onclick={onClose}
			>
				Close · K / Esc
			</button>
		</header>

		<div class="grid gap-5 p-5 md:grid-cols-[1fr_15rem]">
			<div>
				<div class="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-white/42">
					{#each WEEKDAY_NAMES as weekday}
						<div class="py-1">{weekday.slice(0, 3)}</div>
					{/each}
				</div>

				<div class="mt-1 grid grid-cols-7 gap-1">
					{#each month.cells as cell (cell.key)}
						<div
							class="flex aspect-square min-h-10 items-center justify-center rounded-sm border text-sm {cell.day ===
							null
								? 'border-transparent text-transparent'
								: cell.isCurrentDay
									? 'border-[#f97316]/70 bg-[#f97316]/18 font-bold text-[#ffb27c]'
									: 'border-white/6 bg-white/[0.025] text-white/72'}"
							aria-current={cell.isCurrentDay ? 'date' : undefined}
						>
							{cell.day ?? ''}
						</div>
					{/each}
				</div>
			</div>

			<aside class="rounded-sm border border-white/8 bg-black/14 p-4">
				<p class="m-0 font-mono text-4xl font-semibold tracking-[0.06em]">
					{time.formattedTime}
				</p>
				<p class="mt-1 mb-0 text-sm text-white/58">{time.formattedDate}</p>

				<dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
					<dt class="text-white/42">Period</dt>
					<dd class="m-0 text-right capitalize">{time.period}</dd>

					<dt class="text-white/42">Season</dt>
					<dd class="m-0 text-right">{formatSeason(time.season)}</dd>

					<dt class="text-white/42">Temperature</dt>
					<dd class="m-0 text-right">{Math.round(snapshot.environment.temperatureCelsius)}°C</dd>

					<dt class="text-white/42">Feels like</dt>
					<dd class="m-0 text-right">{Math.round(snapshot.environment.windChillCelsius)}°C</dd>

					<dt class="text-white/42">Weather</dt>
					<dd class="m-0 text-right">{formatWeatherLabel(snapshot.environment.weather)}</dd>

					<dt class="text-white/42">Moon</dt>
					<dd class="m-0 text-right">{describeLunarPhase(snapshot.environment.lunarPhase)}</dd>
				</dl>
			</aside>
		</div>
	</section>
</div>
