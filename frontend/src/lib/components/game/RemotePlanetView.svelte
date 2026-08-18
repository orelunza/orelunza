<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		Fog,
		HemisphereLight,
		PerspectiveCamera,
		Vector2,
		Vector3
	} from 'three';

	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import { GameRenderer } from '$lib/game/rendering/GameRenderer';
	import { RemoteSurfaceSession } from '$lib/game/world/remote/RemoteSurfaceSession';

	interface Props {
		location: PlanetTravelRequest;
		onWorld?: () => void;
		onMap?: () => void;
		onGlobe?: () => void;
		onSetDestination?: (destination: PlanetTravelRequest) => void;
	}

	let { location, onWorld, onMap, onGlobe, onSetDestination }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let resolvedCountry = $state<string | null>(null);
	let resolvedBiome = $state<string | null>(null);

	onMount(() => {
		if (!canvas) return;

		const abortController = new AbortController();
		const surface = RemoteSurfaceSession.createDefault();
		let gameRenderer: GameRenderer | null = null;
		let camera: PerspectiveCamera | null = null;
		let frame = 0;
		let pointer: number | null = null;
		let previous = new Vector2();
		let target = new Vector3();
		let bearing = Math.PI * 0.22;
		let elevationAngle = 0.62;
		let viewDistance = 38;
		let previousFrame = performance.now();

		const resize = () => {
			if (!canvas || !gameRenderer || !camera) return;
			const bounds = canvas.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) return;
			gameRenderer.resize(bounds.width, bounds.height);
			camera.aspect = bounds.width / bounds.height;
			camera.updateProjectionMatrix();
		};

		const updateCamera = () => {
			if (!camera) return;
			const horizontalDistance = Math.cos(elevationAngle) * viewDistance;
			camera.position.set(
				target.x + Math.sin(bearing) * horizontalDistance,
				target.y + Math.sin(elevationAngle) * viewDistance,
				target.z + Math.cos(bearing) * horizontalDistance
			);
			camera.up.set(0, 1, 0);
			camera.lookAt(target);
		};

		const down = (event: PointerEvent) => {
			pointer = event.pointerId;
			previous.set(event.clientX, event.clientY);
			canvas?.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			const x = event.clientX - previous.x;
			const y = event.clientY - previous.y;
			previous.set(event.clientX, event.clientY);
			bearing -= x * 0.006;
			elevationAngle = Math.max(0.18, Math.min(1.28, elevationAngle + y * 0.004));
		};
		const up = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			pointer = null;
			if (canvas?.hasPointerCapture(event.pointerId)) {
				canvas.releasePointerCapture(event.pointerId);
			}
		};
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			viewDistance = Math.max(9, Math.min(56, viewDistance * Math.exp(event.deltaY * 0.0012)));
		};

		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		canvas.addEventListener('pointerdown', down);
		canvas.addEventListener('pointermove', move);
		canvas.addEventListener('pointerup', up);
		canvas.addEventListener('pointercancel', up);
		canvas.addEventListener('wheel', wheel, { passive: false });

		const load = async () => {
			try {
				loading = true;
				loadError = null;
				const region = await surface.prepare(location, {
					halfExtentMeters: 192,
					resolution: 25,
					chunkRadius: 2,
					signal: abortController.signal
				});
				if (abortController.signal.aborted || !canvas) return;

				resolvedCountry = region.ecology.country?.name ?? location.countryName ?? null;
				resolvedBiome = region.ecology.biomeLabel ?? location.biomeName ?? null;

				gameRenderer = new GameRenderer(canvas, 'low');
				gameRenderer.scene.background = new Color('#8fb4cc');
				gameRenderer.scene.fog = new Fog('#8fb4cc', 58, 145);
				gameRenderer.scene.add(
					new AmbientLight(0xb9c9d2, 1.05),
					new HemisphereLight(0xc8e5ff, 0x4a5339, 1.35)
				);
				const sun = new DirectionalLight(0xfff4d7, 2.4);
				sun.position.set(45, 70, 28);
				gameRenderer.scene.add(sun);
				gameRenderer.rebuildWorld(region.bridge.world);

				const ground = region.generator.visualHeightAt(
					region.spawnPosition.x,
					region.spawnPosition.z
				);
				target.set(region.spawnPosition.x, ground + 3.5, region.spawnPosition.z);
				camera = new PerspectiveCamera(55, 1, 0.08, 240);
				resize();
				loading = false;

				const render = (now: number) => {
					if (!gameRenderer || !camera) return;
					const deltaSeconds = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
					previousFrame = now;
					updateCamera();
					gameRenderer.updateVegetation(camera.position, deltaSeconds, 0.35, 0.18);
					gameRenderer.render(camera);
					frame = requestAnimationFrame(render);
				};
				frame = requestAnimationFrame(render);
			} catch (error) {
				if (abortController.signal.aborted) return;
				loading = false;
				loadError = error instanceof Error ? error.message : 'Unable to load this surface.';
			}
		};

		void load();

		return () => {
			abortController.abort();
			cancelAnimationFrame(frame);
			observer.disconnect();
			canvas?.removeEventListener('pointerdown', down);
			canvas?.removeEventListener('pointermove', move);
			canvas?.removeEventListener('pointerup', up);
			canvas?.removeEventListener('pointercancel', up);
			canvas?.removeEventListener('wheel', wheel);
			gameRenderer?.dispose();
			surface.dispose();
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-[#071017]">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-none outline-none"
		aria-label="Remote surface view"
		data-testid="remote-planet-view"
	></canvas>

	{#if loading}
		<div
			class="pointer-events-none absolute inset-0 grid place-items-center bg-[#071017]/72 text-white"
		>
			<div class="text-center">
				<p class="m-0 text-sm font-semibold">Loading surface</p>
				<p class="mt-1 mb-0 text-xs text-white/50">
					{location.countryName ?? location.settlementName ?? 'Earth'}
				</p>
			</div>
		</div>
	{/if}

	<section
		class="pointer-events-auto absolute top-4 left-4 rounded-lg border border-white/10 bg-black/48 px-3 py-2 text-white backdrop-blur-md"
	>
		<p class="m-0 text-[.64rem] font-semibold tracking-[.18em] text-sky-300 uppercase">View</p>
		<h1 class="m-0 mt-0.5 text-lg font-semibold">
			{resolvedCountry ?? location.countryName ?? location.settlementName ?? 'Earth'}
		</h1>
		{#if resolvedBiome ?? location.biomeName}
			<p class="mt-0.5 mb-0 text-xs text-white/55">{resolvedBiome ?? location.biomeName}</p>
		{/if}
	</section>

	<nav class="view-nav pointer-events-auto absolute top-4 right-4" aria-label="World views">
		<button type="button" onclick={onWorld}>World</button>
		<button type="button" onclick={onMap}>Map</button>
		<button type="button" onclick={onGlobe}>Globe</button>
	</nav>

	{#if loadError}
		<div
			class="pointer-events-auto absolute bottom-4 left-4 max-w-sm rounded-lg border border-red-300/20 bg-black/60 px-3 py-2 text-sm text-white backdrop-blur-md"
		>
			<p class="m-0 font-semibold">Surface unavailable</p>
			<p class="mt-1 mb-0 text-xs text-white/60">{loadError}</p>
		</div>
	{/if}

	<div class="pointer-events-auto absolute right-4 bottom-4 flex gap-2">
		<button type="button" class="action" onclick={onGlobe}>Back</button>
		<button type="button" class="action primary" onclick={() => onSetDestination?.(location)}>
			Destination
		</button>
	</div>
</div>

<style>
	.view-nav {
		display: inline-flex;
		gap: 0.15rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.45);
		padding: 0.15rem;
		backdrop-filter: blur(8px);
	}
	.view-nav button,
	.action {
		border-radius: 0.35rem;
		padding: 0.42rem 0.65rem;
		font-size: 0.78rem;
		color: rgb(255 255 255 / 0.78);
	}
	.view-nav button:hover,
	.view-nav button:focus-visible,
	.action:hover,
	.action:focus-visible {
		background: rgb(255 255 255 / 0.1);
		color: white;
		outline: none;
	}
	.action {
		border: 1px solid rgb(255 255 255 / 0.14);
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(8px);
	}
	.action.primary {
		border-color: transparent;
		background: #7dd3fc;
		color: #061018;
		font-weight: 750;
	}
</style>
