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

/**
 * Orelunza procedural locomotion — rewritten from scratch.
 *
 * The animator is a pure pose producer. It receives a read-only snapshot of the
 * player each frame and returns a reusable HumanoidPose. It never touches
 * PlayerState and never writes bodyYaw / yaw / desiredMovementYaw.
 *
 * Body orientation is read from the authoritative PlayerController snapshot.
 * The animator never invents, smooths or redirects a second body yaw. Two
 * reusable pose objects (a target and the smoothed output) avoid per-frame
 * allocations.
 */

const MAX_DELTA = 0.05;
const MAX_HEAD_YAW = 0.78;
const MAX_HEAD_PITCH = 0.35;
const TWO_PI = Math.PI * 2;

// Idle hysteresis so the tiniest residual velocity does not flicker into a walk.
const IDLE_ENTER_SPEED = 0.05;
const IDLE_EXIT_SPEED = 0.12;

const LANDING_SECONDS = 0.26;
const STEP_SECONDS = 0.34;

export class HumanoidAnimator {
	readonly pose: HumanoidPose = createNeutralPose();

	private readonly target: HumanoidPose = createNeutralPose();
	private readonly snapshot: HumanoidAnimationSnapshot = createSnapshot();

	private bodyYawValue = Math.PI;
	private gaitPhase = 0;
	private clock = 0;
	private blink = 0;
	private blinkCountdown = 2;
	private moving = false;
	private landingTimer = 0;
	private landingPower = 0;
	private wasGrounded = true;
	private lastVerticalSpeed = 0;
	private initialized = false;
	private updateMs = 0;

	private stepTimer = 0;
	private stepHeight = 0;
	private stepFoot: HumanoidLeadingFoot | null = null;
	private stepId = -1;

	update(input: HumanoidAnimationInput): HumanoidPose {
		const startedAt = now();
		const delta = clamp(finite(input.deltaSeconds, 0), 0, MAX_DELTA);
		const vx = finite(input.velocityX, 0);
		const vy = finite(input.velocityY, 0);
		const vz = finite(input.velocityZ, 0);
		const grounded = Boolean(input.grounded);
		const speed = Math.hypot(vx, vz);

		this.initialize(input);

		const bodyYaw = resolveYaw(input.bodyYaw, input.yaw, this.bodyYawValue);
		const cameraYaw = resolveYaw(input.cameraYaw, input.yaw, bodyYaw);
		const desiredYaw = resolveYaw(input.desiredMovementYaw, input.yaw, bodyYaw);
		this.bodyYawValue = bodyYaw;

		// Idle hysteresis.
		this.moving = this.moving ? speed > IDLE_ENTER_SPEED : speed > IDLE_EXIT_SPEED;

		// Locomotion is classified relative to the real body orientation owned by
		// PlayerController. This preserves true backward walking and strafing.
		const localFwd = localForward(bodyYaw, vx, vz);
		const localSd = localSide(bodyYaw, vx, vz);
		const running = speed > (WALK_SPEED + SPRINT_SPEED) * 0.5;
		const movementYaw = this.moving && speed > Number.EPSILON ? Math.atan2(vx, vz) : desiredYaw;

		this.updateLanding(grounded, vy);
		this.updateStep(input.stepEvent ?? null, grounded, delta);
		this.advanceTimers(speed, running, grounded, delta);

		const state = this.resolveState(localFwd, localSd, running, grounded, vy);

		this.writeTarget(state, speed, localFwd, localSd, running, grounded, vy);
		this.smooth(delta, state);

		this.updateMs = now() - startedAt;
		this.writeSnapshot(
			state,
			speed,
			grounded,
			cameraYaw,
			movementYaw,
			localFwd,
			localSd,
			vy,
			input
		);

		return this.pose;
	}

	get bodyYaw(): number {
		return this.bodyYawValue;
	}

	get lastUpdateMs(): number {
		return this.updateMs;
	}

