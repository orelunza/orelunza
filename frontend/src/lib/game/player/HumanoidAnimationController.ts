import {
	AnimationClip,
	AnimationMixer,
	BooleanKeyframeTrack,
	LoopOnce,
	LoopRepeat,
	type AnimationAction,
	type Object3D
} from 'three';
import type {
	HumanoidAnimationSnapshot,
	HumanoidLeadingFoot,
	HumanoidLocomotionState
} from './HumanoidPose';

/**
 * Orelunza animation state controller — rewritten.
 *
 * The controller maps locomotion states to a small blend state machine and, when
 * real transform clips are present, drives a Three.js AnimationMixer. Its
 * internals are split into two collaborators:
 *
 *   - a numeric BlendState: authoritative weights, transition counting and the
 *     public blend snapshot. It is allocation-free and always runs.
 *   - a lazily-created MixerBackend: crossfades real actions, scales playback by
 *     speed and keeps at most two actions active. Only created when clips carry
 *     meaningful transform tracks, or when a caller explicitly reads `mixer`.
 *
 * The procedural avatar is posed directly by HumanoidAnimator, so with the empty
 * placeholder clips the controller stays purely numeric. A future GLB with real
 * tracks flips it to the mixer backend automatically, with no API change.
 */

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
export type HumanoidAnimationBackend = 'auto' | 'procedural' | 'mixer';

export interface HumanoidAnimationBlendSnapshot {
	activeState: HumanoidAnimationState;
	currentAction: string;
	previousAction: string | null;
	weights: Record<HumanoidAnimationState, number>;
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
	leadingFoot: HumanoidLeadingFoot | null;
	mouseLookActive: boolean;
	cameraRecentering: boolean;
}

export interface HumanoidAnimationControllerOptions {
	strict?: boolean;
	fadeSeconds?: number;
	backend?: HumanoidAnimationBackend;
}

export interface HumanoidAnimationDebugFlags {
	mouseLookActive: boolean;
	cameraRecentering: boolean;
}

const MAX_DELTA_SECONDS = 0.05;
const DEFAULT_FADE_SECONDS = 0.18;
const MIN_FADE_SECONDS = 0.001;
const TURN_ALIAS_STATES = new Set<HumanoidAnimationState>(['turn_left', 'turn_right']);
const ONE_SHOT_STATES = new Set<HumanoidAnimationState>(['jump', 'land', 'reaction_shoved']);

export class HumanoidAnimationController {
	readonly backend: Exclude<HumanoidAnimationBackend, 'auto'>;

	private readonly clipByName = new Map<string, AnimationClip>();
	private readonly fadeSeconds: number;
	private readonly weights = createWeightRecord();
	private readonly blendSnapshot: HumanoidAnimationBlendSnapshot;
	private readonly legacySnapshot = createLocomotionSnapshot();
	private readonly debugFlags: HumanoidAnimationDebugFlags = {
		mouseLookActive: false,
		cameraRecentering: false
	};

	private mixerBackend: MixerBackend | null = null;

	// Blend state.
	private activeState: HumanoidAnimationState = 'idle';
	private currentActionName = 'idle';
	private previousActionName: string | null = null;
	private transitionFrom: HumanoidAnimationState | null = null;
	private transitionElapsed = 0;
	private transitionCount = 0;
	private totalTime = 0;
	private actionStartedAt = 0;
	private disposed = false;

	constructor(
		readonly root: Object3D,
		clips: AnimationClip[] = createFallbackHumanoidClips(),
		options: HumanoidAnimationControllerOptions = {}
	) {
		this.fadeSeconds = clampFinite(options.fadeSeconds, DEFAULT_FADE_SECONDS, 0, 2);

		for (const clip of clips) {
			if (clip?.name && !this.clipByName.has(clip.name)) {
				this.clipByName.set(clip.name, clip);
			}
		}

		const missing = validateRequiredHumanoidClips(clips);

		if (options.strict && missing.length > 0) {
			throw new Error(`Missing humanoid animation clips: ${missing.join(', ')}`);
		}

		this.backend = resolveBackend(options.backend ?? 'auto', clips);
		this.weights.idle = 1;
		this.blendSnapshot = createBlendSnapshot(this.weights, this.clipByName.size);

		if (this.backend === 'mixer') {
			this.ensureMixer();
		}
	}

