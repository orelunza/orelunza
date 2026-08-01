export type HumanoidLocomotionState =
	| 'idle'
	| 'walk_forward'
	| 'walk_backward'
	| 'strafe_left'
	| 'strafe_right'
	| 'run'
	| 'jump_start'
	| 'airborne'
	| 'landing'
	| 'turn_left'
	| 'turn_right';

export interface HumanoidAnimationInput {
	yaw: number;
	velocityX: number;
	velocityY: number;
	velocityZ: number;
	grounded: boolean;
	deltaSeconds: number;
}

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
	updateMs: number;
}

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
	blink: number;
}

export function createNeutralPose(): HumanoidPose {
	return {
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
}
