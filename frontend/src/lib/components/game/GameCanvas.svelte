<script lang="ts">
	import { onMount } from 'svelte';

	import { GameEngine } from '$lib/game/GameEngine';
	import type { GameEngineOptions, GameSnapshot } from '$lib/game/game-types';
	import type { BlockType } from '$lib/game/world/voxel-types';

	type GameCommand =
		| {
				type: 'pause' | 'resume' | 'inventory' | 'close-inventory' | 'save';
				token: number;
		  }
		| {
				type: 'hotbar';
				index: number;
				token: number;
		  }
		| {
				type: 'open-build-catalog' | 'close-build-catalog';
				token: number;
		  }
		| {
				type: 'select-build-block';
				blockType: BlockType;
				token: number;
		  };

	interface Props extends Omit<GameEngineOptions, 'canvas' | 'onSnapshot'> {
		onSnapshot?: (snapshot: GameSnapshot) => void;
		command?: GameCommand;
	}

	let {
		worldId,
		playerId,
		regionName,
		seed,
		appearance,
		onSnapshot,
		onError,
		onMove,
		command
	}: Props = $props();

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
			appearance,
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

		switch (command.type) {
			case 'pause':
				engine.pause();
				break;

			case 'resume':
				engine.resume();
				break;

			case 'inventory':
				engine.openInventory();
				break;

			case 'close-inventory':
				engine.closeInventory();
				break;

			case 'save':
				void engine.saveNow();
				break;

			case 'hotbar':
				engine.selectHotbar(command.index);
				break;

			case 'open-build-catalog':
				engine.openBuildCatalog();
				break;

			case 'close-build-catalog':
				engine.closeBuildCatalog();
				break;

			case 'select-build-block':
				if (engine.selectBuildBlock(command.blockType)) {
					engine.closeBuildCatalog();
				}
				break;
		}
	});
</script>

<canvas
	bind:this={canvas}
	class="h-full w-full bg-[#131619] outline-none"
	tabindex="0"
	aria-label="Orelunza voxel world"
	data-testid="game-canvas"
	data-engine="three"
	data-camera="third-person"
	data-terrain="natural-low-poly"
	data-controls="camera-relative"
></canvas>
