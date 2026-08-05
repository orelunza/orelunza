import {
	AnimationClip,
	Bone,
	Mesh,
	SkinnedMesh,
	VectorKeyframeTrack,
	type BufferGeometry,
	type Material,
	type Object3D
} from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	normalizeCharacterAppearance,
	type CharacterAppearanceV1,
	type CharacterBodyType as AppearanceBodyType
} from '../character/CharacterAppearance';
import { HumanoidRig } from './HumanoidRig';
import { createFallbackHumanoidClips } from './HumanoidAnimationController';
import type { HumanoidPose } from './HumanoidPose';

/**
 * Runtime wrapper around the procedural Orelunza rig — rewritten.
 *
 * Responsibilities:
 *   - own one HumanoidRig (geometry + materials);
 *   - own the procedural animation clip set used by the mixer backend;
 *   - expose on-demand metrics for the performance HUD;
 *   - forward appearance and pose changes to the rig.
 *
 * The former imported-model / retarget surface is preserved as inert
 * compatibility shims (all counters zero) because the debug UI and diagnostics
 * still read those shapes. No GLB / FBX / Mixamo asset is ever loaded — the
 * citizen is always procedural.
 */

/** Public compatibility re-export used by player code. */
export type CharacterBodyType = AppearanceBodyType;

export type HumanoidModelSource = 'procedural-fallback';
export type HumanoidLoadStatus = 'loading' | 'ready' | 'failed';

export interface HumanoidModelMetrics {
	objectCount: number;
	meshCount: number;
	skinnedMeshCount: number;
	materialCount: number;
	boneCount: number;
	triangles: number;
}

export interface HumanoidSourceAsset {
	scene: Object3D;
	clips: AnimationClip[];
	clipNames: string[];
	metrics: HumanoidModelMetrics;
	sourceKind: HumanoidModelSource;
	sourceDescription: string;
	retarget: HumanoidRetargetDiagnostics;
}

/** Inert retarget diagnostics: the procedural rig retargets nothing. */
export interface HumanoidRetargetDiagnostics {
	retargetedClipCount: number;
	targetSkeletonBoneCount: number;
	sourceSkeletonBoneCount: number;
	matchedTrackCount: number;
	ignoredTrackCount: number;
	essentialBones: Record<string, string>;
	boneMapping: Record<string, string>;
}

const MODEL_OFFSET_Y = 0.12;
const SOURCE_DESCRIPTION =
	'Lightweight procedural Orelunza citizen generated directly with Three.js';

export class HumanoidModel {
	readonly object: Object3D;
	readonly isRiggedHumanoid = true;
	readonly animationRoot: Object3D;
	readonly source: HumanoidModelSource = 'procedural-fallback';
	readonly clips: AnimationClip[];
	readonly modelOffsetY = MODEL_OFFSET_Y;
	readonly retarget: HumanoidRetargetDiagnostics = emptyRetargetDiagnostics();
	readonly rig: HumanoidRig;

	private disposed = false;

	private constructor(appearance: CharacterAppearanceV1) {
		const normalized = normalizeCharacterAppearance(appearance);

		this.rig = new HumanoidRig(normalized);
		this.object = this.rig.object;
		this.animationRoot = this.object;
		this.clips = createFallbackHumanoidClips();

		this.tagObject(normalized);
	}

	static async loadDefault(appearance: CharacterAppearanceV1): Promise<HumanoidModel> {
		return new HumanoidModel(appearance);
	}

	static createFallback(appearance: CharacterAppearanceV1): HumanoidModel {
		return new HumanoidModel(appearance);
	}

	get appearanceSnapshot(): CharacterAppearanceV1 {
		return normalizeCharacterAppearance(this.object.userData.appearance);
	}

	get animationNames(): string[] {
		return this.clips.map((clip) => clip.name);
	}

	/** Measured on demand: a hairstyle change adds or removes meshes. */
	get metrics(): HumanoidModelMetrics {
		return measureModel(this.object);
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		if (this.disposed) {
			return;
		}

		const normalized = normalizeCharacterAppearance(appearance);
		this.rig.updateAppearance(normalized);
		this.writeAppearanceMetadata(normalized);
	}