	get diagnostics(): HumanoidAnimationSnapshot {
		return this.snapshot;
	}

	reset(bodyYaw = Math.PI): void {
		this.bodyYawValue = normalize(finite(bodyYaw, Math.PI));
		this.gaitPhase = 0;
		this.clock = 0;
		this.blink = 0;
		this.blinkCountdown = 2;
		this.moving = false;
		this.landingTimer = 0;
		this.landingPower = 0;
		this.wasGrounded = true;
		this.lastVerticalSpeed = 0;
		this.initialized = true;
		this.updateMs = 0;
		this.stepTimer = 0;
		this.stepHeight = 0;
		this.stepFoot = null;
		this.stepId = -1;

		resetHumanoidPose(this.pose);
		resetHumanoidPose(this.target);
		resetSnapshot(this.snapshot, this.bodyYawValue);
	}

	private initialize(input: HumanoidAnimationInput): void {
		if (this.initialized) {
			return;
		}

		if (Number.isFinite(input.bodyYaw)) {
			this.bodyYawValue = normalize(input.bodyYaw as number);
		} else if (Number.isFinite(input.yaw)) {
			this.bodyYawValue = normalize(input.yaw as number);
		}

		this.wasGrounded = Boolean(input.grounded);
		this.lastVerticalSpeed = finite(input.velocityY, 0);
		this.initialized = true;
	}

	private updateLanding(grounded: boolean, verticalSpeed: number): void {
		if (grounded && !this.wasGrounded) {
			this.landingPower = clamp(Math.abs(this.lastVerticalSpeed) / 12, 0.35, 1);
			this.landingTimer = LANDING_SECONDS * this.landingPower;
		}

		this.wasGrounded = grounded;
		this.lastVerticalSpeed = verticalSpeed;
	}

	private updateStep(
		event: Readonly<HumanoidStepEvent> | null,
		grounded: boolean,
		delta: number
	): void {
		if (grounded && event && Number.isFinite(event.startedAt) && event.startedAt !== this.stepId) {
			this.stepId = event.startedAt;
			this.stepFoot = event.leadingFoot;
			this.stepHeight = clamp(finite(event.height, 0), 0, 1);
			this.stepTimer = STEP_SECONDS;
		}

		if (!grounded) {
			this.stepTimer = 0;
			this.stepHeight = 0;
			this.stepFoot = null;
			return;
		}

		this.stepTimer = Math.max(0, this.stepTimer - delta);

		if (this.stepTimer === 0) {
			this.stepHeight = 0;
			this.stepFoot = null;
		}
	}

	private advanceTimers(speed: number, running: boolean, grounded: boolean, delta: number): void {
		this.clock += delta;

		if (this.moving && grounded) {
			const cadence = running ? 12.5 : 8.2;
			const scale = clamp(speed / WALK_SPEED, 0.25, 1.45);
			this.gaitPhase += cadence * delta * scale;

			if (this.gaitPhase > 1_000_000) {
				this.gaitPhase %= TWO_PI;
			}
		}

		this.blinkCountdown -= delta;

		if (this.blinkCountdown <= 0) {
			this.blink = 1;
			this.blinkCountdown = 2.6 + (Math.sin(this.clock * 1.7) + 1) * 1.2;
		}

		this.blink = Math.max(0, this.blink - delta * 12);
		this.landingTimer = Math.max(0, this.landingTimer - delta);
	}

	private resolveState(
		localFwd: number,
		localSd: number,
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

		if (Math.abs(localSd) > Math.abs(localFwd) * 1.15) {
			return localSd > 0 ? 'strafe_right' : 'strafe_left';
		}

		if (localFwd < -0.2) {
			return 'walk_backward';
		}

		return 'walk_forward';
	}