	/** Compatibility accessor: creates the mixer on demand for diagnostics/tests. */
	get mixer(): AnimationMixer {
		return this.ensureMixer().mixer;
	}

	get snapshot(): HumanoidAnimationBlendSnapshot {
		return this.blendSnapshot;
	}

	get usesMixerBackend(): boolean {
		return this.backend === 'mixer';
	}

	update(
		locomotion: HumanoidAnimationSnapshot | HumanoidLocomotionState,
		speedOrDeltaSeconds: number,
		deltaSecondsOrDebugFlags?: number | HumanoidAnimationDebugFlags,
		debugFlags: HumanoidAnimationDebugFlags = this.debugFlags
	): void {
		if (this.disposed) {
			return;
		}

		const legacy = typeof locomotion === 'string';
		const deltaSeconds = safeDelta(
			typeof deltaSecondsOrDebugFlags === 'number' ? deltaSecondsOrDebugFlags : speedOrDeltaSeconds
		);
		const snapshot = legacy
			? writeLegacyLocomotionSnapshot(this.legacySnapshot, locomotion, speedOrDeltaSeconds)
			: locomotion;
		const flags =
			typeof deltaSecondsOrDebugFlags === 'object' ? deltaSecondsOrDebugFlags : debugFlags;
		const targetState = mapLocomotionState(snapshot.locomotionState, snapshot.speed);

		this.debugFlags.mouseLookActive = Boolean(flags.mouseLookActive);
		this.debugFlags.cameraRecentering = Boolean(flags.cameraRecentering);

		this.setState(targetState);
		this.advance(deltaSeconds);
		this.syncLocomotionSnapshot(snapshot);
	}

	playPreview(deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		this.setState('idle');
		this.advance(safeDelta(deltaSeconds));
	}

	setState(state: HumanoidAnimationState): void {
		if (this.disposed || state === this.activeState || !isHumanoidAnimationState(state)) {
			return;
		}

		const previous = this.activeState;
		this.previousActionName = this.currentActionName;
		this.currentActionName = state;
		this.activeState = state;
		this.transitionFrom = previous;
		this.transitionElapsed = 0;
		this.actionStartedAt = this.totalTime;
		this.transitionCount += 1;

		const instant = this.fadeSeconds <= MIN_FADE_SECONDS;
		this.weights[state] = instant ? 1 : 0;

		if (instant) {
			this.weights[previous] = 0;
			this.transitionFrom = null;
		}

		this.mixerBackend?.beginTransition(previous, state, this.fadeSeconds);
		this.syncBlendSnapshot();
	}

	reset(state: HumanoidAnimationState = 'idle'): void {
		if (this.disposed) {
			return;
		}

		zeroWeights(this.weights);
		this.weights[state] = 1;
		this.activeState = state;
		this.currentActionName = state;
		this.previousActionName = null;
		this.transitionFrom = null;
		this.transitionElapsed = 0;
		this.transitionCount = 0;
		this.totalTime = 0;
		this.actionStartedAt = 0;
		this.debugFlags.mouseLookActive = false;
		this.debugFlags.cameraRecentering = false;

		this.mixerBackend?.reset(state);
		resetBlendSnapshot(this.blendSnapshot, this.weights, state, this.clipByName.size);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.mixerBackend?.dispose();
		this.mixerBackend = null;
		this.clipByName.clear();
		this.transitionFrom = null;
		zeroWeights(this.weights);
	}

	private advance(deltaSeconds: number): void {
		this.totalTime += deltaSeconds;

		if (this.transitionFrom) {
			this.transitionElapsed += deltaSeconds;
			const alpha =
				this.fadeSeconds <= MIN_FADE_SECONDS
					? 1
					: clamp01(this.transitionElapsed / this.fadeSeconds);

			this.weights[this.activeState] = alpha;
			this.weights[this.transitionFrom] = 1 - alpha;

			if (alpha >= 1) {
				this.finishTransition();
			}
		} else {
			this.weights[this.activeState] = 1;
		}

		if (this.mixerBackend) {
			this.mixerBackend.advance(
				this.activeState,
				this.blendSnapshot,
				deltaSeconds,
				!this.transitionFrom
			);
		}

		this.syncBlendSnapshot();
	}

	private finishTransition(): void {
		if (this.transitionFrom) {
			this.weights[this.transitionFrom] = 0;
			this.mixerBackend?.stopState(this.transitionFrom);
		}

		this.weights[this.activeState] = 1;
		this.transitionFrom = null;
		this.transitionElapsed = 0;
	}

