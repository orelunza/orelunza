import { Group, MathUtils, Quaternion, Vector3, type Object3D } from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	normalizeCharacterAppearance,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import {
	HumanoidAnimationController,
	type HumanoidAnimationBlendSnapshot
} from './HumanoidAnimationController';
import { HumanoidAnimator } from './HumanoidAnimator';
import {
	countClipTrackMatches,
	HumanoidModel,
	type HumanoidLoadStatus,
	type HumanoidModelSource
} from './HumanoidModel';
import {
	copyHumanoidPose,
	createNeutralPose,
	type HumanoidAnimationSnapshot,
	type HumanoidPose
} from './HumanoidPose';
import { BuildHammer } from './BuildHammer';
import { ColdBreathEmitter } from './ColdBreathEmitter';
import type { HumanLifeState } from '../human/HumanConditionState';
import type { PlayerState } from './PlayerState';
import { angleDelta } from './ThirdPersonCamera';

/**
 * Runtime owner of one rendered Orelunza humanoid — rewritten.
 *
 * PlayerAvatar is a strictly read-only consumer of PlayerState. Each frame it:
 *   1. asks HumanoidAnimator for a locomotion pose from a read-only view of the
 *      player (it passes velocities/flags, never mutates them);
 *   2. copies that pose into a private render pose;
 *   3. layers transient visual overlays (world look, build reach, hammer action,
 *      terrain foot grounding) onto the render pose only;
 *   4. applies the render pose to the rig and syncs the group transform.
 *
 * It never writes bodyYaw, yaw, desiredMovementYaw or any telemetry back onto
 * PlayerState — those are owned by PlayerController. The object's visual
 * rotation simply mirrors `player.bodyYaw`.
 */

export interface PlayerAvatarOptions {
	groundHeightAt?: (x: number, z: number) => number;
	/** Compatibility flag from the former imported-model pipeline (always procedural). */
	allowFallback?: boolean;
}

export interface PlayerAvatarMetrics {
	updateMs: number;
	objectCount: number;
	meshCount: number;
	skinnedMeshCount: number;
	materialCount: number;
	boneCount: number;
	triangles: number;
	modelSource: HumanoidModelSource | HumanoidLoadStatus;
	ready: boolean;
	error: string | null;
	animationBlend: HumanoidAnimationBlendSnapshot;
	retargetedClipCount: number;
	targetSkeletonBoneCount: number;
	debug: PlayerAvatarDebugSnapshot;
	animation: HumanoidAnimationSnapshot;
}

export interface PlayerAvatarDebugSnapshot {
	modelSource: string;
	ready: boolean;
	currentAction: string;
	previousAction: string | null;
	mixerTime: number;
	actionTime: number;
	actionWeight: number;
	activeActionCount: number;
	cameraYaw: number;
	bodyYaw: number;
	desiredMovementYaw: number;
	headYaw: number;
	localForwardSpeed: number;
	localSideSpeed: number;
	verticalSpeed: number;
	grounded: boolean;
	stepActive: boolean;
	stepHeight: number;
	leadingFoot: 'left' | 'right' | null;
	mouseLookActive: boolean;
	cameraRecentering: boolean;
	totalTrackCount: number;
	matchedTrackCount: number;
	unmatchedTrackCount: number;
	hipsBoneName: string;
	leftUpperLegBoneName: string;
	rightUpperLegBoneName: string;
	leftHandBoneName: string;
	rightHandBoneName: string;
	hipsQuaternion: number[];
	leftUpperLegQuaternion: number[];
	rightUpperLegQuaternion: number[];
	leftHandQuaternion: number[];
	rightHandQuaternion: number[];
}

const EMPTY_TRACK_STATS: ReturnType<typeof countClipTrackMatches> = {
	totalTrackCount: 0,
	matchedTrackCount: 0,
	unmatchedTrackCount: 0,
	matchedBoneNames: []
};