	applyPose(pose: HumanoidPose): void {
		if (!this.disposed) {
			this.rig.applyPose(pose);
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.rig.dispose();

		for (const clip of this.clips) {
			clip.resetDuration();
		}

		this.clips.length = 0;
		this.object.clear();
		this.object.userData.disposed = true;
	}

	private tagObject(appearance: CharacterAppearanceV1): void {
		const data = this.object.userData;
		data.avatarPipeline = 'procedural-voxel';
		data.avatarStyle = 'orelunza-simple-voxel';
		data.avatarRole = 'peaceful-citizen-explorer';
		data.noMilitaryGear = true;
		data.modelSource = this.source;
		data.sourceDescription = SOURCE_DESCRIPTION;
		this.writeAppearanceMetadata(appearance);
	}

	private writeAppearanceMetadata(appearance: CharacterAppearanceV1): void {
		this.object.userData.appearance = appearance;
		this.object.userData.requestedBodyType = appearance.bodyType;
	}
}

// ---------------------------------------------------------------------------
// Pure clip-name / bone-name utilities.
//
// These are exact-contract helpers used by tooling and by the test suite. They
// map arbitrary imported filenames and skeleton names to Orelunza's canonical
// vocabulary so that a future GLB pipeline could plug in without touching the
// player code. They perform no side effects.
// ---------------------------------------------------------------------------

const CLIP_ALIASES: Readonly<Record<string, string>> = {
	idle: 'idle',
	base_idle: 'idle',
	idle_loop: 'idle',
	walk: 'walk',
	walking: 'walk',
	walk_forward: 'walk',
	walking_forward: 'walk',
	run: 'run',
	running: 'run',
	run_forward: 'run',
	strafe_left: 'strafe_left',
	left_strafe: 'strafe_left',
	strafe_right: 'strafe_right',
	right_strafe: 'strafe_right',
	walk_backward: 'walk_backward',
	walking_backward: 'walk_backward',
	walking_backwards: 'walk_backward',
	backward_walk: 'walk_backward',
	jump: 'jump',
	jump_start: 'jump',
	fall: 'fall',
	falling: 'fall',
	falling_idle: 'fall',
	airborne: 'fall',
	land: 'land',
	landing: 'land',
	reaction_shoved: 'reaction_shoved',
	reaction_shoved_spin: 'reaction_shoved',
	shoved_reaction_with_spin: 'reaction_shoved'
};

export function canonicalClipNameFromAsset(assetName: string): string | null {
	const leaf = assetName
		.toLowerCase()
		.replace(/\\/g, '/')
		.split(/[/|]/)
		.at(-1)
		?.replace(/\.(fbx|glb|gltf)$/i, '')
		.replace(/\.\d+$/, '')
		.replace(/[\s-]+/g, '_')
		.replace(/^(?:action|animation)_/, '')
		.trim();

	if (!leaf) {
		return null;
	}

	return CLIP_ALIASES[leaf] ?? null;
}

/**
 * Zero the horizontal (X/Z) components of a Mixamo hip position track while
 * keeping vertical bob. Clones each track so interpolation mode is preserved.
 */
export function neutralizeRootMotionHorizontal(clip: AnimationClip): AnimationClip {
	const tracks = clip.tracks.map((sourceTrack) => {
		const track = sourceTrack.clone();
		const bone = normalizeMixamoBoneName(trackTargetName(track.name));
		const property = trackPropertyName(track.name);
		const isHipPosition =
			(bone === 'hip' || bone === 'hips') &&
			property === 'position' &&
			track instanceof VectorKeyframeTrack &&
			track.values.length % 3 === 0;

		if (!isHipPosition) {
			return track;
		}

		for (let index = 0; index < track.values.length; index += 3) {
			track.values[index] = 0;
			track.values[index + 2] = 0;
		}

		return track;
	});

	return new AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

export function normalizeMixamoBoneName(name: string): string {
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

export function normalizeReallusionBoneName(name: string): string {
	return normalizeMixamoBoneName(name);
}

export function countClipTrackMatches(
	clip: AnimationClip,
	root: Object3D
): {
	totalTrackCount: number;
	matchedTrackCount: number;
	unmatchedTrackCount: number;
	matchedBoneNames: string[];
} {
	const objectNames = new Set<string>();

	root.traverse((child) => {
		if (child.name) {
			objectNames.add(normalizeMixamoBoneName(child.name));
		}
	});

	const matchedNames = new Set<string>();
	let matchedTrackCount = 0;

	for (const track of clip.tracks) {
		const targetName = normalizeMixamoBoneName(trackTargetName(track.name));

		if (targetName && objectNames.has(targetName)) {
			matchedTrackCount += 1;
			matchedNames.add(targetName);
		}
	}

	return {
		totalTrackCount: clip.tracks.length,
		matchedTrackCount,
		unmatchedTrackCount: clip.tracks.length - matchedTrackCount,
		matchedBoneNames: [...matchedNames].sort()
	};
}

export async function loadHumanoidSourceAsset(
	bodyType: CharacterBodyType = 'neutral_m'
): Promise<HumanoidSourceAsset> {
	const appearance = normalizeCharacterAppearance({ ...DEFAULT_CHARACTER_APPEARANCE, bodyType });
	const model = HumanoidModel.createFallback(appearance);

	return {
		scene: model.object,
		clips: model.clips,
		clipNames: model.animationNames,
		metrics: model.metrics,
		sourceKind: model.source,
		sourceDescription: SOURCE_DESCRIPTION,
		retarget: model.retarget
	};
}

export function measureHumanoidModel(object: Object3D): HumanoidModelMetrics {
	return measureModel(object);
}

function measureModel(object: Object3D): HumanoidModelMetrics {
	const materials = new Set<Material>();
	let objectCount = 0;
	let meshCount = 0;
	let skinnedMeshCount = 0;
	let boneCount = 0;
	let triangles = 0;

	object.traverse((child) => {
		objectCount += 1;

		if (child instanceof Bone) {
			boneCount += 1;
		}

		if (!(child instanceof Mesh)) {
			return;
		}

		meshCount += 1;

		if (child instanceof SkinnedMesh) {
			skinnedMeshCount += 1;
		}

		for (const material of asMaterialArray(child.material)) {
			materials.add(material);
		}

		triangles += geometryTriangleCount(child.geometry as BufferGeometry);
	});

	return {
		objectCount,
		meshCount,
		skinnedMeshCount,
		materialCount: materials.size,
		boneCount,
		triangles: Math.round(triangles)
	};
}

function geometryTriangleCount(geometry: BufferGeometry): number {
	const index = geometry.getIndex();
	const position = geometry.getAttribute('position');
	const availableCount = index?.count ?? position?.count ?? 0;
	const drawCount = Number.isFinite(geometry.drawRange.count)
		? Math.min(availableCount, Math.max(0, geometry.drawRange.count))
		: availableCount;

	return drawCount / 3;
}

function trackTargetName(trackName: string): string {
	const bracket = trackName.match(/\.bones\[([^\]]+)\]/);

	if (bracket) {
		return bracket[1];
	}

	const separator = trackName.lastIndexOf('.');
	return separator >= 0 ? trackName.slice(0, separator) : trackName;
}

function trackPropertyName(trackName: string): string {
	const separator = trackName.lastIndexOf('.');
	return separator >= 0 ? trackName.slice(separator + 1) : '';
}

function asMaterialArray(material: Material | Material[]): Material[] {
	return Array.isArray(material) ? material : [material];
}

function emptyRetargetDiagnostics(): HumanoidRetargetDiagnostics {
	return {
		retargetedClipCount: 0,
		targetSkeletonBoneCount: 0,
		sourceSkeletonBoneCount: 0,
		matchedTrackCount: 0,
		ignoredTrackCount: 0,
		essentialBones: {},
		boneMapping: {}
	};
}
