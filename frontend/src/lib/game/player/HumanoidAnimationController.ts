import {
	AnimationClip,
	AnimationMixer,
	BooleanKeyframeTrack,
	LoopRepeat,
	LoopOnce,
	MathUtils,
	NumberKeyframeTrack,
	Quaternion,
	Vector3,
	type AnimationAction,
	type Object3D
} from 'three';
import type { HumanoidAnimationSnapshot, HumanoidLocomotionState } from './HumanoidPose';
import type { LeadingFoot } from './PlayerState';

export const REQUIRED_HUMANOID_CLIPS = [
	'idle',
	'walk',
	'run',
	'strafe_left',
	'strafe_right',
	'walk_backward',
	'jump',
	'fall',
	'land'
] as const;

export const OPTIONAL_HUMANOID_CLIPS = ['reaction_shoved'] as const;

export const HUMANOID_ANIMATION_STATES = [
	...REQUIRED_HUMANOID_CLIPS,
	...OPTIONAL_HUMANOID_CLIPS,
	'turn_left',
	'turn_right'
] as const;

export type RequiredHumanoidClip = (typeof REQUIRED_HUMANOID_CLIPS)[number];
export type HumanoidAnimationState = (typeof HUMANOID_ANIMATION_STATES)[number];

export interface HumanoidAnimationBlendSnapshot {
	activeState: HumanoidAnimationState;
	currentAction: string;
	previousAction: string | null;
	weights: Record<string, number>;
	clipCount: number;
	mixerTime: number;
	transitionCount: number;
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
	leadingFoot: LeadingFoot | null;
	mouseLookActive: boolean;
	cameraRecentering: boolean;
}

export interface HumanoidAnimationControllerOptions {
	strict?: boolean;
	fadeSeconds?: number;
}

interface HumanoidBoneSet {
	hips: Object3D | null;
	chest: Object3D | null;
	neck: Object3D | null;
	head: Object3D | null;
	leftClavicle: Object3D | null;
	leftUpperArm: Object3D | null;
	leftLowerArm: Object3D | null;
	leftHand: Object3D | null;
	rightClavicle: Object3D | null;
	rightUpperArm: Object3D | null;
	rightLowerArm: Object3D | null;
	rightHand: Object3D | null;
	leftUpperLeg: Object3D | null;
	rightUpperLeg: Object3D | null;
	leftLeg: Object3D | null;
	rightLeg: Object3D | null;
	leftFoot: Object3D | null;
	rightFoot: Object3D | null;
}

const FALLBACK_TURN_CLIPS = new Set<HumanoidAnimationState>(['turn_left', 'turn_right']);
const STEP_DURATION_SECONDS = 0.48;
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);

export interface HumanoidAnimationDebugFlags {
	mouseLookActive: boolean;
	cameraRecentering: boolean;
}

export class HumanoidAnimationController {
	readonly mixer: AnimationMixer;
	private readonly actions = new Map<string, AnimationAction>();
	private readonly fadeSeconds: number;
	private readonly fadingOut: Array<{ action: AnimationAction; endTime: number }> = [];
	private readonly lookOffset = new Quaternion();
	private readonly rootWorldQuaternion = new Quaternion();
	private readonly parentWorldQuaternion = new Quaternion();
	private readonly avatarUpWorld = new Vector3();
	private readonly parentSpaceAxis = new Vector3();
	private readonly stepHipOffset = new Quaternion();
	private readonly stepKneeOffset = new Quaternion();
	private readonly stepFootOffset = new Quaternion();
	private readonly bones: HumanoidBoneSet;
	private activeState: HumanoidAnimationState = 'idle';
	private currentActionName = 'idle';
	private previousActionName: string | null = null;
	private transitionCount = 0;
	private activeActionStartedAt = 0;
	private lastLocomotion: HumanoidAnimationSnapshot | null = null;
	private lastDebugFlags: HumanoidAnimationDebugFlags = {
		mouseLookActive: false,
		cameraRecentering: false
	};
	private stepStartedAt = -1;
	private stepElapsed = 0;
	private stepHeight = 0;
	private stepLeadingFoot: LeadingFoot | null = null;

