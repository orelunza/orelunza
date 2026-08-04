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

/** Kept here as a public compatibility export for existing player code. */
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

/**
 * Compatibility diagnostics for the former imported-model pipeline.
 *
 * The procedural Orelunza citizen does not retarget external skeletons, so all
 * counters remain zero. Keeping this shape avoids special cases in the debug UI.
 */
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

/**
 * Runtime wrapper around the procedural voxel rig.
 *
 * The wrapper owns its rig, materials and animation clips. It intentionally
 * preserves the former asynchronous `loadDefault()` surface so PlayerAvatar can
 * later support streamed assets without another API migration.
 */
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

		this.object.userData.avatarPipeline = 'procedural-voxel';
		this.object.userData.avatarStyle = 'orelunza-simple-voxel';
		this.object.userData.avatarRole = 'peaceful-citizen-explorer';
		this.object.userData.noMilitaryGear = true;
		this.object.userData.modelSource = this.source;
		this.object.userData.sourceDescription = SOURCE_DESCRIPTION;
		this.writeAppearanceMetadata(normalized);
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

	/**
	 * Measured on demand because changing a hairstyle can add or remove meshes.
	 */
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

	private writeAppearanceMetadata(appearance: CharacterAppearanceV1): void {
		this.object.userData.appearance = appearance;
		this.object.userData.requestedBodyType = appearance.bodyType;
	}
}

/**
 * Normalize common imported animation filenames to Orelunza's canonical action
 * names. This remains useful for tools and for a possible future GLB pipeline.
 */
export function canonicalClipNameFromAsset(assetName: string): string | null {
	const leaf = assetName
		.toLowerCase()
		.replace(/\\/g, '/')
		.split(/[\/|]/)
		.at(-1)
		?.replace(/\.(fbx|glb|gltf)$/i, '')
		.replace(/\.\d+$/, '')
		.replace(/[\s-]+/g, '_')
		.replace(/^(?:action|animation)_/, '')
		.trim();

	if (!leaf) {
		return null;
	}

	const aliases: Readonly<Record<string, string>> = {
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

	return aliases[leaf] ?? null;
}

/**
 * Remove only horizontal translation from a hip root-motion track.
 *
 * Cloning and mutating the original track preserves its interpolation mode and
 * any future metadata instead of rebuilding it as a new track from scratch.
 */
export function neutralizeRootMotionHorizontal(clip: AnimationClip): AnimationClip {
	const tracks = clip.tracks.map((sourceTrack) => {
		const track = sourceTrack.clone();
		const targetName = trackTargetName(track.name);
		const propertyName = trackPropertyName(track.name);
		const canonicalBone = normalizeMixamoBoneName(targetName);

		if (
			(canonicalBone !== 'hip' && canonicalBone !== 'hips') ||
			propertyName !== 'position' ||
			!(track instanceof VectorKeyframeTrack)
		) {
			return track;
		}

		if (track.values.length % 3 !== 0) {
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

/**
 * Compatibility loader used by diagnostics and development tools.
 *
 * Each call returns an independently owned procedural scene. The caller owns
 * the returned scene and should dispose its materials through the corresponding
 * model/rig lifecycle when it is no longer needed.
 */
export async function loadHumanoidSourceAsset(
	bodyType: CharacterBodyType = 'neutral_m'
): Promise<HumanoidSourceAsset> {
	const appearance = normalizeCharacterAppearance({
		...DEFAULT_CHARACTER_APPEARANCE,
		bodyType
	});
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

	const propertySeparator = trackName.lastIndexOf('.');
	return propertySeparator >= 0 ? trackName.slice(0, propertySeparator) : trackName;
}

function trackPropertyName(trackName: string): string {
	const propertySeparator = trackName.lastIndexOf('.');
	return propertySeparator >= 0 ? trackName.slice(propertySeparator + 1) : '';
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
