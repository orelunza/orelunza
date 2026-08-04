/**
 * Shared procedural-animation contract for the lightweight Orelunza citizen.
 *
 * This module intentionally contains no Three.js objects. A pose is only a
 * compact set of scalar values that can be produced by HumanoidAnimator,
 * consumed by HumanoidRig and inspected by diagnostics or network code.
 */

/** Foot used by a terrain step event. */
export type HumanoidLeadingFoot = 'left' | 'right';

/**
 * Locomotion states produced by the procedural animator or accepted by the
 * animation controller's compatibility API.
 *
 * `walk_forward`, `jump_start`, `airborne` and `landing` are procedural state
 * names. `walk`, `jump`, `fall` and `land` are clip-compatible aliases kept so
 * existing controller calls remain type-safe.
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

/** Small terrain-step signal emitted by PlayerPhysics. */
export interface HumanoidStepEvent {
	leadingFoot: HumanoidLeadingFoot;
	height: number;
	startedAt: number;
}

/** Input consumed once per frame by HumanoidAnimator. */
export interface HumanoidAnimationInput {
	/** Legacy single-yaw input used by previews and tests. */
	yaw?: number;

	/** World-space camera yaw used to drive the head and neck. */
	cameraYaw?: number;

	/** Current body yaw, retained for compatibility with PlayerAvatar. */
	bodyYaw?: number;

	/** Desired world-space movement direction. */
	desiredMovementYaw?: number;

	velocityX: number;
	velocityY: number;
	velocityZ: number;
	grounded: boolean;
	deltaSeconds: number;

	/** Null or absent when no terrain step is active. */
	stepEvent?: Readonly<HumanoidStepEvent> | null;

	/** Reserved diagnostic flags for the camera/animation integration. */
	mouseLookActive?: boolean;
	cameraRecentering?: boolean;
}

/**
 * Complete local-space pose applied directly to HumanoidRig joints.
 *
 * Rotations are expressed in radians. Foot lifts and root bob are expressed in
 * world units relative to the rig's neutral proportions.
 */
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

	/** Normalized blink amount in the inclusive range 0..1. */
	blink: number;
}

/** Lightweight diagnostics shared with PlayerAvatar and debug tooling. */
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
 * Create the relaxed neutral pose used before the first animation update.
 *
 * The values match the default stance expected by HumanoidRig: arms hang
 * slightly away from the torso, elbows remain relaxed and knees are not locked.
 */
const NEUTRAL_POSE_TEMPLATE: Readonly<HumanoidPose> = {
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
	leftShoulderPitch: 0.12,
	rightShoulderPitch: 0.12,
	leftShoulderRoll: 0.1,
	rightShoulderRoll: -0.1,
	leftElbowPitch: -0.38,
	rightElbowPitch: -0.38,
	leftHipPitch: 0,
	rightHipPitch: 0,
	leftHipRoll: 0,
	rightHipRoll: 0,
	leftKneePitch: 0.08,
	rightKneePitch: 0.08,
	leftAnklePitch: 0,
	rightAnklePitch: 0,
	leftFootLift: 0,
	rightFootLift: 0,
	blink: 0
};

export function createNeutralPose(): HumanoidPose {
	return { ...NEUTRAL_POSE_TEMPLATE };
}

/** Copy a pose into an existing object without allocating another pose. */
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

/** Restore an existing pose object to the relaxed neutral stance. */
export function resetHumanoidPose(target: HumanoidPose): HumanoidPose {
	return copyHumanoidPose(target, NEUTRAL_POSE_TEMPLATE);
}
