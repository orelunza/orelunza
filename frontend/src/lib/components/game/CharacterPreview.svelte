<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		Box3,
		Clock,
		DirectionalLight,
		PerspectiveCamera,
		Scene,
		Vector3,
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
	let retargetedClipCount = $state(0);
	let targetSkeletonBoneCount = $state(0);
	let currentAnimation = $state('idle');
	let avatarReady = $state(false);
	let avatarError = $state('');
	let avatarBounds = $state('');

	onMount(() => {
		if (!canvas) {
			return;
		}

		const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
		const scene = new Scene();
		const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
		const light = new DirectionalLight(0xffe2bd, 1.4);
		const clock = new Clock();
		const box = new Box3();
		const center = new Vector3();
		const size = new Vector3();
		avatar = new PlayerAvatar(appearance);

		camera.position.set(0, 1.15, 4.2);
		camera.lookAt(0, 1, 0);
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
				frameAvatar(camera, avatar.object, box, center, size);
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
		retargetedClipCount = diagnostics.retargetedClipCount;
		targetSkeletonBoneCount = diagnostics.targetSkeletonBoneCount;
		currentAnimation = diagnostics.animationBlend.currentAction;
		avatarReady = diagnostics.ready;
		avatarError = diagnostics.error ?? '';
	}

	function frameAvatar(
		camera: PerspectiveCamera,
		object: PlayerAvatar['object'],
		box: Box3,
		center: Vector3,
		size: Vector3
	): void {
		object.updateMatrixWorld(true);
		box.setFromObject(object);
		box.getCenter(center);
		box.getSize(size);
		avatarBounds = `${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)}|${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)}`;

		const radius = Math.max(size.x, size.y, size.z, 1) * 0.62;
		const distance = radius / Math.tan((camera.fov * Math.PI) / 360);

		camera.position.set(center.x, center.y + size.y * 0.02, center.z + distance * 4.2);
		camera.lookAt(center.x, center.y + size.y * 0.05, center.z);
		camera.updateProjectionMatrix();
	}
</script>

<canvas
	bind:this={canvas}
	class="aspect-square w-full rounded-md border border-white/10 bg-[#131619]"
	aria-label="Character preview"
	data-testid="character-preview"
	data-avatar-kind="humanoid-rigged"
	data-avatar-pipeline="procedural-voxel"
	data-avatar-ready={avatarReady ? 'true' : 'false'}
	data-model-source={modelSource}
	data-avatar-model-source={modelSource}
	data-skinned-mesh-count={skinnedMeshCount}
	data-avatar-animation-clips={animationClipCount}
	data-animation-clip-count={animationClipCount}
	data-retargeted-clip-count={retargetedClipCount}
	data-target-skeleton-bone-count={targetSkeletonBoneCount}
	data-current-animation={currentAnimation}
	data-avatar-error={avatarError}
	data-hat-visible="false"
	data-avatar-objects={objectCount}
	data-avatar-meshes={meshCount}
	data-avatar-triangles={triangleCount}
	data-avatar-bounds={avatarBounds}
	data-hair-style={appearance.hairStyle}
	data-skin-tone={appearance.skinTone}
	data-hair-color={appearance.hairColor}
	data-shirt-color={appearance.shirtColor}
	data-pants-color={appearance.pantsColor}
	data-shoes-color={appearance.shoesColor}
></canvas>