const MAX_DELTA_SECONDS = 0.05;
// HumanoidRig is authored facing local -Z, while gameplay yaw 0 faces world +Z.
const MODEL_FORWARD_OFFSET = Math.PI;
const MAX_LOOK_YAW = 0.78;
const MAX_LOOK_PITCH = 0.35;
const LOOK_RESPONSE = 12;
const HAND_RESPONSE = 15;
const HEAD_ORIGIN_HEIGHT = 1.72;
const DEFAULT_HAND_TARGET_DISTANCE = 0.72;
const DEFAULT_HAND_TARGET_HEIGHT = 1.12;

const HAMMER_PREP_END = 0.22;
const HAMMER_STRIKE_END = 0.58;
const HAMMER_IMPACT_END = 0.68;

export class PlayerAvatar {
	readonly object = new Group();
	readonly animator = new HumanoidAnimator();
	readonly ready: Promise<void>;

	private readonly model: HumanoidModel;
	private readonly buildHammer = new BuildHammer();
	private readonly coldBreath = new ColdBreathEmitter();
	private readonly animationController: HumanoidAnimationController;
	private readonly trackStats = new Map<string, ReturnType<typeof countClipTrackMatches>>();
	private readonly renderPose: HumanoidPose = createNeutralPose();

	private readonly tempLeftFoot = new Vector3();
	private readonly tempRightFoot = new Vector3();
	private readonly tempForward = new Vector3();
	private readonly tempRight = new Vector3();
	private readonly lookTarget = new Vector3();
	private readonly handTarget = new Vector3();

	private updateMs = 0;
	private status: HumanoidLoadStatus = 'ready';
	private error: string | null = null;
	private disposed = false;

	private lookTargetActive = false;
	private handTargetActive = false;
	private handTargetHasWorldPosition = false;
	private lookYawOffset = 0;
	private lookPitchOffset = 0;
	private handInfluence = 0;
	private coldBreathIntensity = 0;
	private weatherWindDirection = 0;
	private weatherWindStrength = 0;

	constructor(
		appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE,
		private readonly options: PlayerAvatarOptions = {}
	) {
		this.object.name = 'playerAvatar';
		this.object.userData.avatarKind = 'orelunza-citizen';
		this.object.userData.avatarPipeline = 'procedural-voxel';

		const normalized = normalizeCharacterAppearance(appearance);
		this.model = HumanoidModel.createFallback(normalized);
		this.animationController = new HumanoidAnimationController(
			this.model.animationRoot,
			this.model.clips,
			{ backend: 'procedural' }
		);

		for (const clip of this.model.clips) {
			this.trackStats.set(clip.name, countClipTrackMatches(clip, this.model.animationRoot));
		}

		this.object.add(this.model.object);
		this.model.rig.joints.handRight.add(this.buildHammer.object);
		this.model.rig.joints.head.add(this.coldBreath.object);
		// The procedural rig is authored facing local -Z. Correct that once on
		// the model child so the public avatar root can mirror bodyYaw exactly.
		this.model.object.rotation.y = MODEL_FORWARD_OFFSET;
		this.ready = Promise.resolve();
	}

	get diagnostics(): PlayerAvatarMetrics {
		const metrics = this.model.metrics;

		return {
			updateMs: this.updateMs,
			objectCount: metrics.objectCount,
			meshCount: metrics.meshCount,
			skinnedMeshCount: metrics.skinnedMeshCount,
			materialCount: metrics.materialCount,
			boneCount: metrics.boneCount,
			triangles: metrics.triangles,
			modelSource: this.status === 'ready' ? this.model.source : this.status,
			ready: this.status === 'ready',
			error: this.error,
			animationBlend: this.animationController.snapshot,
			retargetedClipCount: this.model.retarget.retargetedClipCount,
			targetSkeletonBoneCount: this.model.retarget.targetSkeletonBoneCount,
			debug: this.debugSnapshot(),
			animation: this.animator.diagnostics
		};
	}

	get appearanceSnapshot(): CharacterAppearanceV1 {
		return this.model.appearanceSnapshot;
	}

