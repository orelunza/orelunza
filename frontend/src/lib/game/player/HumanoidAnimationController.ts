import {
	AnimationClip,
	AnimationMixer,
	BooleanKeyframeTrack,
	LoopRepeat,
	LoopOnce,
	MathUtils,
	NumberKeyframeTrack,
	type AnimationAction,
	type Object3D
} from 'three';
import type { HumanoidLocomotionState } from './HumanoidPose';

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
}

export interface HumanoidAnimationControllerOptions {
	strict?: boolean;
	fadeSeconds?: number;
}

const FALLBACK_TURN_CLIPS = new Set<HumanoidAnimationState>(['turn_left', 'turn_right']);

export class HumanoidAnimationController {
	readonly mixer: AnimationMixer;
	private readonly actions = new Map<string, AnimationAction>();
	private readonly fadeSeconds: number;
	private readonly fadingOut: Array<{ action: AnimationAction; endTime: number }> = [];
	private activeState: HumanoidAnimationState = 'idle';
	private currentActionName = 'idle';
	private previousActionName: string | null = null;
	private transitionCount = 0;

	constructor(
		readonly root: Object3D,
		clips: AnimationClip[] = createFallbackHumanoidClips(),
		options: HumanoidAnimationControllerOptions = {}
	) {
		this.mixer = new AnimationMixer(root);
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

	update(locomotionState: HumanoidLocomotionState, speed: number, deltaSeconds: number): void {
		const targetState = mapLocomotionState(locomotionState, speed);
		this.setState(targetState);
		this.applyPlaybackScale(targetState, speed);
		this.mixer.update(Math.min(deltaSeconds, 0.05));
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
			actionTime: action?.time ?? 0,
			actionWeight: MathUtils.clamp(action?.getEffectiveWeight() ?? 0, 0, 1),
			activeActionCount: [...this.actions.values()].filter(
				(candidate) => candidate.enabled && candidate.getEffectiveWeight() > 0.01
			).length
		};
	}

	dispose(): void {
		this.mixer.stopAllAction();
		this.mixer.uncacheRoot(this.root);
		this.actions.clear();
		this.fadingOut.length = 0;
	}

	private applyPlaybackScale(state: HumanoidAnimationState, speed: number): void {
		const action = this.actions.get(state);

		if (!action) {
			return;
		}

		if (
			state === 'walk' ||
			state === 'walk_backward' ||
			state === 'strafe_left' ||
			state === 'strafe_right'
		) {
			action.timeScale = MathUtils.clamp(speed / 5, 0.75, 1.25);
		} else if (state === 'run') {
			action.timeScale = MathUtils.clamp(speed / 8, 0.85, 1.35);
		} else {
			action.timeScale = 1;
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
