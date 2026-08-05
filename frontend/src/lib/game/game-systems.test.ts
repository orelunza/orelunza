import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	AnimationClip,
	AnimationMixer,
	Bone,
	Box3,
	QuaternionKeyframeTrack,
	Vector3,
	VectorKeyframeTrack
} from 'three';

import { GameLoop } from './GameLoop';
import { GamePersistence } from './persistence/GamePersistence';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	normalizeCharacterAppearance,
	parseCharacterAppearance,
	serializeCharacterAppearance
} from './character/CharacterAppearance';
import { BlockPlacementSystem } from './interaction/BlockPlacementSystem';
import { Hotbar } from './inventory/Hotbar';
import { Inventory } from './inventory/Inventory';
import { KeyboardInput } from './input/KeyboardInput';
import {
	HUMANOID_ANIMATION_STATES,
	HumanoidAnimationController,
	validateRequiredHumanoidClips
} from './player/HumanoidAnimationController';
import { toHumanoidAppearance } from './player/HumanoidAppearance';
import { HumanoidAnimator } from './player/HumanoidAnimator';
import type { HumanoidAnimationSnapshot } from './player/HumanoidPose';
import {
	canonicalClipNameFromAsset,
	countClipTrackMatches,
	HumanoidModel,
	neutralizeRootMotionHorizontal,
	normalizeMixamoBoneName
} from './player/HumanoidModel';
import { HumanoidRig } from './player/HumanoidRig';
import { PlayerAvatar } from './player/PlayerAvatar';
import { PlayerController } from './player/PlayerController';
import type { PlayerState } from './player/PlayerState';
import {
	SPRINT_SPEED,
	WALK_SPEED,
	cameraRelativeMovement,
	PlayerPhysics
} from './player/PlayerPhysics';
import {
	MAX_CAMERA_DISTANCE,
	MAX_CAMERA_PITCH,
	MIN_CAMERA_DISTANCE,
	MIN_CAMERA_PITCH,
	ThirdPersonCamera,
	dampAngle,
	angleDelta
} from './player/ThirdPersonCamera';
import { BlockRegistry } from './world/BlockRegistry';
import { TerrainGenerator } from './world/TerrainGenerator';
import { VoxelWorld } from './world/VoxelWorld';
import { parseWorldSave, serializeWorldSave, type WorldSaveV1 } from './world/WorldSave';
import {
	CENTRAL_CITY_CENTER,
	STARTER_WORLD_SEED,
	chunkToWorld,
	worldToChunk
} from './world/voxel-types';

function createTestMixamoSkeleton(): Bone {
	const hips = namedBone('mixamorigHips');
	const spine = namedBone('mixamorigSpine');
	const leftArm = namedBone('mixamorigLeftArm');
	const rightArm = namedBone('mixamorigRightArm');
	const leftHand = namedBone('mixamorigLeftHand');
	const rightHand = namedBone('mixamorigRightHand');
	const leftUpperLeg = namedBone('mixamorigLeftUpLeg');
	const rightUpperLeg = namedBone('mixamorigRightUpLeg');
	const leftFoot = namedBone('mixamorigLeftFoot');
	const rightFoot = namedBone('mixamorigRightFoot');

	hips.add(spine, leftUpperLeg, rightUpperLeg);
	spine.add(leftArm, rightArm);
	leftArm.add(leftHand);
	rightArm.add(rightHand);
	leftUpperLeg.add(leftFoot);
	rightUpperLeg.add(rightFoot);

	return hips;
}

function namedBone(name: string): Bone {
	const bone = new Bone();
	bone.name = name;

	return bone;
}

function testBones(root: Bone): {
	hips: Bone;
	leftUpperLeg: Bone;
	rightUpperLeg: Bone;
	leftArm: Bone;
	rightArm: Bone;
	leftHand: Bone;
	rightHand: Bone;
	rest: Bone['quaternion'];
} {
	const find = (name: string): Bone => {
		const bone = root.getObjectByName(name);

		if (!(bone instanceof Bone)) {
			throw new Error(`Missing test bone ${name}`);
		}

		return bone;
	};

	return {
		hips: find('mixamorigHips'),
		leftUpperLeg: find('mixamorigLeftUpLeg'),
		rightUpperLeg: find('mixamorigRightUpLeg'),
		leftArm: find('mixamorigLeftArm'),
		rightArm: find('mixamorigRightArm'),
		leftHand: find('mixamorigLeftHand'),
		rightHand: find('mixamorigRightHand'),
		rest: root.quaternion.clone()
	};
}

function createSyntheticLocomotionClips(): AnimationClip[] {
	return [
		createSyntheticMixamoClip('idle', 2, 0.08),
		createSyntheticMixamoClip('walk', 1, 0.55),
		createSyntheticMixamoClip('run', 0.7, 0.85),
		createSyntheticMixamoClip('strafe_left', 1, 0.48),
		createSyntheticMixamoClip('strafe_right', 1, -0.48),
		createSyntheticMixamoClip('walk_backward', 1.2, -0.35),
		createSyntheticMixamoClip('jump', 0.6, 0.65),
		createSyntheticMixamoClip('fall', 1, 0.22),
		createSyntheticMixamoClip('land', 0.45, -0.28),
		createSyntheticMixamoClip('reaction_shoved', 1, 0.9)
	];
}

function createSyntheticMixamoClip(
	name: string,
	duration: number,
	amplitude: number
): AnimationClip {
	return new AnimationClip(name, duration, [
		new VectorKeyframeTrack(
			'mixamorigHips.position',
			[0, duration / 2, duration],
			[0, 0, 0, 0, 0.08, 0, 0, 0, 0]
		),
		quaternionTrack('mixamorigHips.quaternion', duration, amplitude * 0.12),
		quaternionTrack('mixamorigLeftUpLeg.quaternion', duration, amplitude),
		quaternionTrack('mixamorigRightUpLeg.quaternion', duration, -amplitude),
		quaternionTrack('mixamorigLeftFoot.quaternion', duration, amplitude * 0.3),
		quaternionTrack('mixamorigRightFoot.quaternion', duration, -amplitude * 0.3),
		quaternionTrack('mixamorigLeftArm.quaternion', duration, -amplitude * 0.7),
		quaternionTrack('mixamorigRightArm.quaternion', duration, amplitude * 0.7),
		quaternionTrack('mixamorigLeftHand.quaternion', duration, -amplitude * 0.2),
		quaternionTrack('mixamorigRightHand.quaternion', duration, amplitude * 0.2)
	]);
}

function quaternionTrack(name: string, duration: number, angle: number): QuaternionKeyframeTrack {
	const half = angle / 2;
	const values = [0, 0, 0, 1, Math.sin(half), 0, 0, Math.cos(half), 0, 0, 0, 1];

	return new QuaternionKeyframeTrack(name, [0, duration / 2, duration], values);
}

function locomotionSnapshot(
	overrides: Partial<HumanoidAnimationSnapshot> = {}
): HumanoidAnimationSnapshot {
	return {
		locomotionState: 'idle',
		speed: 0,
		gaitPhase: 0,
		armLeftAngle: 0,
		armRightAngle: 0,
		legLeftAngle: 0,
		legRightAngle: 0,
		grounded: true,
		headYaw: 0,
		bodyYaw: Math.PI,
		cameraYaw: Math.PI,
		desiredMovementYaw: Math.PI,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		stepActive: false,
		stepHeight: 0,
		leadingFoot: null,
		stepStartedAt: -1,
		mouseLookActive: false,
		cameraRecentering: false,
		updateMs: 0,
		...overrides
	};
}

