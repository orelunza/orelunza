<script lang="ts">
	import { onMount } from 'svelte';

	import { GameEngine } from '$lib/game/GameEngine';
	import type { GameEngineOptions, GameSnapshot } from '$lib/game/game-types';
	import type { BlockType } from '$lib/game/world/voxel-types';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';

	type GameCommand =
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
				type:
					| 'pause'
					| 'resume'
					| 'inventory'
					| 'close-inventory'
					| 'open-calendar'
					| 'close-calendar'
					| 'save'
					| 'respawn';
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
		homeLocation,
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
			homeLocation,
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
			case 'open-world-map':
				engine.openWorldMap();
				break;
			case 'close-world-map':
				engine.closeWorldMap();
				break;
			case 'travel-to-planet':
				void engine.travelToPlanet(command.destination);
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

			case 'open-calendar':
				engine.openCalendar();
				break;

			case 'close-calendar':
				engine.closeCalendar();
				break;

			case 'save':
				void engine.saveNow();
				break;

			case 'respawn':
				engine.respawn();
				break;

			case 'hotbar':
				engine.selectHotbar(command.index);
				break;

			case 'elevator-floor':
				engine.selectElevatorFloor(command.floor);
				break;

			case 'close-elevator':
				engine.closeElevatorPanel();
				break;

			case 'use-inventory':
				engine.useInventorySlot(command.index);
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
		data-target="none"
		data-label=""
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
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.82));
	}

	.build-cursor::after {
		position: absolute;
		top: 1.85rem;
		left: 50%;
		width: max-content;
		max-width: 12rem;
		transform: translateX(-50%);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.2rem;
		background: rgba(18, 22, 18, 0.82);
		padding: 0.22rem 0.42rem;
		color: var(--cursor-color);
		content: attr(data-label);
		font-size: 0.68rem;
		font-weight: 650;
		line-height: 1;
		white-space: nowrap;
		backdrop-filter: blur(5px);
	}

	:global(.build-cursor[data-label=''])::after {
		display: none;
	}

	:global(.build-cursor[data-target='block']) {
		--cursor-color: #f97316;
	}

	:global(.build-cursor[data-target='vegetation']) {
		--cursor-color: #84cc16;
	}

	:global(.build-cursor[data-target='invalid']) {
		--cursor-color: #ef4444;
	}

	.build-cursor .horizontal,
	.build-cursor .vertical {
		position: absolute;
		background: var(--cursor-color);
		transition:
			transform 80ms ease,
			width 80ms ease,
			height 80ms ease;
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

	:global(.build-cursor[data-target='none']) .horizontal,
	:global(.build-cursor[data-target='none']) .vertical {
		display: none;
	}

	:global(.build-cursor[data-target='vegetation']) .horizontal,
	:global(.build-cursor[data-target='vegetation']) .vertical {
		top: 5px;
		left: 2px;
		display: block;
		width: 13px;
		height: 8px;
		border-radius: 100% 0 100% 0;
		transform: rotate(-32deg);
		transform-origin: 100% 100%;
	}

	:global(.build-cursor[data-target='vegetation']) .vertical {
		top: 10px;
		left: 9px;
		transform: rotate(148deg);
	}

	:global(.build-cursor[data-target='vegetation']) .dot {
		top: 10px;
		left: 11px;
		width: 2px;
		height: 11px;
		border-radius: 1px;
		transform: rotate(28deg);
		transform-origin: top;
	}

	:global(.build-cursor[data-target='invalid']) .horizontal {
		transform: rotate(45deg);
	}

	:global(.build-cursor[data-target='invalid']) .vertical {
		transform: rotate(45deg);
	}
</style>
