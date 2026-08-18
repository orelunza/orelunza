<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Color,
		DirectionalLight,
		HemisphereLight,
		PerspectiveCamera,
		Scene,
		SRGBColorSpace,
		Vector2,
		Vector3,
		WebGLRenderer
	} from 'three';

	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import { PlanetDestinationMarker } from '$lib/game/rendering/planet/PlanetDestinationMarker';
	import { PlanetRenderer } from '$lib/game/rendering/planet/PlanetRenderer';

	interface Props {
		location: PlanetTravelRequest;
		onWorld?: () => void;
		onMap?: () => void;
		onGlobe?: () => void;
		onSetDestination?: (destination: PlanetTravelRequest) => void;
	}

	let { location, onWorld, onMap, onGlobe, onSetDestination }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);

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

		const camera = new PerspectiveCamera(48, 1, 0.04, 5000);
		const planet = new PlanetRenderer(scene);
		planet.setDebugVisible(false);
		const marker = new PlanetDestinationMarker(planet.definition, planet.coordinateSystem);
		planet.object.add(marker.object);
		marker.setDestination(location.coordinate, true);

		scene.add(new AmbientLight(0x7892b0, 1.25), new HemisphereLight(0xb7dcff, 0x475226, 1.05));
		const sun = new DirectionalLight(0xffffff, 3.2);
		sun.position.set(170, 145, 210);
		scene.add(sun);

		const renderScale =
			planet.definition.renderRadiusUnits / planet.definition.equatorialRadiusMeters;
		const planetPoint = planet.coordinateSystem.geodeticToPlanet({
			...location.coordinate,
			altitudeMeters: location.elevationMeters
		});
		const target = new Vector3(
			planetPoint.x * renderScale,
			planetPoint.y * renderScale,
			planetPoint.z * renderScale
		);
		const normal = target.clone().normalize();
		const reference = Math.abs(normal.y) < 0.92 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
		const east = reference.clone().cross(normal).normalize();
		const north = normal.clone().cross(east).normalize();

		let bearing = 0;
		let elevationAngle = 0.72;
		let viewDistance = 24;
		let pointer: number | null = null;
		let previous = new Vector2();
		let frame = 0;

		const resize = () => {
			const bounds = canvas!.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) return;
			renderer.setSize(bounds.width, bounds.height, false);
			camera.aspect = bounds.width / bounds.height;
			camera.updateProjectionMatrix();
		};

		const updateCamera = () => {
			const tangent = north
				.clone()
				.multiplyScalar(Math.cos(bearing))
				.addScaledVector(east, Math.sin(bearing))
				.normalize();
			const radial = Math.sin(elevationAngle) * viewDistance;
			const lateral = Math.cos(elevationAngle) * viewDistance;
			camera.position
				.copy(target)
				.addScaledVector(normal, radial)
				.addScaledVector(tangent, lateral);
			camera.up.copy(normal);
			camera.lookAt(target);
		};

		const down = (event: PointerEvent) => {
			pointer = event.pointerId;
			previous.set(event.clientX, event.clientY);
			canvas!.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			const x = event.clientX - previous.x;
			const y = event.clientY - previous.y;
			previous.set(event.clientX, event.clientY);
			bearing -= x * 0.006;
			elevationAngle = Math.max(0.28, Math.min(1.35, elevationAngle + y * 0.004));
		};
		const up = (event: PointerEvent) => {
			if (pointer !== event.pointerId) return;
			pointer = null;
			canvas!.releasePointerCapture(event.pointerId);
		};
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			viewDistance = Math.max(7, Math.min(140, viewDistance * Math.exp(event.deltaY * 0.0012)));
		};

		const render = () => {
			updateCamera();
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
		resize();
		frame = requestAnimationFrame(render);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			canvas?.removeEventListener('pointerdown', down);
			canvas?.removeEventListener('pointermove', move);
			canvas?.removeEventListener('pointerup', up);
			canvas?.removeEventListener('pointercancel', up);
			canvas?.removeEventListener('wheel', wheel);
			marker.dispose();
			planet.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-[#020711]">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full touch-none outline-none"
		aria-label="Remote Earth view"
		data-testid="remote-planet-view"
	></canvas>

	<section
		class="pointer-events-auto absolute top-4 left-4 rounded-xl border border-white/10 bg-black/55 p-3 text-white backdrop-blur-md"
	>
		<p class="m-0 text-[.68rem] font-semibold tracking-[.2em] text-sky-300 uppercase">
			Remote view
		</p>
		<h1 class="m-0 mt-0.5 text-xl font-semibold">
			{location.countryName ?? location.settlementName ?? 'Earth'}
		</h1>
		{#if location.biomeName}
			<p class="mt-1 mb-0 text-xs text-white/55">{location.biomeName}</p>
		{/if}
	</section>

	<nav class="view-nav pointer-events-auto absolute top-4 right-4" aria-label="World views">
		<button type="button" onclick={onWorld}>World</button>
		<button type="button" onclick={onMap}>Map</button>
		<button type="button" onclick={onGlobe}>Globe</button>
	</nav>

	<div class="pointer-events-auto absolute right-4 bottom-4 flex gap-2">
		<button type="button" class="action" onclick={onGlobe}>Back to globe</button>
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
