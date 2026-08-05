<script lang="ts">
	import { blockIconShape } from '$lib/game/build/block-icon-shape';
	import { blockVisual } from '$lib/game/world/block-visual';
	import type { BlockType } from '$lib/game/world/voxel-types';

	interface Props {
		type: BlockType;
		size?: number;
	}

	let { type, size = 40 }: Props = $props();

	let visual = $derived(blockVisual(type));
	let shape = $derived(blockIconShape(type));
</script>

<span
	class="block-icon"
	style="--icon-size: {size}px; --top: {visual.top}; --left: {visual.left}; --right: {visual.right}; --icon-opacity: {visual.opacity};"
	aria-hidden="true"
>
	<svg viewBox="0 0 48 48" focusable="false">
		{#if shape === 'grass-block'}
			<path class="earth-left" d="M7 17 24 26v16L7 33Z" />
			<path class="earth-right" d="m24 26 17-9v16l-17 9Z" />
			<path class="top" d="M7 17 24 7l17 10-17 9Z" />
			<path class="grass-fringe" d="m8 18 4 1 2-1 3 3 3-2 4 3 3-3 4 1 3-2 3 1" />
			<path class="detail-dark" d="m11 27 3 2m4 2 2 1m9-2 3-2m4 6 2-1" />
		{:else if shape === 'dirt-block'}
			<path class="left" d="M7 17 24 26v16L7 33Z" />
			<path class="right" d="m24 26 17-9v16l-17 9Z" />
			<path class="top" d="M7 17 24 7l17 10-17 9Z" />
			<circle class="detail-light" cx="18" cy="15" r="1.2" />
			<circle class="detail-dark-fill" cx="29" cy="17" r="1.4" />
			<circle class="detail-light" cx="15" cy="29" r="1.1" />
			<circle class="detail-dark-fill" cx="34" cy="29" r="1.2" />
			<path class="detail-dark" d="m10 24 4 2m6 10 3 1m5-5 3-2m5 7 3-2" />
		{:else if shape === 'stone-rock'}
			<path class="stone-outline" d="m8 31 3-13 10-9 13 3 7 11-4 13-12 5-11-3Z" />
			<path class="top" d="m11 18 10-9 13 3-7 10-10 2Z" />
			<path class="left" d="m8 31 3-13 6 6 1 13-4 1Z" />
			<path class="right" d="m17 24 10-2 7-10 7 11-4 13-12 5-7-4Z" />
			<path class="detail-light-stroke" d="m24 13 5 1m2 14 5-2m-14 9 4 2" />
		{:else if shape === 'sand-pile'}
			<path class="sand-shadow" d="M6 34c6-5 11-7 18-7 8 0 13 2 18 7-4 5-12 7-18 7S10 39 6 34Z" />
			<path class="top" d="M10 32c4-3 5-8 8-13 3-5 9-8 13-3 3 4 3 10 8 16-6 4-23 4-29 0Z" />
			<circle class="detail-dark-fill" cx="19" cy="25" r="1" />
			<circle class="detail-dark-fill" cx="27" cy="19" r="0.9" />
			<circle class="detail-light" cx="30" cy="29" r="1.1" />
			<circle class="detail-dark-fill" cx="14" cy="31" r="0.8" />
		{:else if shape === 'water-tile'}
			<path class="water-body" d="M5 23 24 12l19 11-19 12Z" />
			<path class="water-side-left" d="m5 23 19 12v6L5 29Z" />
			<path class="water-side-right" d="m24 35 19-12v6L24 41Z" />
			<path class="water-wave" d="M10 23c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 7 0" />
			<path class="water-wave faint" d="M14 28c2-1 4-1 6 0s4 1 6 0 4-1 7 0" />
		{:else if shape === 'wood-log'}
			<path class="right" d="M15 15h18v23H15Z" />
			<ellipse class="left" cx="24" cy="38" rx="9" ry="4.5" />
			<ellipse class="top" cx="24" cy="15" rx="9" ry="4.8" />
			<ellipse class="ring" cx="24" cy="15" rx="5.5" ry="2.8" />
			<ellipse class="ring" cx="24" cy="15" rx="2.3" ry="1.2" />
			<path class="bark" d="M18 20v12m6-10v13m5-17v15" />
		{:else if shape === 'leaf-cluster'}
			<circle class="left" cx="16" cy="24" r="9" />
			<circle class="right" cx="31" cy="23" r="9.5" />
			<circle class="top" cx="24" cy="15" r="9" />
			<circle class="left" cx="24" cy="31" r="9" />
			<path class="leaf-vein" d="m24 11-1 19m-8-7 9 2m8-7-8 7m2 3 6 2" />
			<circle class="detail-light" cx="17" cy="18" r="1.5" />
			<circle class="detail-dark-fill" cx="31" cy="29" r="1.7" />
		{:else if shape === 'flower-stem'}
			<path class="stem" d="M24 39c0-8 1-14 0-21" />
			<path class="leaf" d="M23 29c-6-5-10-3-10 1 4 2 7 2 10-1Zm2-5c5-5 9-3 9 1-3 2-6 2-9-1Z" />
			<circle class="petal" cx="24" cy="12" r="5" />
			<circle class="petal" cx="17.5" cy="16" r="5" />
			<circle class="petal" cx="20" cy="23" r="5" />
			<circle class="petal" cx="28" cy="23" r="5" />
			<circle class="petal" cx="30.5" cy="16" r="5" />
			<circle class="flower-center" cx="24" cy="17" r="4" />
		{:else if shape === 'wooden-boards'}
			<path class="board-side" d="M7 13h34v7H7Zm0 11h34v7H7Zm0 11h34v7H7Z" />
			<path class="board" d="M7 11h34v7H7Zm0 11h34v7H7Zm0 11h34v7H7Z" />
			<path class="wood-grain" d="M12 14h11m5 0h8M10 25h8m5 0h13M13 36h14m4 0h6" />
			<circle class="nail" cx="10" cy="14.5" r="1" />
			<circle class="nail" cx="38" cy="25.5" r="1" />
			<circle class="nail" cx="10" cy="36.5" r="1" />
		{:else if shape === 'glass-pane'}
			<path class="glass-fill" d="M8 10h32v28H8Z" />
			<path class="glass-frame" d="M8 10h32v28H8Zm5 5v18h22V15Z" fill-rule="evenodd" />
			<path class="glass-divider" d="M24 15v18M13 24h22" />
			<path class="glass-shine" d="m15 20 7-5m-7 11 13-9m-5 13 10-7" />
		{:else if shape === 'brick-wall'}
			<path class="mortar" d="M6 11h36v28H6Z" />
			<path
				class="brick"
				d="M7 12h10v7H7Zm12 0h14v7H19Zm16 0h6v7h-6ZM7 21h6v7H7Zm8 0h14v7H15Zm16 0h10v7H31ZM7 30h12v8H7Zm14 0h13v8H21Zm15 0h5v8h-5Z"
			/>
		{/if}
	</svg>
</span>

<style>
	.block-icon {
		display: inline-grid;
		width: var(--icon-size);
		height: var(--icon-size);
		place-items: center;
		opacity: var(--icon-opacity);
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.top,
	.petal,
	.board,
	.brick {
		fill: var(--top);
	}

	.left,
	.board-side,
	.sand-shadow,
	.water-side-left {
		fill: var(--left);
	}

	.right,
	.water-side-right {
		fill: var(--right);
	}

	.earth-left {
		fill: #64472f;
	}

	.earth-right {
		fill: #7a5737;
	}

	.grass-fringe {
		fill: none;
		stroke: var(--top);
		stroke-width: 2.2;
		stroke-linecap: square;
		stroke-linejoin: bevel;
	}

	.detail-dark,
	.bark,
	.wood-grain {
		fill: none;
		stroke: rgba(20, 24, 20, 0.45);
		stroke-width: 1.3;
		stroke-linecap: round;
	}

	.detail-dark-fill,
	.nail {
		fill: rgba(20, 24, 20, 0.48);
	}

	.detail-light {
		fill: rgba(255, 255, 255, 0.38);
	}

	.detail-light-stroke {
		fill: none;
		stroke: rgba(255, 255, 255, 0.28);
		stroke-width: 1.4;
		stroke-linecap: round;
	}

	.stone-outline {
		fill: var(--right);
		stroke: rgba(16, 20, 20, 0.3);
		stroke-width: 1.2;
		stroke-linejoin: round;
	}

	.water-body {
		fill: var(--top);
		fill-opacity: 0.82;
	}

	.water-wave {
		fill: none;
		stroke: rgba(236, 252, 255, 0.8);
		stroke-width: 1.7;
		stroke-linecap: round;
	}

	.water-wave.faint {
		stroke-opacity: 0.5;
	}

	.ring {
		fill: none;
		stroke: rgba(65, 39, 22, 0.6);
		stroke-width: 1.1;
	}

	.leaf-vein {
		fill: none;
		stroke: rgba(232, 246, 207, 0.28);
		stroke-width: 1.2;
		stroke-linecap: round;
	}

	.stem {
		fill: none;
		stroke: #496b32;
		stroke-width: 3;
		stroke-linecap: round;
	}

	.leaf {
		fill: #5c7f3c;
	}

	.flower-center {
		fill: #f6d35d;
		stroke: rgba(77, 50, 22, 0.3);
		stroke-width: 0.8;
	}

	.glass-fill {
		fill: var(--top);
		fill-opacity: 0.22;
	}

	.glass-frame {
		fill: var(--right);
		fill-opacity: 0.9;
	}

	.glass-divider {
		fill: none;
		stroke: var(--right);
		stroke-width: 1.5;
	}

	.glass-shine {
		fill: none;
		stroke: rgba(255, 255, 255, 0.78);
		stroke-width: 1.3;
		stroke-linecap: round;
	}

	.mortar {
		fill: #d0c3af;
	}
</style>
