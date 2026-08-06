<script lang="ts">
	interface Props {
		latitude: number;
		longitude: number;
		elevationMeters: number;
		zone: string;
		editCount: number;
		onReturn?: () => void;
	}

	let { latitude, longitude, elevationMeters, zone, editCount, onReturn }: Props = $props();
</script>

<section
	class="pointer-events-auto w-[min(25rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/65 p-4 text-white shadow-2xl backdrop-blur-md"
	aria-label="Planet surface location"
>
	<p class="m-0 text-xs font-semibold tracking-[0.24em] text-emerald-300 uppercase">
		Planet surface
	</p>
	<h2 class="mt-1 mb-0 text-xl font-semibold">{zone}</h2>
	<div class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
		<span class="text-white/45">Latitude</span><strong class="text-right"
			>{latitude.toFixed(5)}°</strong
		>
		<span class="text-white/45">Longitude</span><strong class="text-right"
			>{longitude.toFixed(5)}°</strong
		>
		<span class="text-white/45">Elevation</span><strong class="text-right"
			>{elevationMeters.toFixed(0)} m</strong
		>
		<span class="text-white/45">Local edits</span><strong class="text-right">{editCount}</strong>
	</div>
	<p class="mt-3 mb-0 text-xs leading-5 text-white/48">
		Drag to orbit · Wheel to zoom · Left click removes a voxel · Right click places stone.
	</p>
	<button
		type="button"
		class="mt-4 w-full rounded-md border border-white/15 px-4 py-2 text-sm transition hover:bg-white/10"
		onclick={onReturn}
	>
		Return to globe · G
	</button>
</section>