	constructor(
		readonly root: Object3D,
		clips: AnimationClip[] = createFallbackHumanoidClips(),
		options: HumanoidAnimationControllerOptions = {}
	) {
		this.mixer = new AnimationMixer(root);
		this.bones = collectHumanoidBones(root);
		validateCollectedBones(this.bones, options.strict === true);
		this.fadeSeconds = options.fadeSeconds ?? 0.18;
		const clipByName = new Map(clips.map((clip) => [clip.name, clip]));
		const missing = REQUIRED_HUMANOID_CLIPS.filter((name) => !clipByName.has(name));

		if (options.strict && missing.length > 0) {
			throw new Error(`Missing humanoid animation clips: ${missing.join(', ')}`);
		}

		for (const state of HUMANOID_ANIMATION_STATES) {
			const clipName = FALLBACK_TURN_CLIPS.has(state) ? 'idle' : state;
			const sourceClip = clipByName.get(clipName) ?? createEmptyClip(clipName);
			const clip = FALLBACK_TURN_CLIPS.has(state) ? cloneClipAs(sourceClip, state) : sourceClip;
			const action = this.mixer.clipAction(clip);
			if (state === 'jump' || state === 'land' || state === 'reaction_shoved') {
				action.setLoop(LoopOnce, 1);
				action.clampWhenFinished = true;
			} else {
				action.setLoop(LoopRepeat, Number.POSITIVE_INFINITY);
			}

			action.enabled = state === 'idle';
			action.setEffectiveWeight(state === 'idle' ? 1 : 0);
			if (state === 'idle') {
				action.play();
			}
			this.actions.set(state, action);
		}
	}

	update(
		locomotion: HumanoidAnimationSnapshot | HumanoidLocomotionState,
		speedOrDeltaSeconds: number,
		deltaSecondsOrDebugFlags?: number | HumanoidAnimationDebugFlags,
		debugFlags: HumanoidAnimationDebugFlags = this.lastDebugFlags
	): void {
		const legacy = typeof locomotion === 'string';
		const deltaSeconds =
			typeof deltaSecondsOrDebugFlags === 'number' ? deltaSecondsOrDebugFlags : speedOrDeltaSeconds;
		const locomotionSnapshot = legacy
			? createLegacyLocomotionSnapshot(locomotion, speedOrDeltaSeconds)
			: locomotion;
		const flags =
			typeof deltaSecondsOrDebugFlags === 'object' ? deltaSecondsOrDebugFlags : debugFlags;

		this.lastLocomotion = locomotionSnapshot;
		this.lastDebugFlags = flags;
		const targetState = mapLocomotionState(
			locomotionSnapshot.locomotionState,
			locomotionSnapshot.speed
		);
		this.setState(targetState);
		this.applyPlaybackScale(targetState, locomotionSnapshot);
		this.mixer.update(Math.min(deltaSeconds, 0.05));
		this.applyLookOverlay(locomotionSnapshot);
		this.applyStepOverlay(locomotionSnapshot, Math.min(deltaSeconds, 0.05));
		this.cleanupFadedActions();
	}

	playPreview(deltaSeconds: number): void {
		this.setState('idle');
		this.mixer.update(Math.min(deltaSeconds, 0.05));
	}

	setState(state: HumanoidAnimationState): void {
		if (state === this.activeState) {
			return;
		}

		const previous = this.actions.get(this.activeState);
		const next = this.actions.get(state);

		if (!next) {
			return;
		}

		this.previousActionName = this.currentActionName;
		this.currentActionName = state;
		this.activeState = state;
		this.activeActionStartedAt = this.mixer.time;
		this.transitionCount += 1;
		next.enabled = true;
		next.reset();
		next.setEffectiveWeight(1);
		next.play();

		if (previous && previous !== next) {
			previous.enabled = true;
			previous.crossFadeTo(next, this.fadeSeconds, false);
			this.fadingOut.push({ action: previous, endTime: this.mixer.time + this.fadeSeconds });
		}
	}

