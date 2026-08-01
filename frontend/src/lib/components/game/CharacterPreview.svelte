<script lang="ts">
	import { onMount } from 'svelte';
	import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
	import { PlayerAvatar } from '$lib/game/player/PlayerAvatar';
	import type { CharacterAppearanceV1 } from '$lib/game/character/CharacterAppearance';

	interface Props {
		appearance: CharacterAppearanceV1;
	}

	let { appearance }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);
	let avatar: PlayerAvatar | null = null;
	let objectCount = $state(0);
	let triangleCount = $state(0);
	let meshCount = $state(0);

	onMount(() => {
		if (!canvas) {
			return;
		}

		const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
		const scene = new Scene();
		const camera = new PerspectiveCamera(45, 1, 0.1, 50);
		const light = new DirectionalLight(0xffe2bd, 1.4);
		avatar = new PlayerAvatar(appearance);
		objectCount = avatar.diagnostics.objectCount;
		triangleCount = avatar.diagnostics.triangles;
		meshCount = avatar.diagnostics.meshCount;

		camera.position.set(0, 1.2, 4.6);
		light.position.set(3, 6, 4);
		scene.add(new AmbientLight(0xffffff, 0.7), light, avatar.object);
		renderer.setPixelRatio(1);
		renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 320, false);

		let frame = 0;
		const tick = () => {
			if (!avatar) {
				return;
			}

			avatar.object.rotation.y += 0.012;
			renderer.render(scene, camera);
			frame = requestAnimationFrame(tick);
		};

		tick();

		return () => {
			cancelAnimationFrame(frame);
			avatar?.dispose();
			renderer.dispose();
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="aspect-square w-full rounded-md border border-white/10 bg-[#131619]"
	aria-label="Character preview"
	data-testid="character-preview"
	data-avatar-kind="humanoid"
	data-hat-visible="false"
	data-avatar-objects={objectCount}
	data-avatar-meshes={meshCount}
	data-avatar-triangles={triangleCount}
	data-hair-style={appearance.hairStyle}
	data-skin-tone={appearance.skinTone}
	data-hair-color={appearance.hairColor}
	data-shirt-color={appearance.shirtColor}
	data-pants-color={appearance.pantsColor}
	data-shoes-color={appearance.shoesColor}
></canvas>
