<script lang="ts">
	import type { GameSnapshot } from '$lib/game/game-types';
	import { onMount } from 'svelte';
	import { StaticCountryDataProvider } from '$lib/game/geography/countries/StaticCountryDataProvider';
	import {
		fitLocations,
		createViewport,
		pan,
		recenter,
		viewportBounds,
		zoomAt,
		type MapViewport
	} from '$lib/game/world/map/MapViewport';
	import { detailForZoom } from '$lib/game/world/map/MapLod';
	import {
		WorldMapDataProvider,
		type MapCoordinate,
		type MapFeature
	} from '$lib/game/world/map/WorldMapDataProvider';
	import { project } from '$lib/game/world/map/WorldMapProjection';
	import type { WorldLocation } from '$lib/game/world/geography/WorldLocation';

	interface Props {
		snapshot: GameSnapshot;
		onClose?: () => void;
		onGlobe?: () => void;
	}
	let { snapshot, onClose, onGlobe }: Props = $props();
	let plan = $derived(snapshot.travel);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let viewport = $state<MapViewport | null>(null);
	let redraw: (() => void) | null = null;
	const provider = new WorldMapDataProvider();

	function playerLocation(): WorldLocation | null {
		const geographic = snapshot.geographicLocation;
		if (!geographic) return plan?.origin ?? null;
		return {
			countryId: '',
			countryName: geographic.countryName ?? '',
			settlementId: geographic.settlementId ?? 'current',
			settlementName: geographic.settlementName ?? 'Current location',
			latitude: geographic.latitude,
			longitude: geographic.longitude,
			elevationMeters: geographic.elevationMeters,
			worldAnchorId: geographic.settlementId ?? 'current',
			biomeName: geographic.biomeName
		};
	}
	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const initial = playerLocation() ?? plan?.origin;
		viewport = createViewport(initial?.latitude ?? 0, initial?.longitude ?? 0, plan ? 3 : 5);
		let pointers = new Map<number, { x: number; y: number }>();
		let lastPinch = 0;
		let texture: HTMLImageElement | null = null;
		const terrain = new Image();
		terrain.src = '/planet-data/preview/land-cover-overview.png';
		terrain.onload = () => {
			texture = terrain;
			draw();
		};
		void new StaticCountryDataProvider()
			.load()
			.then((payload) => {
				provider.setCountries(payload.countries);
				draw();
			})
			.catch(() => undefined);
		const point = (lat: number, lon: number, box: DOMRect) => {
			const p = project(lat, lon);
			const scale = 2 ** viewport!.zoom * box.width;
			let dx = p.x - viewport!.center.x;
			if (dx > 0.5) dx -= 1;
			if (dx < -0.5) dx += 1;
			return {
				x: dx * scale + box.width / 2,
				y: (p.y - viewport!.center.y) * scale + box.height / 2
			};
		};
		const path = (coordinates: readonly MapCoordinate[], box: DOMRect, close = false) => {
			coordinates.forEach((coordinate, index) => {
				const p = point(coordinate.latitude, coordinate.longitude, box);
				if (!index) ctx.moveTo(p.x, p.y);
				else ctx.lineTo(p.x, p.y);
			});
			if (close) ctx.closePath();
		};
		const drawFeature = (feature: MapFeature, box: DOMRect) => {
			if (feature.type === 'country' && feature.country) {
				ctx.strokeStyle = 'rgba(232,242,225,.38)';
				ctx.lineWidth = viewport!.zoom < 5 ? 1 : 0.6;
				for (const polygon of feature.country.polygons)
					for (const ring of polygon) {
						ctx.beginPath();
						path(
							ring.map(([longitude, latitude]) => ({ latitude, longitude })),
							box,
							true
						);
						ctx.stroke();
					}
				return;
			}
			if (feature.type === 'road' && feature.line) {
				ctx.strokeStyle = '#d8c48a';
				ctx.lineWidth = 2;
				ctx.beginPath();
				path(feature.line, box);
				ctx.stroke();
				return;
			}
			if (feature.type === 'building' && feature.footprint) {
				ctx.fillStyle = 'rgba(231,210,161,.9)';
				ctx.beginPath();
				path(feature.footprint, box, true);
				ctx.fill();
				return;
			}
			const p = point(feature.latitude, feature.longitude, box);
			ctx.fillStyle = feature.importance && feature.importance >= 90 ? '#f6c65e' : '#d9f99d';
			ctx.beginPath();
			ctx.arc(p.x, p.y, feature.importance && feature.importance >= 90 ? 6 : 4, 0, Math.PI * 2);
			ctx.fill();
		};
		const draw = () => {
			if (!viewport) return;
			const box = canvas!.getBoundingClientRect();
			if (!box.width || !box.height) return;
			const dpr = devicePixelRatio;
			canvas!.width = Math.round(box.width * dpr);
			canvas!.height = Math.round(box.height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = '#163f5a';
			ctx.fillRect(0, 0, box.width, box.height);
			if (texture) {
				ctx.globalAlpha = 0.58;
				ctx.drawImage(texture, 0, 0, box.width, box.height);
				ctx.globalAlpha = 1;
			}
			const player = playerLocation();
			const bounds = viewportBounds(viewport, box.width / box.height);
			const features = provider.query(bounds, viewport.zoom, { plan, player });
			for (const feature of features.filter((feature) => feature.type === 'country'))
				drawFeature(feature, box);
			for (const feature of features.filter(
				(feature) => feature.type === 'road' || feature.type === 'building'
			))
				drawFeature(feature, box);
			if (plan) {
				const a = point(plan.origin.latitude, plan.origin.longitude, box),
					b = point(plan.destination.latitude, plan.destination.longitude, box);
				ctx.setLineDash([8, 7]);
				ctx.strokeStyle = '#f6c65e';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
				ctx.stroke();
				ctx.setLineDash([]);
			}
			const labels: { text: string; x: number; y: number }[] = [];
			for (const feature of features.filter((feature) => feature.type === 'settlement')) {
				drawFeature(feature, box);
				const p = point(feature.latitude, feature.longitude, box);
				if (
					feature.label &&
					labels.every((label) => Math.hypot(label.x - p.x, label.y - p.y) > 70)
				) {
					labels.push({ text: feature.label, x: p.x, y: p.y });
				}
			}
			ctx.font = '600 12px system-ui';
			ctx.fillStyle = '#fff';
			for (const label of labels) ctx.fillText(label.text, label.x + 8, label.y - 8);
		};
		redraw = draw;
		const resize = new ResizeObserver(draw);
		resize.observe(canvas);
		const down = (event: PointerEvent) => {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			canvas!.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			const prior = pointers.get(event.pointerId);
			if (!prior || !viewport) return;
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (pointers.size === 1)
				viewport = pan(
					viewport,
					event.clientX - prior.x,
					event.clientY - prior.y,
					canvas!.clientWidth
				);
			else {
				const pair = [...pointers.values()];
				const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
				if (lastPinch) viewport = zoomAt(viewport, Math.sign(distance - lastPinch) * 0.12);
				lastPinch = distance;
			}
			draw();
		};
		const up = (event: PointerEvent) => {
			pointers.delete(event.pointerId);
			if (pointers.size < 2) lastPinch = 0;
		};
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			if (viewport) viewport = zoomAt(viewport, event.deltaY < 0 ? 1 : -1);
			draw();
		};
		canvas.addEventListener('pointerdown', down);
		canvas.addEventListener('pointermove', move);
		canvas.addEventListener('pointerup', up);
		canvas.addEventListener('pointercancel', up);
		canvas.addEventListener('wheel', wheel, { passive: false });
		draw();
		return () => {
			redraw = null;
			resize.disconnect();
			canvas?.removeEventListener('pointerdown', down);
			canvas?.removeEventListener('pointermove', move);
			canvas?.removeEventListener('pointerup', up);
			canvas?.removeEventListener('pointercancel', up);
			canvas?.removeEventListener('wheel', wheel);
		};
	});
	function changeZoom(delta: number) {
		if (viewport) viewport = zoomAt(viewport, delta);
		redraw?.();
	}
	function recenterPlayer() {
		const player = playerLocation();
		if (viewport && player) viewport = recenter(viewport, player.latitude, player.longitude);
		redraw?.();
	}
	function fitRoute() {
		if (viewport && plan && canvas)
			viewport = fitLocations(
				viewport,
				[plan.origin, plan.destination],
				canvas.clientWidth / canvas.clientHeight
			);
		redraw?.();
	}
