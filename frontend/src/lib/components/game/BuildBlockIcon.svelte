<script lang="ts">
	import { BlockRegistry } from '$lib/game/world/BlockRegistry';
	import type { BlockType } from '$lib/game/world/voxel-types';

	interface Props {
		type: BlockType;
		size?: number;
		selected?: boolean;
	}

	let { type, size = 46, selected = false }: Props = $props();

	let definition = $derived(BlockRegistry.get(type));
	let color = $derived(toHexColor(definition.color));
	let opacity = $derived(type === 'glass' ? 0.48 : type === 'water' ? 0.68 : 1);

	function toHexColor(value: number): string {
		return `#${value.toString(16).padStart(6, '0')}`;
	}
</script>

<div
	class:selected
	class="block-icon"
	style:--block-size={`${size}px`}
	style:--block-color={color}
	style:--block-opacity={opacity}
	title={definition.label}
	aria-label={definition.label}
>
	{#if type === 'flower'}
		<div class="flower" aria-hidden="true">
			<span class="petal petal-top"></span>
			<span class="petal petal-right"></span>
			<span class="petal petal-bottom"></span>
			<span class="petal petal-left"></span>
			<span class="flower-center"></span>
			<span class="stem"></span>
		</div>
	{:else if type === 'wood'}
		<div class="trunk" aria-hidden="true">
			<span class="trunk-top"></span>
		</div>
	{:else if type === 'leaves'}
		<div class="leaves" aria-hidden="true"></div>
	{:else}
		<div class="cube" aria-hidden="true">
			<span class="face face-top"></span>
			<span class="face face-left"></span>
			<span class="face face-right"></span>
		</div>
	{/if}
</div>

<style>
	.block-icon {
		--block-size: 46px;
		--block-color: #ffffff;
		--block-opacity: 1;

		position: relative;
		display: grid;
		width: var(--block-size);
		height: var(--block-size);
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.2rem;
		transition:
			transform 120ms ease,
			filter 120ms ease;
	}

	.block-icon.selected {
		transform: translateY(-1px) scale(1.06);
		filter: drop-shadow(0 0 5px rgb(249 115 22 / 70%));
	}

	.cube {
		position: relative;
		width: 72%;
		height: 72%;
		transform: translateY(5%);
	}

	.face {
		position: absolute;
		display: block;
		background: var(--block-color);
		opacity: var(--block-opacity);
	}

	.face-top {
		top: 0;
		left: 18%;
		width: 64%;
		height: 42%;
		transform: skewY(-30deg) rotate(30deg);
		transform-origin: center;
		filter: brightness(1.22);
	}

	.face-left {
		bottom: 3%;
		left: 8%;
		width: 46%;
		height: 55%;
		clip-path: polygon(0 0, 100% 24%, 100% 100%, 0 76%);
		filter: brightness(0.82);
	}

	.face-right {
		right: 8%;
		bottom: 3%;
		width: 46%;
		height: 55%;
		clip-path: polygon(0 24%, 100% 0, 100% 76%, 0 100%);
		filter: brightness(1);
	}

	.flower {
		position: relative;
		width: 72%;
		height: 84%;
	}

	.petal,
	.flower-center,
	.stem {
		position: absolute;
		display: block;
	}

	.petal {
		width: 28%;
		height: 28%;
		border-radius: 50%;
		background: var(--block-color);
	}

	.petal-top {
		top: 5%;
		left: 36%;
	}

	.petal-right {
		top: 25%;
		right: 12%;
	}

	.petal-bottom {
		top: 42%;
		left: 36%;
	}

	.petal-left {
		top: 25%;
		left: 12%;
	}

	.flower-center {
		top: 27%;
		left: 39%;
		width: 22%;
		height: 22%;
		border-radius: 50%;
		background: #f6d365;
	}

	.stem {
		bottom: 3%;
		left: 46%;
		width: 9%;
		height: 45%;
		border-radius: 999px;
		background: #4f8f4b;
		z-index: -1;
	}

	.trunk {
		position: relative;
		width: 42%;
		height: 74%;
		border-radius: 22% 22% 12% 12%;
		background: var(--block-color);
		box-shadow:
			inset 5px 0 rgb(255 255 255 / 10%),
			inset -5px 0 rgb(0 0 0 / 14%);
	}

	.trunk-top {
		position: absolute;
		top: -5%;
		left: 0;
		width: 100%;
		height: 18%;
		border-radius: 50%;
		background: var(--block-color);
		filter: brightness(1.25);
	}

	.leaves {
		width: 72%;
		height: 68%;
		border-radius: 38% 48% 40% 52%;
		background: var(--block-color);
		opacity: var(--block-opacity);
		transform: rotate(-6deg);
		box-shadow:
			8px -3px 0 color-mix(in srgb, var(--block-color), white 8%),
			-7px 4px 0 color-mix(in srgb, var(--block-color), black 8%);
	}
</style>
