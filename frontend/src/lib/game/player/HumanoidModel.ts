import {
	AnimationClip,
	Box3,
	Group,
	Mesh,
	SkinnedMesh,
	Vector3,
	VectorKeyframeTrack,
	type BufferGeometry,
	type Material,
	type Object3D
} from 'three';
import {
	normalizeCharacterAppearance,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import { HumanoidRig } from './HumanoidRig';
import {
	createFallbackHumanoidClips,
	validateRequiredHumanoidClips
} from './HumanoidAnimationController';
import type { HumanoidPose } from './HumanoidPose';

export type CharacterBodyType = 'neutral_m' | 'neutral_f';
export type HumanoidModelSource = 'gltf' | 'procedural-fallback';
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
 * Kept for compatibility with the existing diagnostics UI.
 * All retargeting values stay at zero because the GLB is baked in Blender.
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

export const ORELUNZA_CITIZEN_GLB_URL = '/assets/characters/orelunza-citizen/orelunza-citizen.glb';

const MODEL_OFFSET_Y = 0;
const MIN_MODEL_HEIGHT = 1.7;
const MAX_MODEL_HEIGHT = 1.9;

let sourceAssetPromise: Promise<HumanoidSourceAsset> | null = null;

export class HumanoidModel {
	readonly object = new Group();
	readonly isRiggedHumanoid = true;
	readonly animationRoot: Object3D;
	private readonly instanceMaterials: Material[];

	private constructor(
		readonly source: HumanoidModelSource,
		readonly rig: HumanoidRig | null,
		modelObject: Object3D,
		readonly clips: AnimationClip[],
		instanceMaterials: Material[] = [],
		readonly modelOffsetY = MODEL_OFFSET_Y,
		readonly retarget: HumanoidRetargetDiagnostics = emptyRetargetDiagnostics()
	) {
		this.object.name = 'avatarRoot';
		this.object.userData.avatarPipeline =
			source === 'gltf' ? 'gltf-prebaked' : 'procedural-fallback';
		this.object.userData.avatarRole = 'peaceful-citizen-explorer';
		this.object.userData.noMilitaryGear = true;
		this.object.add(modelObject);
		this.animationRoot = source === 'gltf' ? modelObject : this.object;
		this.instanceMaterials = instanceMaterials;
	}

	static async loadDefault(appearance: CharacterAppearanceV1): Promise<HumanoidModel> {
		const normalized = normalizeCharacterAppearance(appearance);
		const asset = await loadHumanoidSourceAsset(normalized.bodyType);
		const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
		const instance = clone(asset.scene);
		const instanceMaterials = cloneInstanceMaterials(instance);

		prepareModelInstance(instance);

		const model = new HumanoidModel(
			'gltf',
			null,
			instance,
			asset.clips,
			instanceMaterials,
			MODEL_OFFSET_Y,
			asset.retarget
		);

		model.object.userData.requestedBodyType = normalized.bodyType;
		model.withAppearance(normalized);

		return model;
	}

	/**
	 * Explicit diagnostic fallback only. The normal avatar pipeline never calls
	 * this method unless PlayerAvatar is created with allowFallback: true.
	 */
	static createFallback(appearance: CharacterAppearanceV1): HumanoidModel {
		const normalized = normalizeCharacterAppearance(appearance);
		const rig = new HumanoidRig(normalized);

		return new HumanoidModel(
			'procedural-fallback',
			rig,
			rig.object,
			createFallbackHumanoidClips(),
			[],
			0.12
		).withAppearance(normalized);
	}

	get appearanceSnapshot(): CharacterAppearanceV1 {
		return normalizeCharacterAppearance(this.object.userData.appearance as CharacterAppearanceV1);
	}

	get animationNames(): string[] {
		return this.clips.map((clip) => clip.name);
	}

	get metrics(): HumanoidModelMetrics {
		return measureModel(this.object);
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		this.withAppearance(appearance);
	}

	applyPose(pose: HumanoidPose): void {
		this.rig?.applyPose(pose);
	}

	dispose(): void {
		this.rig?.dispose();

		for (const material of this.instanceMaterials) {
			material.dispose();
		}

		this.instanceMaterials.length = 0;
		this.object.clear();
	}

	private withAppearance(appearance: CharacterAppearanceV1): HumanoidModel {
		const normalized = normalizeCharacterAppearance(appearance);

		this.rig?.updateAppearance(normalized);
		applyGltfAppearance(this.object, normalized);
		this.object.userData.appearance = normalized;

		return this;
	}
}

/**
 * Kept as a public helper because existing tests and diagnostics use it.
 * It now canonicalizes Blender/glTF action names as well as the old FBX names.
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
		.replace(/^.*action_/, '')
		.replace(/^.*animation_/, '')
		.trim();

	if (!leaf) {
		return null;
	}

	const aliases: Record<string, string> = {
		idle: 'idle',
		base_idle: 'idle',
		walk: 'walk',
		walking: 'walk',
		run: 'run',
		running: 'run',
		strafe_left: 'strafe_left',
		left_strafe: 'strafe_left',
		strafe_right: 'strafe_right',
		right_strafe: 'strafe_right',
		walk_backward: 'walk_backward',
		walking_backward: 'walk_backward',
		walking_backwards: 'walk_backward',
		jump: 'jump',
		fall: 'fall',
		falling: 'fall',
		falling_idle: 'fall',
		land: 'land',
		landing: 'land',
		reaction_shoved: 'reaction_shoved',
		reaction_shoved_spin: 'reaction_shoved',
		shoved_reaction_with_spin: 'reaction_shoved'
	};

	return aliases[leaf] ?? null;
}

/**
 * Compatibility helper kept for the existing unit tests. The production GLB
 * is already baked without horizontal root motion, so the runtime loader does
 * not call this function.
 */
export function neutralizeRootMotionHorizontal(clip: AnimationClip): AnimationClip {
	const tracks = clip.tracks.map((track) => {
		const targetName = trackTargetName(track.name);
		const propertyName = track.name.split('.').at(-1);
		const canonicalBone = normalizeMixamoBoneName(targetName);

		if ((canonicalBone !== 'hip' && canonicalBone !== 'hips') || propertyName !== 'position') {
			return track.clone();
		}

		const values = Array.from(track.values);

		if (values.length % 3 !== 0) {
			return track.clone();
		}

		for (let index = 0; index < values.length; index += 3) {
			values[index] = 0;
			values[index + 2] = 0;
		}

		return new VectorKeyframeTrack(track.name, Array.from(track.times), values);
	});

	return new AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Compatibility helper used by PlayerAvatar diagnostics. Despite its old name,
 * it simply creates a stable canonical bone name and performs no retargeting.
 */
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
	const boneNames = new Set<string>();

	root.traverse((child) => {
		if (child.type === 'Bone') {
			boneNames.add(normalizeMixamoBoneName(child.name));
		}
	});

	const matched = new Set<string>();
	let matchedTrackCount = 0;

	for (const track of clip.tracks) {
		const targetName = trackTargetName(track.name);
		const canonical = normalizeMixamoBoneName(targetName);

		if (boneNames.has(canonical)) {
			matchedTrackCount += 1;
			matched.add(canonical);
		}
	}

	return {
		totalTrackCount: clip.tracks.length,
		matchedTrackCount,
		unmatchedTrackCount: clip.tracks.length - matchedTrackCount,
		matchedBoneNames: [...matched].sort()
	};
}

export async function loadHumanoidSourceAsset(
	_bodyType: CharacterBodyType = 'neutral_m'
): Promise<HumanoidSourceAsset> {
	if (!sourceAssetPromise) {
		const pending = loadHumanoidSourceAssetInternal();
		sourceAssetPromise = pending;

		void pending.catch(() => {
			if (sourceAssetPromise === pending) {
				sourceAssetPromise = null;
			}
		});
	}

	return sourceAssetPromise;
}

async function loadHumanoidSourceAssetInternal(): Promise<HumanoidSourceAsset> {
	const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync(ORELUNZA_CITIZEN_GLB_URL);
	const scene = gltf.scene;

	scene.name = 'orelunzaCitizenGltfSource';
	prepareModelInstance(scene);

	const clips = canonicalizeClips(gltf.animations);
	const missing = validateRequiredHumanoidClips(clips);

	if (missing.length > 0) {
		throw new Error(
			`Orelunza citizen GLB is missing required animation clips: ${missing.join(', ')}`
		);
	}

	validateLoadedAsset(scene, clips);

	const metrics = measureModel(scene);
	const trackStats = clips.reduce(
		(result, clip) => {
			const stats = countClipTrackMatches(clip, scene);
			result.matched += stats.matchedTrackCount;
			result.unmatched += stats.unmatchedTrackCount;
			return result;
		},
		{ matched: 0, unmatched: 0 }
	);

	return {
		scene,
		clips,
		clipNames: clips.map((clip) => clip.name),
		metrics,
		sourceKind: 'gltf',
		sourceDescription:
			'Prebaked Reallusion Neutral_M citizen loaded from one GLB with Blender-baked animations',
		retarget: {
			retargetedClipCount: 0,
			targetSkeletonBoneCount: metrics.boneCount,
			sourceSkeletonBoneCount: 0,
			matchedTrackCount: trackStats.matched,
			ignoredTrackCount: trackStats.unmatched,
			essentialBones: collectEssentialBones(scene),
			boneMapping: {}
		}
	};
}

function canonicalizeClips(sourceClips: AnimationClip[]): AnimationClip[] {
	const byName = new Map<string, { clip: AnimationClip; exact: boolean }>();

	for (const sourceClip of sourceClips) {
		const canonicalName = canonicalClipNameFromAsset(sourceClip.name);

		if (!canonicalName) {
			continue;
		}

		const candidate = sourceClip.clone();
		candidate.name = canonicalName;

		const existing = byName.get(canonicalName);
		const sourceWasExact = sourceClip.name.toLowerCase() === canonicalName;

		if (!existing || (sourceWasExact && !existing.exact)) {
			byName.set(canonicalName, { clip: candidate, exact: sourceWasExact });
		}
	}

	return [...byName.values()].map((entry) => entry.clip);
}

function prepareModelInstance(root: Object3D): void {
	root.visible = true;
	root.updateMatrixWorld(true);

	root.traverse((child) => {
		child.visible = true;

		if (!(child instanceof Mesh)) {
			return;
		}

		child.frustumCulled = false;
		child.castShadow = false;
		child.receiveShadow = false;

		for (const material of asMaterialArray(child.material)) {
			material.visible = true;
			material.needsUpdate = true;
		}

		if (child instanceof SkinnedMesh) {
			child.normalizeSkinWeights();
		}
	});

	root.updateMatrixWorld(true);
}

function validateLoadedAsset(root: Object3D, clips: AnimationClip[]): void {
	const metrics = measureModel(root);

	if (metrics.skinnedMeshCount < 1) {
		throw new Error('Orelunza citizen GLB does not contain a SkinnedMesh.');
	}

	if (metrics.boneCount < 1) {
		throw new Error('Orelunza citizen GLB does not contain a skeleton.');
	}

	for (const clip of clips) {
		if (!Number.isFinite(clip.duration) || clip.duration <= 0) {
			throw new Error(`Animation ${clip.name} has an invalid duration.`);
		}

		if (clip.tracks.length === 0) {
			throw new Error(`Animation ${clip.name} contains no tracks.`);
		}
	}

	const bounds = new Box3().setFromObject(root);
	const size = bounds.getSize(new Vector3());

	if (![size.x, size.y, size.z].every(Number.isFinite)) {
		throw new Error('Orelunza citizen GLB has non-finite bounds.');
	}

	if (size.y < MIN_MODEL_HEIGHT || size.y > MAX_MODEL_HEIGHT) {
		throw new Error(
			`Orelunza citizen GLB height must be between ${MIN_MODEL_HEIGHT} and ` +
				`${MAX_MODEL_HEIGHT} metres, received ${size.y.toFixed(4)}.`
		);
	}

	if (size.x > 3 || size.z > 3) {
		throw new Error(
			`Orelunza citizen GLB bounds are incoherent: ` +
				`${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}.`
		);
	}
}

function cloneInstanceMaterials(root: Object3D): Material[] {
	const clones = new Map<Material, Material>();

	root.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}

		if (Array.isArray(child.material)) {
			child.material = child.material.map((material) => cloneMaterial(material, clones));
		} else {
			child.material = cloneMaterial(child.material, clones);
		}
	});

	return [...clones.values()];
}

