import { MathUtils } from 'three';
import { SPRINT_SPEED, WALK_SPEED } from './PlayerPhysics';
import {
	createNeutralPose,
	type HumanoidAnimationInput,
	type HumanoidAnimationSnapshot,
	type HumanoidLocomotionState,
	type HumanoidPose
} from './HumanoidPose';

const MAX_HEAD_YAW = 0.78;
const MAX_HEAD_PITCH = 0.35;
const TURN_THRESHOLD = 0.35;

export class HumanoidAnimator {
	readonly pose: HumanoidPose = createNeutralPose();
	private visualYaw = Math.PI;
	private gaitPhase = 0;
	private blinkTimer = 1.8;
	private blink = 0;
	private landingTimer = 0;
	private wasGrounded = true;
	private lastVerticalSpeed = 0;
	private updateMs = 0;
	private snapshot: HumanoidAnimationSnapshot = {
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
		updateMs: 0
	};

	update(input: HumanoidAnimationInput): HumanoidPose {
		const startedAt = performance.now();
		const delta = Math.min(input.deltaSeconds, 0.05);
		const speed = Math.hypot(input.velocityX, input.velocityZ);
		const localForward =
			Math.sin(this.visualYaw) * input.velocityX + Math.cos(this.visualYaw) * input.velocityZ;
		const localSide =
			-Math.cos(this.visualYaw) * input.velocityX + Math.sin(this.visualYaw) * input.velocityZ;
		const moving = speed > 0.08;
		const running = speed > (WALK_SPEED + SPRINT_SPEED) * 0.5;
		const desiredYaw = moving ? Math.atan2(input.velocityX, input.velocityZ) : input.yaw;
		const yawDelta = angleDelta(this.visualYaw, desiredYaw);
		const turnSpeed = moving ? 10 : 5;
		const maxTurn = (moving ? 7 : 3.8) * delta;
		this.visualYaw += MathUtils.clamp(yawDelta * dampAlpha(turnSpeed, delta), -maxTurn, maxTurn);
		this.visualYaw = normalizeAngle(this.visualYaw);

		if (input.grounded && !this.wasGrounded) {
			this.landingTimer = MathUtils.clamp(Math.abs(this.lastVerticalSpeed) / 12, 0.12, 0.28);
		}

		this.wasGrounded = input.grounded;
		this.lastVerticalSpeed = input.velocityY;

		const cadence = running ? 12.5 : moving ? 8.2 : 1.1;
		this.gaitPhase += cadence * delta * MathUtils.clamp(speed / WALK_SPEED, 0.25, 1.45);
		this.blinkTimer -= delta;

		if (this.blinkTimer <= 0) {
			this.blink = 1;
			this.blinkTimer = 2.6 + (Math.sin(this.gaitPhase * 1.7) + 1) * 1.2;
		}

		this.blink = Math.max(0, this.blink - delta * 12);
		this.landingTimer = Math.max(0, this.landingTimer - delta);

		const state = this.resolveState({
			speed,
			localForward,
			localSide,
			running,
			grounded: input.grounded,
			verticalSpeed: input.velocityY,
			yawDelta
		});

		this.applyPose({
			state,
			speed,
			localForward,
			localSide,
			running,
			grounded: input.grounded,
			cameraYaw: input.yaw,
			verticalSpeed: input.velocityY,
			delta
		});
		this.updateMs = performance.now() - startedAt;
		this.snapshot = {
			locomotionState: state,
			speed,
			gaitPhase: this.gaitPhase,
			armLeftAngle: this.pose.leftShoulderPitch,
			armRightAngle: this.pose.rightShoulderPitch,
			legLeftAngle: this.pose.leftHipPitch,
			legRightAngle: this.pose.rightHipPitch,
			grounded: input.grounded,
			headYaw: this.pose.headYaw + this.pose.neckYaw,
			bodyYaw: this.visualYaw,
			updateMs: this.updateMs
		};

		return this.pose;
	}