</script>

<div
	class="map-enter absolute inset-0 z-[70] bg-[#071018] p-[max(0.75rem,env(safe-area-inset-top))] text-white"
>
	<section
		class="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10202a] shadow-2xl"
	>
		<header class="flex shrink-0 items-start justify-between gap-3 p-3 sm:p-5">
			<div class="min-w-0">
				<p class="m-0 text-xs font-semibold tracking-[.18em] text-amber-200 uppercase">
					Terrestrial map · {viewport ? detailForZoom(viewport.zoom) : 'loading'}
				</p>
				<h1 class="mt-1 text-xl font-semibold wrap-break-word sm:text-2xl">
					{plan
						? `${plan.origin.countryName} → ${plan.destination.countryName}`
						: 'Your surroundings'}
				</h1>
			</div>
			<button type="button" class="control" aria-label="Close map" onclick={onClose}
				><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg><span
					>Close</span
				></button
			>
		</header>
		<div class="relative min-h-0 flex-1 overflow-hidden border-y border-white/10">
			<canvas
				bind:this={canvas}
				class="h-full w-full touch-none"
				aria-label="Interactive terrestrial map. Drag to pan, use controls or wheel to zoom."
			></canvas>
			<div class="controls" aria-label="Map controls">
				<button type="button" class="control" aria-label="Zoom in" onclick={() => changeZoom(1)}
					><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button
				><button type="button" class="control" aria-label="Zoom out" onclick={() => changeZoom(-1)}
					><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></button
				><button type="button" class="control" aria-label="Recenter player" onclick={recenterPlayer}
					><svg viewBox="0 0 24 24"
						><path d="M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" /></svg
					></button
				>{#if plan}<button
						type="button"
						class="control"
						aria-label="Fit current route"
						onclick={fitRoute}
						><svg viewBox="0 0 24 24"
							><path d="M5 5h5M5 5v5m14-5h-5m5 0v5M5 19h5m-5 0v-5m14 5h-5m5 0v-5" /></svg
						></button
					>{/if}
			</div>
		</div>
		<footer class="route-sheet shrink-0 gap-3 p-3 sm:flex sm:items-end sm:justify-between sm:p-5">
			{#if plan}<div class="min-w-0">
					<p class="m-0 text-sm text-white/60">
						{plan.status} · {Math.round(plan.travelledDistanceKm).toLocaleString()} travelled · {Math.round(
							plan.remainingDistanceKm
						).toLocaleString()} remaining
					</p>
					<p class="m-0 text-lg font-semibold wrap-break-word">
						{Math.round(plan.totalDistanceKm).toLocaleString()} km · {plan.segments.length} approximate
						segment{plan.segments.length === 1 ? '' : 's'}
					</p>
					<p class="m-0 text-xs text-white/55">
						Dashed line is geographic approximation, not a road route.
					</p>
				</div>{:else}<p class="m-0 text-sm text-white/60">
					Map inspection does not move the player or advance travel.
				</p>{/if}
			<div class="flex gap-2">
				<button type="button" class="control" onclick={onGlobe}>Globe</button><button
					type="button"
					class="control primary"
					onclick={onClose}>Close map</button
				>
			</div>
		</footer>
	</section>
</div>

<style>
	.map-enter {
		animation: map-enter 0.35s ease-out;
	}
	.control {
		min-height: 2.75rem;
		min-width: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-radius: 0.4rem;
		padding: 0.5rem 0.7rem;
		color: white;
		background: rgb(255 255 255 / 0.08);
	}
	.control:hover,
	.control:focus-visible {
		outline: 2px solid #f6c65e;
		outline-offset: 2px;
		background: rgb(255 255 255 / 0.16);
	}
	.control svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.primary {
		background: #f97316;
		color: #111;
		font-weight: 700;
	}
	.controls {
		position: absolute;
		right: 0.75rem;
		top: 0.75rem;
		display: grid;
		gap: 0.35rem;
	}
	@keyframes map-enter {
		from {
			opacity: 0;
			transform: scale(1.01);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (max-width: 480px) {
		.route-sheet {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}
		.controls {
			right: 0.5rem;
			top: 0.5rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.map-enter {
			animation: none;
		}
	}
</style>