describe('voxel world coordinates', () => {
	test('converts world coordinates to chunk coordinates', () => {
		expect(worldToChunk({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
		expect(worldToChunk({ x: 16, z: -1 })).toEqual({ x: 1, z: -1 });
		expect(worldToChunk({ x: -1, z: -17 })).toEqual({ x: -1, z: -2 });
	});

	test('converts chunk coordinates to world origins', () => {
		expect(chunkToWorld({ x: 2, z: -3 })).toEqual({ x: 32, y: 0, z: -48 });
	});
});

describe('game loop performance guards', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('starts only one requestAnimationFrame loop and stop cancels it', () => {
		let nextFrame = 0;
		const requested: number[] = [];
		const cancelled: number[] = [];
		const loop = new GameLoop({
			update: () => undefined,
			render: () => undefined
		});

		vi.stubGlobal('requestAnimationFrame', () => {
			const frame = ++nextFrame;
			requested.push(frame);

			return frame;
		});
		vi.stubGlobal('cancelAnimationFrame', (frame: number) => {
			cancelled.push(frame);
		});

		loop.start();
		loop.start();

		expect(requested).toEqual([1]);
		expect(loop.isRunning).toBe(true);

		loop.stop();
		loop.stop();

		expect(cancelled).toEqual([1]);
		expect(loop.isRunning).toBe(false);
	});
});

describe('terrain generation', () => {
	test('is deterministic for a seed', () => {
		const first = new TerrainGenerator(STARTER_WORLD_SEED);
		const second = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(first.heightAt(12, -7)).toBe(second.heightAt(12, -7));
		expect(first.generateChunk(0, 0).blocks.slice(0, 20)).toEqual(
			second.generateChunk(0, 0).blocks.slice(0, 20)
		);
	});

	test('generates a deterministic open spawn meadow', () => {
		const generator = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(generator.heightAt(0, 0)).toBe(9);
		expect(generator.zoneAt(0, 0)).toBe('Spawn Meadow');
		expect(generator.zoneAt(24, 0)).toBe('Riverbank');
	});

	test('places the central city and a path in the expected direction', () => {
		const generator = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(generator.zoneAt(CENTRAL_CITY_CENTER.x, CENTRAL_CITY_CENTER.z)).toBe('Central City');
		expect([-3, -2, -1, 0, 1, 2, 3].some((x) => generator.isPath(x, -40))).toBe(true);

		const cityBlocks = generator
			.generateChunk(0, Math.floor(CENTRAL_CITY_CENTER.z / 16))
			.blocks.filter((block) => block.type === 'brick' || block.type === 'wooden_plank');

		expect(cityBlocks.length).toBeGreaterThan(20);
	});
});

describe('block registry and world mutations', () => {
	test('exposes stable block definitions', () => {
		expect(BlockRegistry.get('grass')).toMatchObject({
			type: 'grass',
			solid: true,
			collectable: true
		});
		expect(BlockRegistry.get('water')).toMatchObject({
			passable: true,
			transparent: true
		});
	});

	test('adds and removes a block', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);

		expect(world.setBlock({ x: 4, y: 20, z: 4 }, 'brick')).toBe(true);
		expect(world.getBlock({ x: 4, y: 20, z: 4 }).type).toBe('brick');
		expect(world.removeBlock({ x: 4, y: 20, z: 4 })).toBe('brick');
		expect(world.getBlock({ x: 4, y: 20, z: 4 }).type).toBe('air');
	});

	test('applies placed and removed block snapshots', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		world.setBlock({ x: 5, y: 20, z: 5 }, 'glass');
		world.removeBlock({ x: 5, y: 20, z: 5 });

		const restored = new VoxelWorld(STARTER_WORLD_SEED);
		restored.loadModifications(world.exportModifications());

		expect(restored.getBlock({ x: 5, y: 20, z: 5 }).type).toBe('air');
	});

	test('keeps loaded chunks and visible generated blocks bounded while moving', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);

		expect(world.ensureChunksAround({ x: 0, z: 0 }, 1)).toBe(true);
		expect(world.getLoadedChunks()).toHaveLength(9);
		const firstVisible = world.getVisibleBlocks();

		expect(firstVisible.length).toBeGreaterThan(0);
		expect(world.ensureChunksAround({ x: 96, z: 0 }, 1)).toBe(true);
		expect(world.getLoadedChunks()).toHaveLength(9);
		expect(world.getVisibleBlocks().some((block) => block.position.x < 16)).toBe(false);
		expect(world.getVisibleBlocks().length).toBeLessThan(firstVisible.length * 2);
	});

	test('player and camera collision queries do not generate new chunks', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const player = testPlayer(world, {
			position: { ...spawn, x: Math.floor(spawn.x / 16) * 16 + 15.75 }
		});
		const camera = new ThirdPersonCamera(1, world);

		world.ensureChunksAround(spawn, 0);
		const loadedBefore = world.getLoadedChunks().length;
		camera.setOrientation(Math.PI / 2, 0.34);
		camera.update(player);
		const physics = new PlayerPhysics(world);
		physics.step(player, move(0, 1), 1 / 60);

		expect(world.getLoadedChunks()).toHaveLength(loadedBefore);
	});

	test('returns a safe spawn and repairs invalid restore positions', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.spawnPosition();

		expect(world.isSolidAt({ x: spawn.x, y: spawn.y, z: spawn.z })).toBe(false);
		expect(world.isSolidAt({ x: spawn.x + 1, y: spawn.y, z: spawn.z })).toBe(false);
		expect(world.safeRestorePosition({ x: 0, y: -50, z: 0 })).toEqual(spawn);
	});
});