	setFirstPersonView(enabled: boolean): void {
		// Keep the body visible when looking down in first person, but never render
		// the camera from inside the procedural head / hair geometry.
		this.model.rig.setHeadVisible(!enabled);
	}

	async updateAppearance(appearance: CharacterAppearanceV1): Promise<void> {
		await this.ready;

		if (this.disposed) {
			return;
		}

		this.model.updateAppearance(normalizeCharacterAppearance(appearance));
	}

	setColdBreath(intensity: number, windDirection: number, windStrength: number): void {
		this.coldBreathIntensity = clamp01(finiteOr(intensity, 0));
		this.weatherWindDirection = finiteOr(windDirection, 0);
		this.weatherWindStrength = clamp01(finiteOr(windStrength, 0));
	}

	setHandTarget(position?: Vector3): void {
		if (this.disposed) {
			return;
		}

		this.handTargetActive = true;
		this.handTargetHasWorldPosition = isFiniteVector(position);

		if (this.handTargetHasWorldPosition && position) {
			this.handTarget.copy(position);
		}
	}

	clearHandTarget(): void {
		this.handTargetActive = false;
		this.handTargetHasWorldPosition = false;
	}

	setBuildMode(active: boolean): void {
		this.buildHammer.setVisible(active);

		if (active) {
			this.setHandTarget();
		} else {
			this.clearHandTarget();
		}
	}

	swingBuildTool(): void {
		this.buildHammer.swing();
	}

	lookAtWorldPosition(position: Vector3): void {
		if (this.disposed || !isFiniteVector(position)) {
			return;
		}

		this.lookTarget.copy(position);
		this.lookTargetActive = true;
	}

	clearLookTarget(): void {
		this.lookTargetActive = false;
	}

	reset(bodyYaw = Math.PI): void {
		if (this.disposed) {
			return;
		}

		const yaw = finiteOr(bodyYaw, Math.PI);
		this.animator.reset(yaw);
		this.animationController.reset('idle');
		copyHumanoidPose(this.renderPose, this.animator.pose);
		this.model.applyPose(this.renderPose);
		this.object.rotation.y = yaw;
		this.lookTargetActive = false;
		this.handTargetActive = false;
		this.handTargetHasWorldPosition = false;
		this.lookYawOffset = 0;
		this.lookPitchOffset = 0;
		this.handInfluence = 0;
		this.buildHammer.cancelSwing();
		this.coldBreathIntensity = 0;
		this.coldBreath.setEnvironment(0, 0);
		this.updateMs = 0;
		this.error = null;
		this.status = 'ready';
	}

	update(
		player: Readonly<PlayerState>,
		_moving: boolean,
		deltaSeconds: number,
		lifeState: HumanLifeState = 'alive'
	): void {
		if (this.disposed) {
			return;
		}

		const startedAt = nowMilliseconds();
		const delta = safeDelta(deltaSeconds);

		try {
			// The animator receives a read-only view. It returns a pose and never
			// writes PlayerState. PlayerController already owns the telemetry.
			const locomotionPose = this.animator.update({
				cameraYaw: player.cameraYaw,
				bodyYaw: player.bodyYaw,
				desiredMovementYaw: player.desiredMovementYaw,
				velocityX: player.velocity.x,
				velocityY: player.velocity.y,
				velocityZ: player.velocity.z,
				grounded: player.onGround,
				deltaSeconds: delta,
				stepEvent: player.stepEvent,
				mouseLookActive: player.mouseLookActive,
				cameraRecentering: player.cameraRecentering
			});

			this.animationController.update(this.animator.diagnostics, delta, {
				mouseLookActive: player.mouseLookActive,
				cameraRecentering: player.cameraRecentering
			});

			this.buildHammer.update(delta);
			const localWindX =
				Math.sin(this.weatherWindDirection - finiteOr(player.bodyYaw, 0)) *
				this.weatherWindStrength;
			this.coldBreath.setEnvironment(this.coldBreathIntensity, localWindX);
			this.coldBreath.update(delta);
			copyHumanoidPose(this.renderPose, locomotionPose);
			if (lifeState === 'unconscious' || lifeState === 'dead') {
				this.applyIncapacitatedPose(this.renderPose, lifeState);
			} else {
				this.applyLookOverlay(player, this.renderPose, delta);
				this.applyHandOverlay(player, this.renderPose, delta);
				this.applyHammerSwingOverlay(this.renderPose);

				if (player.onGround) {
					this.applyFootGrounding(player, this.renderPose);
				}
			}

			this.model.applyPose(this.renderPose);
			this.object.position.set(
				finiteOr(player.position.x, 0),
				finiteOr(player.position.y, 0) + this.model.modelOffsetY,
				finiteOr(player.position.z, 0)
			);
			// Visual rotation mirrors the body yaw; it never writes it back.
			this.object.rotation.y = finiteOr(player.bodyYaw, 0);
			this.status = 'ready';
			this.error = null;
		} catch (cause) {
			this.status = 'failed';
			this.error = errorMessage(cause);
		}

		this.updateMs = nowMilliseconds() - startedAt;
	}

