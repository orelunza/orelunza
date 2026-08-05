/**
 * Procedural-animation data contract for the Orelunza citizen — rewritten.
 *
 * A pose is a flat bag of scalar joint angles (radians) plus a few world-unit
 * offsets. It contains no Three.js objects so it can be produced by
 * HumanoidAnimator, consumed by HumanoidRig, and inspected by diagnostics or
 * network code without pulling in the renderer.
 */

export type HumanoidLeadingFoot = 'left' | 'right';

/**
 * Locomotion states. `walk_forward`, `jump_start`, `airborne`, `landing` are the
 * procedural names produced by the animator. `walk`, `jump`, `fall`, `land`,
 * `turn_*` and `reaction_shoved` are clip-compatible aliases kept so the
 * animation controller and its tests stay type-safe.
 */
export type HumanoidLocomotionState =
	| 'idle'
	| 'walk_forward'
	| 'walk'
	| 'walk_backward'
	| 'strafe_left'
	| 'strafe_right'
	| 'run'
	| 'jump_start'
	| 'jump'
	| 'airborne'
	| 'fall'
	| 'landing'
	| 'land'
	| 'turn_left'
	| 'turn_right'
	| 'reaction_shoved';

/** Terrain step-up signal emitted by PlayerPhysics, consumed by the animator. */
export interface HumanoidStepEvent {
	leadingFoot: HumanoidLeadingFoot;
	height: number;
	startedAt: number;
}

/** Read-only per-frame input to HumanoidAnimator. */
export interface HumanoidAnimationInput {
	/** Legacy single-yaw input used by previews and tests. */
	yaw?: number;
	/** World-space camera yaw, used to drive the head/neck look. */
	cameraYaw?: number;
	/** Current body yaw (read-only reference; never written back). */
	bodyYaw?: number;
	/** Desired world-space movement direction. */
	desiredMovementYaw?: number;

	velocityX: number;
	velocityY: number;
	velocityZ: number;
	grounded: boolean;
	deltaSeconds: number;

	stepEvent?: Readonly<HumanoidStepEvent> | null;
	mouseLookActive?: boolean;
	cameraRecentering?: boolean;
}

/** Complete local-space pose applied directly to the rig joints. */
export interface HumanoidPose {
	state: HumanoidLocomotionState;
	gaitPhase: number;

	rootBob: number;
	hipsYaw: number;
	hipsRoll: number;
	chestPitch: number;
	chestYaw: number;
	neckYaw: number;
	headPitch: number;
	headYaw: number;

	leftShoulderPitch: number;
	rightShoulderPitch: number;
	leftShoulderRoll: number;
	rightShoulderRoll: number;
	leftElbowPitch: number;
	rightElbowPitch: number;

	leftHipPitch: number;
	rightHipPitch: number;
	leftHipRoll: number;
	rightHipRoll: number;
	leftKneePitch: number;
	rightKneePitch: number;
	leftAnklePitch: number;
	rightAnklePitch: number;
	leftFootLift: number;
	rightFootLift: number;

	/** Blink amount, 0..1. */
	blink: number;
}

/** Diagnostics shared with PlayerAvatar, the animation controller and tooling. */
export interface HumanoidAnimationSnapshot {
	locomotionState: HumanoidLocomotionState;
	speed: number;
	gaitPhase: number;
	armLeftAngle: number;
	armRightAngle: number;
	legLeftAngle: number;
	legRightAngle: number;
	grounded: boolean;
	headYaw: number;
	bodyYaw: number;
	cameraYaw: number;
	desiredMovementYaw: number;
	localForwardSpeed: number;
	localSideSpeed: number;
	verticalSpeed: number;
	stepActive: boolean;
	stepHeight: number;
	leadingFoot: HumanoidLeadingFoot | null;
	stepStartedAt: number;
	mouseLookActive: boolean;
	cameraRecentering: boolean;
	updateMs: number;
}

/**
 * Relaxed neutral stance: arms hang slightly out from the torso, elbows relaxed,
 * knees unlocked. Matches the rig's default proportions.
 */
const NEUTRAL: Readonly<HumanoidPose> = Object.freeze({
	state: 'idle',
	gaitPhase: 0,
	rootBob: 0,
	hipsYaw: 0,
	hipsRoll: 0,
	chestPitch: 0,
	chestYaw: 0,
	neckYaw: 0,
	headPitch: 0,
	headYaw: 0,
	leftShoulderPitch: 0.08,
	rightShoulderPitch: 0.08,
	leftShoulderRoll: 0.09,
	rightShoulderRoll: -0.09,
	leftElbowPitch: -0.3,
	rightElbowPitch: -0.3,
	leftHipPitch: 0,
	rightHipPitch: 0,
	leftHipRoll: 0,
	rightHipRoll: 0,
	leftKneePitch: 0.06,
	rightKneePitch: 0.06,
	leftAnklePitch: 0,
	rightAnklePitch: 0,
	leftFootLift: 0,
	rightFootLift: 0,
	blink: 0
});

export function createNeutralPose(): HumanoidPose {
	return { ...NEUTRAL };
}

/** Copy a pose into an existing object without allocating. */
export function copyHumanoidPose(
	target: HumanoidPose,
	source: Readonly<HumanoidPose>
): HumanoidPose {
	target.state = source.state;
	target.gaitPhase = source.gaitPhase;
	target.rootBob = source.rootBob;
	target.hipsYaw = source.hipsYaw;
	target.hipsRoll = source.hipsRoll;
	target.chestPitch = source.chestPitch;
	target.chestYaw = source.chestYaw;
	target.neckYaw = source.neckYaw;
	target.headPitch = source.headPitch;
	target.headYaw = source.headYaw;
	target.leftShoulderPitch = source.leftShoulderPitch;
	target.rightShoulderPitch = source.rightShoulderPitch;
	target.leftShoulderRoll = source.leftShoulderRoll;
	target.rightShoulderRoll = source.rightShoulderRoll;
	target.leftElbowPitch = source.leftElbowPitch;
	target.rightElbowPitch = source.rightElbowPitch;
	target.leftHipPitch = source.leftHipPitch;
	target.rightHipPitch = source.rightHipPitch;
	target.leftHipRoll = source.leftHipRoll;
	target.rightHipRoll = source.rightHipRoll;
	target.leftKneePitch = source.leftKneePitch;
	target.rightKneePitch = source.rightKneePitch;
	target.leftAnklePitch = source.leftAnklePitch;
	target.rightAnklePitch = source.rightAnklePitch;
	target.leftFootLift = source.leftFootLift;
	target.rightFootLift = source.rightFootLift;
	target.blink = source.blink;
	return target;
}

/** Restore a pose object to the neutral stance. */
export function resetHumanoidPose(target: HumanoidPose): HumanoidPose {
	return copyHumanoidPose(target, NEUTRAL);
}
