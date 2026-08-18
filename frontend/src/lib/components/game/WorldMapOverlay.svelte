<script lang="ts">
	import { onMount } from 'svelte';
	import type { GameSnapshot } from '$lib/game/game-types';
	import { knownSettlements } from '$lib/game/world/geography/SettlementCatalog';
	import { compassDirection, localDestinationVector } from '$lib/game/world/map/LocalMapNavigation';
	import { findLocalMapPath, localMapTarget } from '$lib/game/world/map/LocalMapPath';

	interface Props {
		snapshot: GameSnapshot;
		onClose?: () => void;
		onGlobe?: () => void;
		onClearDestination?: () => void | Promise<void>;
	}

	let { snapshot, onClose, onGlobe, onClearDestination }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);
	let actionLoading = $state(false);
	let redraw: (() => void) | null = null;

	const destination = $derived(snapshot.destination);
	const geographic = $derived(snapshot.geographicLocation);
	const mapSpanMeters = $derived(snapshot.miniMap.size * snapshot.miniMap.cellSizeMeters);
	const destinationDirectionData = $derived(destinationDirection());

	function distanceLabel(kilometres: number | null): string {
		if (kilometres === null || !Number.isFinite(kilometres)) return '';
		if (kilometres < 1) return `${Math.round(kilometres * 1000).toLocaleString()} m`;
		if (kilometres < 10) return `${kilometres.toFixed(1)} km`;
		return `${Math.round(kilometres).toLocaleString()} km`;
	}

	function destinationDirection(): { bearing: number; compass: string } | null {
		if (!geographic || !destination) return null;
		const vector = localDestinationVector(geographic, destination.location);
		return { bearing: vector.bearingDegrees, compass: compassDirection(vector.bearingDegrees) };
	}

	async function clearDestination(): Promise<void> {
		if (!destination || actionLoading) return;
		actionLoading = true;
		try {
			await onClearDestination?.();
		} finally {
			actionLoading = false;
		}
	}

	$effect(() => {
		snapshot.miniMap;
		snapshot.player.position.x;
		snapshot.player.position.z;
		snapshot.destination?.location.latitude;
		snapshot.destination?.location.longitude;
		redraw?.();
	});

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const text = (
			value: string,
			x: number,
			y: number,
			font = '600 12px system-ui',
			align: CanvasTextAlign = 'left'
		) => {
			ctx.save();
			ctx.font = font;
			ctx.textAlign = align;
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			ctx.lineWidth = 4;
			ctx.strokeStyle = 'rgba(3,8,10,.88)';
			ctx.fillStyle = '#f8fafc';
			ctx.strokeText(value, x, y);
			ctx.fillText(value, x, y);
			ctx.restore();
		};

		const cellScreen = (x: number, z: number, box: DOMRect) => {
			const size = Math.max(1, snapshot.miniMap.size);
			const cellWidth = box.width / size;
			const cellHeight = box.height / size;
			return {
				x: (x + 0.5) * cellWidth,
				y: (size - z - 0.5) * cellHeight
			};
		};

		const drawRelief = (box: DOMRect) => {
			const size = Math.max(1, snapshot.miniMap.size);
			const cells = snapshot.miniMap.cells;
			const cellWidth = box.width / size;
			const cellHeight = box.height / size;
			const land = cells.filter((cell) => cell.terrain === 'land');
			const minimum = land.length ? Math.min(...land.map((cell) => cell.elevationMeters)) : 0;
			const maximum = land.length
				? Math.max(...land.map((cell) => cell.elevationMeters))
				: minimum + 1;
			const range = Math.max(1, maximum - minimum);

			for (const cell of cells) {
				if (cell.terrain === 'water') {
					ctx.fillStyle = '#31566a';
				} else {
					const elevation = (cell.elevationMeters - minimum) / range;
					const lightness = 27 + elevation * 24;
					const saturation = 18 + (1 - elevation) * 10;
					ctx.fillStyle = `hsl(92 ${saturation}% ${lightness}%)`;
				}
				ctx.fillRect(
					cell.x * cellWidth,
					(size - 1 - cell.z) * cellHeight,
					Math.ceil(cellWidth + 0.75),
					Math.ceil(cellHeight + 0.75)
				);
			}

			// Lightweight contour lines make the local terrain readable even when the
			// whole area belongs to the same biome.
			const byKey = new Map(cells.map((cell) => [`${cell.x}:${cell.z}`, cell]));
			ctx.save();
			ctx.strokeStyle = 'rgba(255,255,255,.12)';
			ctx.lineWidth = 1;
			for (const cell of land) {
				const band = Math.floor(cell.elevationMeters / 8);
				const east = byKey.get(`${cell.x + 1}:${cell.z}`);
				const north = byKey.get(`${cell.x}:${cell.z + 1}`);
				const x = cell.x * cellWidth;
				const y = (size - 1 - cell.z) * cellHeight;
				if (east && Math.floor(east.elevationMeters / 8) !== band) {
					ctx.beginPath();
					ctx.moveTo(x + cellWidth, y);
					ctx.lineTo(x + cellWidth, y + cellHeight);
					ctx.stroke();
				}
				if (north && Math.floor(north.elevationMeters / 8) !== band) {
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x + cellWidth, y);
					ctx.stroke();
				}
			}
			ctx.restore();
		};

		const drawNearbySettlements = (box: DOMRect) => {
			if (!geographic) return;
			const halfSpan = Math.max(1, mapSpanMeters / 2);
			for (const settlement of knownSettlements()) {
				const vector = localDestinationVector(geographic, settlement);
				if (Math.abs(vector.eastMeters) > halfSpan || Math.abs(vector.northMeters) > halfSpan)
					continue;
				const x = box.width / 2 + (vector.eastMeters / halfSpan) * (box.width / 2);
				const y = box.height / 2 - (vector.northMeters / halfSpan) * (box.height / 2);
				if (Math.hypot(x - box.width / 2, y - box.height / 2) < 30) continue;
				text(settlement.name, x, y, '650 11px system-ui', 'center');
			}
		};

		const drawGuidance = (box: DOMRect) => {
			if (!destination || !geographic) return;
			const vector = localDestinationVector(geographic, destination.location);
			const target = localMapTarget(snapshot.miniMap, vector.eastMeters, vector.northMeters);
			const path = findLocalMapPath(snapshot.miniMap, target);

			if (path.length > 1) {
				ctx.save();
				ctx.strokeStyle = 'rgba(255,255,255,.92)';
				ctx.lineWidth = 4;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.shadowColor = 'rgba(0,0,0,.55)';
				ctx.shadowBlur = 4;
				ctx.beginPath();
				for (let index = 0; index < path.length; index += 1) {
					const point = cellScreen(path[index].x, path[index].z, box);
					if (index === 0) ctx.moveTo(point.x, point.y);
					else ctx.lineTo(point.x, point.y);
				}
				ctx.stroke();
				ctx.restore();
			}

			const endpoint = cellScreen(target.x, target.z, box);
			ctx.save();
			ctx.translate(endpoint.x, endpoint.y);
			if (target.inside) {
				ctx.strokeStyle = '#fb923c';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(0, 0, 9, 0, Math.PI * 2);
				ctx.stroke();
			} else {
				const centreX = box.width / 2;
				const centreY = box.height / 2;
				ctx.rotate(Math.atan2(endpoint.y - centreY, endpoint.x - centreX));
				ctx.fillStyle = '#fb923c';
				ctx.beginPath();
				ctx.moveTo(11, 0);
				ctx.lineTo(-7, -7);
				ctx.lineTo(-7, 7);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();

			const name =
				destination.location.settlementName || destination.location.countryName || 'Destination';
			const rightSide = endpoint.x > box.width * 0.68;
			const labelX = endpoint.x + (rightSide ? -15 : 15);
			const align: CanvasTextAlign = rightSide ? 'right' : 'left';
			text(name, labelX, endpoint.y - 7, '700 12px system-ui', align);
			const distance = distanceLabel(destination.directDistanceKm);
			if (distance) text(distance, labelX, endpoint.y + 10, '500 11px system-ui', align);
		};

		const drawPlayer = (box: DOMRect) => {
			const x = box.width / 2;
			const y = box.height / 2;
			const heading = snapshot.miniMap.playerYaw - snapshot.miniMap.northRadians;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(heading);
			ctx.fillStyle = '#38bdf8';
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2.5;
			ctx.beginPath();
			ctx.moveTo(0, -15);
			ctx.lineTo(-9, 10);
			ctx.lineTo(0, 6);
			ctx.lineTo(9, 10);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		};

		const draw = () => {
			const box = canvas!.getBoundingClientRect();
			if (!box.width || !box.height) return;
			const dpr = Math.min(devicePixelRatio, 2);
			canvas!.width = Math.round(box.width * dpr);
			canvas!.height = Math.round(box.height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = '#1f352f';
			ctx.fillRect(0, 0, box.width, box.height);
			drawRelief(box);
			drawNearbySettlements(box);
			drawGuidance(box);
			drawPlayer(box);

			text('N', box.width / 2, 18, '800 12px system-ui', 'center');
			ctx.save();
			ctx.strokeStyle = 'rgba(255,255,255,.9)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(box.width / 2, 29);
			ctx.lineTo(box.width / 2, 43);
			ctx.stroke();
			ctx.restore();

			const scaleMeters = 1000;
			const scalePixels = (scaleMeters / Math.max(1, mapSpanMeters)) * box.width;
			ctx.save();
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(18, box.height - 20);
			ctx.lineTo(18 + scalePixels, box.height - 20);
			ctx.stroke();
			ctx.restore();
			text('1 km', 18, box.height - 33, '600 10px system-ui');
		};

		redraw = draw;
		const resize = new ResizeObserver(draw);
		resize.observe(canvas);
		draw();
		return () => {
			redraw = null;
			resize.disconnect();
		};
	});
