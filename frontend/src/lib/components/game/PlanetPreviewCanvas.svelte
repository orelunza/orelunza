<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		HemisphereLight,
		PerspectiveCamera,
		Raycaster,
		Scene,
		SRGBColorSpace,
		Vector2,
		Vector3,
		WebGLRenderer
	} from 'three';
	import type { GeographicLocationSnapshot } from '$lib/game/game-types';
	import { PlanetGeographyQuery } from '$lib/game/geography/PlanetGeographyQuery';
	import { CountryResolver } from '$lib/game/geography/countries/CountryResolver';
	import { PlanetEcologyQuery } from '$lib/game/geography/ecology/PlanetEcologyQuery';
	import { PlanetSurfaceContextResolver } from '$lib/game/geography/ecology/PlanetSurfaceContextResolver';
	import { PlanetDestinationMarker } from '$lib/game/rendering/planet/PlanetDestinationMarker';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';
	import {
		createPendingSurfaceDestination,
		rayToPlanetDestination,
		resolveSurfaceDestination,
		type PlanetSurfaceDestination
	} from '$lib/game/planet/surface/PlanetSurfaceDestination';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import {
		settlementForCountry,
		type SettlementAnchor
	} from '$lib/game/world/geography/SettlementCatalog';
	import { greatCircleDistanceKm } from '$lib/game/world/geography/GeographicDistance';
	import PlanetTravelHud from './PlanetTravelHud.svelte';

	interface Props {
		currentLocation?: GeographicLocationSnapshot | null;
		travelling?: boolean;
		travelError?: string | null;
		onClose?: () => void;
		onTravel?: (destination: PlanetTravelRequest) => void | Promise<void>;
	}
	let {
		currentLocation = null,
		travelling = false,
		travelError = null,
		onClose,
		onTravel
	}: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);
	let destination = $state<PlanetSurfaceDestination | null>(null);
	let loading = $state(false);
	let message = $state<string | null>(null);
	let settlement = $state<SettlementAnchor | null>(null);
	let distanceKm = $state<number | null>(null);
	$effect(() => {
		if (!travelling && travelError) {
			loading = false;
			message = travelError;
		}
	});

	onMount(() => {
		if (!canvas) return;
		const scene = new Scene();
		scene.background = new Color('#020711');
		const renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.outputColorSpace = SRGBColorSpace;
		const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
		const planet = new PlanetRenderer(scene);
		const destinationMarker = new PlanetDestinationMarker(
			planet.definition,
			planet.coordinateSystem
		);
		const currentMarker = new PlanetDestinationMarker(planet.definition, planet.coordinateSystem);
		planet.object.add(destinationMarker.object, currentMarker.object);
		if (currentLocation) {
			const coordinate = {
				latitudeRadians: (currentLocation.latitude * Math.PI) / 180,
				longitudeRadians: (currentLocation.longitude * Math.PI) / 180,
				altitudeMeters: currentLocation.elevationMeters
			};
			currentMarker.setDestination(coordinate, false);
		}
		scene.add(new AmbientLight(0x7892b0, 1.4), new HemisphereLight(0xaed8ff, 0x405028, 1.2));
		const sun = new DirectionalLight(0xffffff, 3.4);
		sun.position.set(180, 120, 240);
		scene.add(sun);
		const geography = new PlanetGeographyQuery();
		const countries = new CountryResolver();
		const ecology = new PlanetEcologyQuery();
		const context = new PlanetSurfaceContextResolver(countries, ecology);
		const raycaster = new Raycaster();
		const ndc = new Vector2();
		let orbitYaw = currentLocation ? (-currentLocation.longitude * Math.PI) / 180 : 0.38;
		let orbitPolar = currentLocation
			? Math.PI / 2 - (currentLocation.latitude * Math.PI) / 180
			: 1.35;
		let distance = 285;
		let pointer: number | null = null;
		let previous = new Vector2();
		let travel = 0;
		let frame = 0;
		let request = 0;
		const resize = () => {
			const w = Math.max(1, canvas!.clientWidth),
				h = Math.max(1, canvas!.clientHeight);
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		};
		const select = async (event: PointerEvent) => {
			const box = canvas!.getBoundingClientRect();
			ndc.set(
				((event.clientX - box.left) / box.width) * 2 - 1,
				(-(event.clientY - box.top) / box.height) * 2 + 1
			);
			raycaster.setFromCamera(ndc, camera);
			const coordinate = rayToPlanetDestination(
				raycaster.ray,
				planet.definition,
				planet.coordinateSystem
			);
			if (!coordinate) return;
			const id = ++request;
			destination = createPendingSurfaceDestination(coordinate);
			message = 'Reading land and elevation data…';
			destinationMarker.setDestination(coordinate, true);
			try {
				const sample = await geography.sample(coordinate);
				const details = await context.resolve(coordinate, sample);
				if (id !== request) return;
				destination = resolveSurfaceDestination(coordinate, sample, 0.55, details);
				settlement = details.country ? settlementForCountry(details.country) : null;
				distanceKm =
					currentLocation && settlement ? greatCircleDistanceKm(currentLocation, settlement) : null;
				message = destination.status === 'ocean' ? 'Ocean travel is not available yet.' : null;
			} catch {
				if (id === request) {
					message = 'Unable to read this destination.';
					destination = null;
				}
			}
		};
		const confirm = async () => {
			if (!destination || destination.status !== 'land' || loading) return;
			loading = true;
			message = null;
			try {
				await onTravel?.({
					coordinate: destination.coordinate,
					elevationMeters: destination.sample!.elevationMeters,
					countryId: destination.ecology?.country?.id ?? null,
					countryName: destination.ecology?.country?.name ?? null,
					biomeId: destination.ecology?.biome ?? null,
					biomeName: destination.ecology?.biomeLabel ?? null,
					settlementId: settlement?.id ?? null,
					settlementName: settlement?.name ?? null,
					totalDistanceKm: distanceKm ?? undefined
				});
			} catch (error) {
				message = error instanceof Error ? error.message : 'Travel failed.';
				loading = false;
			}
		};
		const down = (e: PointerEvent) => {
			pointer = e.pointerId;
			previous.set(e.clientX, e.clientY);
			travel = 0;
			canvas!.setPointerCapture(e.pointerId);
		};
		const move = (e: PointerEvent) => {
			if (pointer !== e.pointerId) return;
			const x = e.clientX - previous.x,
				y = e.clientY - previous.y;
			previous.set(e.clientX, e.clientY);
			travel += Math.abs(x) + Math.abs(y);
			orbitYaw += x * 0.005;
			orbitPolar = Math.max(0.08, Math.min(Math.PI - 0.08, orbitPolar + y * 0.005));
		};
		const up = (e: PointerEvent) => {
			if (pointer !== e.pointerId) return;
			pointer = null;
			canvas!.releasePointerCapture(e.pointerId);
			if (e.type !== 'pointercancel' && travel < 5 && e.button === 0) void select(e);
		};
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			distance = Math.max(108, Math.min(900, distance * Math.exp(e.deltaY * 0.0012)));
		};
		const key = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (e.code === 'Enter') void confirm();
			if (e.code === 'Escape') onClose?.();
		};
		const render = () => {
			camera.position.setFromSphericalCoords(distance, orbitPolar, orbitYaw);
			camera.lookAt(0, 0, 0);
			planet.update(camera, Math.max(1, canvas!.clientHeight));
			renderer.render(scene, camera);
			frame = requestAnimationFrame(render);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		canvas.addEventListener('pointerdown', down);
		canvas.addEventListener('pointermove', move);
		canvas.addEventListener('pointerup', up);
		canvas.addEventListener('pointercancel', up);
		canvas.addEventListener('wheel', wheel, { passive: false });
		window.addEventListener('keydown', key);
		resize();
		frame = requestAnimationFrame(render);
		return () => {
			request++;
			cancelAnimationFrame(frame);
			observer.disconnect();
			canvas?.removeEventListener('pointerdown', down);
			canvas?.removeEventListener('pointermove', move);
			canvas?.removeEventListener('pointerup', up);
			canvas?.removeEventListener('pointercancel', up);
			canvas?.removeEventListener('wheel', wheel);
			window.removeEventListener('keydown', key);
			destinationMarker.dispose();
			currentMarker.dispose();
			geography.dispose();
			countries.dispose();
			ecology.dispose();
			planet.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-[#020711]">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-none outline-none"
		aria-label="Orelunza world map"
		data-testid="planet-preview-canvas"
	></canvas>
	<section
		class="pointer-events-none absolute top-4 left-4 max-w-sm rounded-xl border border-white/10 bg-black/55 p-4 text-white backdrop-blur-md"
	>
		<p class="m-0 text-xs font-semibold tracking-[.25em] text-sky-300 uppercase">Orelunza Earth</p>
		<h1 class="mt-1 text-xl font-semibold">World map</h1>
		<p class="mb-0 text-sm text-white/65">
			Click land to choose a destination. Drag to rotate, scroll to zoom.
		</p>
		{#if currentLocation}<p class="mt-2 mb-0 text-xs text-emerald-200">
				You are here · {currentLocation.countryName ??
					currentLocation.biomeName ??
					'Planet surface'}
			</p>{/if}
		<button
			type="button"
			class="pointer-events-auto mt-3 rounded-md border border-white/15 px-3 py-1 text-sm hover:bg-white/10"
			onclick={onClose}>Close · M</button
		>
	</section>
	<div class="pointer-events-none absolute right-4 bottom-4">
		<PlanetTravelHud {destination} {loading} {message} onEnter={confirm} />
		{#if settlement}
			<section
				class="pointer-events-auto mt-2 rounded-xl border border-white/10 bg-black/65 p-4 text-white backdrop-blur-md"
			>
				<p class="m-0 text-xs font-semibold tracking-[.2em] text-sky-200 uppercase">Destination</p>
				<p class="mt-2 mb-0 text-lg font-semibold">{settlement.name}</p>
				<p class="m-0 text-sm text-white/60">{settlement.countryName}</p>
				{#if currentLocation && distanceKm !== null}<p class="mt-3 mb-0 text-sm">
						From {currentLocation.settlementName ?? currentLocation.countryName ?? 'your location'} ·
						<strong>{Math.round(distanceKm).toLocaleString()} km</strong>
					</p>{/if}
			</section>
		{/if}
	</div>
</div>