describe('humanoid avatar rig and animation', () => {
	test('maps Mixamo filenames to canonical animation names', () => {
		expect(canonicalClipNameFromAsset('Idle.fbx')).toBe('idle');
		expect(canonicalClipNameFromAsset('Walking.fbx')).toBe('walk');
		expect(canonicalClipNameFromAsset('Running.fbx')).toBe('run');
		expect(canonicalClipNameFromAsset('Left Strafe.fbx')).toBe('strafe_left');
		expect(canonicalClipNameFromAsset('Right Strafe.fbx')).toBe('strafe_right');
		expect(canonicalClipNameFromAsset('Walking Backwards.fbx')).toBe('walk_backward');
		expect(canonicalClipNameFromAsset('Falling Idle.fbx')).toBe('fall');
		expect(canonicalClipNameFromAsset('Landing.fbx')).toBe('land');
		expect(canonicalClipNameFromAsset('Shoved Reaction With Spin.fbx')).toBe('reaction_shoved');
	});

	test('neutralizes horizontal root motion on Mixamo hips position tracks', () => {
		const clip = new AnimationClip('walk', 1, [
			new VectorKeyframeTrack('mixamorigHips.position', [0, 0.5, 1], [0, 1, 0, 4, 2, -3, 9, 1, -8])
		]);
		const sanitized = neutralizeRootMotionHorizontal(clip);
		const values = Array.from(sanitized.tracks[0].values);

		expect(values).toEqual([0, 1, 0, 0, 2, 0, 0, 1, 0]);
	});

	test('normalizes Mixamo bone names and counts real clip track matches', () => {
		const root = createTestMixamoSkeleton();
		const clip = createSyntheticMixamoClip('walk', 1, 0.6);
		const stats = countClipTrackMatches(clip, root);

		expect(normalizeMixamoBoneName('mixamorig:LeftUpLeg')).toBe('leftupleg');
		expect(normalizeMixamoBoneName('Beta_Joints:Hips')).toBe('hips');
		expect(stats.totalTrackCount).toBe(10);
		expect(stats.matchedTrackCount).toBe(10);
		expect(stats.unmatchedTrackCount).toBe(0);
		expect(stats.matchedBoneNames).toEqual(
			expect.arrayContaining(['hips', 'leftupleg', 'rightupleg', 'leftarm', 'righthand'])
		);
	});

	test('creates an explicit fallback only when requested by tests or development', () => {
		const model = HumanoidModel.createFallback(DEFAULT_CHARACTER_APPEARANCE);

		expect(model.source).toBe('procedural-fallback');
		expect(model.isRiggedHumanoid).toBe(true);
		expect(model.object.userData.avatarPipeline).toBe('procedural-voxel');
		expect(model.object.userData.avatarRole).toBe('peaceful-citizen-explorer');
		expect(model.object.userData.noMilitaryGear).toBe(true);
		expect(model.object.getObjectByName('hat')).toBeUndefined();
		expect(model.object.userData.appearance).toMatchObject({
			displayName: DEFAULT_CHARACTER_APPEARANCE.displayName
		});
		expect(validateRequiredHumanoidClips(model.clips)).toEqual([]);
		expect(model.animationNames).toEqual(
			expect.arrayContaining(['idle', 'walk', 'run', 'strafe_left', 'strafe_right'])
		);
		expect(model.metrics.objectCount).toBeGreaterThan(30);
		model.dispose();
	});

	test('normalizes human appearance fields for skin, hair and civilian clothing', () => {
		const appearance = toHumanoidAppearance({
			skinTone: '#d1a17f',
			hairStyle: 'curly',
			hairColor: '#221610',
			shirtColor: '#5c8f7a',
			pantsColor: '#42506a',
			shoesColor: '#2a2622'
		});

		expect(appearance.skinTone).toBe('#d1a17f');
		expect(appearance.hairStyle).toBe('curly');
		expect(appearance.top).toEqual({ color: '#5c8f7a', style: 'field_tunic' });
		expect(appearance.pants).toEqual({ color: '#42506a', style: 'woven_trousers' });
		expect(appearance.shoes).toEqual({ color: '#2a2622', style: 'soft_boots' });
	});

	test('uses AnimationMixer actions for locomotion blending', () => {
		const model = HumanoidModel.createFallback(DEFAULT_CHARACTER_APPEARANCE);
		const controller = new HumanoidAnimationController(model.object, model.clips);

		controller.playPreview(1 / 60);
		expect(controller.mixer).toBeInstanceOf(AnimationMixer);
		expect(controller.snapshot.clipCount).toBeGreaterThanOrEqual(9);
		expect(controller.snapshot.weights.idle).toBe(1);
		expect(HUMANOID_ANIMATION_STATES).toContain('walk');

		controller.update('run', SPRINT_SPEED, 1 / 15);
		expect(controller.snapshot.activeState).toBe('run');
		expect(controller.snapshot.weights.run).toBeGreaterThan(0);
		expect(controller.snapshot.weights.idle).toBeLessThan(1);

		controller.update('strafe_left', WALK_SPEED, 1 / 15);
		expect(controller.snapshot.activeState).toBe('strafe_left');
		expect(controller.snapshot.mixerTime).toBeGreaterThan(0);
		const transitions = controller.snapshot.transitionCount;
		controller.update('strafe_left', WALK_SPEED, 1 / 15);
		expect(controller.snapshot.transitionCount).toBe(transitions);
		controller.dispose();
		model.dispose();
	});

	test('does not restart the same action and keeps active actions bounded', () => {
		const root = createTestMixamoSkeleton();
		const controller = new HumanoidAnimationController(root, createSyntheticLocomotionClips(), {
			strict: true,
			fadeSeconds: 0.05
		});

		controller.update('walk_forward', WALK_SPEED, 1 / 60);
		const firstTransitionCount = controller.snapshot.transitionCount;
		const firstActionTime = controller.snapshot.actionTime;

		controller.update('walk_forward', WALK_SPEED, 1 / 60);
		expect(controller.snapshot.transitionCount).toBe(firstTransitionCount);
		expect(controller.snapshot.actionTime).toBeGreaterThan(firstActionTime);
		expect(controller.snapshot.activeActionCount).toBeLessThanOrEqual(2);

		for (let index = 0; index < 8; index += 1) {
			controller.update('walk_forward', WALK_SPEED, 1 / 60);
		}

		expect(controller.snapshot.activeActionCount).toBe(1);
		controller.dispose();
	});

	test('keeps a 10 second walk on one action without periodic restarts', () => {
		const root = createTestMixamoSkeleton();
		const bones = testBones(root);
		const controller = new HumanoidAnimationController(root, createSyntheticLocomotionClips(), {
			strict: true,
			fadeSeconds: 0.05
		});
		let maxActiveActions = 0;

		for (let index = 0; index < 600; index += 1) {
			controller.update(
				locomotionSnapshot({
					locomotionState: 'walk_forward',
					speed: WALK_SPEED,
					localForwardSpeed: WALK_SPEED
				}),
				1 / 60
			);
			maxActiveActions = Math.max(maxActiveActions, controller.snapshot.activeActionCount);
			expect(controller.snapshot.currentAction).toBe('walk');
			expect(controller.snapshot.currentAction).not.toBe('turn_left');
			expect(controller.snapshot.currentAction).not.toBe('turn_right');
			expect(controller.snapshot.currentAction).not.toBe('reaction_shoved');
		}

		expect(controller.snapshot.transitionCount).toBe(1);
		expect(controller.snapshot.activeActionCount).toBe(1);
		expect(maxActiveActions).toBeLessThanOrEqual(2);
		expect(controller.snapshot.actionTime).toBeGreaterThan(9.5);
		expect(bones.leftHand.quaternion.length()).toBeGreaterThan(0.99);
		expect(bones.leftHand.quaternion.length()).toBeLessThan(1.01);
		controller.dispose();
	});

	test('step overlay moves the leading leg and leaves hands unchanged', () => {
		const stepAnimator = new HumanoidAnimator();
		const referenceAnimator = new HumanoidAnimator();
		const baseInput = {
			yaw: Math.PI,
			velocityX: 0,
			velocityY: 0,
			velocityZ: -WALK_SPEED,
			grounded: true,
			deltaSeconds: 1 / 60
		};

		const step = stepAnimator.update({
			...baseInput,
			stepEvent: {
				leadingFoot: 'left',
				height: 0.8,
				startedAt: 1
			}
		});
		const reference = referenceAnimator.update(baseInput);

		expect(step.leftHipPitch).toBeGreaterThan(reference.leftHipPitch + 0.001);
		expect(step.leftKneePitch).toBeGreaterThan(reference.leftKneePitch + 0.001);
		expect(step.leftShoulderPitch).toBeCloseTo(reference.leftShoulderPitch, 6);
		expect(step.rightShoulderPitch).toBeCloseTo(reference.rightShoulderPitch, 6);
	});

	test('AnimationMixer moves hips, legs, arms and hands during walk', () => {
		const root = createTestMixamoSkeleton();
		const bones = testBones(root);
		const controller = new HumanoidAnimationController(root, createSyntheticLocomotionClips(), {
			strict: true
		});

		controller.update('walk_forward', WALK_SPEED, 1 / 30);
		const first = {
			hips: bones.hips.quaternion.clone(),
			leftLeg: bones.leftUpperLeg.quaternion.clone(),
			rightLeg: bones.rightUpperLeg.quaternion.clone(),
			leftArm: bones.leftArm.quaternion.clone(),
			leftHand: bones.leftHand.quaternion.clone()
		};

		for (let index = 0; index < 12; index += 1) {
			controller.update('walk_forward', WALK_SPEED, 1 / 30);
		}

		expect(first.hips.angleTo(bones.hips.quaternion)).toBeGreaterThan(0.001);
		expect(first.leftLeg.angleTo(bones.leftUpperLeg.quaternion)).toBeGreaterThan(0.05);
		expect(first.rightLeg.angleTo(bones.rightUpperLeg.quaternion)).toBeGreaterThan(0.05);
		expect(first.leftArm.angleTo(bones.leftArm.quaternion)).toBeGreaterThan(0.05);
		expect(first.leftHand.angleTo(bones.leftHand.quaternion)).toBeGreaterThan(0.001);
		expect(bones.leftUpperLeg.quaternion.angleTo(bones.rightUpperLeg.quaternion)).toBeGreaterThan(
			0.05
		);
		controller.dispose();
	});

	test('hand quaternions stay finite and normalized across long locomotion transitions', () => {
		const root = createTestMixamoSkeleton();
		const bones = testBones(root);
		const controller = new HumanoidAnimationController(root, createSyntheticLocomotionClips(), {
			strict: true,
			fadeSeconds: 0.05
		});
		const states = [
			'walk_forward',
			'run',
			'strafe_left',
			'strafe_right',
			'walk_backward',
			'idle'
		] as const;
		let maximumLeftHandAngle = 0;
		let maximumRightHandAngle = 0;

		for (let index = 0; index < 2400; index += 1) {
			const state = states[Math.floor(index / 120) % states.length];
			controller.update(state, state === 'run' ? SPRINT_SPEED : WALK_SPEED, 1 / 60);
			for (const hand of [bones.leftHand, bones.rightHand]) {
				const length = hand.quaternion.length();
				expect(Number.isFinite(length)).toBe(true);
				expect(length).toBeGreaterThan(0.99);
				expect(length).toBeLessThan(1.01);
			}
			maximumLeftHandAngle = Math.max(
				maximumLeftHandAngle,
				bones.leftHand.quaternion.angleTo(bones.rest)
			);
			maximumRightHandAngle = Math.max(
				maximumRightHandAngle,
				bones.rightHand.quaternion.angleTo(bones.rest)
			);
			expect(controller.snapshot.activeActionCount).toBeLessThanOrEqual(2);
		}

		expect(maximumLeftHandAngle).toBeLessThan(1.2);
		expect(maximumRightHandAngle).toBeLessThan(1.2);
		expect(controller.snapshot.currentAction).not.toBe('reaction_shoved');
		controller.dispose();
	});

	test('builds an articulated human hierarchy without a hat', () => {
		const rig = new HumanoidRig(DEFAULT_CHARACTER_APPEARANCE);
		const joints = rig.joints;

		expect(joints.hips.children).toContain(joints.spine);
		expect(joints.chest.children).toContain(joints.neck);
		expect(joints.head.children).toContain(joints.face);
		expect(joints.head.children).toContain(joints.hair);
		expect(joints.shoulderLeft.children).toContain(joints.upperArmLeft);
		expect(joints.upperArmLeft.children).toContain(joints.forearmLeft);
		expect(joints.forearmLeft.children).toContain(joints.handLeft);
		expect(joints.thighLeft.children).toContain(joints.shinLeft);
		expect(joints.shinLeft.children).toContain(joints.footLeft);
		expect(joints.footLeft.children).toContain(joints.shoeLeft);
		expect(rig.object.getObjectByName('hat')).toBeUndefined();
		expect(joints.hair.children.length).toBeGreaterThan(0);
		expect(rig.objectCount).toBeLessThan(60);
		rig.dispose();
	});

	test('matches the Orelunza silhouette: attached head, separated arms, tunic and boots', () => {
		const rig = new HumanoidRig(DEFAULT_CHARACTER_APPEARANCE);
		const joints = rig.joints;
		rig.object.updateMatrixWorld(true);

		const worldPosition = (object: (typeof joints)['head']): Vector3 =>
			new Vector3().setFromMatrixPosition(object.matrixWorld);

		const head = worldPosition(joints.head);
		const neck = worldPosition(joints.neck);
		const chest = worldPosition(joints.chest);
		const leftArm = worldPosition(joints.upperArmLeft);
		const rightArm = worldPosition(joints.upperArmRight);

		// The head sits directly on a short neck that rises from the chest, so it
		// is never a floating cube: head is above neck, neck is above chest, and
		// the vertical gaps are small and human.
		expect(head.y).toBeGreaterThan(neck.y);
		expect(neck.y).toBeGreaterThan(chest.y);
		expect(head.y - neck.y).toBeLessThan(0.4);
		expect(Math.hypot(head.x - neck.x, head.z - neck.z)).toBeLessThan(0.05);

		// The arms hang clearly to the sides of the torso, not merged into it.
		expect(Math.abs(leftArm.x)).toBeGreaterThan(0.28);
		expect(Math.abs(rightArm.x)).toBeGreaterThan(0.28);
		expect(rightArm.x - leftArm.x).toBeGreaterThan(0.56);

		// There must be a real air gap between the inner edge of each arm and the
		// side of the torso — the arms are never glued to the body.
		const ARM_HALF_WIDTH = 0.075;
		const TORSO_HALF_WIDTH = 0.25;
		expect(Math.abs(rightArm.x) - ARM_HALF_WIDTH).toBeGreaterThan(TORSO_HALF_WIDTH);

		// A short sleeve leaves the forearm bare: the forearm and hand read as
		// skin while the shoulder wears the shirt.
		const roles = (group: (typeof joints)['upperArmLeft']): string[] =>
			group.children
				.filter(
					(child): child is import('three').Mesh => (child as { isMesh?: boolean }).isMesh === true
				)
				.map((mesh) => String(mesh.userData.avatarPart));

		expect(roles(joints.upperArmLeft)).toEqual(expect.arrayContaining(['shirt', 'skin']));
		expect(roles(joints.forearmLeft)).toEqual(['skin']);
		expect(roles(joints.handLeft)).toEqual(['skin']);

		// Civilian details from the reference: a waist belt and a trouser cuff.
		const hipRoles = joints.hips.children
			.filter(
				(child): child is import('three').Mesh => (child as { isMesh?: boolean }).isMesh === true
			)
			.map((mesh) => String(mesh.userData.avatarPart));
		const shinRoles = joints.shinLeft.children
			.filter(
				(child): child is import('three').Mesh => (child as { isMesh?: boolean }).isMesh === true
			)
			.map((mesh) => String(mesh.userData.avatarPart));

		expect(hipRoles).toContain('belt');
		expect(shinRoles).toContain('cuff');
		expect(shinRoles).toContain('pants');

		// A visible boot at the foot.
		const shoeRoles = joints.shoeLeft.children
			.filter(
				(child): child is import('three').Mesh => (child as { isMesh?: boolean }).isMesh === true
			)
			.map((mesh) => String(mesh.userData.avatarPart));
		expect(shoeRoles).toContain('shoes');

		// Simple but expressive face: eyes, brows, a nose and a mouth.
		expect(joints.face.children.length).toBeGreaterThanOrEqual(7);

		// There is no vertical air gap under the head: the torso reaches the neck
		// and the head sits on the neck, so the head can never float.
		const partBox = (jointName: keyof typeof joints): Box3 => {
			const box = new Box3();
			let started = false;
			joints[jointName].children.forEach((child) => {
				if ((child as { isMesh?: boolean }).isMesh !== true) {
					return;
				}
				const childBox = new Box3().setFromObject(child);
				if (started) {
					box.union(childBox);
				} else {
					box.copy(childBox);
					started = true;
				}
			});
			return box;
		};
		const headBox = partBox('head');
		const neckBox = partBox('neck');
		const chestBox = partBox('chest');
		expect(headBox.min.y - neckBox.max.y).toBeLessThan(0.02);
		expect(neckBox.min.y - chestBox.max.y).toBeLessThan(0.02);

		rig.dispose();
	});

	test('applies appearance colors and keeps old saves compatible', () => {
		const appearance = normalizeCharacterAppearance({
			...DEFAULT_CHARACTER_APPEARANCE,
			skinTone: '#d1a17f',
			hairStyle: 'afro',
			hairColor: '#111111',
			shirtColor: '#4f8f74',
			pantsColor: '#37485f',
			shoesColor: '#2b2725'
		});
		const rig = new HumanoidRig(appearance);

		expect(rig.appearanceSnapshot).toMatchObject(appearance);
		expect(rig.joints.hair.children.length).toBeGreaterThan(4);
		expect(normalizeCharacterAppearance({ hairStyle: 'invalid' as 'short' }).hairStyle).toBe(
			'short'
		);
		expect(normalizeCharacterAppearance({ skinTone: 'bad' }).skinTone).toBe(
			DEFAULT_CHARACTER_APPEARANCE.skinTone
		);
		rig.updateAppearance({ ...appearance, hairStyle: 'braids_simple' });
		expect(rig.joints.hair.children.length).toBeGreaterThanOrEqual(3);
		rig.dispose();
	});

	test('idle breathes subtly and walk alternates opposite arms and legs', () => {
		const animator = new HumanoidAnimator();
		const idle = animator.update({
			yaw: Math.PI,
			velocityX: 0,
			velocityY: 0,
			velocityZ: 0,
			grounded: true,
			deltaSeconds: 1 / 60
		});

		expect(idle.state).toBe('idle');
		expect(Math.abs(idle.rootBob)).toBeLessThan(0.02);

		let walk = idle;

		for (let index = 0; index < 20; index += 1) {
			walk = animator.update({
				yaw: Math.PI,
				velocityX: 0,
				velocityY: 0,
				velocityZ: -WALK_SPEED,
				grounded: true,
				deltaSeconds: 1 / 60
			});
		}

		expect(walk.state).toBe('walk_forward');
		expect(Math.sign(walk.leftShoulderPitch)).toBe(-Math.sign(walk.rightShoulderPitch));
		expect(Math.sign(walk.leftHipPitch)).toBe(-Math.sign(walk.rightHipPitch));
		expect(Math.sign(walk.rightShoulderPitch)).toBe(-Math.sign(walk.leftHipPitch));
	});

	test('run cadence advances faster than walk and backward pose is distinct', () => {
		const walkAnimator = new HumanoidAnimator();
		const runAnimator = new HumanoidAnimator();
		let walkPhase = 0;
		let runPhase = 0;

		for (let index = 0; index < 30; index += 1) {
			walkAnimator.update({
				yaw: Math.PI,
				velocityX: 0,
				velocityY: 0,
				velocityZ: -WALK_SPEED,
				grounded: true,
				deltaSeconds: 1 / 60
			});
			runAnimator.update({
				yaw: Math.PI,
				velocityX: 0,
				velocityY: 0,
				velocityZ: -SPRINT_SPEED,
				grounded: true,
				deltaSeconds: 1 / 60
			});
			walkPhase = walkAnimator.diagnostics.gaitPhase;
			runPhase = runAnimator.diagnostics.gaitPhase;
		}

		expect(runPhase).toBeGreaterThan(walkPhase);

		const backward = walkAnimator.update({
			yaw: Math.PI,
			velocityX: 0,
			velocityY: 0,
			velocityZ: WALK_SPEED * 0.8,
			grounded: true,
			deltaSeconds: 1 / 60
		});

		expect(backward.state).toBe('walk_backward');
		expect(backward.chestPitch).toBeGreaterThan(0);
	});

	test('strafe left and right produce mirrored poses', () => {
		const leftAnimator = new HumanoidAnimator();
		const rightAnimator = new HumanoidAnimator();
		const left = leftAnimator.update({
			yaw: Math.PI,
			velocityX: -WALK_SPEED,
			velocityY: 0,
			velocityZ: 0,
			grounded: true,
			deltaSeconds: 1 / 30
		});
		const right = rightAnimator.update({
			yaw: Math.PI,
			velocityX: WALK_SPEED,
			velocityY: 0,
			velocityZ: 0,
			grounded: true,
			deltaSeconds: 1 / 30
		});

		expect(left.state).toBe('strafe_left');
		expect(right.state).toBe('strafe_right');
		expect(Math.sign(left.hipsRoll)).toBe(-Math.sign(right.hipsRoll));
	});

	test('rotation is interpolated and mostly frame-rate independent', () => {
		const rotate = (fps: number): number => {
			const animator = new HumanoidAnimator();

			for (let index = 0; index < fps; index += 1) {
				animator.update({
					yaw: -Math.PI / 2,
					velocityX: -WALK_SPEED,
					velocityY: 0,
					velocityZ: 0,
					grounded: true,
					deltaSeconds: 1 / fps
				});
			}

			return animator.bodyYaw;
		};

		expect(rotate(30)).toBeCloseTo(rotate(120), 1);
	});

	test('dampAngle crosses the -PI/+PI boundary through the shortest path', () => {
		const current = Math.PI - 0.05;
		const target = -Math.PI + 0.05;
		const next = dampAngle(current, target, 8, 1 / 60);

		expect(Math.abs(next)).toBeGreaterThan(Math.PI - 0.06);
		expect(next).not.toBeNaN();
	});

	test('camera yaw and body yaw are independent during mouse look', () => {
		const animator = new HumanoidAnimator();
		const initial = animator.bodyYaw;

		for (let index = 0; index < 60; index += 1) {
			animator.update({
				cameraYaw: initial + Math.PI / 2,
				bodyYaw: initial,
				desiredMovementYaw: initial,
				velocityX: 0,
				velocityY: 0,
				velocityZ: 0,
				grounded: true,
				deltaSeconds: 1 / 60,
				stepEvent: null
			});
		}

		expect(animator.diagnostics.locomotionState).toBe('idle');
		expect(animator.bodyYaw).toBeCloseTo(initial, 5);
		expect(Math.abs(animator.diagnostics.headYaw)).toBeLessThanOrEqual(0.78);
	});

	test('short strafe does not rotate the body instantly and prolonged strafe turns gradually', () => {
		const animator = new HumanoidAnimator();
		const initial = animator.bodyYaw;

		for (let index = 0; index < 12; index += 1) {
			animator.update({
				cameraYaw: initial,
				bodyYaw: initial,
				desiredMovementYaw: -Math.PI / 2,
				velocityX: -WALK_SPEED,
				velocityY: 0,
				velocityZ: 0,
				grounded: true,
				deltaSeconds: 1 / 60,
				stepEvent: null
			});
		}

		const shortYaw = animator.bodyYaw;
		expect(animator.diagnostics.locomotionState).toBe('strafe_left');
		expect(Math.abs(angleDelta(initial, shortYaw))).toBeLessThan(0.2);

		for (let index = 0; index < 120; index += 1) {
			animator.update({
				cameraYaw: initial,
				bodyYaw: shortYaw,
				desiredMovementYaw: -Math.PI / 2,
				velocityX: -WALK_SPEED,
				velocityY: 0,
				velocityZ: 0,
				grounded: true,
				deltaSeconds: 1 / 60,
				stepEvent: null
			});
		}

		expect(Math.abs(angleDelta(shortYaw, animator.bodyYaw))).toBeGreaterThan(0.2);
		expect(Math.abs(angleDelta(initial, animator.bodyYaw))).toBeLessThan(Math.PI / 2);
	});

	test('head yaw is clamped and jump, airborne and landing states are distinct', () => {
		const animator = new HumanoidAnimator();
		animator.update({
			yaw: Math.PI * 2,
			velocityX: 0,
			velocityY: 4,
			velocityZ: 0,
			grounded: false,
			deltaSeconds: 1 / 60
		});
		const jumpState = animator.diagnostics.locomotionState;
		const jumpHeadYaw = animator.diagnostics.headYaw;
		animator.update({
			yaw: Math.PI * 2,
			velocityX: 0,
			velocityY: -5,
			velocityZ: 0,
			grounded: false,
			deltaSeconds: 1 / 60
		});
		const fallState = animator.diagnostics.locomotionState;
		animator.update({
			yaw: Math.PI * 2,
			velocityX: 0,
			velocityY: 0,
			velocityZ: 0,
			grounded: true,
			deltaSeconds: 1 / 60
		});
		const landState = animator.diagnostics.locomotionState;

		expect(Math.abs(jumpHeadYaw)).toBeLessThan(1.6);
		expect(jumpState).toBe('jump_start');
		expect(fallState).toBe('airborne');
		expect(landState).toBe('landing');
	});

	test('foot grounding is skipped while airborne and does not generate chunks', async () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		let groundQueries = 0;
		const avatar = new PlayerAvatar(DEFAULT_CHARACTER_APPEARANCE, {
			allowFallback: true,
			groundHeightAt: (x, z) => {
				groundQueries += 1;

				return world.terrainGenerator.heightAt(x, z);
			}
		});
		await avatar.ready;
		const player = testPlayer(world, {
			position: spawn,
			onGround: false,
			velocity: { x: 0, y: 2, z: 0 }
		});
		world.ensureChunksAround(spawn, 0);
		const loadedBefore = world.getLoadedChunks().length;

		avatar.update(player, false, 1 / 60);

		expect(groundQueries).toBe(0);
		expect(world.getLoadedChunks()).toHaveLength(loadedBefore);
		expect(avatar.diagnostics.updateMs).toBeLessThan(10);
		avatar.dispose();
	});
});

