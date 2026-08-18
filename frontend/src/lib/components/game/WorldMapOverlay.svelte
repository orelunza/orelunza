<script lang="ts">
	import { onMount } from 'svelte';
	import type { GameSnapshot } from '$lib/game/game-types';
	import { StaticCountryDataProvider } from '$lib/game/geography/countries/StaticCountryDataProvider';
	import {
		createPendingSurfaceDestination,
		type PlanetSurfaceDestination
	} from '$lib/game/planet/surface/PlanetSurfaceDestination';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import {
		fitLocations,
		createViewport,
		geographicAtPixel,
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
	import { project, unproject } from '$lib/game/world/map/WorldMapProjection';
	import type { WorldLocation } from '$lib/game/world/geography/WorldLocation';
	import type { SettlementAnchor } from '$lib/game/world/geography/SettlementCatalog';
	import { TravelDestinationResolver } from '$lib/game/world/travel/TravelDestinationResolver';

	interface Props {
		snapshot: GameSnapshot;
		onClose?: () => void;
		onGlobe?: () => void;
		onSetDestination?: (destination: PlanetTravelRequest) => void | Promise<void>;
		onClearDestination?: () => void | Promise<void>;
	}

	let { snapshot, onClose, onGlobe, onSetDestination, onClearDestination }: Props = $props();
	let destination = $derived(snapshot.destination);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let viewport = $state<MapViewport | null>(null);
	let selectedDestination = $state<PlanetSurfaceDestination | null>(null);
	let selectedRequest = $state<PlanetTravelRequest | null>(null);
	let selectedSettlement = $state<SettlementAnchor | null>(null);
	let selectedDistanceKm = $state<number | null>(null);
	let selectionLoading = $state(false);
	let actionLoading = $state(false);
	let message = $state<string | null>(null);
	let redraw: (() => void) | null = null;
	const provider = new WorldMapDataProvider();

	function playerLocation(): WorldLocation | null {
		const geographic = snapshot.geographicLocation;
		if (!geographic) return null;
		return {
			countryId: '',
			countryName: geographic.countryName ?? '',
			settlementId: geographic.settlementId ?? 'current',
			settlementName: geographic.settlementName ?? '',
			latitude: geographic.latitude,
			longitude: geographic.longitude,
			elevationMeters: geographic.elevationMeters,
			worldAnchorId: geographic.settlementId ?? 'current',
			biomeName: geographic.biomeName
		};
	}

	function selectionMatchesDestination(): boolean {
		if (!selectedRequest || !destination) return false;
		const latitude = (selectedRequest.coordinate.latitudeRadians * 180) / Math.PI;
		const longitude = (selectedRequest.coordinate.longitudeRadians * 180) / Math.PI;
		return (
			Math.abs(latitude - destination.location.latitude) < 1e-5 &&
			Math.abs(longitude - destination.location.longitude) < 1e-5
		);
	}

	function coordinateLabel(value: number, positive: string, negative: string): string {
		return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
	}

	function selectedDegrees(): { latitude: number; longitude: number } | null {
		if (!selectedDestination) return null;
		return {
			latitude: (selectedDestination.coordinate.latitudeRadians * 180) / Math.PI,
			longitude: (selectedDestination.coordinate.longitudeRadians * 180) / Math.PI
		};
	}

	async function setSelectedDestination(): Promise<void> {
		if (!selectedRequest || actionLoading) return;
		actionLoading = true;
		message = null;
		try {
			await onSetDestination?.(selectedRequest);
			selectedDestination = null;
			selectedRequest = null;
			selectedSettlement = null;
			selectedDistanceKm = null;
			message = 'Destination set. Your position has not changed.';
		} catch (error) {
			message = error instanceof Error ? error.message : 'Unable to set this destination.';
		} finally {
			actionLoading = false;
			redraw?.();
		}
	}

	async function clearSavedDestination(): Promise<void> {
		if (!destination || actionLoading) return;
		actionLoading = true;
		message = null;
		try {
			await onClearDestination?.();
		} catch (error) {
			message = error instanceof Error ? error.message : 'Unable to clear the destination.';
		} finally {
			actionLoading = false;
			redraw?.();
		}
	}

	function clearSelection(): void {
		selectedDestination = null;
		selectedRequest = null;
		selectedSettlement = null;
		selectedDistanceKm = null;
		selectionLoading = false;
		message = null;
		redraw?.();
	}

	$effect(() => {
		destination;
		snapshot.geographicLocation?.latitude;
		snapshot.geographicLocation?.longitude;
		redraw?.();
	});

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const initial = playerLocation() ?? destination?.location;
		viewport = createViewport(initial?.latitude ?? 0, initial?.longitude ?? 0, 1);
		const initialBox = canvas.getBoundingClientRect();
		if (destination && initial && initialBox.width > 0 && initialBox.height > 0) {
			viewport = fitLocations(
				viewport,
				[initial, destination.location],
				initialBox.width / initialBox.height
			);
		}

		const resolver = new TravelDestinationResolver();
		let pointers = new Map<number, { x: number; y: number; movement: number }>();
		let lastPinch = 0;
		let texture: HTMLImageElement | null = null;
		let selectionRequest = 0;
		const terrain = new Image();
		terrain.src = '/planet-data/preview/land-cover-overview.png';
		terrain.onload = () => {
			texture = terrain;
			draw();
		};

		const countryProvider = new StaticCountryDataProvider();
		void countryProvider
			.load()
			.then((payload) => {
				provider.setCountries(payload.countries);
				draw();
			})
			.catch(() => undefined);

		const scaleFor = (box: DOMRect) => 2 ** viewport!.zoom * box.height;
		const point = (lat: number, lon: number, box: DOMRect) => {
			const p = project(lat, lon);
			const scale = scaleFor(box);
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

		const drawTerrain = (image: HTMLImageElement, box: DOMRect) => {
			const scale = scaleFor(box);
			const imageWidth = image.naturalWidth || image.width;
			const imageHeight = image.naturalHeight || image.height;
			if (!imageWidth || !imageHeight) return;

			const worldLeft = box.width / 2 - viewport!.center.x * scale;
			const firstCopy = Math.floor(-worldLeft / scale) - 1;
			const lastCopy = Math.ceil((box.width - worldLeft) / scale) + 1;
			const stripHeight = 3;

			ctx.globalAlpha = 0.72;
			for (let y = 0; y < box.height; y += stripHeight) {
				const nextY = Math.min(box.height, y + stripHeight);
				const projectedTop = Math.max(
					0,
					Math.min(1, viewport!.center.y + (y - box.height / 2) / scale)
				);
				const projectedBottom = Math.max(
					0,
					Math.min(1, viewport!.center.y + (nextY - box.height / 2) / scale)
				);
				const topLatitude = unproject(viewport!.center.x, projectedTop).latitude;
				const bottomLatitude = unproject(viewport!.center.x, projectedBottom).latitude;
				const sourceTop = ((90 - topLatitude) / 180) * imageHeight;
				const sourceBottom = ((90 - bottomLatitude) / 180) * imageHeight;
				const sourceY = Math.max(0, Math.min(imageHeight - 1, sourceTop));
				const sourceHeight = Math.max(1, Math.min(imageHeight - sourceY, sourceBottom - sourceTop));

				for (let copy = firstCopy; copy <= lastCopy; copy += 1) {
					ctx.drawImage(
						image,
						0,
						sourceY,
						imageWidth,
						sourceHeight,
						worldLeft + copy * scale,
						y,
						scale,
						nextY - y
					);
				}
			}
			ctx.globalAlpha = 1;
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
			ctx.fillStyle = 'rgba(217,249,157,.82)';
			ctx.beginPath();
			ctx.arc(p.x, p.y, feature.importance && feature.importance >= 90 ? 3.5 : 2.5, 0, Math.PI * 2);
			ctx.fill();
		};

		const drawMarker = (
			latitude: number,
			longitude: number,
			box: DOMRect,
			kind: 'player' | 'destination' | 'selection',
			label?: string
		) => {
			const p = point(latitude, longitude, box);
			if (p.x < -36 || p.x > box.width + 36 || p.y < -36 || p.y > box.height + 36) return;
			ctx.save();

			if (kind === 'player') {
				ctx.fillStyle = '#0ea5e9';
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
				ctx.strokeStyle = 'rgba(14,165,233,.55)';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
				ctx.stroke();
			} else if (kind === 'destination') {
				ctx.translate(p.x, p.y);
				ctx.rotate(Math.PI / 4);
				ctx.fillStyle = 'rgba(7,16,24,.88)';
				ctx.strokeStyle = '#f6c65e';
				ctx.lineWidth = 3;
				ctx.fillRect(-7, -7, 14, 14);
				ctx.strokeRect(-7, -7, 14, 14);
				ctx.rotate(-Math.PI / 4);
				ctx.translate(-p.x, -p.y);
			} else {
				ctx.strokeStyle = '#f97316';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
				ctx.stroke();
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(p.x - 13, p.y);
				ctx.lineTo(p.x - 5, p.y);
				ctx.moveTo(p.x + 5, p.y);
				ctx.lineTo(p.x + 13, p.y);
				ctx.moveTo(p.x, p.y - 13);
				ctx.lineTo(p.x, p.y - 5);
				ctx.moveTo(p.x, p.y + 5);
				ctx.lineTo(p.x, p.y + 13);
				ctx.stroke();
			}

			if (label) {
				ctx.font = '700 12px system-ui';
				ctx.fillStyle = '#ffffff';
				ctx.shadowColor = 'rgba(0,0,0,.92)';
				ctx.shadowBlur = 5;
				ctx.fillText(label, p.x + 15, p.y - 10);
			}
			ctx.restore();
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
			if (texture) drawTerrain(texture, box);

			const player = playerLocation();
			const bounds = viewportBounds(viewport, box.width / box.height);
			const features = provider.query(bounds, viewport.zoom, { plan: null, player });
			const countryFeatures = features.filter((feature) => feature.type === 'country');
			for (const feature of countryFeatures) drawFeature(feature, box);
			for (const feature of features.filter(
				(feature) => feature.type === 'road' || feature.type === 'building'
			))
				drawFeature(feature, box);

			const occupiedLabels: { left: number; top: number; right: number; bottom: number }[] = [];
			const overlapsLabel = (candidate: {
				left: number;
				top: number;
				right: number;
				bottom: number;
			}) =>
				occupiedLabels.some(
					(label) =>
						candidate.left < label.right + 4 &&
						candidate.right > label.left - 4 &&
						candidate.top < label.bottom + 3 &&
						candidate.bottom > label.top - 3
				);
			const drawCountryLabel = (feature: MapFeature) => {
				if (!feature.label) return;
				const p = point(feature.latitude, feature.longitude, box);
				if (p.x < 0 || p.x > box.width || p.y < 0 || p.y > box.height) return;

				const detail = detailForZoom(viewport!.zoom);
				const fontSize = detail === 'far' ? 8 : detail === 'medium' ? 10 : 12;
				const maximumCharacters = detail === 'far' ? 16 : detail === 'medium' ? 22 : 28;
				const words = feature.label.split(/\s+/).filter(Boolean);
				const lines: string[] = [];
				let line = '';
				for (const word of words) {
					const next = line ? `${line} ${word}` : word;
					if (line && next.length > maximumCharacters) {
						lines.push(line);
						line = word;
					} else line = next;
				}
				if (line) lines.push(line);
				if (!lines.length) return;

				ctx.save();
				ctx.font = `700 ${fontSize}px system-ui`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.lineJoin = 'round';
				ctx.lineWidth = detail === 'far' ? 2.5 : 3;
				ctx.strokeStyle = 'rgba(7,16,24,.78)';
				ctx.fillStyle = detail === 'far' ? 'rgba(255,255,255,.78)' : 'rgba(255,255,255,.88)';
				const lineHeight = fontSize + 2;
				const top = p.y - ((lines.length - 1) * lineHeight) / 2;
				let maximumWidth = 0;
				for (const [index, countryLine] of lines.entries()) {
					const y = top + index * lineHeight;
					maximumWidth = Math.max(maximumWidth, ctx.measureText(countryLine).width);
					ctx.strokeText(countryLine, p.x, y);
					ctx.fillText(countryLine, p.x, y);
				}
				occupiedLabels.push({
					left: p.x - maximumWidth / 2,
					top: top - lineHeight / 2,
					right: p.x + maximumWidth / 2,
					bottom: top + (lines.length - 1) * lineHeight + lineHeight / 2
				});
				ctx.restore();
			};

			for (const feature of countryFeatures) drawCountryLabel(feature);

			const drawSettlementLabel = (feature: MapFeature) => {
				if (!feature.label) return;
				const p = point(feature.latitude, feature.longitude, box);
				if (p.x < 0 || p.x > box.width || p.y < 0 || p.y > box.height) return;

				ctx.font = '600 12px system-ui';
				const textWidth = Math.ceil(ctx.measureText(feature.label).width);
				const textHeight = 14;
				const candidates = [
					{ x: p.x + 8, y: p.y - 8 },
					{ x: p.x + 8, y: p.y + 18 },
					{ x: p.x - textWidth - 8, y: p.y - 8 },
					{ x: p.x - textWidth - 8, y: p.y + 18 },
					{ x: p.x + 8, y: p.y - 24 },
					{ x: p.x - textWidth - 8, y: p.y - 24 },
					{ x: p.x + 8, y: p.y + 34 },
					{ x: p.x - textWidth - 8, y: p.y + 34 }
				];

				let chosen = candidates.find((candidate) => {
					const bounds = {
						left: candidate.x,
						top: candidate.y - textHeight,
						right: candidate.x + textWidth,
						bottom: candidate.y + 2
					};
					return (
						bounds.left >= 4 &&
						bounds.right <= box.width - 4 &&
						bounds.top >= 4 &&
						bounds.bottom <= box.height - 4 &&
						!overlapsLabel(bounds)
					);
				});

				if (!chosen) {
					chosen = {
						x: Math.max(4, Math.min(box.width - textWidth - 4, p.x + 8)),
						y: Math.max(textHeight + 4, Math.min(box.height - 4, p.y - 8))
					};
				}

				const labelBounds = {
					left: chosen.x,
					top: chosen.y - textHeight,
					right: chosen.x + textWidth,
					bottom: chosen.y + 2
				};
				occupiedLabels.push(labelBounds);

				ctx.save();
				ctx.lineWidth = 3;
				ctx.lineJoin = 'round';
				ctx.strokeStyle = 'rgba(7,16,24,.9)';
				ctx.fillStyle = '#ffffff';
				ctx.strokeText(feature.label, chosen.x, chosen.y);
				ctx.fillText(feature.label, chosen.x, chosen.y);
				ctx.restore();
			};

			for (const feature of features.filter((feature) => feature.type === 'settlement'))
				drawSettlementLabel(feature);

			if (destination) {
				drawMarker(
					destination.location.latitude,
					destination.location.longitude,
					box,
					'destination',
					'Destination'
				);
			}

			const selected = selectedDegrees();
			if (selected && !selectionMatchesDestination())
				drawMarker(selected.latitude, selected.longitude, box, 'selection');
			if (player) drawMarker(player.latitude, player.longitude, box, 'player', 'You are here');
		};

		redraw = draw;
		const resize = new ResizeObserver(draw);
		resize.observe(canvas);

		const select = async (event: PointerEvent) => {
			if (!viewport) return;
			const box = canvas!.getBoundingClientRect();
			const geographic = geographicAtPixel(
				viewport,
				event.clientX - box.left,
				event.clientY - box.top,
				box.width,
				box.height
			);
			const coordinate = {
				latitudeRadians: (geographic.latitude * Math.PI) / 180,
				longitudeRadians: (geographic.longitude * Math.PI) / 180,
				altitudeMeters: 0
			};
			const id = ++selectionRequest;
			selectedDestination = createPendingSurfaceDestination(coordinate);
			selectedRequest = null;
			selectedSettlement = null;
			selectedDistanceKm = null;
			selectionLoading = true;
			message = 'Reading land, elevation and region data…';
			draw();
			try {
				const resolved = await resolver.resolve(coordinate, playerLocation());
				if (id !== selectionRequest) return;
				selectedDestination = resolved.destination;
				selectedRequest = resolved.request;
				selectedSettlement = resolved.settlement;
				selectedDistanceKm = resolved.distanceKm;
				message =
					resolved.destination.status === 'ocean'
						? 'This point is on water. It can be inspected, but it cannot be set as a land destination yet.'
						: null;
			} catch {
				if (id !== selectionRequest) return;
				selectedDestination = null;
				selectedRequest = null;
				selectedSettlement = null;
				selectedDistanceKm = null;
				message = 'Unable to read this destination.';
			} finally {
				if (id === selectionRequest) selectionLoading = false;
				draw();
			}
		};

		const down = (event: PointerEvent) => {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, movement: 0 });
			canvas!.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			const prior = pointers.get(event.pointerId);
			if (!prior || !viewport) return;
			const dx = event.clientX - prior.x;
			const dy = event.clientY - prior.y;
			pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
				movement: prior.movement + Math.abs(dx) + Math.abs(dy)
			});
			if (pointers.size === 1) {
				viewport = pan(viewport, dx, dy, canvas!.clientHeight);
			} else {
				const pair = [...pointers.values()];
				const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
				if (lastPinch) viewport = zoomAt(viewport, Math.sign(distance - lastPinch) * 0.12);
				lastPinch = distance;
			}
			draw();
		};
		const up = (event: PointerEvent) => {
			const pointer = pointers.get(event.pointerId);
			const wasSinglePointer = pointers.size === 1;
			pointers.delete(event.pointerId);
			if (pointers.size < 2) lastPinch = 0;
			if (canvas!.hasPointerCapture(event.pointerId))
				canvas!.releasePointerCapture(event.pointerId);
			if (
				event.type !== 'pointercancel' &&
				wasSinglePointer &&
				pointer &&
				pointer.movement < 5 &&
				event.button === 0
			)
				void select(event);
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
			selectionRequest += 1;
			redraw = null;
			resize.disconnect();
			canvas?.removeEventListener('pointerdown', down);
			canvas?.removeEventListener('pointermove', move);
			canvas?.removeEventListener('pointerup', up);
			canvas?.removeEventListener('pointercancel', up);
			canvas?.removeEventListener('wheel', wheel);
			resolver.dispose();
			countryProvider.dispose();
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

	function fitDestination() {
		if (!viewport || !destination || !canvas) return;
		const player = playerLocation();
		viewport = fitLocations(
			viewport,
			player ? [player, destination.location] : [destination.location],
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
					World map · {viewport ? detailForZoom(viewport.zoom) : 'loading'}
				</p>
				<h1 class="mt-1 text-xl font-semibold wrap-break-word sm:text-2xl">World map</h1>
				{#if playerLocation()}
					{@const current = playerLocation()!}
					<p class="mt-1 mb-0 text-xs text-white/70">
						Current position: {current.settlementName || current.countryName || snapshot.zoneName}
					</p>
					<p class="mt-0.5 mb-0 text-xs text-white/55">
						{coordinateLabel(current.latitude, 'N', 'S')} · {coordinateLabel(
							current.longitude,
							'E',
							'W'
						)} · {Math.round(current.elevationMeters).toLocaleString()} m{current.countryName
							? ` · ${current.countryName}`
							: ''}
					</p>
				{:else}
					<p class="mt-1 mb-0 text-xs font-semibold text-amber-200">
						Exact geographic position unavailable
					</p>
					<p class="mt-0.5 mb-0 text-xs text-white/55">
						{snapshot.zoneName} is a local world without a planetary anchor. Orelunza will not invent
						a latitude or longitude.
					</p>
				{/if}
				<p class="mt-1 mb-0 text-xs text-white/55">
					Click land to inspect a place. Setting a destination does not move the player.
				</p>
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
				class="h-full w-full cursor-crosshair touch-none"
				aria-label="Interactive world map. Click land to select a destination, drag to pan, and use controls or the wheel to zoom."
			></canvas>
			<div class="controls" aria-label="Map controls">
				<button type="button" class="control" aria-label="Zoom in" onclick={() => changeZoom(1)}
					><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button
				><button type="button" class="control" aria-label="Zoom out" onclick={() => changeZoom(-1)}
					><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></button
				><button
					type="button"
					class="control"
					aria-label="Recenter on your position"
					disabled={!playerLocation()}
					onclick={recenterPlayer}
					><svg viewBox="0 0 24 24"
						><path d="M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" /></svg
					></button
				>{#if destination}<button
						type="button"
						class="control"
						aria-label="Fit your position and destination"
						onclick={fitDestination}
						><svg viewBox="0 0 24 24"
							><path d="M5 5h5M5 5v5m14-5h-5m5 0v5M5 19h5m-5 0v-5m14 5h-5m5 0v-5" /></svg
						></button
					>{/if}
			</div>
		</div>

		<footer
			class="destination-sheet shrink-0 gap-3 p-3 sm:flex sm:items-end sm:justify-between sm:p-5"
		>
			<div class="min-w-0 flex-1">
				{#if selectedDestination}
					{@const selected = selectedDegrees()}
					<p class="m-0 text-xs font-semibold tracking-[.16em] text-orange-200 uppercase">
						Inspected location
					</p>
					{#if selectedRequest && selected}
						<p class="mt-1 mb-0 text-lg font-semibold wrap-break-word">
							{selectedSettlement?.name ??
								selectedRequest.countryName ??
								selectedRequest.biomeName ??
								'Planet surface'}
						</p>
						{#if selectedSettlement && selectedRequest.countryName}
							<p class="m-0 text-sm text-white/65">{selectedRequest.countryName}</p>
						{/if}
						<p class="m-0 text-sm text-white/60">
							{coordinateLabel(selected.latitude, 'N', 'S')} · {coordinateLabel(
								selected.longitude,
								'E',
								'W'
							)} · {Math.round(selectedRequest.elevationMeters).toLocaleString()} m
						</p>
						<p class="m-0 text-sm text-white/70">
							{selectedRequest.biomeName ?? 'Unknown biome'}{selectedDistanceKm !== null
								? ` · ${Math.round(selectedDistanceKm).toLocaleString()} km straight-line distance`
								: ''}
						</p>
					{:else if selected}
						<p class="mt-1 mb-0 text-sm text-white/70">
							{coordinateLabel(selected.latitude, 'N', 'S')} · {coordinateLabel(
								selected.longitude,
								'E',
								'W'
							)}
						</p>
					{/if}
				{:else if destination}
					<p class="m-0 text-xs font-semibold tracking-[.16em] text-amber-200 uppercase">
						Destination
					</p>
					<p class="mt-1 mb-0 text-lg font-semibold wrap-break-word">
						{destination.location.settlementName ||
							destination.location.countryName ||
							'Destination'}
					</p>
					{#if destination.location.settlementName && destination.location.countryName}
						<p class="m-0 text-sm text-white/65">{destination.location.countryName}</p>
					{/if}
					<p class="m-0 text-sm text-white/60">
						{coordinateLabel(destination.location.latitude, 'N', 'S')} · {coordinateLabel(
							destination.location.longitude,
							'E',
							'W'
						)} · {Math.round(destination.location.elevationMeters).toLocaleString()} m
					</p>
					<p class="m-0 text-sm text-white/70">
						{destination.location.biomeName ?? 'Unknown biome'}{destination.directDistanceKm !==
						null
							? ` · ${Math.round(destination.directDistanceKm).toLocaleString()} km straight-line distance`
							: ''}
					</p>
					<p class="mt-1 mb-0 text-xs text-white/50">
						No route or transport has been assumed. You remain at your current position.
					</p>
				{:else}
					{#if playerLocation()}
						<p class="m-0 text-sm text-white/60">
							The blue "You are here" marker is your only physical position. Click land to inspect a
							place, then set it as a destination if you want to remember where you intend to go.
						</p>
					{:else}
						<p class="m-0 text-sm text-amber-100/80">
							This local world has no geographic anchor yet, so the world map cannot truthfully
							place your body on Earth. A real position must be established before a blue player
							marker can appear.
						</p>
					{/if}
				{/if}
				{#if message}<p class="mt-2 mb-0 text-sm text-amber-200">{message}</p>{/if}
			</div>

			<div class="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
				{#if selectedDestination}
					<button type="button" class="control" onclick={clearSelection}>Clear selection</button>
				{/if}
				{#if selectedRequest && !selectionMatchesDestination()}
					<button
						type="button"
						class="control primary"
						disabled={selectionLoading || actionLoading}
						onclick={() => void setSelectedDestination()}
						>{actionLoading ? 'Setting…' : 'Set destination'}</button
					>
				{:else if destination && !selectedDestination}
					<button
						type="button"
						class="control"
						disabled={actionLoading}
						onclick={() => void clearSavedDestination()}>Clear destination</button
					>
				{/if}
				<button type="button" class="control" onclick={onGlobe}>Globe</button>
				<button type="button" class="control" onclick={onClose}>Close map</button>
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
	.control:disabled {
		cursor: wait;
		opacity: 0.55;
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
		.destination-sheet {
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