	get snapshot(): HumanoidAnimationBlendSnapshot {
		const weights: Record<string, number> = {};

		for (const [name, action] of this.actions) {
			weights[name] = MathUtils.clamp(action.getEffectiveWeight(), 0, 1);
		}
		const action = this.actions.get(this.activeState);

		return {
			activeState: this.activeState,
			currentAction: this.currentActionName,
			previousAction: this.previousActionName,
			weights,
			clipCount: new Set([...this.actions.values()].map((action) => action.getClip().name)).size,
			mixerTime: this.mixer.time,
			transitionCount: this.transitionCount,
			actionTime: Math.max(0, this.mixer.time - this.activeActionStartedAt),
			actionWeight: MathUtils.clamp(action?.getEffectiveWeight() ?? 0, 0, 1),
			activeActionCount: [...this.actions.values()].filter(
				(candidate) => candidate.enabled && candidate.getEffectiveWeight() > 0.01
			).length,
			cameraYaw: this.lastLocomotion?.cameraYaw ?? 0,
			bodyYaw: this.lastLocomotion?.bodyYaw ?? 0,
			desiredMovementYaw: this.lastLocomotion?.desiredMovementYaw ?? 0,
			headYaw: this.lastLocomotion?.headYaw ?? 0,
			localForwardSpeed: this.lastLocomotion?.localForwardSpeed ?? 0,
			localSideSpeed: this.lastLocomotion?.localSideSpeed ?? 0,
			verticalSpeed: this.lastLocomotion?.verticalSpeed ?? 0,
			grounded: this.lastLocomotion?.grounded ?? false,
			stepActive: this.stepLeadingFoot !== null,
			stepHeight: this.stepLeadingFoot ? this.stepHeight : 0,
			leadingFoot: this.stepLeadingFoot,
			mouseLookActive: this.lastDebugFlags.mouseLookActive,
			cameraRecentering: this.lastDebugFlags.cameraRecentering
		};
	}

	dispose(): void {
		this.mixer.stopAllAction();
		this.mixer.uncacheRoot(this.root);
		this.actions.clear();
		this.fadingOut.length = 0;
	}

	private applyPlaybackScale(
		state: HumanoidAnimationState,
		locomotion: HumanoidAnimationSnapshot
	): void {
		const action = this.actions.get(state);

		if (!action) {
			return;
		}

		const forwardSpeed = Math.abs(locomotion.localForwardSpeed);
		const sideSpeed = Math.abs(locomotion.localSideSpeed);

		if (state === 'walk') {
			action.setEffectiveTimeScale(MathUtils.clamp(forwardSpeed / 5, 0.8, 1.3));
		} else if (state === 'walk_backward') {
			action.setEffectiveTimeScale(MathUtils.clamp(forwardSpeed / 4, 0.8, 1.25));
		} else if (state === 'strafe_left' || state === 'strafe_right') {
			action.setEffectiveTimeScale(MathUtils.clamp(sideSpeed / 4.5, 0.8, 1.25));
		} else if (state === 'run') {
			action.setEffectiveTimeScale(MathUtils.clamp(locomotion.speed / 8, 0.9, 1.4));
		} else {
			action.setEffectiveTimeScale(1);
		}
	}

	private applyLookOverlay(locomotion: HumanoidAnimationSnapshot): void {
		const headYaw = MathUtils.clamp(locomotion.headYaw, -0.7, 0.7);

		if (Math.abs(headYaw) < 0.0001) {
			return;
		}

		/*
		 * Reallusion bones do not all use local Y as their twist axis. Rotate
		 * around the avatar's vertical axis expressed in each bone parent's
		 * coordinate system instead of assuming a Mixamo local axis.
		 */
		this.root.getWorldQuaternion(this.rootWorldQuaternion);
		this.avatarUpWorld.copy(Y_AXIS).applyQuaternion(this.rootWorldQuaternion).normalize();

		this.applyParentSpaceYaw(this.bones.chest, MathUtils.clamp(headYaw * 0.2, -0.18, 0.18));
		this.applyParentSpaceYaw(this.bones.neck, headYaw * 0.45);
		this.applyParentSpaceYaw(this.bones.head, headYaw * 0.35);
	}

	private applyParentSpaceYaw(bone: Object3D | null, angle: number): void {
		if (!bone || Math.abs(angle) < 0.0001) {
			return;
		}

		const parent = bone.parent;

		if (!parent) {
			this.lookOffset.setFromAxisAngle(Y_AXIS, angle);
			bone.quaternion.premultiply(this.lookOffset);
			return;
		}

		parent.getWorldQuaternion(this.parentWorldQuaternion);
		this.parentWorldQuaternion.invert();
		this.parentSpaceAxis
			.copy(this.avatarUpWorld)
			.applyQuaternion(this.parentWorldQuaternion)
			.normalize();
		this.lookOffset.setFromAxisAngle(this.parentSpaceAxis, angle);
		bone.quaternion.premultiply(this.lookOffset);
	}