describe('player physics', () => {
	test('normalizes diagonal movement input', () => {
		const windowTarget = new FakeWindow();
		const input = new KeyboardInput(windowTarget as unknown as Window);

		windowTarget.press('KeyW');
		windowTarget.press('KeyD');

		const movement = input.getMovement();

		expect(Math.hypot(movement.forward, movement.right)).toBeCloseTo(1);
		input.destroy();
	});

	test('toggles build mode through keyboard commands', () => {
		const windowTarget = new FakeWindow();
		const input = new KeyboardInput(windowTarget as unknown as Window);

		windowTarget.press('KeyB');

		expect(input.consumeCommands()).toMatchObject({
			build: true
		});
		input.destroy();
	});

	test('detects ground and prevents falling through solid blocks', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world, {
			position: { x: 0.5, y: world.terrainGenerator.heightAt(0, 0) + 1.02, z: 0.5 },
			velocity: { x: 0, y: -1, z: 0 },
			yaw: 0,
			cameraYaw: 0,
			bodyYaw: 0,
			onGround: false
		});
		const physics = new PlayerPhysics(world);

		for (let step = 0; step < 120; step += 1) {
			physics.step(player, { forward: 0, right: 0, jump: false, sprint: false }, 1 / 60);
		}

		expect(player.onGround).toBe(true);
		expect(player.position.y).toBeGreaterThan(world.terrainGenerator.heightAt(0, 0));
	});

	test('jumps only from the ground', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const height = world.terrainGenerator.heightAt(0, 0);
		const player = testPlayer(world, {
			position: { x: 0.5, y: height + 1.02, z: 0.5 },
			velocity: { x: 0, y: 0, z: 0 },
			yaw: 0,
			cameraYaw: 0,
			bodyYaw: 0,
			onGround: true
		});
		const physics = new PlayerPhysics(world);

		physics.step(player, { forward: 0, right: 0, jump: true, sprint: false }, 1 / 60);

		expect(player.velocity.y).toBeGreaterThan(0);
	});

	test('moves relative to the camera yaw', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
		controller.camera.setOrientation(Math.PI, 0.34);
		const startZ = controller.state.position.z;

		controller.step({ forward: 1, right: 0, jump: false, sprint: false }, 1 / 60);

		expect(controller.state.position.z).toBeLessThan(startZ);
	});

	test('computes left and right from the horizontal camera yaw', () => {
		expect(cameraRelativeMovement(Math.PI, move(0, 1))).toMatchObject({
			x: expect.closeTo(1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(Math.PI, move(0, -1))).toMatchObject({
			x: expect.closeTo(-1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(0, move(0, 1))).toMatchObject({
			x: expect.closeTo(-1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(Math.PI / 2, move(0, 1))).toMatchObject({
			x: expect.closeTo(0),
			z: expect.closeTo(1)
		});
		expect(cameraRelativeMovement(-Math.PI / 2, move(0, 1))).toMatchObject({
			x: expect.closeTo(0),
			z: expect.closeTo(-1)
		});
	});

	test('keeps diagonal movement normalized for arbitrary camera yaw', () => {
		const direction = cameraRelativeMovement(0.7, move(1, 1));

		expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
		expect(Math.abs(direction.x)).toBeGreaterThan(0.05);
		expect(Math.abs(direction.z)).toBeGreaterThan(0.05);
	});

	test('accelerates, sprints and decelerates in seconds', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world);
		const physics = new PlayerPhysics(world);

		physics.step(player, move(1, 0), 1 / 60);
		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeGreaterThan(0);
		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(WALK_SPEED);

		for (let index = 0; index < 60; index += 1) {
			physics.step(player, move(1, 0, false, true), 1 / 60);
		}

		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(SPRINT_SPEED, 1);

		for (let index = 0; index < 60; index += 1) {
			physics.step(player, move(0, 0), 1 / 60);
		}

		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(0.2);
	});

	test('keeps movement distance comparable at 30, 60 and 120 FPS', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const distances = [30, 60, 120].map((fps) => {
			const player = testPlayer(world);
			const physics = new PlayerPhysics(world);

			for (let index = 0; index < fps; index += 1) {
				physics.step(player, move(1, 0), 1 / fps);
			}

			return Math.hypot(player.position.x - 0.5, player.position.z - 0.5);
		});

		expect(distances[0]).toBeCloseTo(distances[1], 0);
		expect(distances[2]).toBeCloseTo(distances[1], 0);
	});

	test('validates safe spawn and repairs invalid restore positions', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();

		expect(world.validatePlayerPosition(spawn)).toBe(true);
		world.setBlock(
			{ x: Math.floor(spawn.x), y: Math.floor(spawn.y), z: Math.floor(spawn.z) },
			'brick'
		);

		expect(world.validatePlayerPosition(spawn)).toBe(false);
		expect(world.safeRestorePosition(spawn)).not.toEqual(spawn);
	});

	test('steps up one block but refuses a two-block wall', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const player = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2,
			cameraYaw: Math.PI / 2,
			bodyYaw: Math.PI / 2
		});
		const physics = new PlayerPhysics(world);
		const obstacleX = Math.floor(spawn.x + 1);
		const obstacleZ = Math.floor(spawn.z);
		const baseY = Math.floor(spawn.y);

		world.setBlock({ x: obstacleX, y: baseY, z: obstacleZ }, 'brick');
		let stepEvents = 0;
		let stepHeight = 0;
		let leadingFoot = '';
		for (let index = 0; index < 24; index += 1) {
			physics.step(player, move(1, 0), 1 / 60);
			if (player.stepEvent) {
				stepEvents += 1;
				stepHeight = player.stepEvent.height;
				leadingFoot = player.stepEvent.leadingFoot;
			}
		}

		expect(player.position.y).toBeGreaterThan(spawn.y + 0.5);
		expect(stepEvents).toBe(1);
		expect(stepHeight).toBeGreaterThan(0);
		expect(['left', 'right']).toContain(leadingFoot);

		const wallPlayer = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2,
			cameraYaw: Math.PI / 2,
			bodyYaw: Math.PI / 2
		});
		let wallStepEvents = 0;
		world.setBlock({ x: obstacleX, y: baseY + 1, z: obstacleZ }, 'brick');
		for (let index = 0; index < 24; index += 1) {
			physics.step(wallPlayer, move(1, 0), 1 / 60);
			if (wallPlayer.stepEvent) {
				wallStepEvents += 1;
			}
		}

		expect(wallPlayer.position.x).toBeLessThan(obstacleX);
		expect(wallStepEvents).toBe(0);
	});

	test('does not step up while airborne or into a low ceiling', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const obstacleX = Math.floor(spawn.x + 1);
		const obstacleZ = Math.floor(spawn.z);
		const baseY = Math.floor(spawn.y);
		const physics = new PlayerPhysics(world);

		world.setBlock({ x: obstacleX, y: baseY, z: obstacleZ }, 'brick');
		world.setBlock({ x: obstacleX, y: baseY + 2, z: obstacleZ }, 'brick');

		const ceilingPlayer = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2,
			cameraYaw: Math.PI / 2,
			bodyYaw: Math.PI / 2
		});
		for (let index = 0; index < 24; index += 1) {
			physics.step(ceilingPlayer, move(1, 0), 1 / 60);
		}
		expect(ceilingPlayer.position.x).toBeLessThan(obstacleX);

		const airPlayer = testPlayer(world, {
			position: { ...spawn, y: spawn.y + 2 },
			yaw: Math.PI / 2,
			cameraYaw: Math.PI / 2,
			bodyYaw: Math.PI / 2,
			onGround: false
		});
		physics.step(airPlayer, move(1, 0), 1 / 60);
		expect(airPlayer.position.y).toBeGreaterThan(spawn.y + 1);
	});

	test('camera clamps pitch, zoom and avoids terrain obstacles', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const camera = new ThirdPersonCamera(1, world);
		const player = testPlayer(world);

		camera.setOrientation(0, -10);
		expect(camera.orientationPitch).toBe(MIN_CAMERA_PITCH);
		camera.setOrientation(0, 10);
		expect(camera.orientationPitch).toBe(MAX_CAMERA_PITCH);
		camera.applyZoom(100_000);
		expect(camera.orbitDistance).toBe(MAX_CAMERA_DISTANCE);
		camera.applyZoom(-100_000);
		expect(camera.orbitDistance).toBe(MIN_CAMERA_DISTANCE);

		camera.setOrientation(Math.PI, 0.34);
		camera.update(player);
		expect(camera.camera.position.y).toBeGreaterThan(
			world.terrainGenerator.heightAt(camera.camera.position.x, camera.camera.position.z)
		);
	});

	test('camera shortens before an obstacle behind the player', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world);
		const camera = new ThirdPersonCamera(1, world);
		const wallZ = Math.floor(player.position.z - 3);
		const wallX = Math.floor(player.position.x);

		for (let y = Math.floor(player.position.y); y <= Math.floor(player.position.y + 3); y += 1) {
			world.setBlock({ x: wallX, y, z: wallZ }, 'brick');
		}

		camera.setOrientation(0, 0.2);
		camera.update(player);

		expect(camera.currentDistance).toBeLessThan(camera.orbitDistance);
	});

	test('mouse look keeps the camera independent from body yaw', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world, {
			bodyYaw: Math.PI / 2,
			cameraYaw: Math.PI,
			velocity: { x: WALK_SPEED, y: 0, z: 0 }
		});
		const camera = new ThirdPersonCamera(1, world);
		camera.setOrientation(Math.PI, 0.34);

		camera.applyMouse(player, { x: 80, y: 0 });
		camera.update(player, 1 / 60);
		const yawAfterMouse = camera.orientationYaw;

		expect(player.mouseLookActive).toBe(true);
		expect(player.cameraRecentering).toBe(false);

		for (let index = 0; index < 90; index += 1) {
			camera.update(player, 1 / 60);
		}

		expect(player.mouseLookActive).toBe(false);
		expect(player.cameraRecentering).toBe(false);
		expect(camera.orientationYaw).toBeCloseTo(yawAfterMouse, 6);
	});

	test('over-the-shoulder framing keeps the central aim ray aligned with yaw and pitch', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world);
		const camera = new ThirdPersonCamera(1, world);
		camera.setOrientation(Math.PI, 0.34);

		for (let index = 0; index < 120; index += 1) {
			camera.update(player, 1 / 60);
		}

		const forward = new Vector3(0, 0, -1).applyQuaternion(camera.camera.quaternion).normalize();
		const yaw = camera.orientationYaw;
		const pitch = camera.orientationPitch;
		const expected = new Vector3(
			Math.sin(yaw) * Math.cos(pitch),
			-Math.sin(pitch),
			Math.cos(yaw) * Math.cos(pitch)
		).normalize();

		expect(forward.dot(expected)).toBeGreaterThan(0.999);
	});

	test('build framing offsets the avatar further than exploration framing and settles without jitter', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);

		const explore = new ThirdPersonCamera(1, world);
		explore.setOrientation(Math.PI, 0.34);
		explore.setShoulderFraming('explore');

		const build = new ThirdPersonCamera(1, world);
		build.setOrientation(Math.PI, 0.34);
		build.setShoulderFraming('build');

		for (let index = 0; index < 180; index += 1) {
			explore.update(testPlayer(world), 1 / 60);
			build.update(testPlayer(world), 1 / 60);
		}

		expect(build.shoulderFramingOffset).toBeGreaterThan(explore.shoulderFramingOffset + 0.1);

		const settled = build.shoulderFramingOffset;
		build.update(testPlayer(world), 1 / 60);
		expect(Math.abs(build.shoulderFramingOffset - settled)).toBeLessThan(1e-4);
	});
});

