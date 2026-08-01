<script lang="ts">
	import { onMount } from 'svelte';

	import { GameEngine } from '$lib/game/GameEngine';
	import type { GameEngineOptions, GameSnapshot } from '$lib/game/game-types';

	interface Props extends Omit<GameEngineOptions, 'canvas' | 'onSnapshot'> {
		onSnapshot?: (snapshot: GameSnapshot) => void;
		command?: {
			type: 'pause' | 'resume' | 'inventory' | 'close-inventory' | 'save' | 'hotbar';
			index?: number;
			token: number;
		};
	}

	let { worldId, playerId, regionName, seed, onSnapshot, onError, onMove, command }: Props =
		$props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let engine: GameEngine | null = null;
	let lastCommandToken = 0;

	onMount(() => {
		if (!canvas) {
			return;
		}

		engine = new GameEngine({
			canvas,
			worldId,
			playerId,
			regionName,
			seed,
			onSnapshot,
			onError,
			onMove
		});

		void engine.start();

		return () => {
			engine?.destroy();
			engine = null;
		};
	});

	$effect(() => {
		if (!engine || !command || command.token === lastCommandToken) {
			return;
		}

		lastCommandToken = command.token;

		if (command.type === 'pause') {
			engine.pause();
		} else if (command.type === 'resume') {
			engine.resume();
		} else if (command.type === 'inventory') {
			engine.openInventory();
		} else if (command.type === 'close-inventory') {
			engine.closeInventory();
		} else if (command.type === 'save') {
			void engine.saveNow();
		} else if (command.type === 'hotbar' && command.index !== undefined) {
			engine.selectHotbar(command.index);
		}
	});
</script>

<canvas
	bind:this={canvas}
	class="h-full w-full bg-[#131619] outline-none"
	tabindex="0"
	aria-label="Orelunza voxel world"
	data-testid="game-canvas"
></canvas>
