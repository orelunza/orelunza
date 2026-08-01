<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Clock,
		DirectionalLight,
		PerspectiveCamera,
		Scene,
		WebGLRenderer
	} from 'three';
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
	let skinnedMeshCount = $state(0);
	let modelSource = $state('loading');
	let animationClipCount = $state(0);
	let currentAnimation = $state('idle');
	let avatarReady = $state(false);
	let avatarError = $state('');

	onMount(() => {
		if (!canvas) {
			return;
		}

		const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
		const scene = new Scene();
		const camera = new PerspectiveCamera(45, 1, 0.1, 50);
		const light = new DirectionalLight(0xffe2bd, 1.4);
		const clock = new Clock();
		avatar = new PlayerAvatar(appearance);

		camera.position.set(0, 1.15, 4.2);
		light.position.set(3, 6, 4);
		scene.add(new AmbientLight(0xffffff, 0.7), light, avatar.object);
		renderer.setPixelRatio(1);
		renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 320, false);

		let frame = 0;
		let disposed = false;

		void avatar.ready
			.then(() => {
				if (disposed || !avatar) {
					return;
				}

				updateDiagnostics();
				avatarReady = true;
			})
			.catch((error: unknown) => {
				avatarError = error instanceof Error ? error.message : String(error);
			});

		const tick = () => {
			if (!avatar) {
				return;
			}

			avatar.updatePreview(clock.getDelta());
			avatar.object.rotation.y += 0.012;
			updateDiagnostics();
			renderer.render(scene, camera);
			frame = requestAnimationFrame(tick);
		};

		tick();

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			avatar?.dispose();
			renderer.dispose();
		};
	});

	function updateDiagnostics(): void {
		if (!avatar) {
			return;
		}

		const diagnostics = avatar.diagnostics;

		objectCount = diagnostics.objectCount;
		triangleCount = diagnostics.triangles;
		meshCount = diagnostics.meshCount;
		skinnedMeshCount = diagnostics.skinnedMeshCount;
		modelSource = diagnostics.modelSource;
		animationClipCount = diagnostics.animationBlend.clipCount;
		currentAnimation = diagnostics.animationBlend.currentAction;
		avatarReady = diagnostics.ready;
		avatarError = diagnostics.error ?? '';
	}
</script>

<canvas
	bind:this={canvas}
	class="aspect-square w-full rounded-md border border-white/10 bg-[#131619]"
	aria-label="Character preview"
	data-testid="character-preview"
	data-avatar-kind="humanoid-rigged"
	data-avatar-pipeline="fbx-real"
	data-avatar-ready={avatarReady ? 'true' : 'false'}
	data-model-source={modelSource}
	data-avatar-model-source={modelSource}
	data-skinned-mesh-count={skinnedMeshCount}
	data-avatar-animation-clips={animationClipCount}
	data-animation-clip-count={animationClipCount}
	data-current-animation={currentAnimation}
	data-avatar-error={avatarError}
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