	private syncLocomotionSnapshot(source: HumanoidAnimationSnapshot): void {
		const target = this.blendSnapshot;
		target.cameraYaw = finiteOr(source.cameraYaw, 0);
		target.bodyYaw = finiteOr(source.bodyYaw, 0);
		target.desiredMovementYaw = finiteOr(source.desiredMovementYaw, 0);
		target.headYaw = finiteOr(source.headYaw, 0);
		target.localForwardSpeed = finiteOr(source.localForwardSpeed, 0);
		target.localSideSpeed = finiteOr(source.localSideSpeed, 0);
		target.verticalSpeed = finiteOr(source.verticalSpeed, 0);
		target.grounded = Boolean(source.grounded);
		target.stepActive = Boolean(source.stepActive);
		target.stepHeight = clampFinite(source.stepHeight, 0, 0, 1);
		target.leadingFoot = source.leadingFoot ?? null;
		target.mouseLookActive = this.debugFlags.mouseLookActive;
		target.cameraRecentering = this.debugFlags.cameraRecentering;
	}

	private syncBlendSnapshot(): void {
		const snapshot = this.blendSnapshot;
		snapshot.activeState = this.activeState;
		snapshot.currentAction = this.currentActionName;
		snapshot.previousAction = this.previousActionName;
		snapshot.clipCount = this.clipByName.size;
		snapshot.mixerTime = this.totalTime;
		snapshot.transitionCount = this.transitionCount;
		snapshot.actionTime = Math.max(0, this.totalTime - this.actionStartedAt);
		snapshot.actionWeight = clamp01(this.weights[this.activeState]);
		snapshot.activeActionCount = this.transitionFrom ? 2 : 1;
		snapshot.mouseLookActive = this.debugFlags.mouseLookActive;
		snapshot.cameraRecentering = this.debugFlags.cameraRecentering;
	}

	private ensureMixer(): MixerBackend {
		if (!this.mixerBackend) {
			this.mixerBackend = new MixerBackend(this.root, this.clipByName, this.activeState);
		}

		return this.mixerBackend;
	}
}

/**
 * AnimationMixer wrapper. Owns one action per state, performs crossfades, scales
 * playback by measured speed and guarantees at most two simultaneously-active
 * actions (the outgoing one is hard-stopped once a transition completes).
 */
class MixerBackend {
	readonly mixer: AnimationMixer;

	private readonly actions = new Map<HumanoidAnimationState, AnimationAction>();

	constructor(
		private readonly root: Object3D,
		clipByName: Map<string, AnimationClip>,
		activeState: HumanoidAnimationState
	) {
		this.mixer = new AnimationMixer(root);

		for (const state of HUMANOID_ANIMATION_STATES) {
			const sourceName = TURN_ALIAS_STATES.has(state) ? 'idle' : state;
			const sourceClip = clipByName.get(sourceName) ?? createEmptyClip(sourceName);
			const clip = TURN_ALIAS_STATES.has(state) ? cloneClipAs(sourceClip, state) : sourceClip;
			const action = this.mixer.clipAction(clip);

			if (ONE_SHOT_STATES.has(state)) {
				action.setLoop(LoopOnce, 1);
				action.clampWhenFinished = true;
			} else {
				action.setLoop(LoopRepeat, Number.POSITIVE_INFINITY);
			}

			action.enabled = false;
			action.setEffectiveWeight(0);
			this.actions.set(state, action);
		}

		this.activate(activeState, true);
	}

	beginTransition(
		previous: HumanoidAnimationState,
		next: HumanoidAnimationState,
		fadeSeconds: number
	): void {
		const nextAction = this.actions.get(next);

		if (!nextAction) {
			return;
		}

		nextAction.enabled = true;
		nextAction.reset();
		nextAction.setEffectiveWeight(1);
		nextAction.play();

		const previousAction = this.actions.get(previous);

		if (previousAction && previousAction !== nextAction && fadeSeconds > MIN_FADE_SECONDS) {
			previousAction.enabled = true;
			previousAction.crossFadeTo(nextAction, fadeSeconds, false);
		} else if (previousAction && previousAction !== nextAction) {
			previousAction.stop();
			previousAction.enabled = false;
			previousAction.setEffectiveWeight(0);
		}
	}

