import {
	AnimationClip,
	Group,
	Mesh,
	SkinnedMesh,
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

export type HumanoidModelSource = 'fbx' | 'gltf' | 'procedural-fallback';
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
	sourceKind: 'mixamo-fbx';
	sourceDescription: string;
}

const CHARACTER_BASE_URL = '/assets/characters/orelunza-citizen/mixamo';
const MODEL_SOURCE_URL = `${CHARACTER_BASE_URL}/reaction-shoved-spin.fbx`;
const MODEL_SCALE = 0.01;
const MODEL_OFFSET_Y = 0;

export const MIXAMO_CLIP_URLS = {
	idle: `${CHARACTER_BASE_URL}/base-idle.fbx`,
	walk: `${CHARACTER_BASE_URL}/walk.fbx`,
	run: `${CHARACTER_BASE_URL}/run.fbx`,
	strafe_left: `${CHARACTER_BASE_URL}/strafe-left.fbx`,
	strafe_right: `${CHARACTER_BASE_URL}/strafe-right.fbx`,
	walk_backward: `${CHARACTER_BASE_URL}/walk-backward.fbx`,
	jump: `${CHARACTER_BASE_URL}/jump.fbx`,
	fall: `${CHARACTER_BASE_URL}/fall.fbx`,
	land: `${CHARACTER_BASE_URL}/land.fbx`,
	reaction_shoved: `${CHARACTER_BASE_URL}/reaction-shoved-spin.fbx`
} as const;

let sourceAssetPromise: Promise<HumanoidSourceAsset> | null = null;

export class HumanoidModel {
	readonly object = new Group();
	readonly isRiggedHumanoid = true;
	readonly animationRoot: Object3D;
	private constructor(
		readonly source: HumanoidModelSource,
		readonly rig: HumanoidRig | null,
		modelObject: Object3D,
		readonly clips: AnimationClip[],
		private readonly ownsInstanceResources: boolean,
		readonly modelOffsetY = MODEL_OFFSET_Y
	) {
		this.object.name = 'avatarRoot';
		this.object.userData.avatarPipeline = source === 'fbx' ? 'fbx-rigged' : 'gltf-ready-fallback';
		this.object.userData.avatarRole = 'peaceful-citizen-explorer';
		this.object.userData.noMilitaryGear = true;
		this.object.add(modelObject);
		this.animationRoot =
			source === 'fbx' ? (findPrimarySkeletonRoot(modelObject) ?? modelObject) : this.object;
	}

	static async loadDefault(appearance: CharacterAppearanceV1): Promise<HumanoidModel> {
		const asset = await loadHumanoidSourceAsset();
		const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
		const instance = clone(asset.scene);
		const model = new HumanoidModel('fbx', null, instance, asset.clips, false, MODEL_OFFSET_Y);

		model.withAppearance(appearance);

		return model;
	}

	static createFallback(appearance: CharacterAppearanceV1): HumanoidModel {
		const rig = new HumanoidRig(normalizeCharacterAppearance(appearance));

		return new HumanoidModel(
			'procedural-fallback',
			rig,
			rig.object,
			createFallbackHumanoidClips(),
			false,
			0.12
		).withAppearance(appearance);
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

		if (this.ownsInstanceResources) {
			this.object.traverse((child) => {
				if (!(child instanceof Mesh)) {
					return;
				}

				child.geometry.dispose();
				disposeMaterial(child.material);
			});
		}

		this.object.clear();
	}

	private withAppearance(appearance: CharacterAppearanceV1): HumanoidModel {
		const normalized = normalizeCharacterAppearance(appearance);

		this.rig?.updateAppearance(normalized);
		this.object.userData.appearance = normalized;

		return this;
	}
}

export function canonicalClipNameFromAsset(assetName: string): string | null {
	const normalized = assetName.toLowerCase().replace(/\\/g, '/').split('/').at(-1) ?? assetName;

	if (normalized === 'base-idle.fbx' || normalized === 'idle.fbx') return 'idle';
	if (normalized === 'walk.fbx' || normalized === 'walking.fbx') return 'walk';
	if (normalized === 'run.fbx' || normalized === 'running.fbx') return 'run';
	if (normalized === 'strafe-left.fbx' || normalized === 'left strafe.fbx') return 'strafe_left';
	if (normalized === 'strafe-right.fbx' || normalized === 'right strafe.fbx') return 'strafe_right';
	if (normalized === 'walk-backward.fbx' || normalized === 'walking backwards.fbx') {
		return 'walk_backward';
	}
	if (normalized === 'jump.fbx') return 'jump';
	if (normalized === 'fall.fbx' || normalized === 'falling idle.fbx') return 'fall';
	if (normalized === 'land.fbx' || normalized === 'landing.fbx') return 'land';
	if (normalized === 'reaction-shoved-spin.fbx' || normalized === 'shoved reaction with spin.fbx') {
		return 'reaction_shoved';
	}

	return null;
}