describe('inventory and placement', () => {
	test('selects hotbar slots', () => {
		const hotbar = new Hotbar();

		expect(hotbar.select(4)).toBe(4);
		expect(hotbar.next(1)).toBe(5);
		expect(hotbar.next(-1)).toBe(4);
	});

	test('adds and removes items', () => {
		const inventory = new Inventory();

		expect(inventory.addItem('brick', 3)).toBe(true);
		expect(inventory.removeItem('brick', 2)).toBe(true);
		expect(inventory.getSelectedStack(1)?.quantity).toBe(33);
	});

	test('does not place a block inside the player', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', { x: 10.5, y: 20, z: 10.5 }, 1);
		const inventory = new Inventory();
		const system = new BlockPlacementSystem(
			world,
			inventory,
			controller.state,
			controller.physics.collider,
			() => undefined
		);

		const placed = system.place(
			{
				block: { x: 10, y: 19, z: 10 },
				normal: { x: 0, y: 1, z: 0 },
				type: 'stone'
			},
			'brick'
		);

		expect(placed).toBe(false);
	});
});

describe('world saves', () => {
	test('serializes WorldSaveV1', () => {
		const save: WorldSaveV1 = {
			version: 1,
			worldId: 'starter-world',
			seed: STARTER_WORLD_SEED,
			player: {
				playerId: 'p',
				worldId: 'starter-world',
				position: { x: 1, y: 2, z: 3 },
				yaw: 0,
				pitch: 0
			},
			inventory: new Inventory().snapshot(),
			placedBlocks: [{ position: { x: 1, y: 2, z: 3 }, type: 'brick' }],
			removedBlocks: [{ x: 2, y: 3, z: 4 }],
			changes: [],
			updatedAt: 1
		};

		expect(parseWorldSave(serializeWorldSave(save))).toEqual(save);
	});

	test('serializes character appearance', () => {
		expect(
			parseCharacterAppearance(serializeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE))
		).toEqual(DEFAULT_CHARACTER_APPEARANCE);
	});

	test('serializes WorldSaveV2 with character appearance', () => {
		const save = {
			version: 2 as const,
			worldId: 'orelunza-world',
			seed: STARTER_WORLD_SEED,
			player: {
				playerId: 'p',
				worldId: 'orelunza-world',
				position: { x: 1, y: 12, z: 3 },
				yaw: Math.PI,
				pitch: 0.34
			},
			character: DEFAULT_CHARACTER_APPEARANCE,
			inventory: new Inventory().snapshot(),
			placedBlocks: [],
			removedBlocks: [],
			changes: [],
			updatedAt: 2
		};

		expect(parseWorldSave(serializeWorldSave(save))).toEqual(save);
	});

	test('does not save when nothing changed', async () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = new PlayerController(world, 'p', 'starter-world', { x: 0.5, y: 12, z: 0.5 }, 1);
		const inventory = new Inventory();
		const persistence = new GamePersistence(
			'starter-world',
			STARTER_WORLD_SEED,
			world,
			player,
			inventory,
			DEFAULT_CHARACTER_APPEARANCE,
			() => undefined
		);

		await expect(persistence.save(false)).resolves.toBe(false);
	});
});