</script>

<div
	class="absolute inset-0 z-[70] bg-[#071018] p-[max(0.75rem,env(safe-area-inset-top))] text-white"
>
	<section
		class="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10202a] shadow-2xl"
	>
		<header class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
			<div class="min-w-0">
				<p class="m-0 text-[.68rem] font-semibold tracking-[.18em] text-sky-200 uppercase">
					Map · north up
				</p>
				<h1 class="mt-0.5 truncate text-xl font-semibold">{snapshot.miniMap.zoneName}</h1>
				{#if destination && destinationDirectionData}
					<p class="m-0 truncate text-xs text-white/60">
						{destination.location.settlementName ||
							destination.location.countryName ||
							'Destination'} · {destinationDirectionData.compass} · {distanceLabel(
							destination.directDistanceKm
						)}
					</p>
				{/if}
			</div>
			<nav class="view-nav" aria-label="World views">
				<button type="button" onclick={onClose}>World</button>
				<button type="button" class="active" aria-current="page">Map</button>
				<button type="button" onclick={onGlobe}>Globe</button>
			</nav>
		</header>

		<div class="relative min-h-0 flex-1 overflow-hidden border-t border-white/10">
			<canvas
				bind:this={canvas}
				class="h-full w-full"
				aria-label="Local topographic map centred on the player"
			></canvas>
			{#if destination}
				<button
					type="button"
					class="absolute right-3 bottom-3 rounded-md bg-black/55 px-3 py-2 text-xs text-white/75 backdrop-blur-sm hover:bg-black/70 disabled:opacity-50"
					disabled={actionLoading}
					onclick={() => void clearDestination()}>Clear destination</button
				>
			{/if}
		</div>
	</section>
</div>

<style>
	.view-nav {
		display: inline-flex;
		flex: 0 0 auto;
		gap: 0.15rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.18);
		padding: 0.15rem;
	}
	.view-nav button {
		border-radius: 0.35rem;
		padding: 0.42rem 0.65rem;
		font-size: 0.78rem;
		color: rgb(255 255 255 / 0.72);
	}
	.view-nav button:hover,
	.view-nav button:focus-visible {
		background: rgb(255 255 255 / 0.1);
		color: white;
		outline: none;
	}
	.view-nav .active {
		background: rgb(125 211 252 / 0.18);
		color: #bae6fd;
		font-weight: 700;
	}
	@media (max-width: 560px) {
		.view-nav button {
			padding-inline: 0.48rem;
		}
	}
</style>
