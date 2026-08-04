import { Group, Object3D, Quaternion, Vector3 } from 'three';
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
	normalizeMixamoBoneName,
	type HumanoidLoadStatus,
	type HumanoidModelSource
} from './HumanoidModel';
import type { HumanoidAnimationSnapshot } from './HumanoidPose';
import type { PlayerState } from './PlayerState';

export interface PlayerAvatarOptions {
	groundHeightAt?: (x: number, z: number) => number;
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

export class PlayerAvatar {
	readonly object = new Group();
	readonly animator = new HumanoidAnimator();
	readonly ready: Promise<void>;
	private model: HumanoidModel | null = null;
	private animationController: HumanoidAnimationController | null = null;
	private readonly tempLeftFoot = new Vector3();
	private readonly tempRightFoot = new Vector3();
	private readonly tempForward = new Vector3();
	private readonly tempRight = new Vector3();
	private readonly emptyQuaternion = new Quaternion();
	private updateMs = 0;
	private status: HumanoidLoadStatus = 'loading';
	private error: string | null = null;
	private disposed = false;
	private lookTarget: Vector3 | null = null;

	constructor(
		appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE,
		private readonly options: PlayerAvatarOptions = {}
	) {
		this.object.name = 'playerAvatar';
		this.ready = this.load(normalizeCharacterAppearance(appearance));
	}

	get diagnostics(): PlayerAvatarMetrics {
		const metrics = this.model?.metrics ?? {
			objectCount: 1,
			meshCount: 0,
			skinnedMeshCount: 0,
			materialCount: 0,
			boneCount: 0,
			triangles: 0
		};

		return {
			updateMs: this.updateMs,
			objectCount: metrics.objectCount,
			meshCount: metrics.meshCount,
			skinnedMeshCount: metrics.skinnedMeshCount,
			materialCount: metrics.materialCount,
			boneCount: metrics.boneCount,
			triangles: metrics.triangles,
			modelSource: this.model?.source ?? this.status,
			ready: this.status === 'ready',
			error: this.error,
			animationBlend: this.animationController?.snapshot ?? emptyBlendSnapshot(),
			retargetedClipCount: this.model?.retarget.retargetedClipCount ?? 0,
			targetSkeletonBoneCount: this.model?.retarget.targetSkeletonBoneCount ?? 0,
			debug: this.debugSnapshot(),
			animation: this.animator.diagnostics
		};
	}

	async updateAppearance(appearance: CharacterAppearanceV1): Promise<void> {
		await this.ready;
		this.model?.updateAppearance(normalizeCharacterAppearance(appearance));
	}

	setHandTarget(): void {
		// Hook reserved for future build/interact poses.
	}

	clearHandTarget(): void {
		// Hook reserved for future build/interact poses.
	}

	lookAtWorldPosition(position: Vector3): void {
		this.lookTarget = position;
	}

	clearLookTarget(): void {
		this.lookTarget = null;
	}

	update(player: PlayerState, _moving: boolean, deltaSeconds: number): void {
		const startedAt = performance.now();
		const pose = this.animator.update({
			cameraYaw: player.cameraYaw,
			bodyYaw: player.bodyYaw,
			desiredMovementYaw: player.desiredMovementYaw,
			velocityX: player.velocity.x,
			velocityY: player.velocity.y,
			velocityZ: player.velocity.z,
			grounded: player.onGround,
			deltaSeconds,
			stepEvent: player.stepEvent
		});
		const snapshot = this.animator.diagnostics;

		player.bodyYaw = this.animator.bodyYaw;
		player.yaw = player.bodyYaw;
		player.headYaw = snapshot.headYaw;
		player.localForwardSpeed = snapshot.localForwardSpeed;
		player.localSideSpeed = snapshot.localSideSpeed;
		player.verticalSpeed = snapshot.verticalSpeed;
		this.animationController?.update(snapshot, deltaSeconds, {
			mouseLookActive: player.mouseLookActive,
			cameraRecentering: player.cameraRecentering
		});

		if (player.onGround) {
			this.applyFootGrounding(player, pose);
		}

		this.model?.applyPose(pose);
		this.object.position.set(
			player.position.x,
			player.position.y + (this.model?.modelOffsetY ?? 0),
			player.position.z
		);
		this.object.rotation.y = player.bodyYaw;
		this.updateMs = performance.now() - startedAt;
	}

	updatePreview(deltaSeconds: number): void {
		this.animationController?.playPreview(deltaSeconds);
	}

	dispose(): void {
		this.disposed = true;
		this.animationController?.dispose();
		this.model?.dispose();
		this.object.clear();
	}