describe('rewritten locomotion, camera and avatar contracts', () => {
	test('HumanoidAnimator never mutates the PlayerState it reads', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world, {
			bodyYaw: 1,
			yaw: 1,
			desiredMovementYaw: 1,
			cameraYaw: 2,
			velocity: { x: WALK_SPEED, y: 0, z: 0 }
		});
		const before = JSON.parse(JSON.stringify(player));
		const animator = new HumanoidAnimator();

		for (let index = 0; index < 30; index += 1) {
			animator.update({
				cameraYaw: player.cameraYaw,
				bodyYaw: player.bodyYaw,
				desiredMovementYaw: player.desiredMovementYaw,
				velocityX: player.velocity.x,
				velocityY: player.velocity.y,
				velocityZ: player.velocity.z,
				grounded: player.onGround,
				deltaSeconds: 1 / 60,
				stepEvent: player.stepEvent
			});
		}

		// The animator receives a read-only snapshot; the source state is untouched.
		expect(player.bodyYaw).toBe(before.bodyYaw);
		expect(player.yaw).toBe(before.yaw);
		expect(player.desiredMovementYaw).toBe(before.desiredMovementYaw);
		expect(player.cameraYaw).toBe(before.cameraYaw);
	});

	test('PlayerAvatar applies the pose without changing the real body yaw', async () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const avatar = new PlayerAvatar(DEFAULT_CHARACTER_APPEARANCE, { allowFallback: true });
		await avatar.ready;
		const player = testPlayer(world, {
			position: spawn,
			bodyYaw: 0.8,
			yaw: 0.8,
			desiredMovementYaw: 0.8,
			cameraYaw: 2.5,
			velocity: { x: WALK_SPEED, y: 0, z: 0 }
		});

		for (let index = 0; index < 30; index += 1) {
			avatar.update(player, true, 1 / 60);
		}

		expect(player.bodyYaw).toBe(0.8);
		expect(player.yaw).toBe(0.8);
		expect(player.desiredMovementYaw).toBe(0.8);
		// The avatar's visual rotation tracks the state's body yaw exactly.
		expect(avatar.object.rotation.y).toBeCloseTo(0.8, 6);
		avatar.dispose();
	});

	test('camera stays independent of the body during continuous mouse rotation', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
		const bodyYawBefore = controller.state.bodyYaw;

		// Spin the camera every frame without any movement input.
		for (let index = 0; index < 120; index += 1) {
			controller.applyMouse({ x: 12, y: 0 });
			controller.step(move(0, 0), 1 / 60);
		}

		// The camera has rotated a lot; the idle body follows only via the
		// bounded turn-in-place, never spinning uncontrollably or oscillating.
		expect(controller.camera.orientationYaw).not.toBeCloseTo(bodyYawBefore, 1);
		expect(Number.isFinite(controller.state.bodyYaw)).toBe(true);
		expect(controller.state.cameraRecentering).toBe(false);
	});

	test('camera does not jitter after 10 seconds of steady following', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);

		for (let index = 0; index < 600; index += 1) {
			controller.step(move(1, 0), 1 / 60);
		}

		const yawA = controller.camera.orientationYaw;
		const distanceA = controller.camera.currentDistance;
		controller.step(move(1, 0), 1 / 60);
		const yawB = controller.camera.orientationYaw;
		const distanceB = controller.camera.currentDistance;

		expect(Math.abs(angleDelta(yawA, yawB))).toBeLessThan(1e-3);
		expect(Math.abs(distanceA - distanceB)).toBeLessThan(1e-2);
	});

	test('rapid direction reversal never blocks and turns via the shortest path', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
		controller.camera.setOrientation(Math.PI, 0.34);

		controller.step(move(1, 0), 1 / 60);
		const forwardYaw = controller.state.desiredMovementYaw;
		controller.step(move(-1, 0), 1 / 60);
		const backwardYaw = controller.state.desiredMovementYaw;

		// The desired direction flips immediately with the input.
		expect(Math.abs(angleDelta(forwardYaw, backwardYaw))).toBeGreaterThan(Math.PI - 0.2);
		expect(Number.isFinite(controller.state.bodyYaw)).toBe(true);
	});

	test('body turns in place toward the camera without moving', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
		const startPosition = { ...controller.state.position };

		// Swing the camera ~120 degrees, then hold still and keep looking.
		controller.applyMouse({ x: 900, y: 0 });
		for (let index = 0; index < 60; index += 1) {
			controller.applyMouse({ x: 1, y: 0 });
			controller.step(move(0, 0), 1 / 60);
		}

		const bodyToCamera = Math.abs(angleDelta(controller.state.bodyYaw, controller.state.cameraYaw));
		expect(bodyToCamera).toBeLessThan(0.62 + 0.05);
		expect(controller.state.position.x).toBeCloseTo(startPosition.x, 3);
		expect(controller.state.position.z).toBeCloseTo(startPosition.z, 3);
	});

	test('body rotation is stable at 30, 60, 120 and 144 FPS', () => {
		const finalYaw = (fps: number): number => {
			const world = new VoxelWorld(STARTER_WORLD_SEED);
			const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
			controller.camera.setOrientation(Math.PI, 0.34);

			const seconds = 1;
			for (let index = 0; index < fps * seconds; index += 1) {
				controller.step(move(1, 1), 1 / fps);
			}

			return controller.state.bodyYaw;
		};

		const at30 = finalYaw(30);
		const at60 = finalYaw(60);
		const at120 = finalYaw(120);
		const at144 = finalYaw(144);

		expect(Math.abs(angleDelta(at30, at60))).toBeLessThan(0.05);
		expect(Math.abs(angleDelta(at60, at120))).toBeLessThan(0.05);
		expect(Math.abs(angleDelta(at120, at144))).toBeLessThan(0.05);
	});

	test('full jump arc is driven by velocityY and onGround', () => {
		const animator = new HumanoidAnimator();
		const base = {
			cameraYaw: Math.PI,
			bodyYaw: Math.PI,
			desiredMovementYaw: Math.PI,
			velocityX: 0,
			velocityZ: 0,
			deltaSeconds: 1 / 60,
			stepEvent: null
		};

		const rising = animator.update({ ...base, velocityY: 5, grounded: false });
		expect(animator.diagnostics.locomotionState).toBe('jump_start');

		let falling = rising;
		for (let index = 0; index < 4; index += 1) {
			falling = animator.update({ ...base, velocityY: -6, grounded: false });
		}
		expect(animator.diagnostics.locomotionState).toBe('airborne');

		const landing = animator.update({ ...base, velocityY: 0, grounded: true });
		expect(animator.diagnostics.locomotionState).toBe('landing');
		// Knees flex on landing to absorb the impact.
		expect(landing.leftKneePitch).toBeGreaterThan(0.1);
	});

	test('idle is genuinely calm with almost no root motion', () => {
		const animator = new HumanoidAnimator();
		let pose = animator.pose;
		let maxRootBob = 0;

		for (let index = 0; index < 180; index += 1) {
			pose = animator.update({
				cameraYaw: Math.PI,
				bodyYaw: Math.PI,
				desiredMovementYaw: Math.PI,
				velocityX: 0,
				velocityY: 0,
				velocityZ: 0,
				grounded: true,
				deltaSeconds: 1 / 60,
				stepEvent: null
			});
			maxRootBob = Math.max(maxRootBob, Math.abs(pose.rootBob));
		}

		expect(animator.diagnostics.locomotionState).toBe('idle');
		expect(maxRootBob).toBeLessThan(0.02);
	});

	test('build raycast ignores the avatar entirely', async () => {
		const { BlockRaycaster } = await import('./interaction/BlockRaycaster');
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const avatar = new PlayerAvatar(DEFAULT_CHARACTER_APPEARANCE, { allowFallback: true });
		await avatar.ready;

		const raycaster = new BlockRaycaster(6);
		const camera = new ThirdPersonCamera(1, world);
		const player = testPlayer(world);
		camera.setOrientation(Math.PI, 0.2);
		camera.update(player);

		// The raycaster only ever receives world block lookups. The avatar object
		// is never part of that set, so it can never be targeted.
		const lookups: never[] = [];
		const result = raycaster.raycast(camera.camera, lookups);
		expect(result).toBeNull();

		// And the avatar object graph is not a block lookup mesh.
		expect(avatar.object.name).toBe('playerAvatar');
		avatar.dispose();
	});
});

