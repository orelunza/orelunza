import { Group, Vector3 } from 'three';
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
import { HumanoidModel, type HumanoidLoadStatus, type HumanoidModelSource } from './HumanoidModel';
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
	animation: HumanoidAnimationSnapshot;
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
			yaw: player.yaw,
			velocityX: player.velocity.x,
			velocityY: player.velocity.y,
			velocityZ: player.velocity.z,
			grounded: player.onGround,
			deltaSeconds
		});
		const snapshot = this.animator.diagnostics;

		this.animationController?.update(snapshot.locomotionState, snapshot.speed, deltaSeconds);
		this.model?.applyPostAnimationAdjustments();

		if (player.onGround) {
			this.applyFootGrounding(player, pose);
		}

		this.model?.applyPose(pose);
		this.object.position.set(
			player.position.x,
			player.position.y + (this.model?.modelOffsetY ?? 0),
			player.position.z
		);
		this.object.rotation.y = this.animator.bodyYaw;
		this.updateMs = performance.now() - startedAt;
	}

	updatePreview(deltaSeconds: number): void {
		this.animationController?.playPreview(deltaSeconds);
		this.model?.applyPostAnimationAdjustments();
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
			this.animationController = new HumanoidAnimationController(model.object, model.clips, {
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
			this.animationController = new HumanoidAnimationController(model.object, model.clips);
			this.object.add(model.object);
			this.status = 'ready';
			this.error = error instanceof Error ? error.message : String(error);
		}
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
		transitionCount: 0
	};
}
