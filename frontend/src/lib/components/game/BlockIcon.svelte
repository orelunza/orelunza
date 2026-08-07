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
		{:else if shape === 'concrete-block'}
			<rect class="top" x="8" y="9" width="32" height="30" rx="2" />
			<path class="detail-dark" d="M10 22h28M24 10v28" />
		{:else if shape === 'marble-block'}
			<rect class="top" x="8" y="9" width="32" height="30" rx="2" />
			<path class="detail-dark" d="m11 31 8-7 5 2 7-10 7-3M14 15l6 3 5-5" />
		{:else if shape === 'glass-panel'}
			<rect class="glass-fill" x="9" y="8" width="30" height="32" rx="1" />
			<path class="glass-frame" d="M8 7h32v34H8Zm4 4v26h24V11Z" fill-rule="evenodd" />
			<path class="glass-shine" d="m15 28 15-14m-10 20 13-12" />
		{:else if shape === 'wooden-door'}
			<rect class="top" x="12" y="5" width="24" height="38" rx="1" />
			<path class="detail-dark" d="M16 10h16v12H16Zm0 16h16v12H16Z" />
			<circle class="detail-light" cx="31" cy="25" r="1.8" />
		{:else if shape === 'stone-slab'}
			<path class="top" d="M7 24 24 15l17 9-17 9Z" />
			<path class="left" d="m7 24 17 9v7L7 31Z" /><path class="right" d="m24 33 17-9v7l-17 9Z" />
		{:else if shape === 'stone-stairs'}
			<path class="top" d="M9 35h10v-8h10v-8h10v16Z" />
			<path class="detail-dark" d="M9 35h30M19 27h20M29 19h10" />
		{:else if shape === 'wood-fence'}
			<path class="top" d="M12 8h5v34h-5Zm19 0h5v34h-5ZM13 16h22v5H13Zm0 28h22v5H13Z" />
		{:else if shape === 'metal-fence'}
			<path
				class="right"
				d="M8 13h32v4H8Zm0 25h32v4H8ZM12 8h3v35h-3Zm7 0h3v35h-3Zm7 0h3v35h-3Zm7 0h3v35h-3Z"
			/>
		{:else if shape === 'brick-fence'}
			<path class="mortar" d="M5 21h38v19H5Z" /><path
				class="brick"
				d="M6 22h10v8H6Zm12 0h13v8H18Zm15 0h9v8h-9ZM6 32h7v7H6Zm9 0h13v7H15Zm15 0h12v7H30Z"
			/>
		{:else if shape === 'table'}
			<path class="top" d="M7 17 24 9l17 8-17 8Z" />
			<path class="right" d="M11 22h4v19h-4Zm22 0h4v19h-4Z" /><path
				class="left"
				d="M19 24h4v17h-4Zm11 0h4v17h-4Z"
			/>
		{:else if shape === 'bed'}
			<path class="right" d="M7 23 27 13l14 8-20 11Z" /><path
				class="top"
				d="m10 22 17-8 6 4-17 9Z"
			/><path class="detail-light-stroke" d="m11 23 5 3" />
		{:else if shape === 'mattress'}
			<path class="top" d="M7 22 26 12l15 9-19 11Z" /><path
				class="right"
				d="m7 22 15 10v7L7 29Z"
			/><path class="left" d="m22 32 19-11v7L22 39Z" />
		{:else if shape === 'curtain'}
			<path class="top" d="M10 10h28v31H10Z" /><path
				class="detail-dark"
				d="M16 11v29m8-29v29m8-29v29M8 9h32"
			/>
		{:else if shape === 'wardrobe'}
			<rect class="top" x="10" y="6" width="28" height="37" rx="1" /><path
				class="detail-dark"
				d="M24 7v35"
			/><circle class="detail-light" cx="21" cy="25" r="1.2" /><circle
				class="detail-light"
				cx="27"
				cy="25"
				r="1.2"
			/>
		{:else if shape === 'clothes-rack'}
			<path class="detail-dark" d="M10 40V10m28 30V10M10 12h28" /><path
				class="top"
				d="m18 18-5 8h10Zm12 0-5 8h10Z"
			/>
		{:else if shape === 'shoe-rack'}
			<path class="detail-dark" d="M8 13h32v27H8Zm0 13h32" /><path
				class="top"
				d="M12 20c4-4 7-4 10 0v3H12Zm15 13c4-4 7-4 10 0v3H27Z"
			/>
		{:else if shape === 'floor-lamp'}
			<path class="detail-dark" d="M24 22v18M16 41h16" /><path
				class="top"
				d="m15 8 18 0 5 14H10Z"
			/><circle class="detail-light" cx="24" cy="16" r="4" />
		{:else if shape === 'fire-pit'}
			<ellipse class="right" cx="24" cy="35" rx="16" ry="6" /><path
				class="top"
				d="M24 9c8 8 9 14 4 20-2 3-7 3-10 0-4-5-1-11 6-20Z"
			/><path class="detail-light-stroke" d="M13 34h22" />
		{:else if shape === 'chair'}
			<path class="top" d="M13 24h22v8H13Z" /><path
				class="detail-dark"
				d="M15 32v11m18-11v11M14 24V10h20v14"
			/>
		{:else if shape === 'sofa'}
			<path class="top" d="M8 23h32v15H8Z" /><path
				class="detail-dark"
				d="M10 23V12h28v11M15 38v4m18-4v4"
			/>
		{:else if shape === 'kitchen-counter'}
			<rect class="top" x="7" y="17" width="34" height="22" /><path
				class="detail-dark"
				d="M7 17h34M24 19v18"
			/>
		{:else if shape === 'kitchen-cabinet'}
			<rect class="top" x="10" y="10" width="28" height="32" /><path
				class="detail-dark"
				d="M24 11v30"
			/><circle class="detail-light" cx="21" cy="27" r="1.2" />
		{:else if shape === 'refrigerator'}
			<rect class="top" x="13" y="5" width="22" height="39" rx="2" /><path
				class="detail-dark"
				d="M14 25h20M30 10v11"
			/>
		{:else if shape === 'sink'}
			<path class="top" d="M8 20h32v19H8Z" /><ellipse
				class="left"
				cx="24"
				cy="24"
				rx="9"
				ry="4"
			/><path class="detail-dark" d="M29 19v-7h-7" />
		{:else if shape === 'toilet'}
			<rect class="top" x="15" y="7" width="18" height="14" rx="2" /><ellipse
				class="right"
				cx="24"
				cy="31"
				rx="12"
				ry="9"
			/>
		{:else if shape === 'shower'}
			<path class="detail-dark" d="M12 42V8h24v34M17 14h14" /><path
				class="water-wave"
				d="M18 18v17m6-17v19m6-19v17"
			/>
		{:else if shape === 'mirror'}
			<rect class="glass-fill" x="12" y="7" width="24" height="35" rx="2" /><path
				class="glass-shine"
				d="m17 27 12-12m-8 19 10-10"
			/>
		{:else if shape === 'radio'}
			<rect class="top" x="9" y="18" width="30" height="20" rx="2" /><circle
				class="detail-dark-fill"
				cx="18"
				cy="28"
				r="6"
			/><path class="detail-dark" d="M31 8v10m-1 6h6m-6 5h6" />
		{:else if shape === 'bookshelf'}
			<rect class="top" x="9" y="6" width="30" height="38" /><path
				class="detail-dark"
				d="M10 18h28M10 30h28M15 8v9m6-9v9m5 13v12m6-12v12"
			/>
		{:else if shape === 'rug'}
			<path class="top" d="M7 24 24 14l17 10-17 10Z" /><path
				class="detail-light-stroke"
				d="m12 24 12-7 12 7-12 7Z"
			/>
		{:else if shape === 'cooking-pot'}
			<ellipse class="top" cx="24" cy="20" rx="11" ry="5" /><path
				class="right"
				d="M13 20v15c3 5 19 5 22 0V20"
			/><path class="detail-dark" d="M8 25h5m22 0h5" />
		{:else if shape === 'frying-pan'}
			<ellipse class="top" cx="19" cy="27" rx="12" ry="8" /><path
				class="detail-dark"
				d="m29 23 12-9"
			/>
		{:else if shape === 'plate-stack'}
			<ellipse class="top" cx="24" cy="29" rx="14" ry="5" /><path
				class="detail-dark"
				d="M11 25c7 4 19 4 26 0m-24-4c6 3 16 3 22 0"
			/>
		{:else if shape === 'glass-cup'}
			<path class="glass-fill" d="M17 13h14l-2 26H19Z" /><path
				class="glass-shine"
				d="m21 17 5-2m-5 6 4-2"
			/>
		{:else if shape === 'fruit-bowl'}
			<path class="right" d="M10 27h28c-2 11-8 15-14 15S12 38 10 27Z" /><circle
				class="top"
				cx="18"
				cy="24"
				r="6"
			/><circle class="top" cx="28" cy="22" r="6" />
		{:else if shape === 'asphalt-road'}
			<path class="right" d="M5 31 24 20l19 10-19 11Z" />
			<path class="detail-light-stroke" d="m10 31 8-5m5-3 6-3m5 8 5-3" />
		{:else if shape === 'sidewalk-tile'}
			<path class="top" d="M6 25 24 15l18 10-18 10Z" />
			<path class="detail-dark" d="M15 20v10m9-15v20m9-15v10M8 25h32" />
		{:else if shape === 'road-marking'}
			<path class="right" d="M5 31 24 20l19 10-19 11Z" />
			<path class="detail-light-stroke" d="m11 32 8-5m5-3 8-5m3 11 5-3" />
		{:else if shape === 'glass-door'}
			<rect class="glass-fill" x="12" y="5" width="24" height="38" rx="1" />
			<path class="glass-frame" d="M11 4h26v40H11Zm4 4v32h18V8Z" fill-rule="evenodd" />
			<path class="glass-shine" d="m17 25 12-12m-8 18 10-10" />
			<circle class="detail-light" cx="31" cy="26" r="1.6" />
		{:else if shape === 'street-lamp'}
			<path class="detail-dark" d="M23 39V13h11" />
			<path class="top" d="m29 11 10 0-2 9h-6Z" />
			<circle class="detail-light" cx="34" cy="17" r="3" />
			<path class="right" d="M16 39h15v4H16Z" />
		{:else if shape === 'public-bench'}
			<path class="top" d="M8 24h32v7H8Zm2-13h28v8H10Z" />
			<path class="detail-dark" d="M12 31v10m24-10v10M12 19v5m24-5v5" />
		{:else if shape === 'trash-bin'}
			<path class="right" d="M14 15h20l-2 27H16Z" />
			<path class="top" d="M12 11h24v6H12Z" />
			<path class="detail-dark" d="M18 21v15m6-15v15m6-15v15" />
		{:else if shape === 'bollard'}
			<path class="right" d="M20 14h8l2 27H18Z" />
			<ellipse class="top" cx="24" cy="14" rx="5" ry="3" />
			<path class="detail-light-stroke" d="M19 27h10" />
		{:else if shape === 'bus-shelter'}
			<path class="glass-fill" d="M9 12h30v27H9Z" />
			<path class="glass-frame" d="M7 9h34v4H7Zm2 3h3v29H9Zm27 0h3v29h-3Z" />
			<path class="top" d="M14 30h20v5H14Z" />
		{:else if shape === 'store-shelf'}
			<rect class="top" x="8" y="8" width="32" height="34" />
			<path class="detail-dark" d="M9 18h30M9 29h30M14 12v4m7-4v4m7 11v4m7-4v4" />
		{:else if shape === 'produce-crate'}
			<path class="right" d="M8 23h32v17H8Z" />
			<path class="detail-light-stroke" d="M11 27h26M11 34h26" />
			<circle class="top" cx="17" cy="20" r="5" /><circle
				class="top"
				cx="26"
				cy="18"
				r="5"
			/><circle class="top" cx="34" cy="21" r="4" />
		{:else if shape === 'drink-cooler'}
			<rect class="glass-fill" x="11" y="5" width="26" height="39" rx="2" />
			<path class="glass-frame" d="M10 4h28v41H10Zm4 5v31h20V9Z" fill-rule="evenodd" />
			<path class="detail-light-stroke" d="M17 17h14M17 25h14M17 33h14" />
		{:else if shape === 'checkout-counter'}
			<path class="top" d="M6 21h36v18H6Z" />
			<path class="detail-dark" d="M8 26h20m8-13v10h6M30 16h6" />
		{:else if shape === 'shopping-cart'}
			<path class="detail-dark" d="M8 12h5l4 20h19l4-13H16m1 4h20M20 34v3m13-3v3" />
			<circle class="right" cx="20" cy="40" r="3" /><circle class="right" cx="33" cy="40" r="3" />
		{:else if shape === 'store-sign'}
			<rect class="top" x="7" y="10" width="34" height="20" rx="2" />
			<path class="detail-light-stroke" d="M12 17h24M12 23h16" />
			<path class="detail-dark" d="M17 30v10m14-10v10" />
		{:else if shape === 'pool-tile'}
			<path class="top" d="M6 25 24 15l18 10-18 10Z" />
			<path class="water-wave" d="M10 25c3-2 5-2 8 0s5 2 8 0 5-2 9 0" />
			<path class="detail-light-stroke" d="M24 16v18M8 25h32" />
		{:else if shape === 'pool-ladder'}
			<path
				class="detail-dark"
				d="M15 40V14c0-5 5-7 9-4 2 1 3 3 3 6v24M15 22h12M15 29h12M15 36h12"
			/>
		{:else if shape === 'changing-bench'}
			<path class="top" d="M8 22h32v8H8Z" />
			<path class="detail-dark" d="M13 30v11m22-11v11M11 25h26" />
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