function cloneMaterial(material: Material, clones: Map<Material, Material>): Material {
	const existing = clones.get(material);

	if (existing) {
		return existing;
	}

	const cloned = material.clone();
	clones.set(material, cloned);
	return cloned;
}

function applyGltfAppearance(root: Object3D, appearance: CharacterAppearanceV1): void {
	root.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}

		for (const material of asMaterialArray(child.material)) {
			const role = `${child.name} ${material.name}`.toLowerCase();

			if (/hair|brow/.test(role)) {
				setMaterialColor(material, appearance.hairColor);
			} else if (/shirt|tunic|top|uppercloth|upper_cloth/.test(role)) {
				setMaterialColor(material, appearance.shirtColor);
			} else if (/pants|trouser|lowercloth|lower_cloth/.test(role)) {
				setMaterialColor(material, appearance.pantsColor);
			} else if (/shoe|boot/.test(role)) {
				setMaterialColor(material, appearance.shoesColor);
			} else if (/skin|nail/.test(role)) {
				setMaterialColor(material, appearance.skinTone);
			}
		}
	});
}

function collectEssentialBones(root: Object3D): Record<string, string> {
	const wanted = new Map<string, string>([
		['hip', 'hips'],
		['spine01', 'spine'],
		['spine02', 'chest'],
		['necktwist01', 'neck'],
		['head', 'head'],
		['lhand', 'leftHand'],
		['rhand', 'rightHand'],
		['lthigh', 'leftUpperLeg'],
		['rthigh', 'rightUpperLeg'],
		['lfoot', 'leftFoot'],
		['rfoot', 'rightFoot']
	]);
	const result: Record<string, string> = {};

	root.traverse((child) => {
		if (child.type !== 'Bone') {
			return;
		}

		const canonical = normalizeReallusionBoneName(child.name);
		const role = wanted.get(canonical);

		if (role) {
			result[role] = child.name;
		}
	});

	return result;
}

function trackTargetName(trackName: string): string {
	const bracket = trackName.match(/\.bones\[([^\]]+)\]/);

	if (bracket) {
		return bracket[1];
	}

	const propertySeparator = trackName.lastIndexOf('.');
	return propertySeparator >= 0 ? trackName.slice(0, propertySeparator) : trackName;
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

		if (child.type === 'Bone') {
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

		const geometry = child.geometry as BufferGeometry;
		const index = geometry.getIndex();
		const position = geometry.getAttribute('position');
		triangles += (index?.count ?? position?.count ?? 0) / 3;
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

function asMaterialArray(material: Material | Material[]): Material[] {
	return Array.isArray(material) ? material : [material];
}

function setMaterialColor(material: Material, color: string): void {
	if (hasColor(material)) {
		material.color.set(color);
		material.needsUpdate = true;
	}
}

function hasColor(
	material: Material
): material is Material & { color: { set: (color: string) => void } } {
	return 'color' in material && typeof material.color === 'object' && material.color !== null;
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
