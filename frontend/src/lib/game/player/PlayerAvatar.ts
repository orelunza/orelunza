import { Group, Vector3 } from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	normalizeCharacterAppearance,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import { HumanoidAnimator } from './HumanoidAnimator';
import { HumanoidRig } from './HumanoidRig';
import type { HumanoidAnimationSnapshot } from './HumanoidPose';
import type { PlayerState } from './PlayerState';

export interface PlayerAvatarOptions {
	groundHeightAt?: (x: number, z: number) => number;
}

export interface PlayerAvatarMetrics {
	updateMs: number;
	objectCount: number;
	meshCount: number;
	triangles: number;
	animation: HumanoidAnimationSnapshot;
}

export class PlayerAvatar {
	readonly object: Group;
	readonly rig: HumanoidRig;
	readonly animator = new HumanoidAnimator();
	private readonly tempLeftFoot = new Vector3();
	private readonly tempRightFoot = new Vector3();
	private readonly tempForward = new Vector3();
	private readonly tempRight = new Vector3();
	private updateMs = 0;
	private lookTarget: Vector3 | null = null;

	constructor(
		appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE,
		private readonly options: PlayerAvatarOptions = {}
	) {
		this.rig = new HumanoidRig(normalizeCharacterAppearance(appearance));
		this.object = this.rig.object;
	}

	get diagnostics(): PlayerAvatarMetrics {
		return {
			updateMs: this.updateMs,
			objectCount: this.rig.objectCount,
			meshCount: this.rig.meshCount,
			triangles: this.rig.triangleCount,
			animation: this.animator.diagnostics
		};
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		this.rig.updateAppearance(normalizeCharacterAppearance(appearance));
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

		if (player.onGround) {
			this.applyFootGrounding(player, pose);
		}

		this.rig.applyPose(pose);
		this.object.position.set(player.position.x, player.position.y + 0.12, player.position.z);
		this.object.rotation.y = this.animator.bodyYaw;
		this.updateMs = performance.now() - startedAt;
	}

	dispose(): void {
		this.rig.dispose();
	}

	private applyFootGrounding(
		player: PlayerState,
		pose: { leftFootLift: number; rightFootLift: number }
	): void {
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

		const leftGround = groundHeightAt(this.tempLeftFoot.x, this.tempLeftFoot.z) + 1.02;
		const rightGround = groundHeightAt(this.tempRightFoot.x, this.tempRightFoot.z) + 1.02;
		pose.leftFootLift += Math.max(-0.03, Math.min(0.08, leftGround - player.position.y));
		pose.rightFootLift += Math.max(-0.03, Math.min(0.08, rightGround - player.position.y));
	}
}
