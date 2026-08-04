import { dampAngle, angleDelta } from './ThirdPersonCamera';
import { SPRINT_SPEED, WALK_SPEED } from './PlayerPhysics';
import {
	createNeutralPose,
	resetHumanoidPose,
	type HumanoidAnimationInput,
	type HumanoidAnimationSnapshot,
	type HumanoidLeadingFoot,
	type HumanoidLocomotionState,
	type HumanoidPose,
	type HumanoidStepEvent
} from './HumanoidPose';

const MAX_DELTA_SECONDS = 0.05;
const MAX_HEAD_YAW = 0.78;
const MAX_HEAD_PITCH = 0.35;
const IDLE_ENTER_SPEED = 0.06;
const IDLE_EXIT_SPEED = 0.13;
const STRAFE_HOLD_SECONDS = 0.7;
const LANDING_MAX_SECONDS = 0.28;
const STEP_POSE_SECONDS = 0.34;
const TWO_PI = Math.PI * 2;

/**
 * Lightweight procedural locomotion for the Orelunza voxel citizen.
 *
 * The animator owns two reusable pose objects: one visible pose and one target
 * pose. Every update mutates these objects in place, avoiding per-frame pose or
 * diagnostics allocations while still smoothing transitions between states.
 */
export class HumanoidAnimator {
	readonly pose: HumanoidPose = createNeutralPose();

	private readonly targetPose: HumanoidPose = createNeutralPose();
	private readonly snapshot: HumanoidAnimationSnapshot = createInitialSnapshot();

	private visualYaw = Math.PI;
	private gaitPhase = 0;
	private elapsedSeconds = 0;
	private blinkTimer = 1.8;
	private blink = 0;
	private landingTimer = 0;
	private landingStrength = 0;
	private wasGrounded = true;
	private lastVerticalSpeed = 0;
	private moving = false;
	private strafeHoldTime = 0;
	private initialized = false;
	private updateMs = 0;

	private stepTimer = 0;
	private stepHeight = 0;
	private stepLeadingFoot: HumanoidLeadingFoot | null = null;
	private stepStartedAt = -1;