	private applyStepOverlay(locomotion: HumanoidAnimationSnapshot, deltaSeconds: number): void {
		if (locomotion.stepActive && locomotion.leadingFoot && locomotion.stepHeight > 0) {
			if (locomotion.stepStartedAt !== this.stepStartedAt) {
				this.stepStartedAt = locomotion.stepStartedAt;
				this.stepElapsed = 0;
				this.stepHeight = MathUtils.clamp(locomotion.stepHeight, 0, 1.1);
				this.stepLeadingFoot = locomotion.leadingFoot;
			}
		}

		if (!this.stepLeadingFoot) {
			return;
		}

		this.stepElapsed += deltaSeconds;
		const progress = MathUtils.clamp(this.stepElapsed / STEP_DURATION_SECONDS, 0, 1);
		const lift = Math.sin(progress * Math.PI);
		const settle = 1 - progress;
		const hipLift = this.stepHeight * (0.18 + 0.22 * smoothStep(progress));
		const thighAngle = lift * 0.48 + settle * 0.12;
		const kneeAngle = lift * 0.72;
		const footAngle = lift * -0.32 + settle * -0.08;
		const upperLeg =
			this.stepLeadingFoot === 'left' ? this.bones.leftUpperLeg : this.bones.rightUpperLeg;
		const lowerLeg = this.stepLeadingFoot === 'left' ? this.bones.leftLeg : this.bones.rightLeg;
		const foot = this.stepLeadingFoot === 'left' ? this.bones.leftFoot : this.bones.rightFoot;

		if (this.bones.hips) {
			this.bones.hips.position.y += hipLift;
		}
		this.stepHipOffset.setFromAxisAngle(X_AXIS, thighAngle);
		this.stepKneeOffset.setFromAxisAngle(X_AXIS, kneeAngle);
		this.stepFootOffset.setFromAxisAngle(X_AXIS, footAngle);
		upperLeg?.quaternion.multiply(this.stepHipOffset);
		lowerLeg?.quaternion.multiply(this.stepKneeOffset);
		foot?.quaternion.multiply(this.stepFootOffset);

		if (progress >= 1) {
			this.stepStartedAt = -1;
			this.stepElapsed = 0;
			this.stepHeight = 0;
			this.stepLeadingFoot = null;
		}
	}

	private cleanupFadedActions(): void {
		for (let index = this.fadingOut.length - 1; index >= 0; index -= 1) {
			const entry = this.fadingOut[index];

			if (this.mixer.time < entry.endTime) {
				continue;
			}

			entry.action.stop();
			entry.action.enabled = false;
			entry.action.setEffectiveWeight(0);
			this.fadingOut.splice(index, 1);
		}
	}
}

export function mapLocomotionState(
	state: HumanoidLocomotionState,
	speed: number
): HumanoidAnimationState {
	if (state === 'idle') {
		return speed > 0.05 ? 'walk' : 'idle';
	}

	if (state === 'walk_forward') {
		return 'walk';
	}

	if (state === 'jump_start') {
		return 'jump';
	}

	if (state === 'airborne') {
		return 'fall';
	}

	if (state === 'landing') {
		return 'land';
	}

	return state;
}

export function validateRequiredHumanoidClips(clips: AnimationClip[]): string[] {
	const names = new Set(clips.map((clip) => clip.name));

	return REQUIRED_HUMANOID_CLIPS.filter((name) => !names.has(name));
}

export function createFallbackHumanoidClips(): AnimationClip[] {
	return REQUIRED_HUMANOID_CLIPS.map((state) => {
		const tracks =
			state === 'idle'
				? [
						new NumberKeyframeTrack('chest.scale[y]', [0, 1, 2], [1, 1.018, 1]),
						new NumberKeyframeTrack('hips.position[y]', [0, 1, 2], [0.82, 0.826, 0.82])
					]
				: [new BooleanKeyframeTrack('avatarRoot.visible', [0, 1], [true, true])];

		return new AnimationClip(state, state === 'idle' ? 2 : 1, tracks);
	});
}

