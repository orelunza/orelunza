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
		WebGLRenderer
	} from 'three';
	import type { GeographicLocationSnapshot } from '$lib/game/game-types';
	import { StaticCountryDataProvider } from '$lib/game/geography/countries/StaticCountryDataProvider';
	import { PlanetCountryLabelLayer } from '$lib/game/rendering/planet/PlanetCountryLabelLayer';
	import { PlanetDestinationMarker } from '$lib/game/rendering/planet/PlanetDestinationMarker';
	import { PlanetLocationLabel } from '$lib/game/rendering/planet/PlanetLocationLabel';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';
	import {
		createPendingSurfaceDestination,
		rayToPlanetDestination,
		type PlanetSurfaceDestination
	} from '$lib/game/planet/surface/PlanetSurfaceDestination';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import type { NavigationDestination } from '$lib/game/world/navigation/NavigationDestination';
	import type { SettlementAnchor } from '$lib/game/world/geography/SettlementCatalog';
	import { TravelDestinationResolver } from '$lib/game/world/travel/TravelDestinationResolver';
	import type { WorldLocation } from '$lib/game/world/geography/WorldLocation';

	interface Props {
		mode?: 'onboarding' | 'navigation';
		focusLocation?: WorldLocation | null;
		descending?: boolean;
		currentLocation?: GeographicLocationSnapshot | null;
		savedDestination?: NavigationDestination | null;
		travelling?: boolean;
		travelError?: string | null;
		onClose?: () => void;
		onMap?: () => void;
		onSetDestination?: (destination: PlanetTravelRequest) => void | Promise<void>;
		onSetCurrentLocation?: (location: PlanetTravelRequest) => void | Promise<void>;
		onClearDestination?: () => void | Promise<void>;
		onView?: (destination: PlanetTravelRequest) => void;
		/** @deprecated Use onSetDestination for navigation mode. */
		onTravel?: (destination: PlanetTravelRequest) => void | Promise<void>;
		onSelection?: (destination: PlanetTravelRequest | null) => void;
	}

	let {
		mode = 'navigation',
		focusLocation = null,
		descending = false,
		currentLocation = null,
		savedDestination = null,
		travelling = false,
		travelError = null,
		onClose,
		onMap,
		onSetDestination,
		onSetCurrentLocation,
		onClearDestination,
		onView,
		onTravel,
		onSelection
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let destination = $state<PlanetSurfaceDestination | null>(null);
	let loading = $state(false);
	let message = $state<string | null>(null);
	let settlement = $state<SettlementAnchor | null>(null);
	let distanceKm = $state<number | null>(null);
	let travelRequest = $state<PlanetTravelRequest | null>(null);
	let syncMarkers: (() => void) | null = null;
	let confirmSelection: (() => Promise<void>) | null = null;
	let anchorCurrentLocation: (() => Promise<void>) | null = null;
	let clearSavedSelection: (() => Promise<void>) | null = null;

	$effect(() => {
		if (!travelling && travelError) {
			loading = false;
			message = travelError;
		}
	});

	$effect(() => {
		currentLocation?.latitude;
		currentLocation?.longitude;
		savedDestination?.location.latitude;
		savedDestination?.location.longitude;
		syncMarkers?.();
	});

	function selectionMatchesSavedDestination(): boolean {
		if (!travelRequest || !savedDestination) return false;
		const latitude = (travelRequest.coordinate.latitudeRadians * 180) / Math.PI;
		const longitude = (travelRequest.coordinate.longitudeRadians * 180) / Math.PI;
		return (
			Math.abs(latitude - savedDestination.location.latitude) < 1e-5 &&
			Math.abs(longitude - savedDestination.location.longitude) < 1e-5
		);
	}

	function clearInspection(): void {
		destination = null;
		travelRequest = null;
		settlement = null;
		distanceKm = null;
		message = null;
		syncMarkers?.();
	}

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
		planet.setDebugVisible(false);
		const countryLabelLayer = new PlanetCountryLabelLayer(
			planet.definition,
			planet.coordinateSystem
		);
		planet.object.add(countryLabelLayer.object);
		const destinationMarker = new PlanetDestinationMarker(
			planet.definition,
			planet.coordinateSystem
		);
		const currentMarker = new PlanetDestinationMarker(planet.definition, planet.coordinateSystem);
		const currentLabel = new PlanetLocationLabel(
			'You',
			'#7dd3fc',
			planet.definition,
			planet.coordinateSystem
		);
		const destinationLabel = new PlanetLocationLabel(
			'Destination',
			'#fb923c',
			planet.definition,
			planet.coordinateSystem
		);
		planet.object.add(
			destinationMarker.object,
			currentMarker.object,
			currentLabel.object,
			destinationLabel.object
		);
		scene.add(new AmbientLight(0x7892b0, 1.4), new HemisphereLight(0xaed8ff, 0x405028, 1.2));
		const sun = new DirectionalLight(0xffffff, 3.4);
		sun.position.set(180, 120, 240);
		scene.add(sun);

		const destinationResolver = new TravelDestinationResolver();
		const countryProvider = new StaticCountryDataProvider();
		void countryProvider
			.load()
			.then((payload) => {
				countryLabelLayer.setCountries(payload.countries);
			})
			.catch(() => undefined);

		const raycaster = new Raycaster();
		const ndc = new Vector2();
		const initialFocus = savedDestination?.location ?? focusLocation ?? currentLocation;
		let orbitYaw = initialFocus ? (-initialFocus.longitude * Math.PI) / 180 : 0.38;
		let orbitPolar = initialFocus ? Math.PI / 2 - (initialFocus.latitude * Math.PI) / 180 : 1.35;
		let distance = 285;
		let pointer: number | null = null;
		let previous = new Vector2();
		let dragDistance = 0;
		let frame = 0;
		let request = 0;

		const destinationCoordinate = () => {
			if (destination) return destination.coordinate;
			if (!savedDestination) return null;
			return {
				latitudeRadians: (savedDestination.location.latitude * Math.PI) / 180,
				longitudeRadians: (savedDestination.location.longitude * Math.PI) / 180,
				altitudeMeters: savedDestination.location.elevationMeters
			};
		};

		const updateMarkerObjects = () => {
			if (currentLocation) {
				const coordinate = {
					latitudeRadians: (currentLocation.latitude * Math.PI) / 180,
					longitudeRadians: (currentLocation.longitude * Math.PI) / 180,
					altitudeMeters: currentLocation.elevationMeters
				};
				currentMarker.object.visible = true;
				currentMarker.setDestination(coordinate, false);
				currentLabel.object.visible = true;
				currentLabel.setCoordinate(coordinate);
			} else {
				currentMarker.object.visible = false;
				currentLabel.object.visible = false;
			}

			const selected = destinationCoordinate();
			if (selected) {
				destinationMarker.object.visible = true;
				destinationMarker.setDestination(selected, true);
				destinationLabel.object.visible = true;
				destinationLabel.setCoordinate(selected);
			} else {
				destinationMarker.object.visible = false;
				destinationLabel.object.visible = false;
			}
		};
		syncMarkers = updateMarkerObjects;
		updateMarkerObjects();

		const resize = () => {
			const bounds = canvas!.getBoundingClientRect();
			const w = bounds.width;
			const h = bounds.height;
			if (w <= 0 || h <= 0) return;
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
			travelRequest = null;
			settlement = null;
			distanceKm = null;
			message = 'Loading…';
			updateMarkerObjects();
			try {
				const resolved = await destinationResolver.resolve(coordinate, currentLocation);
				if (id !== request) return;
				destination = resolved.destination;
				settlement = resolved.settlement;
				distanceKm = resolved.distanceKm;
				travelRequest = resolved.request;
				message = destination.status === 'ocean' ? 'Water' : null;
				updateMarkerObjects();
				if (mode === 'onboarding') onSelection?.(travelRequest);
			} catch {
				if (id === request) {
					message = 'Unavailable';
					destination = null;
					travelRequest = null;
					settlement = null;
					distanceKm = null;
					updateMarkerObjects();
				}
			}
		};

		const confirm = async () => {
			if (!travelRequest || loading || selectionMatchesSavedDestination()) return;
			loading = true;
			message = null;
			try {
				await (onSetDestination ?? onTravel)?.(travelRequest);
			} catch (error) {
				message = error instanceof Error ? error.message : 'Unable to set this destination.';
			} finally {
				loading = false;
			}
		};

		const anchorHere = async () => {
			if (!travelRequest || loading || currentLocation || destination?.status === 'ocean') return;
			loading = true;
			message = null;
			try {
				await onSetCurrentLocation?.(travelRequest);
				clearInspection();
			} catch (error) {
				message = error instanceof Error ? error.message : 'Unable to set the current location.';
			} finally {
				loading = false;
			}
		};

		const clearSavedDestination = async () => {
			if (!savedDestination || loading) return;
			loading = true;
			message = null;
			try {
				await onClearDestination?.();
			} catch (error) {
				message = error instanceof Error ? error.message : 'Unable to clear the destination.';
			} finally {
				loading = false;
			}
		};

		confirmSelection = confirm;
		anchorCurrentLocation = anchorHere;
		clearSavedSelection = clearSavedDestination;

		const down = (event: PointerEvent) => {
			pointer = event.pointerId;
			previous.set(event.clientX, event.clientY);
			dragDistance = 0;
			canvas!.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			const x = event.clientX - previous.x;
			const y = event.clientY - previous.y;
			previous.set(event.clientX, event.clientY);
			dragDistance += Math.abs(x) + Math.abs(y);
			orbitYaw -= x * 0.005;
			orbitPolar = Math.max(0.08, Math.min(Math.PI - 0.08, orbitPolar + y * 0.005));
		};
		const up = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			pointer = null;
			canvas!.releasePointerCapture(event.pointerId);
			if (event.type !== 'pointercancel' && dragDistance < 5 && event.button === 0)
				void select(event);
		};
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			distance = Math.max(108, Math.min(900, distance * Math.exp(event.deltaY * 0.0012)));
		};
		const key = (event: KeyboardEvent) => {
			if (event.repeat) return;
			if (mode === 'navigation' && event.code === 'Enter') void confirm();
			if (mode === 'navigation' && event.code === 'Escape') onClose?.();
		};

		const render = () => {
			if (descending && focusLocation) {
				const targetYaw = (-focusLocation.longitude * Math.PI) / 180;
				const targetPolar = Math.PI / 2 - (focusLocation.latitude * Math.PI) / 180;
				orbitYaw += (targetYaw - orbitYaw) * 0.035;
				orbitPolar += (targetPolar - orbitPolar) * 0.035;
				distance += (118 - distance) * 0.028;
			}
			camera.position.setFromSphericalCoords(distance, orbitPolar, orbitYaw);
			camera.lookAt(0, 0, 0);
			planet.update(camera, Math.max(1, canvas!.clientHeight));
			countryLabelLayer.update(distance);
			currentLabel.update(distance);
			destinationLabel.update(distance);
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
			request += 1;
			syncMarkers = null;
			confirmSelection = null;
			anchorCurrentLocation = null;
			clearSavedSelection = null;
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
			currentLabel.dispose();
			destinationLabel.dispose();
			destinationResolver.dispose();
			countryProvider.dispose();
			countryLabelLayer.dispose();
			planet.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-[#020711]">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-none outline-none"
		aria-label="Orelunza global globe"
		data-testid="planet-preview-canvas"
	></canvas>

	{#if mode === 'navigation'}
		<section
			class="pointer-events-auto absolute top-4 left-4 rounded-xl border border-white/10 bg-black/55 p-3 text-white backdrop-blur-md"
		>
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="m-0 text-[.68rem] font-semibold tracking-[.2em] text-sky-300 uppercase">
						Earth
					</p>
					<h1 class="m-0 mt-0.5 text-xl font-semibold">Globe</h1>
				</div>
				<nav class="view-nav" aria-label="World views">
					<button type="button" onclick={onClose}>World</button>
					<button type="button" onclick={onMap}>Map</button>
					<button type="button" class="active" aria-current="page">Globe</button>
				</nav>
			</div>
			{#if currentLocation}
				<p class="mt-2 mb-0 max-w-[18rem] truncate text-xs text-emerald-200">
					You · {currentLocation.countryName ?? currentLocation.settlementName ?? 'Earth'}
				</p>
			{:else}
				<p class="mt-2 mb-0 text-xs text-amber-100/75">Current position not set</p>
			{/if}
		</section>

		{#if destination || savedDestination}
			<section
				class="pointer-events-auto absolute right-4 bottom-4 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/65 p-4 text-white backdrop-blur-md"
			>
				{#if destination}
					<p class="m-0 text-[.68rem] font-semibold tracking-[.18em] text-sky-200 uppercase">
						Place
					</p>
					{#if travelRequest}
						<p class="mt-1 mb-0 text-lg font-semibold">
							{travelRequest.countryName ?? settlement?.name ?? travelRequest.biomeName ?? 'Earth'}
						</p>
						{#if settlement && !settlement.name.endsWith('Entry Settlement')}
							<p class="m-0 text-sm text-white/55">{settlement.name}</p>
						{/if}
						<p class="mt-1 mb-0 text-xs text-white/55">
							{travelRequest.biomeName ?? 'Unknown terrain'}{distanceKm !== null
								? ` · ${Math.round(distanceKm).toLocaleString()} km`
								: ''}
						</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="action"
								onclick={() => travelRequest && onView?.(travelRequest)}>View</button
							>
							{#if !currentLocation && destination.status !== 'ocean'}
								<button
									type="button"
									class="action"
									disabled={loading}
									onclick={() => void anchorCurrentLocation?.()}>Set current location</button
								>
							{/if}
							{#if currentLocation && destination.status !== 'ocean' && !selectionMatchesSavedDestination()}
								<button
									type="button"
									class="action primary"
									disabled={loading}
									onclick={() => void confirmSelection?.()}>Destination</button
								>
							{/if}
							<button type="button" class="action subtle" onclick={clearInspection}>Clear</button>
						</div>
					{:else}
						<p class="mt-2 mb-0 text-sm text-white/65">{message ?? 'Loading…'}</p>
					{/if}
				{:else if savedDestination}
					<p class="m-0 text-[.68rem] font-semibold tracking-[.18em] text-orange-200 uppercase">
						Destination
					</p>
					<p class="mt-1 mb-0 text-lg font-semibold">
						{savedDestination.location.settlementName ||
							savedDestination.location.countryName ||
							'Destination'}
					</p>
					<div class="mt-3 flex gap-2">
						<button type="button" class="action" onclick={onMap}>Map</button>
						<button
							type="button"
							class="action subtle"
							disabled={loading}
							onclick={() => void clearSavedSelection?.()}>Clear</button
						>
					</div>
				{/if}
				{#if message && travelRequest}
					<p class="mt-2 mb-0 text-xs text-amber-200">{message}</p>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.view-nav {
		display: inline-flex;
		gap: 0.15rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.18);
		padding: 0.15rem;
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
	.view-nav .active {
		background: rgb(125 211 252 / 0.18);
		color: #bae6fd;
		font-weight: 700;
	}
	.action {
		border: 1px solid rgb(255 255 255 / 0.14);
		background: rgb(255 255 255 / 0.06);
	}
	.action.primary {
		border-color: transparent;
		background: #7dd3fc;
		color: #061018;
		font-weight: 750;
	}
	.action.subtle {
		color: rgb(255 255 255 / 0.55);
	}
	.action:disabled {
		cursor: wait;
		opacity: 0.5;
	}
</style>