export function neutralizeRootMotionHorizontal(clip: AnimationClip): AnimationClip {
	const tracks = clip.tracks.map((track) => {
		const [targetName, propertyName] = track.name.split('.');

		if (normalizeMixamoBoneName(targetName) !== 'hips' || propertyName !== 'position') {
			return track.clone();
		}

		const values = Array.from(track.values);

		for (let index = 0; index < values.length; index += 3) {
			values[index] = 0;
			values[index + 2] = 0;
		}

		return new VectorKeyframeTrack(track.name, Array.from(track.times), values);
	});

	return new AnimationClip(clip.name, clip.duration, tracks);
}

export function normalizeMixamoBoneName(name: string): string {
	return name
		.replace(/\\/g, '/')
		.split('/')
		.at(-1)!
		.replace(/^.*:/, '')
		.replace(/^mixamorig/i, '')
		.replace(/^beta[_-]?joints:?/i, '')
		.replace(/[^a-z0-9]/gi, '')
		.toLowerCase();
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
		const boneName = normalizeMixamoBoneName(track.name.split('.')[0]);

		if (boneNames.has(boneName)) {
			matchedTrackCount += 1;
			matched.add(boneName);
		}
	}

	return {
		totalTrackCount: clip.tracks.length,
		matchedTrackCount,
		unmatchedTrackCount: clip.tracks.length - matchedTrackCount,
		matchedBoneNames: [...matched].sort()
	};
}

export async function loadHumanoidSourceAsset(): Promise<HumanoidSourceAsset> {
	sourceAssetPromise ??= loadHumanoidSourceAssetInternal();

	return sourceAssetPromise;
}

async function loadHumanoidSourceAssetInternal(): Promise<HumanoidSourceAsset> {
	const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
	const loader = new FBXLoader();
	const modelScene = await loader.loadAsync(MODEL_SOURCE_URL);

	prepareModelScene(modelScene);

	if (measureModel(modelScene).skinnedMeshCount <= 0) {
		throw new Error(`Humanoid model ${MODEL_SOURCE_URL} does not contain a SkinnedMesh.`);
	}

	const clips = await Promise.all(
		Object.entries(MIXAMO_CLIP_URLS).map(async ([name, url]) => {
			const root = await loader.loadAsync(url);
			const clip = root.animations[0];

			if (!clip) {
				throw new Error(`Mixamo asset ${url} does not contain an animation clip.`);
			}

			const renamed = clip.clone();
			renamed.name = name;

			return neutralizeRootMotionHorizontal(renamed);
		})
	);
	const missing = validateRequiredHumanoidClips(clips);

	if (missing.length > 0) {
		throw new Error(`Missing required humanoid clips: ${missing.join(', ')}`);
	}

	return {
		scene: modelScene,
		clips,
		clipNames: clips.map((clip) => clip.name),
		metrics: measureModel(modelScene),
		sourceKind: 'mixamo-fbx',
		sourceDescription:
			'Mixamo FBX skeleton animations with the only available skinned mesh from reaction-shoved-spin.fbx'
	};
}

function prepareModelScene(scene: Object3D): void {
	scene.name = 'orelunzaCitizenFbx';
	scene.scale.setScalar(MODEL_SCALE);
	scene.position.y = MODEL_OFFSET_Y;
	scene.userData.avatarRole = 'peaceful-citizen-explorer';
	scene.userData.noMilitaryGear = true;
	scene.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}

		child.frustumCulled = false;
		child.castShadow = false;
		child.receiveShadow = false;
	});
}

function findPrimarySkeletonRoot(object: Object3D): Object3D | null {
	let primaryRoot: Object3D | null = null;

	object.traverse((child) => {
		if (primaryRoot || !(child instanceof SkinnedMesh)) {
			return;
		}

		primaryRoot = child.skeleton.bones[0] ?? null;
	});

	return primaryRoot;
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

		addMaterials(materials, child.material);

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

function addMaterials(materials: Set<Material>, material: Material | Material[]): void {
	if (Array.isArray(material)) {
		for (const item of material) {
			materials.add(item);
		}

		return;
	}

	materials.add(material);
}

function disposeMaterial(material: Material | Material[]): void {
	if (Array.isArray(material)) {
		for (const item of material) {
			item.dispose();
		}

		return;
	}

	material.dispose();
}