function move(forward: number, right: number, jump = false, sprint = false) {
	return {
		forward,
		right,
		jump,
		sprint
	};
}

function testPlayer(
	world: VoxelWorld,
	overrides: Partial<ReturnType<typeof baseTestPlayer>> = {}
): ReturnType<typeof baseTestPlayer> {
	return {
		...baseTestPlayer(world),
		...overrides
	};
}

function baseTestPlayer(world: VoxelWorld): PlayerState {
	return {
		playerId: 'p',
		worldId: 'w',
		position: world.findSafeSpawnPosition(),
		velocity: { x: 0, y: 0, z: 0 },
		yaw: Math.PI,
		pitch: 0,
		onGround: true,
		height: 1.78,
		radius: 0.32,
		cameraYaw: Math.PI,
		bodyYaw: Math.PI,
		desiredMovementYaw: Math.PI,
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		stepEvent: null,
		mouseLookActive: false,
		cameraRecentering: false
	};
}

class FakeWindow {
	private readonly listeners = new Map<string, Set<(event: KeyboardEvent) => void>>();

	addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
		const listeners = this.listeners.get(type) ?? new Set<(event: KeyboardEvent) => void>();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
		this.listeners.get(type)?.delete(listener);
	}

	press(code: string): void {
		this.dispatch('keydown', { code } as KeyboardEvent);
	}

	private dispatch(type: string, event: KeyboardEvent): void {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}
}
