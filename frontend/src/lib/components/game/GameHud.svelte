<script lang="ts">
	import type { GameSnapshot } from '$lib/game/game-types';
	import BuildHotbar from './BuildHotbar.svelte';
	import InteractionPrompt from './InteractionPrompt.svelte';
	import WorldClockHud from './WorldClockHud.svelte';
	import HumanStatusHud from './HumanStatusHud.svelte';
	import HumanConditionOverlay from './HumanConditionOverlay.svelte';

	interface Props {
		snapshot: GameSnapshot;
		onHotbarSelect?: (index: number) => void;
		onPause?: () => void;
		onCalendar?: () => void;
		onWorldMap?: () => void;
		onRespawn?: () => void;
	}

	let { snapshot, onHotbarSelect, onPause, onCalendar, onWorldMap, onRespawn }: Props = $props();

	let selectedSlot = $derived(
		snapshot.buildMode && snapshot.selectedBuildBlock
			? (snapshot.inventory.hotbar.find(
					(slot) => slot.stack?.type === snapshot.selectedBuildBlock
				) ??
					snapshot.inventory.hotbar[snapshot.selectedHotbarIndex] ??
					null)
			: (snapshot.inventory.hotbar[snapshot.selectedHotbarIndex] ?? null)
	);
</script>

<div class="pointer-events-none absolute inset-0 z-20 text-white" aria-label="Game HUD">
	<div
		class="absolute top-3 left-3 rounded-sm border border-white/10 bg-[#1a1e22]/76 px-3 py-2 text-xs backdrop-blur-md"
	>
		<p class="m-0 font-semibold">{snapshot.zoneName}</p>
		<p class="m-0 text-white/52">
			{snapshot.saveStatus === 'saved'
				? 'Saved'
				: snapshot.saveStatus === 'saving'
					? 'Saving'
					: snapshot.saveStatus}
		</p>
	</div>

	<div class="absolute top-3 left-1/2 -translate-x-1/2">
		<WorldClockHud environment={snapshot.environment} onOpen={onCalendar} />
	</div>

	{#if snapshot.dayAnnouncement}
		<div
			class="absolute top-28 left-1/2 min-w-64 -translate-x-1/2 rounded-sm border border-[#f97316]/28 bg-[#171c20]/86 px-5 py-3 text-center shadow-xl backdrop-blur-md"
			aria-live="polite"
		>
			<p class="m-0 text-sm font-semibold text-white">{snapshot.dayAnnouncement.title}</p>
			<p class="mt-1 mb-0 text-xs text-white/52">{snapshot.dayAnnouncement.subtitle}</p>
		</div>
	{/if}

	{#if snapshot.buildMode}
		<div
			class="absolute top-24 left-1/2 -translate-x-1/2 rounded-sm border border-[#f97316]/35 bg-[#1a1e22]/76 px-3 py-2 text-xs font-semibold text-[#f97316] backdrop-blur-md"
		>
			Build Mode
		</div>
	{/if}

	{#if snapshot.debugPerformance && snapshot.performance}
		<div
			class="absolute top-20 right-3 w-64 rounded-sm border border-white/10 bg-[#101418]/82 p-3 font-mono text-[0.68rem] leading-5 text-white/72 backdrop-blur-md"
			aria-label="Performance debug"
		>
			<p class="m-0 font-sans text-xs font-semibold text-white">Performance</p>
			<p class="m-0">FPS {snapshot.performance.fps}</p>
			<p class="m-0">Frame {snapshot.performance.frameMs}ms</p>
			<p class="m-0">Draw calls {snapshot.performance.drawCalls}</p>
			<p class="m-0">Triangles {snapshot.performance.triangles}</p>
			<p class="m-0">Chunks {snapshot.performance.chunksLoaded}</p>
			<p class="m-0">Objects {snapshot.performance.objects}</p>
			<p class="m-0">Initial gen {snapshot.performance.initialGenerationMs}ms</p>
			<p class="m-0">Rebuild avg {snapshot.performance.averageChunkRebuildMs}ms</p>
			<p class="m-0">Physics {snapshot.performance.physicsMs}ms</p>
			<p class="m-0">Camera {snapshot.performance.cameraMs}ms</p>
		</div>
	{/if}

	{#if snapshot.introVisible}
		<div
			class="absolute top-20 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-sm border border-white/10 bg-[#1a1e22]/74 px-4 py-3 text-center backdrop-blur-md"
		>
			<p class="m-0 font-semibold">Welcome to Orelunza</p>
			<p class="mt-1 mb-0 text-sm text-white/58">
				The city lies beyond the meadow. Walk freely, explore, or build your own place.
			</p>
		</div>
	{/if}

	<div class="pointer-events-auto absolute top-3 right-3 flex items-center gap-2">
		{#if snapshot.human.lifeState !== 'unconscious' && snapshot.human.lifeState !== 'dead'}
			<button
				type="button"
				class="rounded-sm border border-white/10 bg-[#1a1e22]/76 px-3 py-2 text-xs backdrop-blur-md hover:bg-white/10"
				aria-label="Open the world globe"
				onclick={onWorldMap}
			>
				Globe · M
			</button>
		{/if}

		<button
			type="button"
			class="rounded-sm border border-white/10 bg-[#1a1e22]/76 px-3 py-2 text-xs backdrop-blur-md hover:bg-white/10"
			aria-label="Open pause menu"
			onclick={onPause}
		>
			Menu
		</button>
	</div>

	{#if !snapshot.buildMode && snapshot.human.lifeState !== 'unconscious' && snapshot.human.lifeState !== 'dead'}
		<div
			class="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2"
			aria-label="Crosshair"
		>
			<span class="absolute top-1/2 left-0 h-px w-full bg-white/78"></span>
			<span class="absolute top-0 left-1/2 h-full w-px bg-white/78"></span>
		</div>
	{/if}

	{#if snapshot.mobileLimited}
		<div
			class="absolute top-16 left-3 rounded-sm border border-[#f97316]/30 bg-[#1a1e22]/80 px-3 py-2 text-xs text-white/70 backdrop-blur-md"
		>
			Desktop controls are the current focus.
		</div>
	{/if}

	<HumanStatusHud human={snapshot.human} />
	<HumanConditionOverlay human={snapshot.human} {onRespawn} />

	<div class="absolute bottom-24 left-1/2 -translate-x-1/2">
		<InteractionPrompt
			target={snapshot.targetedBlock}
			{selectedSlot}
			pointerLocked={snapshot.pointerLocked}
			buildMode={snapshot.buildMode}
		/>
	</div>

	{#if snapshot.buildMode}
		<div class="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2">
			<BuildHotbar
				palette={snapshot.buildPalette}
				selectedIndex={snapshot.selectedBuildPaletteIndex}
				selectedBlock={snapshot.selectedBuildBlock}
				inventory={snapshot.inventory}
				creative={snapshot.creativeBuild}
				onSelect={onHotbarSelect}
			/>
		</div>
	{/if}
</div>
