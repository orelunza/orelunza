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

	interface Props extends Omit<GameEngineOptions, 'canvas' | 'buildCursorElement' | 'onSnapshot'> {
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
	let buildCursorElement = $state<HTMLDivElement | null>(null);
	let engine: GameEngine | null = null;
	let lastCommandToken = 0;

	onMount(() => {
		if (!canvas || !buildCursorElement) {
			return;
		}

		engine = new GameEngine({
			canvas,
			buildCursorElement,
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

<div class="relative h-full w-full">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full bg-[#131619] outline-none"
		tabindex="0"
		aria-label="Orelunza voxel world"
		data-testid="game-canvas"
		data-engine="three"
		data-camera="third-person"
		data-terrain="natural-low-poly"
		data-controls="camera-relative"
	></canvas>

	<div
		bind:this={buildCursorElement}
		hidden
		class="build-cursor pointer-events-none absolute z-30 size-6 -translate-x-1/2 -translate-y-1/2"
		data-state="idle"
		aria-hidden="true"
	>
		<span class="horizontal"></span>
		<span class="vertical"></span>
		<span class="dot"></span>
	</div>
</div>

<style>
	.build-cursor {
		--cursor-color: rgba(255, 255, 255, 0.9);
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
	}

	.build-cursor[data-state='valid'] {
		--cursor-color: #f97316;
	}

	.build-cursor[data-state='invalid'] {
		--cursor-color: #ef4444;
	}

	.build-cursor .horizontal,
	.build-cursor .vertical {
		position: absolute;
		background: var(--cursor-color);
	}

	.build-cursor .horizontal {
		top: calc(50% - 1px);
		left: 0;
		width: 100%;
		height: 2px;
	}

	.build-cursor .vertical {
		top: 0;
		left: calc(50% - 1px);
		width: 2px;
		height: 100%;
	}

	.build-cursor .dot {
		position: absolute;
		top: calc(50% - 2px);
		left: calc(50% - 2px);
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--cursor-color);
	}
</style>
