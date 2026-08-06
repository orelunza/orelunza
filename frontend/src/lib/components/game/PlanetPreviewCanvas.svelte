<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		PerspectiveCamera,
		Scene,
		Vector3,
		WebGLRenderer
	} from 'three';

	import type { PlanetLodQuality } from '$lib/game/planet/PlanetLodSystem';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';

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
	let planetRenderer: PlanetRenderer | null = null;

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
		scene.add(new AmbientLight(0x7892b0, 1.4));
		const sun = new DirectionalLight(0xffffff, 3.4);
		sun.position.set(180, 120, 240);
		scene.add(sun);

		let orbitYaw = 0.7;
		let orbitPolar = 1.08;
		let orbitDistance = 285;
		let pointerId: number | null = null;
		let previousX = 0;
		let previousY = 0;
		let frame = 0;
		let lastHudUpdate = 0;
		const logicalCamera = new Vector3();

		const resize = (): void => {
			const width = Math.max(1, canvas?.clientWidth ?? 1);
			const height = Math.max(1, canvas?.clientHeight ?? 1);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		};

		const updateCamera = (): void => {
			camera.position.setFromSphericalCoords(orbitDistance, orbitPolar, orbitYaw);
			camera.lookAt(0, 0, 0);
		};

		const pointerDown = (event: PointerEvent): void => {
			pointerId = event.pointerId;
			previousX = event.clientX;
			previousY = event.clientY;
			canvas?.setPointerCapture(event.pointerId);
		};

		const pointerMove = (event: PointerEvent): void => {
			if (pointerId !== event.pointerId) {
				return;
			}
			const deltaX = event.clientX - previousX;
			const deltaY = event.clientY - previousY;
			previousX = event.clientX;
			previousY = event.clientY;
			orbitYaw -= deltaX * 0.005;
			orbitPolar = Math.max(0.08, Math.min(Math.PI - 0.08, orbitPolar + deltaY * 0.005));
		};

		const pointerUp = (event: PointerEvent): void => {
			if (pointerId === event.pointerId) {
				pointerId = null;
				canvas?.releasePointerCapture(event.pointerId);
			}
		};

		const wheel = (event: WheelEvent): void => {
			event.preventDefault();
			orbitDistance = Math.max(108, Math.min(900, orbitDistance * Math.exp(event.deltaY * 0.0012)));
		};

		const renderFrame = (time: number): void => {
			updateCamera();
			planet.update(camera, Math.max(1, canvas?.clientHeight ?? 1));
			renderer.render(scene, camera);

			if (time - lastHudUpdate >= 200) {
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
		canvas.addEventListener('wheel', wheel, { passive: false });
		resize();
		frame = requestAnimationFrame(renderFrame);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			canvas?.removeEventListener('pointerdown', pointerDown);
			canvas?.removeEventListener('pointermove', pointerMove);
			canvas?.removeEventListener('pointerup', pointerUp);
			canvas?.removeEventListener('pointercancel', pointerUp);
			canvas?.removeEventListener('wheel', wheel);
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
		aria-label="Orelunza real-world planetary geography preview"
		data-testid="planet-preview-canvas"
	></canvas>

	<div
		class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4"
	>
		<section
			class="pointer-events-auto max-w-md rounded-xl border border-white/10 bg-black/55 p-4 text-white shadow-2xl backdrop-blur-md"
		>
			<p class="text-xs font-semibold tracking-[0.28em] text-sky-300 uppercase">
				Planet Earth · Lot 2
			</p>
			<h1 class="mt-1 text-xl font-semibold">Real-world geography</h1>
			<p class="mt-2 text-sm leading-6 text-white/65">
				Natural Earth coastlines, streamed cube tiles, coarse global relief and a separate ocean
				surface. Drag to orbit and zoom toward the terrain.
			</p>
			<div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
				<span class="text-white/45">Latitude</span><strong>{latitude.toFixed(3)}°</strong>
				<span class="text-white/45">Longitude</span><strong>{longitude.toFixed(3)}°</strong>
				<span class="text-white/45">Altitude</span><strong>{altitudeKm.toFixed(0)} km</strong>
				<span class="text-white/45">Visible tiles</span><strong>{activeTiles}</strong>
				<span class="text-white/45">LOD limit</span><strong>{maximumLod}</strong>
				<span class="text-white/45">Triangles</span><strong>{triangles.toLocaleString()}</strong>
				<span class="text-white/45">Data pack</span>
				<strong class:text-emerald-300={geographyReady}>{geographyQuality}</strong>
				<span class="text-white/45">Data tiles</span>
				<strong>{loadedDataTiles}/{requestedDataTiles}</strong>
				<span class="text-white/45">Parent fallbacks</span><strong>{fallbackDataTiles}</strong>
				<span class="text-white/45">Cache</span>
				<strong>{cacheEntries} · {cacheKilobytes.toFixed(0)} KiB</strong>
				<span class="text-white/45">Visible land</span><strong>{landPercent.toFixed(1)}%</strong>
				<span class="text-white/45">Elevation range</span><strong>{elevationRange}</strong>
				<span class="text-white/45">Relief display</span><strong>×{reliefExaggeration}</strong>
				<span class="text-white/45">Rebuilds</span><strong>{geometryRebuilds}</strong>
			</div>
		</section>

		<section
			class="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/55 p-3 text-sm text-white backdrop-blur-md"
		>
			<label class="flex items-center gap-2">
				<span class="text-white/55">Quality</span>
				<select
					bind:value={quality}
					class="rounded-md border border-white/15 bg-black/50 px-2 py-1"
				>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
			</label>
			<label class="flex items-center gap-2">
				<input bind:checked={coastlinesVisible} type="checkbox" />
				<span>Coastlines</span>
			</label>
			<label class="flex items-center gap-2">
				<input bind:checked={gridVisible} type="checkbox" />
				<span>LOD grid</span>
			</label>
			<button
				type="button"
				class="rounded-md border border-white/15 px-3 py-1 hover:bg-white/10"
				onclick={() => window.history.back()}
			>
				Back
			</button>
		</section>
	</div>

	<div
		class="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs tracking-[0.12em] text-white/45 uppercase"
	>
		Natural Earth coastlines · bundled preview relief · GEBCO importer included for production data
	</div>
</div>