	update(input: HumanoidAnimationInput): HumanoidPose {
		const startedAt = nowMilliseconds();
		const delta = safeDelta(input.deltaSeconds);
		const velocityX = finiteOr(input.velocityX, 0);
		const velocityY = finiteOr(input.velocityY, 0);
		const velocityZ = finiteOr(input.velocityZ, 0);
		const grounded = Boolean(input.grounded);

		this.initializeYaw(input);

		const cameraYaw = resolveYaw(input.cameraYaw, input.yaw, this.visualYaw);
		const desiredInputYaw = resolveYaw(input.desiredMovementYaw, input.yaw, this.visualYaw);
		const speed = Math.hypot(velocityX, velocityZ);

		this.moving = this.moving ? speed > IDLE_ENTER_SPEED : speed > IDLE_EXIT_SPEED;

		const desiredMovementYaw =
			this.moving && speed > Number.EPSILON ? Math.atan2(velocityX, velocityZ) : desiredInputYaw;
		const preTurnLocalForward = localForwardSpeed(this.visualYaw, velocityX, velocityZ);
		const preTurnLocalSide = localSideSpeed(this.visualYaw, velocityX, velocityZ);
		const sideDominant = Math.abs(preTurnLocalSide) > Math.abs(preTurnLocalForward) * 1.15;

		if (this.moving && sideDominant && grounded) {
			this.strafeHoldTime += delta;
		} else {
			this.strafeHoldTime = 0;
		}

		const running = speed > (WALK_SPEED + SPRINT_SPEED) * 0.5;
		const turnSpeed = this.resolveBodyTurnSpeed(this.moving, running, grounded, sideDominant);

		if (this.moving) {
			this.visualYaw = dampAngle(this.visualYaw, desiredMovementYaw, turnSpeed, delta);
		} else {
			this.visualYaw = normalizeAngle(this.visualYaw);
		}

		const localForward = localForwardSpeed(this.visualYaw, velocityX, velocityZ);
		const localSide = localSideSpeed(this.visualYaw, velocityX, velocityZ);

		this.updateLanding(grounded, velocityY);
		this.updateStep(input.stepEvent ?? null, grounded, delta);
		this.updateTimers(speed, running, grounded, delta);

		const state = this.resolveState(localForward, localSide, running, grounded, velocityY);

		this.writeTargetPose(
			state,
			speed,
			localForward,
			localSide,
			running,
			grounded,
			cameraYaw,
			velocityY
		);
		this.blendPose(delta, state);

		this.updateMs = nowMilliseconds() - startedAt;
		this.writeSnapshot(
			state,
			speed,
			grounded,
			cameraYaw,
			desiredMovementYaw,
			localForward,
			localSide,
			velocityY,
			Boolean(input.mouseLookActive),
			Boolean(input.cameraRecentering)
		);

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

	/** Reset temporal animation state while preserving the reusable objects. */
	reset(bodyYaw = Math.PI): void {
		this.visualYaw = normalizeAngle(finiteOr(bodyYaw, Math.PI));
		this.gaitPhase = 0;
		this.elapsedSeconds = 0;
		this.blinkTimer = 1.8;
		this.blink = 0;
		this.landingTimer = 0;
		this.landingStrength = 0;
		this.wasGrounded = true;
		this.lastVerticalSpeed = 0;
		this.moving = false;
		this.strafeHoldTime = 0;
		this.initialized = true;
		this.updateMs = 0;
		this.stepTimer = 0;
		this.stepHeight = 0;
		this.stepLeadingFoot = null;
		this.stepStartedAt = -1;

		resetHumanoidPose(this.pose);
		resetHumanoidPose(this.targetPose);
		resetSnapshot(this.snapshot, this.visualYaw);
	}

	private initializeYaw(input: HumanoidAnimationInput): void {
		if (this.initialized) {
			return;
		}

		// PlayerAvatar supplies bodyYaw. Legacy previews/tests usually supply only
		// yaw and intentionally keep the historical Math.PI starting direction.
		if (Number.isFinite(input.bodyYaw)) {
			this.visualYaw = normalizeAngle(input.bodyYaw as number);
		}

		this.wasGrounded = Boolean(input.grounded);
		this.lastVerticalSpeed = finiteOr(input.velocityY, 0);
		this.initialized = true;
	}

	private updateLanding(grounded: boolean, verticalSpeed: number): void {
		if (grounded && !this.wasGrounded) {
			this.landingStrength = clamp(Math.abs(this.lastVerticalSpeed) / 12, 0.35, 1);
			this.landingTimer = LANDING_MAX_SECONDS * this.landingStrength;
		}

		this.wasGrounded = grounded;
		this.lastVerticalSpeed = verticalSpeed;
	}

	private updateStep(
		stepEvent: Readonly<HumanoidStepEvent> | null,
		grounded: boolean,
		delta: number
	): void {
		if (
			grounded &&
			stepEvent &&
			Number.isFinite(stepEvent.startedAt) &&
			stepEvent.startedAt !== this.stepStartedAt
		) {
			this.stepStartedAt = stepEvent.startedAt;
			this.stepLeadingFoot = stepEvent.leadingFoot;
			this.stepHeight = clamp(finiteOr(stepEvent.height, 0), 0, 1);
			this.stepTimer = STEP_POSE_SECONDS;
		}

		if (!grounded) {
			this.stepTimer = 0;
			this.stepHeight = 0;
			this.stepLeadingFoot = null;
			return;
		}

		this.stepTimer = Math.max(0, this.stepTimer - delta);

		if (this.stepTimer === 0) {
			this.stepHeight = 0;
			this.stepLeadingFoot = null;
		}
	}

	private updateTimers(speed: number, running: boolean, grounded: boolean, delta: number): void {
		this.elapsedSeconds += delta;

		if (this.moving && grounded) {
			const cadence = running ? 12.5 : 8.2;
			const velocityScale = clamp(speed / WALK_SPEED, 0.25, 1.45);
			this.gaitPhase += cadence * delta * velocityScale;

			// Keep long-running sessions numerically stable without changing normal
			// diagnostic comparisons or short test sequences.
			if (this.gaitPhase > 1_000_000) {
				this.gaitPhase %= TWO_PI;
			}
		}

		this.blinkTimer -= delta;

		if (this.blinkTimer <= 0) {
			this.blink = 1;
			this.blinkTimer = 2.6 + (Math.sin(this.elapsedSeconds * 1.7) + 1) * 1.2;
		}

		this.blink = Math.max(0, this.blink - delta * 12);
		this.landingTimer = Math.max(0, this.landingTimer - delta);
	}

	private resolveState(
		localForward: number,
		localSide: number,
		running: boolean,
		grounded: boolean,
		verticalSpeed: number
	): HumanoidLocomotionState {
		if (!grounded) {
			return verticalSpeed > 0.6 ? 'jump_start' : 'airborne';
		}

		if (this.landingTimer > 0) {
			return 'landing';
		}

		if (!this.moving) {
			return 'idle';
		}

		if (running) {
			return 'run';
		}

		if (Math.abs(localSide) > Math.abs(localForward) * 1.15) {
			return localSide > 0 ? 'strafe_right' : 'strafe_left';
		}

		if (localForward < -0.2) {
			return 'walk_backward';
		}

		return 'walk_forward';
	}

	private resolveBodyTurnSpeed(
		moving: boolean,
		running: boolean,
		grounded: boolean,
		sideDominant: boolean
	): number {
		if (!grounded) {
			return 1.2;
		}

		if (!moving) {
			return 0.6;
		}

		if (sideDominant) {
			return this.strafeHoldTime < STRAFE_HOLD_SECONDS ? 0.35 : 1.8;
		}

		return running ? 8.5 : 5.8;
	}

	private writeTargetPose(
		state: HumanoidLocomotionState,
		speed: number,
		localForward: number,
		localSide: number,
		running: boolean,
		grounded: boolean,
		cameraYaw: number,
		verticalSpeed: number
	): void {
		const pose = resetHumanoidPose(this.targetPose);
		const phase = this.gaitPhase;
		const stride = Math.sin(phase);
		const opposite = -stride;
		const liftLeft = Math.max(0, Math.sin(phase - 0.35));
		const liftRight = Math.max(0, Math.sin(phase + Math.PI - 0.35));
		const speedRatio = clamp(speed / SPRINT_SPEED, 0, 1);
		const walkWeight = grounded ? clamp(speed / WALK_SPEED, 0, 1) : 0;
		const runWeight = running
			? clamp((speed - WALK_SPEED) / Math.max(SPRINT_SPEED - WALK_SPEED, 0.001), 0, 1)
			: 0;
		const sideSign = Math.sign(localSide);
		const backwardWeight = localForward < -0.2 ? clamp(-localForward / WALK_SPEED, 0, 1) : 0;
		const sideWeight = clamp(Math.abs(localSide) / WALK_SPEED, 0, 1);
		const breath = Math.sin(this.elapsedSeconds * 1.65);
		const armAmplitude = walkWeight * 0.56 + runWeight * 0.32;
		const legAmplitude = walkWeight * 0.56 + runWeight * 0.34;
		const cautious = lerp(1, 0.58, backwardWeight);
		const movementLook = clamp(localSide / SPRINT_SPEED, -0.12, 0.12);
		const totalLookYaw = clamp(
			angleDelta(this.visualYaw, cameraYaw) + movementLook,
			-MAX_HEAD_YAW,
			MAX_HEAD_YAW
		);

		pose.state = state;
		pose.gaitPhase = phase;
		pose.blink = this.blink;
		pose.neckYaw = totalLookYaw * 0.46;
		pose.headYaw = totalLookYaw * 0.54;
		pose.headPitch = clamp(-verticalSpeed * 0.015, -MAX_HEAD_PITCH, MAX_HEAD_PITCH);

		if (!this.moving && grounded && state !== 'landing') {
			pose.rootBob = breath * 0.006;
			pose.chestPitch = breath * 0.006;
			pose.leftShoulderPitch = 0.12 + breath * 0.008;
			pose.rightShoulderPitch = 0.12 - breath * 0.008;
			pose.leftKneePitch = 0.08;
			pose.rightKneePitch = 0.08;
		} else if (grounded) {
			pose.rootBob = Math.abs(Math.sin(phase * 2)) * (0.008 + speedRatio * 0.03) + breath * 0.003;
			pose.hipsYaw = stride * (0.03 + speedRatio * 0.04) + sideSign * sideWeight * 0.07;
			pose.hipsRoll = opposite * (0.016 + speedRatio * 0.024) + sideSign * sideWeight * 0.055;
			pose.chestPitch = -runWeight * 0.16 + backwardWeight * 0.09;
			pose.chestYaw = -pose.hipsYaw * 0.7;

			pose.leftShoulderPitch = -opposite * armAmplitude * cautious - runWeight * 0.2;
			pose.rightShoulderPitch = -stride * armAmplitude * cautious - runWeight * 0.2;
			pose.leftShoulderRoll = 0.14 - sideSign * sideWeight * 0.13;
			pose.rightShoulderRoll = -0.14 - sideSign * sideWeight * 0.13;
			pose.leftElbowPitch = -0.4 - walkWeight * 0.18 - runWeight * 0.38;
			pose.rightElbowPitch = -0.4 - walkWeight * 0.18 - runWeight * 0.38;

			pose.leftHipPitch = stride * legAmplitude * cautious - backwardWeight * 0.14;
			pose.rightHipPitch = opposite * legAmplitude * cautious - backwardWeight * 0.14;
			pose.leftHipRoll = sideSign * sideWeight * 0.2;
			pose.rightHipRoll = sideSign * sideWeight * 0.2;
			pose.leftKneePitch = Math.max(
				0.08,
				liftLeft * (0.44 + runWeight * 0.36) + backwardWeight * 0.18
			);
			pose.rightKneePitch = Math.max(
				0.08,
				liftRight * (0.44 + runWeight * 0.36) + backwardWeight * 0.18
			);
			pose.leftAnklePitch = -pose.leftHipPitch * 0.27 - liftLeft * 0.11;
			pose.rightAnklePitch = -pose.rightHipPitch * 0.27 - liftRight * 0.11;
			pose.leftFootLift = liftLeft * (0.012 + runWeight * 0.022);
			pose.rightFootLift = liftRight * (0.012 + runWeight * 0.022);

			if (sideWeight > 0.3 && !running) {
				pose.leftHipPitch *= 0.45;
				pose.rightHipPitch *= 0.45;
				pose.leftKneePitch += sideWeight * (sideSign < 0 ? 0.24 : 0.1);
				pose.rightKneePitch += sideWeight * (sideSign > 0 ? 0.24 : 0.1);
				pose.leftShoulderPitch -= sideSign * 0.16;
				pose.rightShoulderPitch -= sideSign * 0.16;
			}
		}

		if (!grounded) {
			this.writeAirbornePose(pose, state, verticalSpeed);
		} else if (state === 'landing') {
			this.applyLandingPose(pose);
		}

		this.applyStepPose(pose);
		clampPose(pose);
	}

	private writeAirbornePose(
		pose: HumanoidPose,
		state: HumanoidLocomotionState,
		verticalSpeed: number
	): void {
		const rising = state === 'jump_start';
		const fallWeight = clamp(-verticalSpeed / 8, 0, 1);

		pose.rootBob = rising ? -0.018 : -0.035;
		pose.chestPitch = rising ? -0.04 : 0.07 + fallWeight * 0.04;
		pose.hipsYaw *= 0.35;
		pose.hipsRoll *= 0.35;
		pose.leftHipPitch = rising ? 0.22 : 0.16;
		pose.rightHipPitch = rising ? -0.16 : -0.1;
		pose.leftKneePitch = rising ? 0.44 : 0.38 + fallWeight * 0.08;
		pose.rightKneePitch = rising ? 0.34 : 0.32 + fallWeight * 0.08;
		pose.leftAnklePitch = -0.08;
		pose.rightAnklePitch = -0.08;
		pose.leftFootLift = 0;
		pose.rightFootLift = 0;
		pose.leftShoulderPitch = rising ? -0.42 : -0.28;
		pose.rightShoulderPitch = rising ? -0.28 : -0.2;
		pose.leftShoulderRoll = 0.18;
		pose.rightShoulderRoll = -0.18;
		pose.leftElbowPitch = -0.7;
		pose.rightElbowPitch = -0.7;
	}

	private applyLandingPose(pose: HumanoidPose): void {
		const duration = Math.max(LANDING_MAX_SECONDS * this.landingStrength, 0.001);
		const land = clamp(this.landingTimer / duration, 0, 1);

		pose.rootBob -= land * 0.075;
		pose.leftKneePitch += land * 0.42;
		pose.rightKneePitch += land * 0.42;
		pose.leftHipPitch -= land * 0.08;
		pose.rightHipPitch -= land * 0.08;
		pose.chestPitch += land * 0.12;
		pose.leftShoulderPitch += land * 0.08;
		pose.rightShoulderPitch += land * 0.08;
	}

	private applyStepPose(pose: HumanoidPose): void {
		if (this.stepTimer <= 0 || !this.stepLeadingFoot) {
			return;
		}

		const progress = 1 - this.stepTimer / STEP_POSE_SECONDS;
		const influence = Math.sin(clamp(progress, 0, 1) * Math.PI);
		const height = this.stepHeight;
		const footLift = influence * height * 0.1;
		const kneeLift = influence * height * 0.42;
		const hipLift = influence * height * 0.16;

		if (this.stepLeadingFoot === 'left') {
			pose.leftFootLift += footLift;
			pose.leftKneePitch += kneeLift;
			pose.leftHipPitch += hipLift;
			pose.hipsRoll -= influence * 0.035;
		} else {
			pose.rightFootLift += footLift;
			pose.rightKneePitch += kneeLift;
			pose.rightHipPitch += hipLift;
			pose.hipsRoll += influence * 0.035;
		}
	}

	private blendPose(delta: number, state: HumanoidLocomotionState): void {
		const response =
			state === 'landing' ? 24 : state === 'jump_start' || state === 'airborne' ? 18 : 16;
		const amount = 1 - Math.exp(-response * delta);
		const source = this.targetPose;
		const target = this.pose;

		target.state = source.state;
		target.gaitPhase = source.gaitPhase;
		target.rootBob = lerp(target.rootBob, source.rootBob, amount);
		target.hipsYaw = lerp(target.hipsYaw, source.hipsYaw, amount);
		target.hipsRoll = lerp(target.hipsRoll, source.hipsRoll, amount);
		target.chestPitch = lerp(target.chestPitch, source.chestPitch, amount);
		target.chestYaw = lerp(target.chestYaw, source.chestYaw, amount);
		target.neckYaw = lerp(target.neckYaw, source.neckYaw, amount);
		target.headPitch = lerp(target.headPitch, source.headPitch, amount);
		target.headYaw = lerp(target.headYaw, source.headYaw, amount);
		target.leftShoulderPitch = lerp(target.leftShoulderPitch, source.leftShoulderPitch, amount);
		target.rightShoulderPitch = lerp(target.rightShoulderPitch, source.rightShoulderPitch, amount);
		target.leftShoulderRoll = lerp(target.leftShoulderRoll, source.leftShoulderRoll, amount);
		target.rightShoulderRoll = lerp(target.rightShoulderRoll, source.rightShoulderRoll, amount);
		target.leftElbowPitch = lerp(target.leftElbowPitch, source.leftElbowPitch, amount);
		target.rightElbowPitch = lerp(target.rightElbowPitch, source.rightElbowPitch, amount);
		target.leftHipPitch = lerp(target.leftHipPitch, source.leftHipPitch, amount);
		target.rightHipPitch = lerp(target.rightHipPitch, source.rightHipPitch, amount);
		target.leftHipRoll = lerp(target.leftHipRoll, source.leftHipRoll, amount);
		target.rightHipRoll = lerp(target.rightHipRoll, source.rightHipRoll, amount);
		target.leftKneePitch = lerp(target.leftKneePitch, source.leftKneePitch, amount);
		target.rightKneePitch = lerp(target.rightKneePitch, source.rightKneePitch, amount);
		target.leftAnklePitch = lerp(target.leftAnklePitch, source.leftAnklePitch, amount);
		target.rightAnklePitch = lerp(target.rightAnklePitch, source.rightAnklePitch, amount);
		target.leftFootLift = lerp(target.leftFootLift, source.leftFootLift, amount);
		target.rightFootLift = lerp(target.rightFootLift, source.rightFootLift, amount);
		target.blink = source.blink;
	}

	private writeSnapshot(
		state: HumanoidLocomotionState,
		speed: number,
		grounded: boolean,
		cameraYaw: number,
		desiredMovementYaw: number,
		localForward: number,
		localSide: number,
		verticalSpeed: number,
		mouseLookActive: boolean,
		cameraRecentering: boolean
	): void {
		const snapshot = this.snapshot;
		const stepActive = this.stepTimer > 0 && this.stepLeadingFoot !== null;

		snapshot.locomotionState = state;
		snapshot.speed = speed;
		snapshot.gaitPhase = this.gaitPhase;
		snapshot.armLeftAngle = this.pose.leftShoulderPitch;
		snapshot.armRightAngle = this.pose.rightShoulderPitch;
		snapshot.legLeftAngle = this.pose.leftHipPitch;
		snapshot.legRightAngle = this.pose.rightHipPitch;
		snapshot.grounded = grounded;
		snapshot.headYaw = clamp(this.pose.headYaw + this.pose.neckYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
		snapshot.bodyYaw = this.visualYaw;
		snapshot.cameraYaw = cameraYaw;
		snapshot.desiredMovementYaw = desiredMovementYaw;
		snapshot.localForwardSpeed = localForward;
		snapshot.localSideSpeed = localSide;
		snapshot.verticalSpeed = verticalSpeed;
		snapshot.stepActive = stepActive;
		snapshot.stepHeight = stepActive ? this.stepHeight : 0;
		snapshot.leadingFoot = stepActive ? this.stepLeadingFoot : null;
		snapshot.stepStartedAt = stepActive ? this.stepStartedAt : -1;
		snapshot.mouseLookActive = mouseLookActive;
		snapshot.cameraRecentering = cameraRecentering;
		snapshot.updateMs = this.updateMs;
	}
}

function createInitialSnapshot(): HumanoidAnimationSnapshot {
	return {
		locomotionState: 'idle',
		speed: 0,
		gaitPhase: 0,
		armLeftAngle: 0.12,
		armRightAngle: 0.12,
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
		updateMs: 0
	};
}

function resetSnapshot(snapshot: HumanoidAnimationSnapshot, bodyYaw: number): void {
	snapshot.locomotionState = 'idle';
	snapshot.speed = 0;
	snapshot.gaitPhase = 0;
	snapshot.armLeftAngle = 0.12;
	snapshot.armRightAngle = 0.12;
	snapshot.legLeftAngle = 0;
	snapshot.legRightAngle = 0;
	snapshot.grounded = true;
	snapshot.headYaw = 0;
	snapshot.bodyYaw = bodyYaw;
	snapshot.cameraYaw = bodyYaw;
	snapshot.desiredMovementYaw = bodyYaw;
	snapshot.localForwardSpeed = 0;
	snapshot.localSideSpeed = 0;
	snapshot.verticalSpeed = 0;
	snapshot.stepActive = false;
	snapshot.stepHeight = 0;
	snapshot.leadingFoot = null;
	snapshot.stepStartedAt = -1;
	snapshot.mouseLookActive = false;
	snapshot.cameraRecentering = false;
	snapshot.updateMs = 0;
}

function clampPose(pose: HumanoidPose): void {
	pose.rootBob = clamp(pose.rootBob, -0.12, 0.12);
	pose.hipsYaw = clamp(pose.hipsYaw, -0.35, 0.35);
	pose.hipsRoll = clamp(pose.hipsRoll, -0.28, 0.28);
	pose.chestPitch = clamp(pose.chestPitch, -0.3, 0.3);
	pose.chestYaw = clamp(pose.chestYaw, -0.28, 0.28);
	pose.neckYaw = clamp(pose.neckYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
	pose.headYaw = clamp(pose.headYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
	pose.headPitch = clamp(pose.headPitch, -MAX_HEAD_PITCH, MAX_HEAD_PITCH);
	pose.leftShoulderPitch = clamp(pose.leftShoulderPitch, -1.15, 1.15);
	pose.rightShoulderPitch = clamp(pose.rightShoulderPitch, -1.15, 1.15);
	pose.leftShoulderRoll = clamp(pose.leftShoulderRoll, -0.5, 0.5);
	pose.rightShoulderRoll = clamp(pose.rightShoulderRoll, -0.5, 0.5);
	pose.leftElbowPitch = clamp(pose.leftElbowPitch, -1.2, 0);
	pose.rightElbowPitch = clamp(pose.rightElbowPitch, -1.2, 0);
	pose.leftHipPitch = clamp(pose.leftHipPitch, -1.05, 1.05);
	pose.rightHipPitch = clamp(pose.rightHipPitch, -1.05, 1.05);
	pose.leftHipRoll = clamp(pose.leftHipRoll, -0.4, 0.4);
	pose.rightHipRoll = clamp(pose.rightHipRoll, -0.4, 0.4);
	pose.leftKneePitch = clamp(pose.leftKneePitch, 0, 1.25);
	pose.rightKneePitch = clamp(pose.rightKneePitch, 0, 1.25);
	pose.leftAnklePitch = clamp(pose.leftAnklePitch, -0.5, 0.5);
	pose.rightAnklePitch = clamp(pose.rightAnklePitch, -0.5, 0.5);
	pose.leftFootLift = clamp(pose.leftFootLift, 0, 0.16);
	pose.rightFootLift = clamp(pose.rightFootLift, 0, 0.16);
	pose.blink = clamp(pose.blink, 0, 1);
}

function localForwardSpeed(yaw: number, velocityX: number, velocityZ: number): number {
	return Math.sin(yaw) * velocityX + Math.cos(yaw) * velocityZ;
}

function localSideSpeed(yaw: number, velocityX: number, velocityZ: number): number {
	return -Math.cos(yaw) * velocityX + Math.sin(yaw) * velocityZ;
}

function resolveYaw(
	primary: number | undefined,
	fallback: number | undefined,
	defaultYaw: number
): number {
	if (Number.isFinite(primary)) {
		return normalizeAngle(primary as number);
	}

	if (Number.isFinite(fallback)) {
		return normalizeAngle(fallback as number);
	}

	return normalizeAngle(defaultYaw);
}

function safeDelta(value: number): number {
	return clamp(finiteOr(value, 0), 0, MAX_DELTA_SECONDS);
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * amount;
}

function normalizeAngle(value: number): number {
	return Math.atan2(Math.sin(value), Math.cos(value));
}

function nowMilliseconds(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