function createEmptyClip(name: string): AnimationClip {
	return new AnimationClip(name, 1, [
		new BooleanKeyframeTrack('avatarRoot.visible', [0, 1], [true, true])
	]);
}

function cloneClipAs(clip: AnimationClip, name: string): AnimationClip {
	const clone = clip.clone();
	clone.name = name;

	return clone;
}

function createLegacyLocomotionSnapshot(
	state: HumanoidLocomotionState,
	speed: number
): HumanoidAnimationSnapshot {
	return {
		locomotionState: state,
		speed,
		gaitPhase: 0,
		armLeftAngle: 0,
		armRightAngle: 0,
		legLeftAngle: 0,
		legRightAngle: 0,
		grounded: true,
		headYaw: 0,
		bodyYaw: Math.PI,
		cameraYaw: Math.PI,
		desiredMovementYaw: Math.PI,
		localForwardSpeed: speed,
		localSideSpeed: state === 'strafe_left' || state === 'strafe_right' ? speed : 0,
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

function smoothStep(value: number): number {
	return value * value * (3 - 2 * value);
}

function collectHumanoidBones(root: Object3D): HumanoidBoneSet {
	const bones: HumanoidBoneSet = {
		hips: null,
		chest: null,
		neck: null,
		head: null,
		leftClavicle: null,
		leftUpperArm: null,
		leftLowerArm: null,
		leftHand: null,
		rightClavicle: null,
		rightUpperArm: null,
		rightLowerArm: null,
		rightHand: null,
		leftUpperLeg: null,
		rightUpperLeg: null,
		leftLeg: null,
		rightLeg: null,
		leftFoot: null,
		rightFoot: null
	};

	root.traverse((child) => {
		if (child.type !== 'Bone') {
			return;
		}

		const name = normalizeBoneName(child.name);

		if (name === 'hip' || name === 'hips') bones.hips = child;
		else if (name === 'spine02' || name === 'spine2' || name === 'chest') bones.chest = child;
		else if (name === 'neck' || name === 'necktwist01') bones.neck = child;
		else if (name === 'head') bones.head = child;
		else if (name === 'leftshoulder' || name === 'lclavicle') bones.leftClavicle = child;
		else if (name === 'leftarm' || name === 'lupperarm') bones.leftUpperArm = child;
		else if (name === 'leftforearm' || name === 'lforearm') bones.leftLowerArm = child;
		else if (name === 'lefthand' || name === 'lhand') bones.leftHand = child;
		else if (name === 'rightshoulder' || name === 'rclavicle') bones.rightClavicle = child;
		else if (name === 'rightarm' || name === 'rupperarm') bones.rightUpperArm = child;
		else if (name === 'rightforearm' || name === 'rforearm') bones.rightLowerArm = child;
		else if (name === 'righthand' || name === 'rhand') bones.rightHand = child;
		else if (name === 'leftupleg' || name === 'lthigh') bones.leftUpperLeg = child;
		else if (name === 'rightupleg' || name === 'rthigh') bones.rightUpperLeg = child;
		else if (name === 'leftleg' || name === 'lcalf') bones.leftLeg = child;
		else if (name === 'rightleg' || name === 'rcalf') bones.rightLeg = child;
		else if (name === 'leftfoot' || name === 'lfoot') bones.leftFoot = child;
		else if (name === 'rightfoot' || name === 'rfoot') bones.rightFoot = child;
	});

	return bones;
}

function validateCollectedBones(bones: HumanoidBoneSet, strict: boolean): void {
	if (!strict) {
		return;
	}

	const missing = Object.entries(bones)
		.filter(([, bone]) => bone === null)
		.map(([name]) => name);

	if (missing.length > 0) {
		throw new Error(`Missing humanoid runtime bones: ${missing.join(', ')}`);
	}
}

function normalizeBoneName(name: string): string {
	return name
		.replace(/\\/g, '/')
		.split('/')
		.at(-1)!
		.replace(/^.*:/, '')
		.replace(/^mixamorig/i, '')
		.replace(/^beta[_-]?joints:?/i, '')
		.replace(/^cc[_-]?base[_-]?/i, '')
		.replace(/[^a-z0-9]/gi, '')
		.toLowerCase();
}
