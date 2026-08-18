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
	import { PlanetDestinationMarker } from '$lib/game/rendering/planet/PlanetDestinationMarker';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';
	import {
		createPendingSurfaceDestination,
		rayToPlanetDestination,
		type PlanetSurfaceDestination
	} from '$lib/game/planet/surface/PlanetSurfaceDestination';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import type { SettlementAnchor } from '$lib/game/world/geography/SettlementCatalog';
	import { TravelDestinationResolver } from '$lib/game/world/travel/TravelDestinationResolver';
	import type { WorldLocation } from '$lib/game/world/geography/WorldLocation';

	interface Props {
		mode?: 'onboarding' | 'navigation';
		focusLocation?: WorldLocation | null;
		descending?: boolean;
		currentLocation?: GeographicLocationSnapshot | null;
		travelling?: boolean;
		travelError?: string | null;
		onClose?: () => void;
		onSetDestination?: (destination: PlanetTravelRequest) => void | Promise<void>;
		/** @deprecated Use onSetDestination for navigation mode. */
		onTravel?: (destination: PlanetTravelRequest) => void | Promise<void>;
		onSelection?: (destination: PlanetTravelRequest | null) => void;
	}
	let {
		mode = 'navigation',
		focusLocation = null,
		descending = false,
		currentLocation = null,
		travelling = false,
		travelError = null,
		onClose,
		onSetDestination,
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
		planet.setDebugVisible(false);
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
		const destinationResolver = new TravelDestinationResolver();
		const raycaster = new Raycaster();
		const ndc = new Vector2();
		let orbitYaw = currentLocation ? (-currentLocation.longitude * Math.PI) / 180 : 0.38;
		let orbitPolar = currentLocation
			? Math.PI / 2 - (currentLocation.latitude * Math.PI) / 180
			: 1.35;
		let distance = 285;
		let pointer: number | null = null;
		let previous = new Vector2();
		let dragDistance = 0;
		let frame = 0;
		let request = 0;
		const resize = () => {
			const bounds = canvas!.getBoundingClientRect();
			const w = bounds.width,
				h = bounds.height;
			// The onboarding stage can be laid out after mount. Never lock the
			// renderer to a synthetic 1×1 buffer when the first measurement is zero.
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
			message = 'Reading land and elevation data…';
			destinationMarker.setDestination(coordinate, true);
			try {
				const resolved = await destinationResolver.resolve(coordinate, currentLocation);
				if (id !== request) return;
				destination = resolved.destination;
				settlement = resolved.settlement;
				distanceKm = resolved.distanceKm;
				travelRequest = resolved.request;
				message =
					destination.status === 'ocean'
						? 'This point is on water. It can be inspected, but it cannot be set as a land destination yet.'
						: null;
				if (mode === 'onboarding') onSelection?.(travelRequest);
			} catch {
				if (id === request) {
					message = 'Unable to read this destination.';
					destination = null;
					travelRequest = null;
					settlement = null;
					distanceKm = null;
				}
			}
		};
		const confirm = async () => {
			if (!travelRequest || loading) return;
			loading = true;
			message = null;
			try {
				await (onSetDestination ?? onTravel)?.(travelRequest);
			} catch (error) {
				message = error instanceof Error ? error.message : 'Unable to set this destination.';
				loading = false;
			}
		};
		const down = (e: PointerEvent) => {
			pointer = e.pointerId;
			previous.set(e.clientX, e.clientY);
			dragDistance = 0;
			canvas!.setPointerCapture(e.pointerId);
		};
		const move = (e: PointerEvent) => {
			if (pointer !== e.pointerId) return;
			const x = e.clientX - previous.x,
				y = e.clientY - previous.y;
			previous.set(e.clientX, e.clientY);
			dragDistance += Math.abs(x) + Math.abs(y);
			orbitYaw -= x * 0.005;
			orbitPolar = Math.max(0.08, Math.min(Math.PI - 0.08, orbitPolar + y * 0.005));
		};
		const up = (e: PointerEvent) => {
			if (pointer !== e.pointerId) return;
			pointer = null;
			canvas!.releasePointerCapture(e.pointerId);
			if (e.type !== 'pointercancel' && dragDistance < 5 && e.button === 0) void select(e);
		};
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			distance = Math.max(108, Math.min(900, distance * Math.exp(e.deltaY * 0.0012)));
		};
		const key = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (mode === 'navigation' && e.code === 'Enter') void confirm();
			if (mode === 'navigation' && e.code === 'Escape') onClose?.();
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
			destinationResolver.dispose();
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
	{#if mode === 'navigation'}<section
			class="pointer-events-none absolute top-4 left-4 max-w-sm rounded-xl border border-white/10 bg-black/55 p-4 text-white backdrop-blur-md"
		>
			<p class="m-0 text-xs font-semibold tracking-[.25em] text-sky-300 uppercase">
				Orelunza Earth
			</p>
			<h1 class="mt-1 text-xl font-semibold">World map</h1>
			<p class="mb-0 text-sm text-white/65">
				Click land to inspect a place. Drag to rotate, scroll to zoom.
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
		</section>{/if}
	{#if mode === 'navigation' && destination}
		<section
			class="pointer-events-auto absolute right-4 bottom-4 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/65 p-4 text-white backdrop-blur-md"
		>
			<p class="m-0 text-xs font-semibold tracking-[.2em] text-sky-200 uppercase">
				Inspected location
			</p>
			{#if travelRequest}
				<p class="mt-2 mb-0 text-lg font-semibold">
					{settlement?.name ??
						travelRequest.countryName ??
						travelRequest.biomeName ??
						'Planet surface'}
				</p>
				{#if settlement && travelRequest.countryName}
					<p class="m-0 text-sm text-white/60">{travelRequest.countryName}</p>
				{/if}
				<p class="mt-2 mb-0 text-sm text-white/70">
					{travelRequest.biomeName ?? 'Unknown biome'}{distanceKm !== null
						? ` · ${Math.round(distanceKm).toLocaleString()} km straight-line distance`
						: ''}
				</p>
				<p class="mt-1 mb-0 text-xs text-white/50">Setting this destination does not move you.</p>
				<button
					type="button"
					class="mt-3 rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-[#061018] hover:bg-sky-200 disabled:cursor-wait disabled:opacity-55"
					disabled={loading}
					onclick={() => void confirm()}>{loading ? 'Setting…' : 'Set destination'}</button
				>
			{:else}
				<p class="mt-2 mb-0 text-sm text-white/65">
					{message ?? 'Reading land, elevation and region data…'}
				</p>
			{/if}
			{#if message && travelRequest}<p class="mt-2 mb-0 text-sm text-amber-200">{message}</p>{/if}
		</section>
	{/if}
</div>