	private writeTarget(
		state: HumanoidLocomotionState,
		speed: number,
		localFwd: number,
		localSd: number,
		running: boolean,
		grounded: boolean,
		verticalSpeed: number
	): void {
		const pose = resetHumanoidPose(this.target);
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
		const sideSign = Math.sign(localSd);
		const backWeight = localFwd < -0.2 ? clamp(-localFwd / WALK_SPEED, 0, 1) : 0;
		const sideWeight = clamp(Math.abs(localSd) / WALK_SPEED, 0, 1);
		const breath = Math.sin(this.clock * 1.65);
		const armAmp = walkWeight * 0.56 + runWeight * 0.32;
		const legAmp = walkWeight * 0.56 + runWeight * 0.34;
		const cautious = lerp(1, 0.58, backWeight);

		pose.state = state;
		pose.gaitPhase = phase;
		pose.blink = this.blink;

		// Camera orbit must not twist the citizen's head. Explicit world-look
		// targets are layered later by PlayerAvatar.applyLookOverlay().
		pose.neckYaw = 0;
		pose.headYaw = 0;
		pose.headPitch = clamp(-verticalSpeed * 0.015, -MAX_HEAD_PITCH, MAX_HEAD_PITCH);

		if (!this.moving && grounded && state !== 'landing') {
			// Idle: an almost imperceptible breath, no gait motion at all.
			pose.rootBob = breath * 0.006;
			pose.chestPitch = breath * 0.006;
			pose.leftShoulderPitch = 0.08 + breath * 0.008;
			pose.rightShoulderPitch = 0.08 - breath * 0.008;
			pose.leftKneePitch = 0.06;
			pose.rightKneePitch = 0.06;
		} else if (grounded) {
			pose.rootBob = Math.abs(Math.sin(phase * 2)) * (0.008 + speedRatio * 0.03) + breath * 0.003;
			pose.hipsYaw = stride * (0.03 + speedRatio * 0.04) + sideSign * sideWeight * 0.07;
			pose.hipsRoll = opposite * (0.016 + speedRatio * 0.024) + sideSign * sideWeight * 0.055;
			pose.chestPitch = -runWeight * 0.16 + backWeight * 0.09;
			pose.chestYaw = -pose.hipsYaw * 0.7;

			// Opposite arms/legs, arms kept out from the torso via shoulder roll.
			pose.leftShoulderPitch = -opposite * armAmp * cautious - runWeight * 0.2;
			pose.rightShoulderPitch = -stride * armAmp * cautious - runWeight * 0.2;
			pose.leftShoulderRoll = 0.12 - sideSign * sideWeight * 0.13;
			pose.rightShoulderRoll = -0.12 - sideSign * sideWeight * 0.13;
			pose.leftElbowPitch = -0.34 - walkWeight * 0.18 - runWeight * 0.38;
			pose.rightElbowPitch = -0.34 - walkWeight * 0.18 - runWeight * 0.38;

			pose.leftHipPitch = stride * legAmp * cautious - backWeight * 0.14;
			pose.rightHipPitch = opposite * legAmp * cautious - backWeight * 0.14;
			pose.leftHipRoll = sideSign * sideWeight * 0.2;
			pose.rightHipRoll = sideSign * sideWeight * 0.2;
			pose.leftKneePitch = Math.max(0.06, liftLeft * (0.44 + runWeight * 0.36) + backWeight * 0.18);
			pose.rightKneePitch = Math.max(
				0.06,
				liftRight * (0.44 + runWeight * 0.36) + backWeight * 0.18
			);
			pose.leftAnklePitch = -pose.leftHipPitch * 0.27 - liftLeft * 0.11;
			pose.rightAnklePitch = -pose.rightHipPitch * 0.27 - liftRight * 0.11;
			pose.leftFootLift = liftLeft * (0.012 + runWeight * 0.022);
			pose.rightFootLift = liftRight * (0.012 + runWeight * 0.022);

			if (sideWeight > 0.3 && !running) {
				// Cross-step feel for a lateral strafe, not a rotated forward walk.
				pose.leftHipPitch *= 0.45;
				pose.rightHipPitch *= 0.45;
				pose.leftKneePitch += sideWeight * (sideSign < 0 ? 0.24 : 0.1);
				pose.rightKneePitch += sideWeight * (sideSign > 0 ? 0.24 : 0.1);
				pose.leftShoulderPitch -= sideSign * 0.16;
				pose.rightShoulderPitch -= sideSign * 0.16;
			}
		}

		if (!grounded) {
			this.writeAirborne(pose, state, verticalSpeed);
		} else if (state === 'landing') {
			this.applyLanding(pose);
		}

		this.applyStep(pose);
		clampPose(pose);
	}