	advance(
		activeState: HumanoidAnimationState,
		locomotion: HumanoidAnimationBlendSnapshot,
		deltaSeconds: number,
		settled: boolean
	): void {
		this.applyPlaybackScale(activeState, locomotion);
		this.mixer.update(deltaSeconds);

		if (settled) {
			this.cleanup(activeState);
		}
	}

	stopState(state: HumanoidAnimationState): void {
		const action = this.actions.get(state);

		if (action) {
			action.stop();
			action.enabled = false;
			action.setEffectiveWeight(0);
		}
	}

	reset(state: HumanoidAnimationState): void {
		this.mixer.stopAllAction();
		this.mixer.setTime(0);
		this.activate(state, true);
	}

	dispose(): void {
		this.mixer.stopAllAction();
		this.mixer.uncacheRoot(this.root);
		this.actions.clear();
	}

	private activate(state: HumanoidAnimationState, reset: boolean): void {
		const action = this.actions.get(state);

		if (!action) {
			return;
		}

		action.enabled = true;

		if (reset) {
			action.reset();
		}

		action.setEffectiveWeight(1);
		action.play();
	}

	private applyPlaybackScale(
		state: HumanoidAnimationState,
		locomotion: HumanoidAnimationBlendSnapshot
	): void {
		const action = this.actions.get(state);

		if (!action) {
			return;
		}

		const forwardSpeed = Math.abs(locomotion.localForwardSpeed);
		const sideSpeed = Math.abs(locomotion.localSideSpeed);
		let scale = 1;

		if (state === 'walk') {
			scale = clamp(forwardSpeed / 5, 0.8, 1.3);
		} else if (state === 'walk_backward') {
			scale = clamp(forwardSpeed / 4, 0.8, 1.25);
		} else if (state === 'strafe_left' || state === 'strafe_right') {
			scale = clamp(sideSpeed / 4.5, 0.8, 1.25);
		} else if (state === 'run') {
			scale = clamp(Math.hypot(forwardSpeed, sideSpeed) / 8, 0.9, 1.4);
		}

		action.setEffectiveTimeScale(scale);
	}

	private cleanup(activeState: HumanoidAnimationState): void {
		for (const [state, action] of this.actions) {
			if (state === activeState) {
				continue;
			}

			if (action.enabled || action.getEffectiveWeight() > 0) {
				action.stop();
				action.enabled = false;
				action.setEffectiveWeight(0);
			}
		}
	}
}

