<script lang="ts">
	import type { WorldEnvironmentSnapshot } from '$lib/game/game-types';
	import { formatSeason, formatWeatherLabel } from '$lib/game/environment/time/WorldTimeFormatter';

	interface Props {
		environment: WorldEnvironmentSnapshot;
		onOpen?: () => void;
	}

	let { environment, onOpen }: Props = $props();
</script>

<button
	type="button"
	class="pointer-events-auto rounded-sm border border-white/10 bg-[#1a1e22]/78 px-4 py-2 text-center shadow-lg backdrop-blur-md transition hover:border-white/20 hover:bg-[#20262b]/86"
	aria-label="Open world calendar"
	onclick={onOpen}
>
	<p class="m-0 font-mono text-lg leading-none font-semibold tracking-[0.08em] text-white">
		{environment.time.formattedTime}
	</p>
	<p class="mt-1 mb-0 text-[0.7rem] leading-none text-white/68">
		{environment.time.formattedShortDate}
	</p>
	<p class="mt-1.5 mb-0 text-[0.64rem] leading-none text-white/44">
		{formatSeason(environment.time.season)} • {Math.round(environment.temperatureCelsius)}°C •
		{formatWeatherLabel(environment.weather)} • K
	</p>
</button>