	updatePreview(deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		const delta = safeDelta(deltaSeconds);
		const locomotionPose = this.animator.update({
			yaw: Math.PI,
			bodyYaw: Math.PI,
			velocityX: 0,
			velocityY: 0,
			velocityZ: 0,
			grounded: true,
			deltaSeconds: delta
		});

		this.buildHammer.update(delta);
		this.coldBreath.setEnvironment(this.coldBreathIntensity, 0);
		this.coldBreath.update(delta);
		copyHumanoidPose(this.renderPose, locomotionPose);
		this.handInfluence = dampScalar(
			this.handInfluence,
			this.handTargetActive ? 1 : 0,
			HAND_RESPONSE,
			delta
		);
		this.applyPreviewHandOverlay(this.renderPose);
		this.applyHammerSwingOverlay(this.renderPose);
		this.model.applyPose(this.renderPose);
		this.animationController.playPreview(delta);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.status = 'failed';
		this.error = null;
		this.animationController.dispose();
		this.buildHammer.dispose();
		this.coldBreath.dispose();
		this.model.dispose();
		this.trackStats.clear();
		this.object.clear();
		this.object.userData.disposed = true;
	}

	private debugSnapshot(): PlayerAvatarDebugSnapshot {
		const blend = this.animationController.snapshot;
		const trackStats = this.trackStats.get(blend.currentAction) ?? EMPTY_TRACK_STATS;
		const joints = this.model.rig.joints;

		return {
			modelSource: this.model.source,
			ready: this.status === 'ready',
			currentAction: blend.currentAction,
			previousAction: blend.previousAction,
			mixerTime: blend.mixerTime,
			actionTime: blend.actionTime,
			actionWeight: blend.actionWeight,
			activeActionCount: blend.activeActionCount,
			cameraYaw: blend.cameraYaw,
			bodyYaw: blend.bodyYaw,
			desiredMovementYaw: blend.desiredMovementYaw,
			headYaw: blend.headYaw,
			localForwardSpeed: blend.localForwardSpeed,
			localSideSpeed: blend.localSideSpeed,
			verticalSpeed: blend.verticalSpeed,
			grounded: blend.grounded,
			stepActive: blend.stepActive,
			stepHeight: blend.stepHeight,
			leadingFoot: blend.leadingFoot,
			mouseLookActive: blend.mouseLookActive,
			cameraRecentering: blend.cameraRecentering,
			totalTrackCount: trackStats.totalTrackCount,
			matchedTrackCount: trackStats.matchedTrackCount,
			unmatchedTrackCount: trackStats.unmatchedTrackCount,
			hipsBoneName: joints.hips.name,
			leftUpperLegBoneName: joints.thighLeft.name,
			rightUpperLegBoneName: joints.thighRight.name,
			leftHandBoneName: joints.handLeft.name,
			rightHandBoneName: joints.handRight.name,
			hipsQuaternion: quaternionArray(joints.hips),
			leftUpperLegQuaternion: quaternionArray(joints.thighLeft),
			rightUpperLegQuaternion: quaternionArray(joints.thighRight),
			leftHandQuaternion: quaternionArray(joints.handLeft),
			rightHandQuaternion: quaternionArray(joints.handRight)
		};
	}