export function mapLocomotionState(
	state: HumanoidLocomotionState,
	speed: number
): HumanoidAnimationState {
	if (state === 'idle') {
		return finiteOr(speed, 0) > 0.05 ? 'walk' : 'idle';
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

	return isHumanoidAnimationState(state) ? state : 'idle';
}

export function validateRequiredHumanoidClips(clips: readonly AnimationClip[]): string[] {
	const names = new Set<string>();

	for (const clip of clips) {
		if (clip?.name) {
			names.add(clip.name);
		}
	}

	return REQUIRED_HUMANOID_CLIPS.filter((name) => !names.has(name));
}

export function createFallbackHumanoidClips(): AnimationClip[] {
	return REQUIRED_HUMANOID_CLIPS.map((state) => createEmptyClip(state));
}

function resolveBackend(
	requested: HumanoidAnimationBackend,
	clips: readonly AnimationClip[]
): Exclude<HumanoidAnimationBackend, 'auto'> {
	if (requested === 'procedural' || requested === 'mixer') {
		return requested;
	}

	return clips.some(hasMeaningfulAnimationTracks) ? 'mixer' : 'procedural';
}

function hasMeaningfulAnimationTracks(clip: AnimationClip): boolean {
	for (const track of clip.tracks) {
		const property = track.name.slice(track.name.lastIndexOf('.') + 1).toLowerCase();

		if (
			property === 'position' ||
			property === 'quaternion' ||
			property === 'scale' ||
			property === 'morphtargetinfluences'
		) {
			return true;
		}
	}

	return false;
}

function createEmptyClip(name: string): AnimationClip {
	const duration = name === 'idle' ? 2 : 1;

	return new AnimationClip(name, duration, [
		new BooleanKeyframeTrack('avatarRoot.visible', [0, duration], [true, true])
	]);
}

function cloneClipAs(clip: AnimationClip, name: string): AnimationClip {
	const clone = clip.clone();
	clone.name = name;
	return clone;
}

function createWeightRecord(): Record<HumanoidAnimationState, number> {
	return {
		idle: 0,
		walk: 0,
		run: 0,
		strafe_left: 0,
		strafe_right: 0,
		walk_backward: 0,
		jump: 0,
		fall: 0,
		land: 0,
		reaction_shoved: 0,
		turn_left: 0,
		turn_right: 0
	};
}

function zeroWeights(weights: Record<HumanoidAnimationState, number>): void {
	for (const state of HUMANOID_ANIMATION_STATES) {
		weights[state] = 0;
	}
}

function createBlendSnapshot(
	weights: Record<HumanoidAnimationState, number>,
	clipCount: number
): HumanoidAnimationBlendSnapshot {
	return {
		activeState: 'idle',
		currentAction: 'idle',
		previousAction: null,
		weights,
		clipCount,
		mixerTime: 0,
		transitionCount: 0,
		actionTime: 0,
		actionWeight: 1,
		activeActionCount: 1,
		cameraYaw: 0,
		bodyYaw: 0,
		desiredMovementYaw: 0,
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		grounded: true,
		stepActive: false,
		stepHeight: 0,
		leadingFoot: null,
		mouseLookActive: false,
		cameraRecentering: false
	};
}

function createLocomotionSnapshot(): HumanoidAnimationSnapshot {
	return {
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

function writeLegacyLocomotionSnapshot(
	target: HumanoidAnimationSnapshot,
	state: HumanoidLocomotionState,
	speed: number
): HumanoidAnimationSnapshot {
	const normalizedSpeed = Math.max(0, finiteOr(speed, 0));
	const airborne =
		state === 'jump_start' || state === 'jump' || state === 'airborne' || state === 'fall';

	target.locomotionState = state;
	target.speed = normalizedSpeed;
	target.gaitPhase = 0;
	target.armLeftAngle = 0;
	target.armRightAngle = 0;
	target.legLeftAngle = 0;
	target.legRightAngle = 0;
	target.grounded = !airborne;
	target.headYaw = 0;
	target.bodyYaw = Math.PI;
	target.cameraYaw = Math.PI;
	target.desiredMovementYaw = Math.PI;
	target.localForwardSpeed =
		state === 'strafe_left' || state === 'strafe_right' ? 0 : normalizedSpeed;
	target.localSideSpeed =
		state === 'strafe_left' ? -normalizedSpeed : state === 'strafe_right' ? normalizedSpeed : 0;
	target.verticalSpeed = state === 'jump_start' || state === 'jump' ? normalizedSpeed : 0;
	target.stepActive = false;
	target.stepHeight = 0;
	target.leadingFoot = null;
	target.stepStartedAt = -1;
	target.mouseLookActive = false;
	target.cameraRecentering = false;
	target.updateMs = 0;
	return target;
}

function resetBlendSnapshot(
	target: HumanoidAnimationBlendSnapshot,
	weights: Record<HumanoidAnimationState, number>,
	state: HumanoidAnimationState,
	clipCount: number
): void {
	target.activeState = state;
	target.currentAction = state;
	target.previousAction = null;
	target.weights = weights;
	target.clipCount = clipCount;
	target.mixerTime = 0;
	target.transitionCount = 0;
	target.actionTime = 0;
	target.actionWeight = 1;
	target.activeActionCount = 1;
	target.cameraYaw = 0;
	target.bodyYaw = 0;
	target.desiredMovementYaw = 0;
	target.headYaw = 0;
	target.localForwardSpeed = 0;
	target.localSideSpeed = 0;
	target.verticalSpeed = 0;
	target.grounded = true;
	target.stepActive = false;
	target.stepHeight = 0;
	target.leadingFoot = null;
	target.mouseLookActive = false;
	target.cameraRecentering = false;
}

function isHumanoidAnimationState(value: string): value is HumanoidAnimationState {
	return (HUMANOID_ANIMATION_STATES as readonly string[]).includes(value);
}

function safeDelta(value: number): number {
	return clampFinite(value, 0, 0, MAX_DELTA_SECONDS);
}

function clampFinite(
	value: number | undefined,
	fallback: number,
	min: number,
	max: number
): number {
	return clamp(finiteOr(value, fallback), min, max);
}

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
	return clamp(value, 0, 1);
}