	private async load(appearance: CharacterAppearanceV1): Promise<void> {
		try {
			const model = await HumanoidModel.loadDefault(appearance);

			if (this.disposed) {
				model.dispose();

				return;
			}

			this.model = model;
			this.animationController = new HumanoidAnimationController(model.animationRoot, model.clips, {
				strict: true
			});
			this.object.add(model.object);
			this.status = 'ready';
		} catch (error) {
			if (!this.options.allowFallback) {
				this.status = 'failed';
				this.error = error instanceof Error ? error.message : String(error);
				throw error;
			}

			const model = HumanoidModel.createFallback(appearance);

			if (this.disposed) {
				model.dispose();

				return;
			}

			this.model = model;
			this.animationController = new HumanoidAnimationController(model.animationRoot, model.clips);
			this.object.add(model.object);
			this.status = 'ready';
			this.error = error instanceof Error ? error.message : String(error);
		}
	}

	private debugSnapshot(): PlayerAvatarDebugSnapshot {
		const blend = this.animationController?.snapshot ?? emptyBlendSnapshot();
		const model = this.model;
		const clip = model?.clips.find((candidate) => candidate.name === blend.currentAction);
		const trackStats =
			model && clip
				? countClipTrackMatches(clip, model.animationRoot)
				: {
						totalTrackCount: 0,
						matchedTrackCount: 0,
						unmatchedTrackCount: 0
					};
		const hips = model ? findBoneByCanonicalName(model.animationRoot, 'hips') : null;
		const leftUpperLeg = model ? findBoneByCanonicalName(model.animationRoot, 'leftupleg') : null;
		const rightUpperLeg = model ? findBoneByCanonicalName(model.animationRoot, 'rightupleg') : null;
		const leftHand = model ? findBoneByCanonicalName(model.animationRoot, 'lefthand') : null;
		const rightHand = model ? findBoneByCanonicalName(model.animationRoot, 'righthand') : null;

		return {
			modelSource: String(model?.source ?? this.status),
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
			hipsBoneName: hips?.name ?? '',
			leftUpperLegBoneName: leftUpperLeg?.name ?? '',
			rightUpperLegBoneName: rightUpperLeg?.name ?? '',
			leftHandBoneName: leftHand?.name ?? '',
			rightHandBoneName: rightHand?.name ?? '',
			hipsQuaternion: quaternionArray(hips ?? this.emptyQuaternion),
			leftUpperLegQuaternion: quaternionArray(leftUpperLeg ?? this.emptyQuaternion),
			rightUpperLegQuaternion: quaternionArray(rightUpperLeg ?? this.emptyQuaternion),
			leftHandQuaternion: quaternionArray(leftHand ?? this.emptyQuaternion),
			rightHandQuaternion: quaternionArray(rightHand ?? this.emptyQuaternion)
		};
	}

	private applyFootGrounding(
		player: PlayerState,
		pose: { leftFootLift: number; rightFootLift: number }
	): void {
		const groundHeightAt = this.options.groundHeightAt;

		if (!groundHeightAt || this.model?.source !== 'procedural-fallback') {
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

		const leftGround = groundHeightAt(this.tempLeftFoot.x, this.tempLeftFoot.z) + 1.02;
		const rightGround = groundHeightAt(this.tempRightFoot.x, this.tempRightFoot.z) + 1.02;
		pose.leftFootLift += Math.max(-0.03, Math.min(0.08, leftGround - player.position.y));
		pose.rightFootLift += Math.max(-0.03, Math.min(0.08, rightGround - player.position.y));
	}
}

function emptyBlendSnapshot(): HumanoidAnimationBlendSnapshot {
	return {
		activeState: 'idle',
		currentAction: 'idle',
		previousAction: null,
		weights: {},
		clipCount: 0,
		mixerTime: 0,
		transitionCount: 0,
		actionTime: 0,
		actionWeight: 0,
		activeActionCount: 0,
		cameraYaw: 0,
		bodyYaw: 0,
		desiredMovementYaw: 0,
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		grounded: false,
		stepActive: false,
		stepHeight: 0,
		leadingFoot: null,
		mouseLookActive: false,
		cameraRecentering: false
	};
}

function findBoneByCanonicalName(root: Object3D, canonicalName: string): Object3D | null {
	let found: Object3D | null = null;

	root.traverse((child) => {
		if (found || child.type !== 'Bone') {
			return;
		}

		if (normalizeMixamoBoneName(child.name) === canonicalName) {
			found = child;
		}
	});

	return found;
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
