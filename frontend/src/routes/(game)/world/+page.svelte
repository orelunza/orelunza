<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import BuildCatalogOverlay from '$lib/components/game/BuildCatalogOverlay.svelte';
	import CalendarPanel from '$lib/components/game/CalendarPanel.svelte';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import InventoryOverlay from '$lib/components/game/InventoryOverlay.svelte';
	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';
	import PauseMenu from '$lib/components/game/PauseMenu.svelte';
	import PlanetPreviewCanvas from '$lib/components/game/PlanetPreviewCanvas.svelte';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import { ApiError } from '$lib/api/ApiError';
	import type { CharacterAppearanceV1 } from '$lib/game/character/CharacterAppearance';
	import { CharacterStore } from '$lib/game/character/CharacterStore';
	import type { GameSnapshot } from '$lib/game/game-types';
	import { STARTER_WORLD_SEED, type BlockType } from '$lib/game/world/voxel-types';
	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	type SimpleGameCommand =
		| 'pause'
		| 'resume'
		| 'inventory'
		| 'close-inventory'
		| 'save'
		| 'open-calendar'
		| 'close-calendar'
		| 'open-build-catalog'
		| 'close-build-catalog'
		| 'respawn';

	type GameCommand =
		| {
				type: SimpleGameCommand;
				token: number;
		  }
		| {
				type: 'open-world-map' | 'close-world-map';
				token: number;
		  }
		| {
				type: 'travel-to-planet';
				destination: PlanetTravelRequest;
				token: number;
		  }
		| {
				type: 'hotbar';
				index: number;
				token: number;
		  }
		| {
				type: 'select-build-block';
				blockType: BlockType;
				token: number;
		  }
		| {
				type: 'elevator-floor';
				floor: number;
				token: number;
		  }
		| {
				type: 'close-elevator';
				token: number;
		  }
		| {
				type: 'use-inventory';
				index: number;
				token: number;
		  };

	let loading = $state(true);
	let loadError = $state<ApiError | null>(null);
	let snapshot = $state<GameSnapshot | null>(null);
	let appearance = $state<CharacterAppearanceV1 | null>(null);
	let command = $state<GameCommand | undefined>(undefined);
	let commandToken = 0;
	let controller: AbortController | null = null;

	const characterStore = new CharacterStore();

	let regionName = $derived(
		worldState.selectedRegion?.name ?? worldState.regions[0]?.name ?? 'Starter World'
	);

	let regionId = $derived(
		worldState.selectedRegion?.id ?? worldState.regions[0]?.id ?? 'starter-world'
	);

	let playerId = $derived(sessionState.humanId || 'local-player');
	let worldId = $derived(worldState.worldId ?? regionId);

	function sendCommand(type: SimpleGameCommand): void {
		command = {
			type,
			token: ++commandToken
		};
	}

	function sendHotbarCommand(index: number): void {
		command = {
			type: 'hotbar',
			index,
			token: ++commandToken
		};
	}

	function sendBuildBlockCommand(blockType: BlockType): void {
		command = {
			type: 'select-build-block',
			blockType,
			token: ++commandToken
		};
	}

	function sendUseInventoryCommand(index: number): void {
		command = {
			type: 'use-inventory',
			index,
			token: ++commandToken
		};
	}

	function sendElevatorFloorCommand(floor: number): void {
		command = { type: 'elevator-floor', floor, token: ++commandToken };
	}

	function closeElevatorPanel(): void {
		command = { type: 'close-elevator', token: ++commandToken };
	}

	async function initialize(): Promise<void> {
		controller?.abort();
		controller = new AbortController();
		loading = true;
		loadError = null;

		try {
			const character = await characterStore.load(playerId);

			if (!character) {
				await goto(resolve('/character/create'), {
					replaceState: true
				});

				return;
			}

			appearance = character;

			const regions = await worldState.loadWorld(controller.signal).catch(() => []);

			if (regions.length > 0) {
				await worldState.selectRegion(regions[0].id, controller.signal).catch(() => undefined);
				await worldState.loadRegionPlaces(regions[0].id, controller.signal).catch(() => []);
			}

			await worldState.loadPosition(controller.signal).catch(() => null);
		} catch (error) {
			loadError = ApiError.fromUnknown(error);
		} finally {
			loading = false;
		}
	}

	function openWorldGlobe(): void {
		if (snapshot?.status === 'world-map' || loading || !appearance) {
			return;
		}

		command = { type: 'open-world-map', token: ++commandToken };
	}

	function closeWorldGlobe(): void {
		if (snapshot?.status !== 'world-map') {
			return;
		}

		command = { type: 'close-world-map', token: ++commandToken };
	}

	function travelTo(destination: PlanetTravelRequest): void {
		command = { type: 'travel-to-planet', destination, token: ++commandToken };
	}

	async function logout(): Promise<void> {
		sendCommand('save');
		await sessionState.logout().catch(() => undefined);
		await goto(resolve('/login'), { replaceState: true });
	}

	onMount(() => {
		void initialize();

		const handleWorldGlobeShortcut = (event: KeyboardEvent): void => {
			if (event.repeat || event.code !== 'KeyM') {
				return;
			}

			if (snapshot?.status === 'world-map') {
				void closeWorldGlobe();
			} else if (
				(snapshot?.status === 'playing' || snapshot?.status === 'paused') &&
				snapshot.human.lifeState !== 'unconscious' &&
				snapshot.human.lifeState !== 'dead'
			) {
				void openWorldGlobe();
			}
		};

		window.addEventListener('keydown', handleWorldGlobeShortcut);

		return () => {
			controller?.abort();
			window.removeEventListener('keydown', handleWorldGlobeShortcut);
		};
	});
