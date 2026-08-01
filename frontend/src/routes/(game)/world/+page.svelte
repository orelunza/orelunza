<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHud from '$lib/components/game/GameHud.svelte';
	import InventoryOverlay from '$lib/components/game/InventoryOverlay.svelte';
	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';
	import PauseMenu from '$lib/components/game/PauseMenu.svelte';
	import { ApiError } from '$lib/api/ApiError';
	import type { CharacterAppearanceV1 } from '$lib/game/character/CharacterAppearance';
	import { CharacterStore } from '$lib/game/character/CharacterStore';
	import type { GameSnapshot } from '$lib/game/game-types';
	import { STARTER_WORLD_SEED } from '$lib/game/world/voxel-types';
	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	let loading = $state(true);
	let loadError = $state<ApiError | null>(null);
	let snapshot = $state<GameSnapshot | null>(null);
	let appearance = $state<CharacterAppearanceV1 | null>(null);
	let command = $state<
		| {
				type: 'pause' | 'resume' | 'inventory' | 'close-inventory' | 'save' | 'hotbar';
				index?: number;
				token: number;
		  }
		| undefined
	>(undefined);
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

	function sendCommand(type: NonNullable<typeof command>['type'], index?: number): void {
		command = {
			type,
			index,
			token: ++commandToken
		};
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

	async function logout(): Promise<void> {
		sendCommand('save');
		await sessionState.logout().catch(() => undefined);
		await goto(resolve('/login'), { replaceState: true });
	}

	onMount(() => {
		void initialize();

		return () => {
			controller?.abort();
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
				data-zone={snapshot.zoneName}
				data-build-mode={snapshot.buildMode ? 'true' : 'false'}
				data-pointer-locked={snapshot.pointerLocked ? 'true' : 'false'}
			>
				Game state
			</div>

			<GameHud
				{snapshot}
				onHotbarSelect={(index) => {
					sendCommand('hotbar', index);
				}}
				onPause={() => {
					sendCommand('pause');
				}}
			/>

			{#if snapshot.status === 'paused'}
				<PauseMenu
					onResume={() => {
						sendCommand('resume');
					}}
					onSave={() => {
						sendCommand('save');
					}}
					onLogout={logout}
				/>
			{/if}

			{#if snapshot.status === 'inventory'}
				<InventoryOverlay
					inventory={snapshot.inventory}
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
</main>