	private applyIncapacitatedPose(pose: HumanoidPose, lifeState: 'unconscious' | 'dead'): void {
		const dead = lifeState === 'dead';
		pose.state = 'idle';
		pose.rootBob = dead ? -0.5 : -0.34;
		pose.hipsRoll = dead ? 0.48 : 0.22;
		pose.chestPitch = dead ? 0.72 : 0.5;
		pose.chestYaw = 0;
		pose.neckYaw = 0;
		pose.headYaw = 0;
		pose.headPitch = dead ? 0.5 : 0.34;
		pose.leftShoulderPitch = dead ? 0.72 : 0.5;
		pose.rightShoulderPitch = dead ? 0.58 : 0.46;
		pose.leftElbowPitch = dead ? -0.62 : -0.48;
		pose.rightElbowPitch = dead ? -0.48 : -0.42;
		pose.leftHipPitch = dead ? -0.86 : -0.55;
		pose.rightHipPitch = dead ? -0.7 : -0.48;
		pose.leftKneePitch = dead ? 1.2 : 0.88;
		pose.rightKneePitch = dead ? 1.05 : 0.8;
		pose.leftFootLift = 0;
		pose.rightFootLift = 0;
		pose.blink = 1;
	}

	private applyLookOverlay(player: Readonly<PlayerState>, pose: HumanoidPose, delta: number): void {
		let targetYaw = 0;
		let targetPitch = 0;

		if (this.lookTargetActive) {
			const originX = finiteOr(player.position.x, 0);
			const originY = finiteOr(player.position.y, 0) + HEAD_ORIGIN_HEIGHT;
			const originZ = finiteOr(player.position.z, 0);
			const dx = this.lookTarget.x - originX;
			const dy = this.lookTarget.y - originY;
			const dz = this.lookTarget.z - originZ;
			const horizontal = Math.hypot(dx, dz);

			if (horizontal > 0.0001) {
				const worldYaw = Math.atan2(dx, dz);
				targetYaw = MathUtils.clamp(
					angleDelta(player.bodyYaw, worldYaw),
					-MAX_LOOK_YAW,
					MAX_LOOK_YAW
				);
				targetPitch = MathUtils.clamp(Math.atan2(dy, horizontal), -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
			}
		}

		this.lookYawOffset = dampScalar(this.lookYawOffset, targetYaw, LOOK_RESPONSE, delta);
		this.lookPitchOffset = dampScalar(this.lookPitchOffset, targetPitch, LOOK_RESPONSE, delta);

		pose.neckYaw = MathUtils.clamp(
			pose.neckYaw + this.lookYawOffset * 0.42,
			-MAX_LOOK_YAW,
			MAX_LOOK_YAW
		);
		pose.headYaw = MathUtils.clamp(
			pose.headYaw + this.lookYawOffset * 0.58,
			-MAX_LOOK_YAW,
			MAX_LOOK_YAW
		);
		pose.headPitch = MathUtils.clamp(
			pose.headPitch + this.lookPitchOffset,
			-MAX_LOOK_PITCH,
			MAX_LOOK_PITCH
		);
	}

	private applyHandOverlay(player: Readonly<PlayerState>, pose: HumanoidPose, delta: number): void {
		this.handInfluence = dampScalar(
			this.handInfluence,
			this.handTargetActive ? 1 : 0,
			HAND_RESPONSE,
			delta
		);

		if (this.handInfluence <= 0.0001) {
			return;
		}

		let reachYaw = 0;
		let reachPitch = -0.72;

		if (this.handTargetActive && this.handTargetHasWorldPosition) {
			const originX = finiteOr(player.position.x, 0);
			const originY = finiteOr(player.position.y, 0) + DEFAULT_HAND_TARGET_HEIGHT;
			const originZ = finiteOr(player.position.z, 0);
			const dx = this.handTarget.x - originX;
			const dy = this.handTarget.y - originY;
			const dz = this.handTarget.z - originZ;
			const horizontal = Math.max(0.0001, Math.hypot(dx, dz));
			const worldYaw = Math.atan2(dx, dz);

			reachYaw = MathUtils.clamp(angleDelta(player.bodyYaw, worldYaw), -0.55, 0.55);
			reachPitch = MathUtils.clamp(-0.58 - Math.atan2(dy, horizontal) * 0.35, -1, -0.35);
		} else {
			this.writeDefaultHandTarget(player);
		}

		const influence = this.handInfluence;
		pose.chestYaw = lerp(pose.chestYaw, reachYaw * 0.28, influence);
		pose.leftShoulderPitch = lerp(pose.leftShoulderPitch, reachPitch, influence);
		pose.rightShoulderPitch = lerp(pose.rightShoulderPitch, reachPitch + 0.05, influence);
		pose.leftShoulderRoll = lerp(pose.leftShoulderRoll, 0.18 + reachYaw * 0.12, influence);
		pose.rightShoulderRoll = lerp(pose.rightShoulderRoll, -0.18 + reachYaw * 0.12, influence);
		pose.leftElbowPitch = lerp(pose.leftElbowPitch, -0.94, influence);
		pose.rightElbowPitch = lerp(pose.rightElbowPitch, -0.88, influence);
	}

	private applyHammerSwingOverlay(pose: HumanoidPose): void {
		if (!this.buildHammer.swinging) {
			return;
		}

		const progress = this.buildHammer.swingProgress;
		let influence = 1;
		let chestPitch = -0.06;
		let chestYaw = -0.24;
		let shoulderPitch = 0.42;
		let shoulderRoll = -0.32;
		let elbowPitch = -1.55;

		if (progress < HAMMER_PREP_END) {
			influence = smoothstep01(progress / HAMMER_PREP_END);
		} else if (progress < HAMMER_STRIKE_END) {
			const strike = smoothstep01(
				(progress - HAMMER_PREP_END) / (HAMMER_STRIKE_END - HAMMER_PREP_END)
			);
			chestPitch = lerp(-0.06, 0.15, strike);
			chestYaw = lerp(-0.24, 0.24, strike);
			shoulderPitch = lerp(0.42, -1.36, strike);
			shoulderRoll = lerp(-0.32, -0.06, strike);
			elbowPitch = lerp(-1.55, -0.22, strike);
		} else if (progress < HAMMER_IMPACT_END) {
			chestPitch = 0.15;
			chestYaw = 0.24;
			shoulderPitch = -1.36;
			shoulderRoll = -0.06;
			elbowPitch = -0.22;
		} else {
			influence = 1 - smoothstep01((progress - HAMMER_IMPACT_END) / (1 - HAMMER_IMPACT_END));
			chestPitch = 0.15;
			chestYaw = 0.24;
			shoulderPitch = -1.36;
			shoulderRoll = -0.06;
			elbowPitch = -0.22;
		}

		pose.chestPitch = lerp(pose.chestPitch, chestPitch, influence * 0.78);
		pose.chestYaw = lerp(pose.chestYaw, chestYaw, influence * 0.9);
		pose.rightShoulderPitch = lerp(pose.rightShoulderPitch, shoulderPitch, influence);
		pose.rightShoulderRoll = lerp(pose.rightShoulderRoll, shoulderRoll, influence);
		pose.rightElbowPitch = lerp(pose.rightElbowPitch, elbowPitch, influence);

		// The left arm remains a stabilizer instead of mirroring the striking arm.
		pose.leftShoulderPitch = lerp(pose.leftShoulderPitch, -0.48, influence * 0.28);
		pose.leftElbowPitch = lerp(pose.leftElbowPitch, -0.82, influence * 0.22);
	}

	private applyPreviewHandOverlay(pose: HumanoidPose): void {
		const influence = this.handInfluence;

		if (influence <= 0.0001) {
			return;
		}

		pose.leftShoulderPitch = lerp(pose.leftShoulderPitch, -0.72, influence);
		pose.rightShoulderPitch = lerp(pose.rightShoulderPitch, -0.67, influence);
		pose.leftShoulderRoll = lerp(pose.leftShoulderRoll, 0.18, influence);
		pose.rightShoulderRoll = lerp(pose.rightShoulderRoll, -0.18, influence);
		pose.leftElbowPitch = lerp(pose.leftElbowPitch, -0.94, influence);
		pose.rightElbowPitch = lerp(pose.rightElbowPitch, -0.88, influence);
	}

	private writeDefaultHandTarget(player: Readonly<PlayerState>): void {
		const yaw = finiteOr(player.bodyYaw, 0);
		this.handTarget.set(
			finiteOr(player.position.x, 0) + Math.sin(yaw) * DEFAULT_HAND_TARGET_DISTANCE,
			finiteOr(player.position.y, 0) + DEFAULT_HAND_TARGET_HEIGHT,
			finiteOr(player.position.z, 0) + Math.cos(yaw) * DEFAULT_HAND_TARGET_DISTANCE
		);
	}

	private applyFootGrounding(player: Readonly<PlayerState>, pose: HumanoidPose): void {
		const groundHeightAt = this.options.groundHeightAt;

		if (!groundHeightAt) {
			return;
		}

		const yaw = this.animator.bodyYaw;
		this.tempForward.set(Math.sin(yaw), 0, Math.cos(yaw));
		this.tempRight.set(-this.tempForward.z, 0, this.tempForward.x);

		this.tempLeftFoot
			.set(player.position.x, player.position.y, player.position.z)
			.addScaledVector(this.tempRight, -0.18)
			.addScaledVector(this.tempForward, -0.12);

		this.tempRightFoot
			.set(player.position.x, player.position.y, player.position.z)
			.addScaledVector(this.tempRight, 0.18)
			.addScaledVector(this.tempForward, -0.12);

		const sampledLeft = groundHeightAt(this.tempLeftFoot.x, this.tempLeftFoot.z);
		const sampledRight = groundHeightAt(this.tempRightFoot.x, this.tempRightFoot.z);

		if (Number.isFinite(sampledLeft)) {
			const leftGround = sampledLeft + 1.02;
			pose.leftFootLift += MathUtils.clamp(leftGround - player.position.y, -0.03, 0.08);
		}

		if (Number.isFinite(sampledRight)) {
			const rightGround = sampledRight + 1.02;
			pose.rightFootLift += MathUtils.clamp(rightGround - player.position.y, -0.03, 0.08);
		}

		pose.leftFootLift = MathUtils.clamp(pose.leftFootLift, 0, 0.16);
		pose.rightFootLift = MathUtils.clamp(pose.rightFootLift, 0, 0.16);
	}
}

function quaternionArray(source: Object3D | Quaternion): number[] {
	const quaternion = source instanceof Quaternion ? source : source.quaternion;

	return [
		Number(quaternion.x.toFixed(6)),
		Number(quaternion.y.toFixed(6)),
		Number(quaternion.z.toFixed(6)),
		Number(quaternion.w.toFixed(6))
	];
}

function isFiniteVector(value: Vector3 | undefined): value is Vector3 {
	return Boolean(
		value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
	);
}

function safeDelta(value: number): number {
	return MathUtils.clamp(finiteOr(value, 0), 0, MAX_DELTA_SECONDS);
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function dampScalar(current: number, target: number, response: number, delta: number): number {
	return lerp(current, target, 1 - Math.exp(-response * delta));
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * MathUtils.clamp(amount, 0, 1);
}

function smoothstep01(value: number): number {
	const clamped = MathUtils.clamp(value, 0, 1);
	return clamped * clamped * (3 - 2 * clamped);
}

function errorMessage(cause: unknown): string {
	if (cause instanceof Error && cause.message.trim()) {
		return cause.message;
	}

	return 'Unknown player avatar update error';
}

function nowMilliseconds(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