</script>

<svelte:head>
	<title>Orelunza</title>
	<meta name="description" content="Enter the Orelunza voxel world." />
</svelte:head>

<main class="relative h-dvh w-screen overflow-hidden bg-[#131619]" aria-label="Orelunza game">
	{#if loading}
		<LoadingWorld
			message="Generating Orelunza"
			detail="Preparing terrain, trees, water and a safe spawn."
		/>
	{:else if appearance}
		<GameCanvas
			{worldId}
			{playerId}
			{regionName}
			seed={STARTER_WORLD_SEED}
			{appearance}
			{command}
			onSnapshot={(next) => {
				snapshot = next;
			}}
			onError={(error) => {
				loadError = ApiError.fromUnknown(error);
			}}
		/>

		{#if snapshot}
			<div
				class="sr-only"
				data-testid="game-debug-state"
				data-player-x={snapshot.player.position.x.toFixed(3)}
				data-player-y={snapshot.player.position.y.toFixed(3)}
				data-player-z={snapshot.player.position.z.toFixed(3)}
				data-player-yaw={snapshot.player.yaw.toFixed(3)}
				data-zone={snapshot.zoneName}
				data-world-time={snapshot.environment.time.formattedTime}
				data-world-date={snapshot.environment.time.formattedDate}
				data-world-day={snapshot.environment.time.dayNumber}
				data-calendar-open={snapshot.status === 'calendar' ? 'true' : 'false'}
				data-build-mode={snapshot.buildMode ? 'true' : 'false'}
				data-build-catalog-open={snapshot.buildCatalogOpen ? 'true' : 'false'}
				data-selected-build-block={snapshot.selectedBuildBlock ?? ''}
				data-creative-build={snapshot.creativeBuild ? 'true' : 'false'}
				data-pointer-locked={snapshot.pointerLocked ? 'true' : 'false'}
				data-fps={snapshot.diagnostics?.fps.toFixed(1) ?? '0'}
				data-frame-ms={snapshot.diagnostics?.frameTimeMs.toFixed(2) ?? '0'}
				data-physics-ms={snapshot.diagnostics?.physicsMs.toFixed(2) ?? '0'}
				data-camera-ms={snapshot.diagnostics?.cameraMs.toFixed(2) ?? '0'}
				data-render-ms={snapshot.diagnostics?.renderMs.toFixed(2) ?? '0'}
				data-collision-cells={snapshot.diagnostics?.collisionCells ?? 0}
				data-callbacks-per-second={snapshot.diagnostics?.svelteCallbacksPerSecond.toFixed(1) ?? '0'}
				data-backend-calls-per-second={snapshot.diagnostics?.backendCallsPerSecond.toFixed(1) ??
					'0'}
				data-hud-updates-per-second={snapshot.diagnostics?.hudUpdatesPerSecond.toFixed(1) ?? '0'}
				data-chunks-active={snapshot.diagnostics?.chunksActive ?? 0}
				data-three-objects={snapshot.diagnostics?.threeObjects ?? 0}
				data-draw-calls={snapshot.diagnostics?.drawCalls ?? 0}
				data-triangles={snapshot.diagnostics?.triangles ?? 0}
				data-engine-starts={snapshot.diagnostics?.startCount ?? 0}
				data-active-loops={snapshot.diagnostics?.activeLoops ?? 0}
				data-world-rebuilds={snapshot.diagnostics?.worldRebuilds ?? 0}
				data-chunk-refreshes={snapshot.diagnostics?.chunkRefreshes ?? 0}
				data-avatar-update-ms={snapshot.diagnostics?.avatarUpdateMs.toFixed(3) ?? '0'}
				data-avatar-objects={snapshot.diagnostics?.avatarObjects ?? 0}
				data-avatar-triangles={snapshot.diagnostics?.avatarTriangles ?? 0}
				data-avatar-draw-calls={snapshot.diagnostics?.avatarDrawCalls ?? 0}
				data-avatar-ready={snapshot.diagnostics?.avatarReady ? 'true' : 'false'}
				data-avatar-model-source={snapshot.diagnostics?.avatarModelSource ?? ''}
				data-model-source={snapshot.diagnostics?.avatarModelSource ?? ''}
				data-skinned-mesh-count={snapshot.diagnostics?.avatarSkinnedMeshes ?? 0}
				data-avatar-materials={snapshot.diagnostics?.avatarMaterials ?? 0}
				data-avatar-bones={snapshot.diagnostics?.avatarBones ?? 0}
				data-avatar-animation-clips={snapshot.diagnostics?.avatarAnimationClips ?? 0}
				data-retargeted-clip-count={snapshot.diagnostics?.avatarRetargetedClipCount ?? 0}
				data-target-skeleton-bone-count={snapshot.diagnostics?.avatarTargetSkeletonBoneCount ?? 0}
				data-current-animation={snapshot.diagnostics?.avatarCurrentAnimation ?? 'idle'}
				data-previous-animation={snapshot.diagnostics?.avatarPreviousAnimation ?? ''}
				data-mixer-time={snapshot.diagnostics?.avatarMixerTime.toFixed(3) ?? '0'}
				data-action-time={snapshot.diagnostics?.avatarActionTime.toFixed(3) ?? '0'}
				data-action-weight={snapshot.diagnostics?.avatarActionWeight.toFixed(3) ?? '0'}
				data-active-action-count={snapshot.diagnostics?.avatarActiveActionCount ?? 0}
				data-camera-yaw={snapshot.diagnostics?.locomotionCameraYaw.toFixed(3) ?? '0'}
				data-body-yaw={snapshot.diagnostics?.locomotionBodyYaw.toFixed(3) ?? '0'}
				data-desired-movement-yaw={snapshot.diagnostics?.locomotionDesiredMovementYaw.toFixed(3) ??
					'0'}
				data-head-yaw={snapshot.diagnostics?.locomotionHeadYaw.toFixed(3) ?? '0'}
				data-local-forward-speed={snapshot.diagnostics?.locomotionLocalForwardSpeed.toFixed(3) ??
					'0'}
				data-local-side-speed={snapshot.diagnostics?.locomotionLocalSideSpeed.toFixed(3) ?? '0'}
				data-vertical-speed={snapshot.diagnostics?.locomotionVerticalSpeed.toFixed(3) ?? '0'}
				data-grounded={snapshot.diagnostics?.locomotionGrounded ? 'true' : 'false'}
				data-step-active={snapshot.diagnostics?.locomotionStepActive ? 'true' : 'false'}
				data-step-height={snapshot.diagnostics?.locomotionStepHeight.toFixed(3) ?? '0'}
				data-leading-foot={snapshot.diagnostics?.locomotionLeadingFoot ?? ''}
				data-mouse-look-active={snapshot.diagnostics?.locomotionMouseLookActive ? 'true' : 'false'}
				data-camera-recentering={snapshot.diagnostics?.locomotionCameraRecentering
					? 'true'
					: 'false'}
				data-total-track-count={snapshot.diagnostics?.avatarTotalTrackCount ?? 0}
				data-matched-track-count={snapshot.diagnostics?.avatarMatchedTrackCount ?? 0}
				data-unmatched-track-count={snapshot.diagnostics?.avatarUnmatchedTrackCount ?? 0}
				data-hips-bone-name={snapshot.diagnostics?.avatarHipsBoneName ?? ''}
				data-left-upper-leg-bone-name={snapshot.diagnostics?.avatarLeftUpperLegBoneName ?? ''}
				data-right-upper-leg-bone-name={snapshot.diagnostics?.avatarRightUpperLegBoneName ?? ''}
				data-left-hand-bone-name={snapshot.diagnostics?.avatarLeftHandBoneName ?? ''}
				data-right-hand-bone-name={snapshot.diagnostics?.avatarRightHandBoneName ?? ''}
				data-hips-quaternion={snapshot.diagnostics?.avatarHipsQuaternion.join(',') ?? '0,0,0,1'}
				data-left-upper-leg-quaternion={snapshot.diagnostics?.avatarLeftUpperLegQuaternion.join(
					','
				) ?? '0,0,0,1'}
				data-right-upper-leg-quaternion={snapshot.diagnostics?.avatarRightUpperLegQuaternion.join(
					','
				) ?? '0,0,0,1'}
				data-left-hand-quaternion={snapshot.diagnostics?.avatarLeftHandQuaternion.join(',') ??
					'0,0,0,1'}
				data-right-hand-quaternion={snapshot.diagnostics?.avatarRightHandQuaternion.join(',') ??
					'0,0,0,1'}
				data-avatar-error={snapshot.diagnostics?.avatarError ?? ''}
				data-avatar-state={snapshot.avatar?.locomotionState ?? 'idle'}
				data-avatar-speed={snapshot.avatar?.speed.toFixed(3) ?? '0'}
				data-avatar-gait-phase={snapshot.avatar?.gaitPhase.toFixed(3) ?? '0'}
				data-avatar-arm-left={snapshot.avatar?.armLeftAngle.toFixed(3) ?? '0'}
				data-avatar-arm-right={snapshot.avatar?.armRightAngle.toFixed(3) ?? '0'}
				data-avatar-leg-left={snapshot.avatar?.legLeftAngle.toFixed(3) ?? '0'}
				data-avatar-leg-right={snapshot.avatar?.legRightAngle.toFixed(3) ?? '0'}
				data-avatar-grounded={snapshot.avatar?.grounded ? 'true' : 'false'}
				data-avatar-head-yaw={snapshot.avatar?.headYaw.toFixed(3) ?? '0'}
				data-avatar-body-yaw={snapshot.avatar?.bodyYaw.toFixed(3) ?? '0'}
			>
				Game state
			</div>

			<GameHud
				{snapshot}
				onHotbarSelect={sendHotbarCommand}
				onPause={() => {
					sendCommand('pause');
				}}
				onCalendar={() => {
					sendCommand('open-calendar');
				}}
				onWorldMap={() => {
					void openWorldGlobe();
				}}
				onRespawn={() => {
					sendCommand('respawn');
				}}
				onElevatorFloor={sendElevatorFloorCommand}
				onCloseElevator={closeElevatorPanel}
			/>

			{#if snapshot.status === 'calendar'}
				<CalendarPanel
					{snapshot}
					onClose={() => {
						sendCommand('close-calendar');
					}}
				/>
			{/if}

			{#if snapshot.status === 'build-catalog'}
				<BuildCatalogOverlay
					inventory={snapshot.inventory}
					selectedBlock={snapshot.selectedBuildBlock}
					onSelect={sendBuildBlockCommand}
					onClose={() => {
						sendCommand('close-build-catalog');
					}}
				/>
			{/if}

			{#if snapshot.status === 'paused'}
				<PauseMenu
					onResume={() => {
						sendCommand('resume');
					}}
					onSave={() => {
						sendCommand('save');
					}}
					onOpenWorldMap={() => {
						void openWorldGlobe();
					}}
					onLogout={logout}
				/>
			{/if}

			{#if snapshot.status === 'inventory'}
				<InventoryOverlay
					inventory={snapshot.inventory}
					onUse={(index) => {
						sendUseInventoryCommand(index);
					}}
					onClose={() => {
						sendCommand('close-inventory');
					}}
				/>
			{/if}
		{/if}

		{#if loadError}
			<div
				class="pointer-events-none absolute right-4 bottom-24 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-sm border border-[#f97316]/30 bg-[#1a1e22]/86 p-3 text-sm text-white/78 backdrop-blur-md"
			>
				<p class="m-0 font-semibold text-[#f97316]">Local world active</p>
				<p class="m-0 mt-1 text-white/58">{loadError.message}</p>
			</div>
		{/if}
	{/if}

	{#if appearance && (snapshot?.status === 'world-map' || snapshot?.status === 'travelling')}
		<div class="absolute inset-0 z-[70]" data-testid="world-globe-mode">
			<PlanetPreviewCanvas
				currentLocation={snapshot.geographicLocation}
				travelling={snapshot.status === 'travelling'}
				travelError={snapshot.error}
				onClose={() => {
					void closeWorldGlobe();
				}}
				onTravel={travelTo}
			/>
		</div>
	{/if}
</main>