	get bodyYaw(): number {
		return this.visualYaw;
	}

	get lastUpdateMs(): number {
		return this.updateMs;
	}

	get diagnostics(): HumanoidAnimationSnapshot {
		return this.snapshot;
	}

	private resolveState(input: {
		speed: number;
		localForward: number;
		localSide: number;
		running: boolean;
		grounded: boolean;
		verticalSpeed: number;
		yawDelta: number;
	}): HumanoidLocomotionState {
		if (!input.grounded) {
			return input.verticalSpeed > 0.6 ? 'jump_start' : 'airborne';
		}

		if (this.landingTimer > 0) {
			return 'landing';
		}

		if (input.speed < 0.08) {
			if (input.yawDelta > TURN_THRESHOLD) {
				return 'turn_right';
			}

			if (input.yawDelta < -TURN_THRESHOLD) {
				return 'turn_left';
			}

			return 'idle';
		}

		if (input.running) {
			return 'run';
		}

		if (Math.abs(input.localSide) > Math.abs(input.localForward) * 1.15) {
			return input.localSide > 0 ? 'strafe_right' : 'strafe_left';
		}

		if (input.localForward < -0.2) {
			return 'walk_backward';
		}

		return 'walk_forward';
	}

	private applyPose(input: {
		state: HumanoidLocomotionState;
		speed: number;
		localForward: number;
		localSide: number;
		running: boolean;
		grounded: boolean;
		cameraYaw: number;
		verticalSpeed: number;
		delta: number;
	}): void {
		const phase = this.gaitPhase;
		const stride = Math.sin(phase);
		const opposite = Math.sin(phase + Math.PI);
		const liftLeft = Math.max(0, Math.sin(phase - 0.35));
		const liftRight = Math.max(0, Math.sin(phase + Math.PI - 0.35));
		const speedRatio = MathUtils.clamp(input.speed / SPRINT_SPEED, 0, 1);
		const walkWeight = input.grounded ? MathUtils.clamp(input.speed / WALK_SPEED, 0, 1) : 0;
		const runWeight = input.running
			? MathUtils.clamp((input.speed - WALK_SPEED) / (SPRINT_SPEED - WALK_SPEED), 0, 1)
			: 0;
		const sideSign = Math.sign(input.localSide);
		const backward = input.localForward < -0.2 ? 1 : 0;
		const side = MathUtils.clamp(Math.abs(input.localSide) / WALK_SPEED, 0, 1);
		const breath = Math.sin(phase * 0.28);
		const armAmplitude = 0.2 + walkWeight * 0.42 + runWeight * 0.34;
		const legAmplitude = 0.15 + walkWeight * 0.48 + runWeight * 0.34;
		const cautious = backward ? 0.55 : 1;
		const cameraDelta = MathUtils.clamp(
			angleDelta(this.visualYaw, input.cameraYaw),
			-MAX_HEAD_YAW,
			MAX_HEAD_YAW
		);

		this.pose.state = input.state;
		this.pose.gaitPhase = phase;
		this.pose.rootBob = input.grounded
			? Math.abs(Math.sin(phase * 2)) * (0.01 + speedRatio * 0.035) + breath * 0.006
			: -0.035;
		this.pose.hipsYaw = stride * (0.035 + speedRatio * 0.045) + sideSign * side * 0.08;
		this.pose.hipsRoll = opposite * (0.018 + speedRatio * 0.025) + sideSign * side * 0.06;
		this.pose.chestPitch = runWeight * -0.16 + backward * 0.08 + (input.grounded ? 0 : 0.08);
		this.pose.chestYaw = -this.pose.hipsYaw * 0.7;
		this.pose.neckYaw = cameraDelta * 0.38;
		this.pose.headYaw =
			cameraDelta * 0.32 + MathUtils.clamp(input.localSide / SPRINT_SPEED, -0.16, 0.16);
		this.pose.headPitch = MathUtils.clamp(
			-input.verticalSpeed * 0.015,
			-MAX_HEAD_PITCH,
			MAX_HEAD_PITCH
		);

		this.pose.leftShoulderPitch = -opposite * armAmplitude * cautious - runWeight * 0.22;
		this.pose.rightShoulderPitch = -stride * armAmplitude * cautious - runWeight * 0.22;
		this.pose.leftShoulderRoll = 0.18 + sideSign * side * -0.14;
		this.pose.rightShoulderRoll = -0.18 + sideSign * side * -0.14;
		this.pose.leftElbowPitch = -0.42 - walkWeight * 0.2 - runWeight * 0.42;
		this.pose.rightElbowPitch = -0.42 - walkWeight * 0.2 - runWeight * 0.42;
		this.pose.leftHipPitch = stride * legAmplitude * cautious - backward * 0.16;
		this.pose.rightHipPitch = opposite * legAmplitude * cautious - backward * 0.16;
		this.pose.leftHipRoll = sideSign * side * 0.22;
		this.pose.rightHipRoll = sideSign * side * 0.22;
		this.pose.leftKneePitch = Math.max(
			0.08,
			liftLeft * (0.45 + runWeight * 0.38) + backward * 0.18
		);
		this.pose.rightKneePitch = Math.max(
			0.08,
			liftRight * (0.45 + runWeight * 0.38) + backward * 0.18
		);
		this.pose.leftAnklePitch = -this.pose.leftHipPitch * 0.28 - liftLeft * 0.12;
		this.pose.rightAnklePitch = -this.pose.rightHipPitch * 0.28 - liftRight * 0.12;
		this.pose.leftFootLift = input.grounded ? liftLeft * (0.015 + runWeight * 0.02) : 0;
		this.pose.rightFootLift = input.grounded ? liftRight * (0.015 + runWeight * 0.02) : 0;
		this.pose.blink = this.blink;

		if (side > 0.3 && !input.running) {
			this.pose.leftHipPitch *= 0.45;
			this.pose.rightHipPitch *= 0.45;
			this.pose.leftKneePitch += side * (sideSign < 0 ? 0.24 : 0.1);
			this.pose.rightKneePitch += side * (sideSign > 0 ? 0.24 : 0.1);
			this.pose.leftShoulderPitch += sideSign * -0.16;
			this.pose.rightShoulderPitch += sideSign * -0.16;
		}

		if (!input.grounded) {
			this.pose.leftHipPitch = 0.24;
			this.pose.rightHipPitch = -0.18;
			this.pose.leftKneePitch = 0.42;
			this.pose.rightKneePitch = 0.34;
			this.pose.leftShoulderPitch = -0.42;
			this.pose.rightShoulderPitch = -0.28;
			this.pose.leftElbowPitch = -0.7;
			this.pose.rightElbowPitch = -0.7;
		} else if (input.state === 'landing') {
			const land = this.landingTimer / 0.28;
			this.pose.rootBob -= land * 0.08;
			this.pose.leftKneePitch += land * 0.42;
			this.pose.rightKneePitch += land * 0.42;
			this.pose.chestPitch += land * 0.12;
		} else if (input.state === 'turn_left' || input.state === 'turn_right') {
			const sign = input.state === 'turn_right' ? 1 : -1;
			this.pose.hipsYaw += sign * 0.12;
			this.pose.leftFootLift = sign < 0 ? 0.025 : 0;
			this.pose.rightFootLift = sign > 0 ? 0.025 : 0;
			this.pose.leftKneePitch += sign < 0 ? 0.2 : 0.08;
			this.pose.rightKneePitch += sign > 0 ? 0.2 : 0.08;
		}
	}
}

function dampAlpha(speed: number, delta: number): number {
	return 1 - Math.exp(-speed * delta);
}

function angleDelta(current: number, target: number): number {
	return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function normalizeAngle(value: number): number {
	return Math.atan2(Math.sin(value), Math.cos(value));
}
