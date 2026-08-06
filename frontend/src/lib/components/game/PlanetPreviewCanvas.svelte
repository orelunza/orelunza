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
		Vector2,
		Vector3,
		WebGLRenderer
	} from 'three';

	import type { PlanetLodQuality } from '$lib/game/planet/PlanetLodSystem';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';
	import { PlanetDestinationMarker } from '$lib/game/rendering/planet/PlanetDestinationMarker';
	import { PlanetSurfaceVoxelRenderer } from '$lib/game/rendering/planet/PlanetSurfaceVoxelRenderer';
	import { PlanetGeographyQuery } from '$lib/game/geography/PlanetGeographyQuery';
	import {
		createPendingSurfaceDestination,
		rayToPlanetDestination,
		resolveSurfaceDestination,
		type PlanetSurfaceDestination
	} from '$lib/game/planet/surface/PlanetSurfaceDestination';
	import { PlanetSurfaceSpawnResolver } from '$lib/game/planet/surface/PlanetSurfaceSpawnResolver';
	import { PlanetSurfaceSession } from '$lib/game/planet/surface/PlanetSurfaceSession';
	import PlanetTravelHud from './PlanetTravelHud.svelte';
	import PlanetLocationHud from './PlanetLocationHud.svelte';

	let canvas = $state<HTMLCanvasElement | null>(null);
	let quality = $state<PlanetLodQuality>('medium');
	let gridVisible = $state(false);
	let coastlinesVisible = $state(true);
	let latitude = $state(0);
	let longitude = $state(0);
	let altitudeKm = $state(0);
	let activeTiles = $state(0);
	let triangles = $state(0);
	let maximumLod = $state(0);
	let geometryRebuilds = $state(0);
	let geographyReady = $state(false);
	let geographyQuality = $state('unavailable');
	let loadedDataTiles = $state(0);
	let requestedDataTiles = $state(0);
	let fallbackDataTiles = $state(0);
	let cacheEntries = $state(0);
	let cacheKilobytes = $state(0);
	let landPercent = $state(0);
	let elevationRange = $state('0 / 0 m');
	let reliefExaggeration = $state(1);
	let destination = $state<PlanetSurfaceDestination | null>(null);
	let travelLoading = $state(false);
	let travelMessage = $state<string | null>(null);
	let explorationMode = $state<'globe' | 'surface'>('globe');
	let surfaceLatitude = $state(0);
	let surfaceLongitude = $state(0);
	let surfaceElevation = $state(0);
	let surfaceZone = $state('Planet Surface');
	let surfaceEditCount = $state(0);
	let planetRenderer: PlanetRenderer | null = null;
	let enterRegion = (): void => {};
	let returnToGlobe = (): void => {};

	$effect(() => {
		planetRenderer?.setQuality(quality);
	});

	$effect(() => {
		planetRenderer?.setDebugVisible(gridVisible);
	});

	$effect(() => {
		planetRenderer?.setCoastlinesVisible(coastlinesVisible);
	});

	onMount(() => {
		if (!canvas) {
			return;
		}

		const scene = new Scene();
		scene.background = new Color('#020711');
		const renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
		const planet = new PlanetRenderer(scene, undefined, quality);
		planetRenderer = planet;
		planet.setDebugVisible(gridVisible);
		planet.setCoastlinesVisible(coastlinesVisible);
		const marker = new PlanetDestinationMarker(planet.definition, planet.coordinateSystem);
		planet.object.add(marker.object);
		const geographyQuery = new PlanetGeographyQuery();
		const spawnResolver = new PlanetSurfaceSpawnResolver(planet.coordinateSystem, geographyQuery);
		const raycaster = new Raycaster();
		const pointerNdc = new Vector2();

		scene.add(new AmbientLight(0x7892b0, 1.4));
		scene.add(new HemisphereLight(0xaed8ff, 0x405028, 1.2));
		const sun = new DirectionalLight(0xffffff, 3.4);
		sun.position.set(180, 120, 240);
		scene.add(sun);

		let orbitYaw = 0.7;
		let orbitPolar = 1.08;
		let orbitDistance = 285;
		let surfaceYaw = 0.75;
		let surfacePolar = 1.05;
		let surfaceDistance = 62;
		let pointerId: number | null = null;
		let pointerButton = 0;
		let previousX = 0;
		let previousY = 0;
		let pointerTravel = 0;
		let frame = 0;
		let lastHudUpdate = 0;
		let surfaceSession: PlanetSurfaceSession | null = null;
		let surfaceRenderer: PlanetSurfaceVoxelRenderer | null = null;
		const logicalCamera = new Vector3();
		const surfaceFocus = new Vector3();

		const resize = (): void => {
			const width = Math.max(1, canvas?.clientWidth ?? 1);
			const height = Math.max(1, canvas?.clientHeight ?? 1);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		};

		const updateCamera = (): void => {
			if (explorationMode === 'globe') {
				camera.position.setFromSphericalCoords(orbitDistance, orbitPolar, orbitYaw);
				camera.lookAt(0, 0, 0);
				return;
			}
			camera.position
				.setFromSphericalCoords(surfaceDistance, surfacePolar, surfaceYaw)
				.add(surfaceFocus);
			camera.lookAt(surfaceFocus);
		};

		const updatePointerNdc = (event: PointerEvent): void => {
			const bounds = canvas?.getBoundingClientRect();
			if (!bounds) return;
			pointerNdc.set(
				((event.clientX - bounds.left) / bounds.width) * 2 - 1,
				-((event.clientY - bounds.top) / bounds.height) * 2 + 1
			);
		};

		const selectDestination = async (event: MouseEvent): Promise<void> => {
			if (explorationMode !== 'globe' || travelLoading) return;
			updatePointerNdc(event as PointerEvent);
			raycaster.setFromCamera(pointerNdc, camera);
			const coordinate = rayToPlanetDestination(
				raycaster.ray,
				planet.definition,
				planet.coordinateSystem
			);
			if (!coordinate) return;
			destination = createPendingSurfaceDestination(coordinate);
			travelMessage = 'Reading land and elevation data…';
			marker.setDestination(coordinate, true);
			try {
				const sample = await geographyQuery.sample(coordinate);
				destination = resolveSurfaceDestination(coordinate, sample);
				marker.setDestination(destination.coordinate, destination.status === 'land');
				travelMessage = destination.message;
			} catch {
				destination = { ...destination, status: 'error', message: 'Unable to read this region.' };
				travelMessage = destination.message;
				marker.setDestination(coordinate, false);
			}
		};

		enterRegion = (): void => {
			if (!destination || destination.status !== 'land' || travelLoading) return;
			travelLoading = true;
			travelMessage = 'Building a local voxel region from planetary elevation…';
			void spawnResolver
				.resolve(destination.coordinate, { halfExtentMeters: 192, resolution: 17 })
				.then((region) => {
					surfaceSession?.dispose();
					surfaceRenderer?.dispose();
					surfaceSession = new PlanetSurfaceSession(region);
					surfaceRenderer = new PlanetSurfaceVoxelRenderer(region.bridge);
					scene.add(surfaceRenderer.object);
					planet.object.visible = false;
					surfaceFocus.copy(region.spawnPosition).add(new Vector3(0, 5, 0));
					surfaceLatitude = (destination!.coordinate.latitudeRadians * 180) / Math.PI;
					surfaceLongitude = (destination!.coordinate.longitudeRadians * 180) / Math.PI;
					surfaceElevation = destination!.sample?.elevationMeters ?? 0;
					surfaceZone = region.generator.zoneAt(0, 0);
					surfaceEditCount = 0;
					explorationMode = 'surface';
					travelMessage = null;
				})
				.catch((error: unknown) => {
					travelMessage = error instanceof Error ? error.message : 'Unable to enter this region.';
				})
				.finally(() => {
					travelLoading = false;
				});
		};

		returnToGlobe = (): void => {
			if (surfaceRenderer) {
				scene.remove(surfaceRenderer.object);
				surfaceRenderer.dispose();
				surfaceRenderer = null;
			}
			surfaceSession?.dispose();
			surfaceSession = null;
			planet.object.visible = true;
			explorationMode = 'globe';
			travelMessage = null;
		};

		const pointerDown = (event: PointerEvent): void => {
			pointerId = event.pointerId;
			pointerButton = event.button;
			pointerTravel = 0;
			previousX = event.clientX;
			previousY = event.clientY;
			canvas?.setPointerCapture(event.pointerId);
		};

		const pointerMove = (event: PointerEvent): void => {
			if (pointerId !== event.pointerId) return;
			const deltaX = event.clientX - previousX;
			const deltaY = event.clientY - previousY;
			previousX = event.clientX;
			previousY = event.clientY;
			pointerTravel += Math.abs(deltaX) + Math.abs(deltaY);
			if (explorationMode === 'globe') {
				orbitYaw -= deltaX * 0.005;
				orbitPolar = Math.max(0.08, Math.min(Math.PI - 0.08, orbitPolar + deltaY * 0.005));
			} else {
				surfaceYaw -= deltaX * 0.006;
				surfacePolar = Math.max(0.18, Math.min(Math.PI / 2 - 0.05, surfacePolar + deltaY * 0.006));
			}
		};

		const pointerUp = (event: PointerEvent): void => {
			if (pointerId !== event.pointerId) return;
			pointerId = null;
			canvas?.releasePointerCapture(event.pointerId);
			if (explorationMode === 'surface' && surfaceRenderer && pointerTravel < 5) {
				updatePointerNdc(event);
				raycaster.setFromCamera(pointerNdc, camera);
				const hit = surfaceRenderer.pick(raycaster);
				if (hit) {
					const changed =
						pointerButton === 2 ? surfaceRenderer.placeAdjacent(hit) : surfaceRenderer.remove(hit);
					if (changed && surfaceSession) {
						surfaceEditCount = surfaceSession.region.bridge.edits.size;
					}
				}
			}
		};

		const wheel = (event: WheelEvent): void => {
			event.preventDefault();
			if (explorationMode === 'globe') {
				orbitDistance = Math.max(
					108,
					Math.min(900, orbitDistance * Math.exp(event.deltaY * 0.0012))
				);
			} else {
				surfaceDistance = Math.max(
					18,
					Math.min(140, surfaceDistance * Math.exp(event.deltaY * 0.0012))
				);
			}
		};

		const keyDown = (event: KeyboardEvent): void => {
			if (event.code === 'Enter' && explorationMode === 'globe') enterRegion();
			if (event.code === 'KeyG' && explorationMode === 'surface') returnToGlobe();
		};

		const contextMenu = (event: MouseEvent): void => event.preventDefault();

		const renderFrame = (time: number): void => {
			updateCamera();
			if (explorationMode === 'globe') {
				planet.update(camera, Math.max(1, canvas?.clientHeight ?? 1));
			}
			renderer.render(scene, camera);

			if (time - lastHudUpdate >= 200 && explorationMode === 'globe') {
				lastHudUpdate = time;
				const scale =
					planet.definition.equatorialRadiusMeters / planet.definition.renderRadiusUnits;
				logicalCamera.copy(camera.position).multiplyScalar(scale);
				const coordinate = planet.coordinateSystem.planetToGeodetic(logicalCamera);
				const diagnostics = planet.diagnostics;
				latitude = (coordinate.latitudeRadians * 180) / Math.PI;
				longitude = (coordinate.longitudeRadians * 180) / Math.PI;
				altitudeKm = coordinate.altitudeMeters / 1000;
				activeTiles = diagnostics.activeTiles;
				triangles = diagnostics.triangles;
				maximumLod = diagnostics.maximumLodLevel;
				geometryRebuilds = diagnostics.geometryRebuilds;
				geographyReady = diagnostics.geographyReady;
				geographyQuality = diagnostics.geographyQuality;
				loadedDataTiles = diagnostics.loadedDataTiles;
				requestedDataTiles = diagnostics.requestedDataTiles;
				fallbackDataTiles = diagnostics.fallbackDataTiles;
				cacheEntries = diagnostics.cacheEntries;
				cacheKilobytes = diagnostics.cacheBytes / 1024;
				landPercent = diagnostics.landVertexFraction * 100;
				elevationRange = `${diagnostics.minimumElevationMeters.toFixed(0)} / ${diagnostics.maximumElevationMeters.toFixed(0)} m`;
				reliefExaggeration = diagnostics.reliefExaggeration;
			}
			frame = requestAnimationFrame(renderFrame);
		};

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		canvas.addEventListener('pointerdown', pointerDown);
		canvas.addEventListener('pointermove', pointerMove);
		canvas.addEventListener('pointerup', pointerUp);
		canvas.addEventListener('pointercancel', pointerUp);
		canvas.addEventListener('dblclick', selectDestination);
		canvas.addEventListener('wheel', wheel, { passive: false });
		canvas.addEventListener('contextmenu', contextMenu);
		window.addEventListener('keydown', keyDown);
		resize();
		frame = requestAnimationFrame(renderFrame);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			canvas?.removeEventListener('pointerdown', pointerDown);
			canvas?.removeEventListener('pointermove', pointerMove);
			canvas?.removeEventListener('pointerup', pointerUp);
			canvas?.removeEventListener('pointercancel', pointerUp);
			canvas?.removeEventListener('dblclick', selectDestination);
			canvas?.removeEventListener('wheel', wheel);
			canvas?.removeEventListener('contextmenu', contextMenu);
			window.removeEventListener('keydown', keyDown);
			surfaceRenderer?.dispose();
			surfaceSession?.dispose();
			marker.dispose();
			geographyQuery.dispose();
			planet.dispose();
			planetRenderer = null;
			renderer.dispose();
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-[#020711]">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-none outline-none"
		aria-label="Orelunza planet and local voxel surface preview"
		data-testid="planet-preview-canvas"
	></canvas>

	<div
		class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4"
	>
		{#if explorationMode === 'globe'}
			<section
				class="pointer-events-auto max-w-md rounded-xl border border-white/10 bg-black/55 p-4 text-white shadow-2xl backdrop-blur-md"
			>
				<p class="text-xs font-semibold tracking-[0.28em] text-sky-300 uppercase">
					Planet Earth · Lot 3
				</p>
				<h1 class="mt-1 text-xl font-semibold">Globe to voxel surface</h1>
				<p class="mt-2 text-sm leading-6 text-white/65">
					Select real land, prepare a tangent local frame and descend into editable voxel terrain.
				</p>
				<div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
					<span class="text-white/45">Latitude</span><strong>{latitude.toFixed(3)}°</strong>
					<span class="text-white/45">Longitude</span><strong>{longitude.toFixed(3)}°</strong>
					<span class="text-white/45">Altitude</span><strong>{altitudeKm.toFixed(0)} km</strong>
					<span class="text-white/45">Visible tiles</span><strong>{activeTiles}</strong>
					<span class="text-white/45">LOD limit</span><strong>{maximumLod}</strong>
					<span class="text-white/45">Triangles</span><strong>{triangles.toLocaleString()}</strong>
					<span class="text-white/45">Data pack</span><strong
						class:text-emerald-300={geographyReady}>{geographyQuality}</strong
					>
					<span class="text-white/45">Data tiles</span><strong
						>{loadedDataTiles}/{requestedDataTiles}</strong
					>
					<span class="text-white/45">Parent fallbacks</span><strong>{fallbackDataTiles}</strong>
					<span class="text-white/45">Cache</span><strong
						>{cacheEntries} · {cacheKilobytes.toFixed(0)} KiB</strong
					>
					<span class="text-white/45">Visible land</span><strong>{landPercent.toFixed(1)}%</strong>
					<span class="text-white/45">Elevation range</span><strong>{elevationRange}</strong>
					<span class="text-white/45">Relief display</span><strong>×{reliefExaggeration}</strong>
					<span class="text-white/45">Rebuilds</span><strong>{geometryRebuilds}</strong>
				</div>
			</section>

			<section
				class="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/55 p-3 text-sm text-white backdrop-blur-md"
			>
				<label class="flex items-center gap-2"
					><span class="text-white/55">Quality</span><select
						bind:value={quality}
						class="rounded-md border border-white/15 bg-black/50 px-2 py-1"
						><option value="low">Low</option><option value="medium">Medium</option><option
							value="high">High</option
						></select
					></label
				>
				<label class="flex items-center gap-2"
					><input bind:checked={coastlinesVisible} type="checkbox" /><span>Coastlines</span></label
				>
				<label class="flex items-center gap-2"
					><input bind:checked={gridVisible} type="checkbox" /><span>LOD grid</span></label
				>
				<button
					type="button"
					class="rounded-md border border-white/15 px-3 py-1 hover:bg-white/10"
					onclick={() => window.history.back()}>Back</button
				>
			</section>
		{:else}
			<PlanetLocationHud
				latitude={surfaceLatitude}
				longitude={surfaceLongitude}
				elevationMeters={surfaceElevation}
				zone={surfaceZone}
				editCount={surfaceEditCount}
				onReturn={returnToGlobe}
			/>
		{/if}
	</div>

	{#if explorationMode === 'globe'}
		<div class="pointer-events-none absolute right-4 bottom-4">
			<PlanetTravelHud
				{destination}
				loading={travelLoading}
				message={travelMessage}
				onEnter={enterRegion}
			/>
		</div>
	{/if}
</div>