	private writeAirborne(
		pose: HumanoidPose,
		state: HumanoidLocomotionState,
		verticalSpeed: number
	): void {
		const rising = state === 'jump_start';
		const fall = clamp(-verticalSpeed / 8, 0, 1);

		// Preparation/impulse on the way up, a stable spread pose while falling.
		pose.rootBob = rising ? -0.018 : -0.035;
		pose.chestPitch = rising ? -0.04 : 0.07 + fall * 0.04;
		pose.hipsYaw *= 0.35;
		pose.hipsRoll *= 0.35;
		pose.leftHipPitch = rising ? 0.22 : 0.16;
		pose.rightHipPitch = rising ? -0.16 : -0.1;
		pose.leftKneePitch = rising ? 0.44 : 0.38 + fall * 0.08;
		pose.rightKneePitch = rising ? 0.34 : 0.32 + fall * 0.08;
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

	private applyLanding(pose: HumanoidPose): void {
		const duration = Math.max(LANDING_SECONDS * this.landingPower, 0.001);
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

	private applyStep(pose: HumanoidPose): void {
		if (this.stepTimer <= 0 || !this.stepFoot) {
			return;
		}

		const progress = 1 - this.stepTimer / STEP_SECONDS;
		const influence = Math.sin(clamp(progress, 0, 1) * Math.PI);
		const foot = influence * this.stepHeight * 0.1;
		const knee = influence * this.stepHeight * 0.42;
		const hip = influence * this.stepHeight * 0.16;

		if (this.stepFoot === 'left') {
			pose.leftFootLift += foot;
			pose.leftKneePitch += knee;
			pose.leftHipPitch += hip;
			pose.hipsRoll -= influence * 0.035;
		} else {
			pose.rightFootLift += foot;
			pose.rightKneePitch += knee;
			pose.rightHipPitch += hip;
			pose.hipsRoll += influence * 0.035;
		}
	}

	private smooth(delta: number, state: HumanoidLocomotionState): void {
		const response =
			state === 'landing' ? 24 : state === 'jump_start' || state === 'airborne' ? 18 : 16;
		const amount = 1 - Math.exp(-response * delta);
		const s = this.target;
		const p = this.pose;

		p.state = s.state;
		p.gaitPhase = s.gaitPhase;
		p.rootBob = lerp(p.rootBob, s.rootBob, amount);
		p.hipsYaw = lerp(p.hipsYaw, s.hipsYaw, amount);
		p.hipsRoll = lerp(p.hipsRoll, s.hipsRoll, amount);
		p.chestPitch = lerp(p.chestPitch, s.chestPitch, amount);
		p.chestYaw = lerp(p.chestYaw, s.chestYaw, amount);
		p.neckYaw = lerp(p.neckYaw, s.neckYaw, amount);
		p.headPitch = lerp(p.headPitch, s.headPitch, amount);
		p.headYaw = lerp(p.headYaw, s.headYaw, amount);
		p.leftShoulderPitch = lerp(p.leftShoulderPitch, s.leftShoulderPitch, amount);
		p.rightShoulderPitch = lerp(p.rightShoulderPitch, s.rightShoulderPitch, amount);
		p.leftShoulderRoll = lerp(p.leftShoulderRoll, s.leftShoulderRoll, amount);
		p.rightShoulderRoll = lerp(p.rightShoulderRoll, s.rightShoulderRoll, amount);
		p.leftElbowPitch = lerp(p.leftElbowPitch, s.leftElbowPitch, amount);
		p.rightElbowPitch = lerp(p.rightElbowPitch, s.rightElbowPitch, amount);
		p.leftHipPitch = lerp(p.leftHipPitch, s.leftHipPitch, amount);
		p.rightHipPitch = lerp(p.rightHipPitch, s.rightHipPitch, amount);
		p.leftHipRoll = lerp(p.leftHipRoll, s.leftHipRoll, amount);
		p.rightHipRoll = lerp(p.rightHipRoll, s.rightHipRoll, amount);
		p.leftKneePitch = lerp(p.leftKneePitch, s.leftKneePitch, amount);
		p.rightKneePitch = lerp(p.rightKneePitch, s.rightKneePitch, amount);
		p.leftAnklePitch = lerp(p.leftAnklePitch, s.leftAnklePitch, amount);
		p.rightAnklePitch = lerp(p.rightAnklePitch, s.rightAnklePitch, amount);
		p.leftFootLift = lerp(p.leftFootLift, s.leftFootLift, amount);
		p.rightFootLift = lerp(p.rightFootLift, s.rightFootLift, amount);
		p.blink = s.blink;
	}

	private writeSnapshot(
		state: HumanoidLocomotionState,
		speed: number,
		grounded: boolean,
		cameraYaw: number,
		movementYaw: number,
		localFwd: number,
		localSd: number,
		verticalSpeed: number,
		input: HumanoidAnimationInput
	): void {
		const s = this.snapshot;
		const stepActive = this.stepTimer > 0 && this.stepFoot !== null;

		s.locomotionState = state;
		s.speed = speed;
		s.gaitPhase = this.gaitPhase;
		s.armLeftAngle = this.pose.leftShoulderPitch;
		s.armRightAngle = this.pose.rightShoulderPitch;
		s.legLeftAngle = this.pose.leftHipPitch;
		s.legRightAngle = this.pose.rightHipPitch;
		s.grounded = grounded;
		s.headYaw = clamp(this.pose.headYaw + this.pose.neckYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
		s.bodyYaw = this.bodyYawValue;
		s.cameraYaw = cameraYaw;
		s.desiredMovementYaw = movementYaw;
		s.localForwardSpeed = localFwd;
		s.localSideSpeed = localSd;
		s.verticalSpeed = verticalSpeed;
		s.stepActive = stepActive;
		s.stepHeight = stepActive ? this.stepHeight : 0;
		s.leadingFoot = stepActive ? this.stepFoot : null;
		s.stepStartedAt = stepActive ? this.stepId : -1;
		s.mouseLookActive = Boolean(input.mouseLookActive);
		s.cameraRecentering = Boolean(input.cameraRecentering);
		s.updateMs = this.updateMs;
	}
}

function createSnapshot(): HumanoidAnimationSnapshot {
	return {
		locomotionState: 'idle',
		speed: 0,
		gaitPhase: 0,
		armLeftAngle: 0.08,
		armRightAngle: 0.08,
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
	Object.assign(snapshot, createSnapshot());
	snapshot.bodyYaw = bodyYaw;
	snapshot.cameraYaw = bodyYaw;
	snapshot.desiredMovementYaw = bodyYaw;
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

function localForward(yaw: number, vx: number, vz: number): number {
	return Math.sin(yaw) * vx + Math.cos(yaw) * vz;
}

function localSide(yaw: number, vx: number, vz: number): number {
	return -Math.cos(yaw) * vx + Math.sin(yaw) * vz;
}

function resolveYaw(
	primary: number | undefined,
	fallback: number | undefined,
	def: number
): number {
	if (Number.isFinite(primary)) {
		return normalize(primary as number);
	}

	if (Number.isFinite(fallback)) {
		return normalize(fallback as number);
	}

	return normalize(def);
}

function finite(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function normalize(value: number): number {
	return Math.atan2(Math.sin(value), Math.cos(value));
}

function now(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
