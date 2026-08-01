<script lang="ts">
	import { onMount } from 'svelte';

	import type { WorldPlace } from '$lib/api/contracts/world';

	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import { WorldRenderer } from '$lib/world/WorldRenderer';

	import type {
		WorldPoint,
		WorldPointerEvent,
		WorldRendererSnapshot,
		WorldSceneModel
	} from '$lib/world/types';

	interface Props {
		model: WorldSceneModel;

		displayName?: string;
		avatar?: string;

		minHeight?: string;

		showControls?: boolean;
		showGrid?: boolean;
		showPlaceLabels?: boolean;
		naturalObjectDensity?: number;

		onPlaceSelect?: (place: WorldPlace) => void;

		onPlaceActivate?: (place: WorldPlace) => void;

		onBackgroundPointer?: (event: WorldPointerEvent) => void;

		onLocalPositionChange?: (position: WorldPoint) => void;

		onMovementChange?: (moving: boolean, position: WorldPoint) => void;

		onNearbyPlaceChange?: (place: WorldPlace | null, distance: number | null) => void;

		onDestinationChange?: (destination: WorldPoint | null) => void;

		onBeforeDestroy?: (position: WorldPoint | null) => void;

		onReady?: (snapshot: WorldRendererSnapshot) => void;

		onError?: (error: Error) => void;

		walkToPlaceId?: string | null;
		walkCommandToken?: number;
		recenterToken?: number;

		class?: string;
	}

	let {
		model,
		displayName = 'Citizen',
		avatar = '',
		minHeight = '36rem',
		showControls = true,
		showGrid = true,
		showPlaceLabels = true,
		naturalObjectDensity = 0.55,
		onPlaceSelect,
		onPlaceActivate,
		onBackgroundPointer,
		onLocalPositionChange,
		onMovementChange,
		onNearbyPlaceChange,
		onDestinationChange,
		onBeforeDestroy,
		onReady,
		onError,
		walkToPlaceId = null,
		walkCommandToken = 0,
		recenterToken = 0,
		class: className = ''
	}: Props = $props();

	let hostElement: HTMLDivElement | undefined;

	let renderer: WorldRenderer | null = null;

	let mounted = false;
	let initializing = $state(true);
	let ready = $state(false);

	let rendererError = $state<string | null>(null);

	let gridVisible = $state(true);

	let labelsVisible = $state(true);

	let currentZoom = $state(1);

	let currentRegionId = $state<string | null>(null);

	let initializationVersion = 0;
	let lastWalkCommandToken = 0;
	let lastRecenterToken = 0;

	const identity = $derived({
		displayName: displayName.trim() || 'Citizen',

		avatar: avatar.trim()
	});

	const containerClasses = $derived(
		[
			'relative overflow-hidden',
			'bg-[var(--orelunza-background-soft)]',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	function updateSnapshot(): void {
		if (!renderer) {
			return;
		}

		const snapshot = renderer.getSnapshot();

		currentZoom = snapshot.camera.zoom;

		currentRegionId = snapshot.regionId;
	}

	function handleRendererReady(): void {
		if (!renderer) {
			return;
		}

		initializing = false;
		ready = true;
		rendererError = null;

		updateSnapshot();

		onReady?.(renderer.getSnapshot());
	}

	function handleRendererError(error: Error): void {
		initializing = false;
		ready = false;

		rendererError = error.message || 'The world renderer failed.';

		onError?.(error);
	}

	async function initializeRenderer(): Promise<void> {
		if (!mounted || !hostElement) {
			return;
		}

		const version = ++initializationVersion;

		renderer?.destroy();

		initializing = true;
		ready = false;
		rendererError = null;

		gridVisible = showGrid;
		labelsVisible = showPlaceLabels;

		const instance = new WorldRenderer({
			identity,

			showGrid: gridVisible,

			showPlaceLabels: labelsVisible,

			naturalObjectDensity,

			fitOnInitialize: true,
			fitOnRegionChange: true,

			events: {
				onPlaceSelect: (place) => {
					onPlaceSelect?.(place);

					updateSnapshot();
				},

				onPlaceActivate: (place) => {
					onPlaceActivate?.(place);

					updateSnapshot();
				},

				onBackgroundPointer: (event) => {
					onBackgroundPointer?.(event);
				},

				onLocalPositionChange: (position) => {
					onLocalPositionChange?.(position);
				},

				onMovementChange: (moving, position) => {
					onMovementChange?.(moving, position);
				},

				onNearbyPlaceChange: (place, distance) => {
					onNearbyPlaceChange?.(place, distance);
				},

				onDestinationChange: (destination) => {
					onDestinationChange?.(destination);
				},

				onReady: handleRendererReady,

				onError: handleRendererError
			}
		});

		renderer = instance;

		try {
			await instance.initialize(hostElement, model, identity);

			if (!mounted || version !== initializationVersion || renderer !== instance) {
				return;
			}

			if (!instance.isReady) {
				return;
			}

			/*
			 * Synchronize the latest props in case they changed while PixiJS
			 * was initializing asynchronously.
			 */
			instance.update(model, {
				identity
			});

			instance.setGridVisible(gridVisible);

			instance.setPlaceLabelsVisible(labelsVisible);

			instance.setNaturalObjectDensity(naturalObjectDensity);

			updateSnapshot();
		} catch (error) {
			if (!mounted || version !== initializationVersion || renderer !== instance) {
				return;
			}

			handleRendererError(
				error instanceof Error
					? error
					: new Error('The world renderer could not be initialized.', {
							cause: error
						})
			);
		}
	}

	function fitScene(): void {
		if (!renderer?.isReady) {
			return;
		}

		renderer.fitScene();
		updateSnapshot();
	}

	function focusCitizen(): void {
		if (!renderer?.isReady) {
			return;
		}

		renderer.focusCitizen();
		updateSnapshot();
	}

	function resetCamera(): void {
		if (!renderer?.isReady) {
			return;
		}

		renderer.resetCamera();
		updateSnapshot();
	}

	function toggleGrid(): void {
		if (!renderer?.isReady) {
			return;
		}

		gridVisible = !gridVisible;

		renderer.setGridVisible(gridVisible);
	}

	function toggleLabels(): void {
		if (!renderer?.isReady) {
			return;
		}

		labelsVisible = !labelsVisible;

		renderer.setPlaceLabelsVisible(labelsVisible);
	}

	function retry(): void {
		void initializeRenderer();
	}

	onMount(() => {
		mounted = true;

		void initializeRenderer();

		return () => {
			mounted = false;
			++initializationVersion;

			onBeforeDestroy?.(renderer?.isReady ? renderer.getCitizenPosition() : null);

			renderer?.destroy();
			renderer = null;

			ready = false;
		};
	});

	/*
	 * Synchronize backend state with the existing PixiJS scene.
	 */
	$effect(() => {
		const nextModel = model;
		const nextIdentity = identity;

		if (!mounted || !renderer?.isReady) {
			return;
		}

		try {
			const previousRegionId = renderer.getSnapshot().regionId;

			renderer.update(nextModel, {
				identity: nextIdentity,

				teleportCitizen: previousRegionId !== nextModel.region.id
			});

			updateSnapshot();
		} catch (error) {
			handleRendererError(
				error instanceof Error
					? error
					: new Error('The world could not be updated.', {
							cause: error
						})
			);
		}
	});

	/*
	 * Synchronize display preferences independently from scene data.
	 */
	$effect(() => {
		const nextGridVisible = showGrid;

		const nextLabelsVisible = showPlaceLabels;

		const nextDensity = naturalObjectDensity;

		gridVisible = nextGridVisible;

		labelsVisible = nextLabelsVisible;

		if (!mounted || !renderer?.isReady) {
			return;
		}

		try {
			renderer.setGridVisible(nextGridVisible);

			renderer.setPlaceLabelsVisible(nextLabelsVisible);

			renderer.setNaturalObjectDensity(nextDensity);
		} catch (error) {
			handleRendererError(
				error instanceof Error
					? error
					: new Error('The world display settings could not be updated.', {
							cause: error
						})
			);
		}
	});

	$effect(() => {
		const placeId = walkToPlaceId;
		const token = walkCommandToken;

		if (!mounted || !renderer?.isReady || !placeId || token === lastWalkCommandToken) {
			return;
		}

		lastWalkCommandToken = token;
		renderer.walkToPlace(placeId);
	});

	$effect(() => {
		const token = recenterToken;

		if (!mounted || !renderer?.isReady || token === lastRecenterToken) {
			return;
		}

		lastRecenterToken = token;
		focusCitizen();
	});
</script>

<section
	class={containerClasses}
	style:min-height={minHeight}
	aria-label="Interactive Orelunza world"
>
	<div bind:this={hostElement} class="absolute inset-0"></div>

	{#if showControls && ready}
		<div
			class="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4"
		>
			<div
				class="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/35 p-2 shadow-xl backdrop-blur-md"
			>
				<Button size="small" variant="secondary" onclick={fitScene} title="Fit the entire region">
					Fit
				</Button>

				<Button
					size="small"
					variant="secondary"
					onclick={focusCitizen}
					disabled={!model.position}
					title="Focus on your citizen"
				>
					Find me
				</Button>

				<Button size="small" variant="ghost" onclick={resetCamera} title="Reset the camera">
					Reset
				</Button>
			</div>

			<div
				class="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/35 p-2 shadow-xl backdrop-blur-md"
			>
				<button
					type="button"
					class={[
						'rounded-xl border px-3 py-2 text-xs font-semibold transition',
						gridVisible
							? 'border-[color-mix(in_srgb,var(--orelunza-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)] text-[var(--orelunza-accent)]'
							: 'border-white/10 bg-white/5 text-white/65 hover:text-white'
					].join(' ')}
					aria-pressed={gridVisible}
					onclick={toggleGrid}
				>
					Grid
				</button>

				<button
					type="button"
					class={[
						'rounded-xl border px-3 py-2 text-xs font-semibold transition',
						labelsVisible
							? 'border-[color-mix(in_srgb,var(--orelunza-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)] text-[var(--orelunza-accent)]'
							: 'border-white/10 bg-white/5 text-white/65 hover:text-white'
					].join(' ')}
					aria-pressed={labelsVisible}
					onclick={toggleLabels}
				>
					Labels
				</button>
			</div>
		</div>
	{/if}

	{#if ready}
		<div
			class="pointer-events-none absolute right-3 bottom-3 z-20 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/60 backdrop-blur-md sm:right-4 sm:bottom-4"
		>
			<span>
				Zoom
				{currentZoom.toFixed(2)}×
			</span>

			{#if currentRegionId}
				<span class="mx-2 text-white/25" aria-hidden="true"> • </span>

				<span>
					{model.region.name}
				</span>
			{/if}
		</div>
	{/if}

	{#if initializing}
		<div
			class="absolute inset-0 z-30 flex items-center justify-center bg-[color-mix(in_srgb,var(--orelunza-background)_82%,transparent)] backdrop-blur-sm"
		>
			<LoadingScreen
				compact
				message="Drawing the region…"
				detail="Preparing the terrain, places and your citizen."
			/>
		</div>
	{/if}

	{#if rendererError}
		<div
			class="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_srgb,var(--orelunza-background)_92%,transparent)] px-5 py-8 backdrop-blur-md"
		>
			<div
				class="w-full max-w-lg rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-5 shadow-[var(--orelunza-shadow)]"
			>
				<ErrorNotice error={rendererError} title="The visual world could not be opened" />

				<div class="mt-5 flex flex-wrap gap-3">
					<Button onclick={retry}>Try again</Button>
				</div>
			</div>
		</div>
	{/if}
</section>
