<script lang="ts">
	import { blockVisual } from '$lib/game/world/block-visual';
	import type { BlockType } from '$lib/game/world/voxel-types';

	interface Props {
		type: BlockType;
		/** Taille du cube en pixels (côté de la case). */
		size?: number;
	}

	let { type, size = 40 }: Props = $props();

	// `blockVisual` est mémorisé par type : aucune couleur recalculée à chaque
	// rendu, aucun WebGLRenderer, aucun canvas, aucune scène Three.js.
	let visual = $derived(blockVisual(type));
</script>

<span
	class="block-icon"
	style="--icon-size: {size}px; --top: {visual.top}; --left: {visual.left}; --right: {visual.right}; --icon-opacity: {visual.opacity};"
	aria-hidden="true"
>
	<span class="cube">
		<span class="face top"></span>
		<span class="face left"></span>
		<span class="face right"></span>
	</span>
</span>

<style>
	.block-icon {
		display: inline-block;
		width: var(--icon-size);
		height: var(--icon-size);
		opacity: var(--icon-opacity);
	}

	.cube {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
	}

	.face {
		position: absolute;
		left: 50%;
		top: 50%;
	}

	/*
	 * Cube isométrique dessiné avec trois losanges/parallélogrammes en CSS.
	 * Dimensions exprimées en fraction de --icon-size pour rester net à toute
	 * taille. Les couleurs proviennent du helper visuel partagé.
	 */
	.top {
		width: calc(var(--icon-size) * 0.58);
		height: calc(var(--icon-size) * 0.58);
		background: var(--top);
		transform: translate(-50%, calc(var(--icon-size) * -0.5)) rotate(45deg) skew(-20deg, -20deg);
		border-radius: calc(var(--icon-size) * 0.04);
	}

	.left {
		width: calc(var(--icon-size) * 0.41);
		height: calc(var(--icon-size) * 0.47);
		background: var(--left);
		transform: translate(calc(var(--icon-size) * -0.5), calc(var(--icon-size) * -0.09)) skewY(20deg);
		border-radius: 0 0 0 calc(var(--icon-size) * 0.04);
	}

	.right {
		width: calc(var(--icon-size) * 0.41);
		height: calc(var(--icon-size) * 0.47);
		background: var(--right);
		transform: translate(calc(var(--icon-size) * 0.09), calc(var(--icon-size) * -0.09))
			skewY(-20deg);
		border-radius: 0 0 calc(var(--icon-size) * 0.04) 0;
	}
</style>
