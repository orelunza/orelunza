import {
	BoxGeometry,
	Group,
	Mesh,
	MeshLambertMaterial,
	type BufferGeometry,
	type Material
} from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import type { HumanoidPose } from './HumanoidPose';

/**
 * Orelunza procedural humanoid proportions.
 *
 * The joint layout intentionally remains compatible with the previous rig so
 * PlayerAvatar, HumanoidAnimator and the debug tools can continue to use the
 * same public joint names.
 */
export const HUMANOID_PROPORTIONS = {
	height: 1.82,
	hipsY: 0.82,
	spineY: 0.18,
	chestY: 0.36,
	neckY: 0.36,
	headY: 0.22,
	shoulderX: 0.34,
	shoulderY: 0.22,
	upperArm: 0.34,
	forearm: 0.32,
	thigh: 0.43,
	shin: 0.43,
	foot: 0.34
} as const;

export interface HumanoidRigJointMap {
	avatarRoot: Group;
	hips: Group;
	spine: Group;
	chest: Group;
	neck: Group;
	head: Group;
	face: Group;
	hair: Group;
	shoulderLeft: Group;
	upperArmLeft: Group;
	forearmLeft: Group;
	handLeft: Group;
	shoulderRight: Group;
	upperArmRight: Group;
	forearmRight: Group;
	handRight: Group;
	thighLeft: Group;
	shinLeft: Group;
	footLeft: Group;
	shoeLeft: Group;
	thighRight: Group;
	shinRight: Group;
	footRight: Group;
	shoeRight: Group;
}

type HumanoidMaterialRole = 'skin' | 'hair' | 'shirt' | 'pants' | 'shoes' | 'face';

/** One shared 12-triangle box for most body parts. */
const BOX_GEOMETRY = new BoxGeometry(1, 1, 1);

/** A slightly narrower top gives the head an Orelunza-specific silhouette. */
const HEAD_GEOMETRY = createTaperedBoxGeometry({
	bottomX: 1,
	topX: 0.9,
	bottomZ: 1,
	topZ: 0.94
});

/** Wider shoulders and a smaller waist, without adding geometry. */
const TORSO_GEOMETRY = createTaperedBoxGeometry({
	bottomX: 0.78,
	topX: 1,
	bottomZ: 0.94,
	topZ: 1
});

/** A subtly tapered pelvis avoids a perfectly rectangular silhouette. */
const PELVIS_GEOMETRY = createTaperedBoxGeometry({
	bottomX: 0.92,
	topX: 1,
	bottomZ: 0.96,
	topZ: 1
});

export class HumanoidRig {
	readonly object = new Group();
	readonly joints: HumanoidRigJointMap;

	private readonly materials: Material[] = [];
	private readonly materialByRole = new Map<HumanoidMaterialRole, MeshLambertMaterial>();
	private readonly meshes: Mesh[] = [];
	private readonly eyeLeft: Mesh;
	private readonly eyeRight: Mesh;
	private readonly eyelidLeft: Mesh;
	private readonly eyelidRight: Mesh;
	private appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE;

	constructor(appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE) {
		this.object.name = 'avatarRoot';
		this.object.userData.avatarStyle = 'orelunza-simple-voxel';
		this.object.userData.rigKind = 'procedural-joint-groups';

		this.joints = this.createJoints();
		this.object.add(this.joints.hips);
		this.buildSkeleton();

		const face = this.buildFace();
		this.eyeLeft = face.eyeLeft;
		this.eyeRight = face.eyeRight;
		this.eyelidLeft = face.eyelidLeft;
		this.eyelidRight = face.eyelidRight;

		this.updateAppearance(appearance);
		this.applyPose({
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
		});
	}

	get objectCount(): number {
		return countObjects(this.object);
	}

	get triangleCount(): number {
		let triangles = 0;

		for (const mesh of this.meshes) {
			const geometry = mesh.geometry;
			const index = geometry.getIndex();
			const position = geometry.getAttribute('position');
			triangles += (index?.count ?? position?.count ?? 0) / 3;
		}

		return Math.round(triangles);
	}

	get meshCount(): number {
		return this.meshes.length;
	}

	get appearanceSnapshot(): CharacterAppearanceV1 {
		return this.appearance;
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		this.appearance = appearance;
		this.material('skin').color.set(appearance.skinTone);
		this.material('hair').color.set(appearance.hairColor);
		this.material('shirt').color.set(appearance.shirtColor);
		this.material('pants').color.set(appearance.pantsColor);
		this.material('shoes').color.set(appearance.shoesColor);

		this.clearHair();
		this.buildHair(appearance.hairStyle);
	}

	applyPose(pose: HumanoidPose): void {
		this.joints.hips.position.y = HUMANOID_PROPORTIONS.hipsY + pose.rootBob;
		this.joints.hips.rotation.set(0, pose.hipsYaw, pose.hipsRoll);
		this.joints.chest.rotation.set(pose.chestPitch, pose.chestYaw, -pose.hipsRoll * 0.55);
		this.joints.neck.rotation.set(pose.headPitch * 0.35, pose.neckYaw, 0);
		this.joints.head.rotation.set(pose.headPitch * 0.65, pose.headYaw, 0);
		this.joints.shoulderLeft.rotation.set(pose.leftShoulderPitch, 0, pose.leftShoulderRoll);
		this.joints.shoulderRight.rotation.set(pose.rightShoulderPitch, 0, pose.rightShoulderRoll);
		this.joints.forearmLeft.rotation.x = pose.leftElbowPitch;
		this.joints.forearmRight.rotation.x = pose.rightElbowPitch;
		this.joints.thighLeft.rotation.set(pose.leftHipPitch, 0, pose.leftHipRoll);
		this.joints.thighRight.rotation.set(pose.rightHipPitch, 0, pose.rightHipRoll);
		this.joints.shinLeft.rotation.x = pose.leftKneePitch;
		this.joints.shinRight.rotation.x = pose.rightKneePitch;
		this.joints.footLeft.rotation.x = pose.leftAnklePitch;
		this.joints.footRight.rotation.x = pose.rightAnklePitch;
		this.joints.footLeft.position.y = -HUMANOID_PROPORTIONS.shin + pose.leftFootLift;
		this.joints.footRight.position.y = -HUMANOID_PROPORTIONS.shin + pose.rightFootLift;

		const blinking = pose.blink > 0.45;
		this.eyeLeft.visible = !blinking;
		this.eyeRight.visible = !blinking;
		this.eyelidLeft.visible = blinking;
		this.eyelidRight.visible = blinking;
	}

	dispose(): void {
		for (const material of this.materials) {
			material.dispose();
		}

		this.materials.length = 0;
		this.materialByRole.clear();
		this.meshes.length = 0;
	}

	private createJoints(): HumanoidRigJointMap {
		return {
			avatarRoot: this.object,
			hips: joint('hips', 0, HUMANOID_PROPORTIONS.hipsY, 0),
			spine: joint('spine', 0, HUMANOID_PROPORTIONS.spineY, 0),
			chest: joint('chest', 0, HUMANOID_PROPORTIONS.chestY, 0),
			neck: joint('neck', 0, HUMANOID_PROPORTIONS.neckY, 0),
			head: joint('head', 0, HUMANOID_PROPORTIONS.headY, 0),
			face: joint('face', 0, 0, 0),
			hair: joint('hair', 0, 0, 0),
			shoulderLeft: joint(
				'shoulderLeft',
				-HUMANOID_PROPORTIONS.shoulderX,
				HUMANOID_PROPORTIONS.shoulderY,
				0
			),
			upperArmLeft: joint('upperArmLeft', 0, -0.02, 0),
			forearmLeft: joint('forearmLeft', 0, -HUMANOID_PROPORTIONS.upperArm, 0),
			handLeft: joint('handLeft', 0, -HUMANOID_PROPORTIONS.forearm, 0),
			shoulderRight: joint(
				'shoulderRight',
				HUMANOID_PROPORTIONS.shoulderX,
				HUMANOID_PROPORTIONS.shoulderY,
				0
			),
			upperArmRight: joint('upperArmRight', 0, -0.02, 0),
			forearmRight: joint('forearmRight', 0, -HUMANOID_PROPORTIONS.upperArm, 0),
			handRight: joint('handRight', 0, -HUMANOID_PROPORTIONS.forearm, 0),
			thighLeft: joint('thighLeft', -0.18, -0.06, 0),
			shinLeft: joint('shinLeft', 0, -HUMANOID_PROPORTIONS.thigh, 0),
			footLeft: joint('footLeft', 0, -HUMANOID_PROPORTIONS.shin, 0),
			shoeLeft: joint('shoeLeft', 0, 0, -0.08),
			thighRight: joint('thighRight', 0.18, -0.06, 0),
			shinRight: joint('shinRight', 0, -HUMANOID_PROPORTIONS.thigh, 0),
			footRight: joint('footRight', 0, -HUMANOID_PROPORTIONS.shin, 0),
			shoeRight: joint('shoeRight', 0, 0, -0.08)
		};
	}

	private buildSkeleton(): void {
		const j = this.joints;

		j.hips.add(j.spine, j.thighLeft, j.thighRight);
		j.spine.add(j.chest);
		j.chest.add(j.neck, j.shoulderLeft, j.shoulderRight);
		j.neck.add(j.head);
		j.head.add(j.face, j.hair);
		j.shoulderLeft.add(j.upperArmLeft);
		j.upperArmLeft.add(j.forearmLeft);
		j.forearmLeft.add(j.handLeft);
		j.shoulderRight.add(j.upperArmRight);
		j.upperArmRight.add(j.forearmRight);
		j.forearmRight.add(j.handRight);
		j.thighLeft.add(j.shinLeft);
		j.shinLeft.add(j.footLeft);
		j.footLeft.add(j.shoeLeft);
		j.thighRight.add(j.shinRight);
		j.shinRight.add(j.footRight);
		j.footRight.add(j.shoeRight);

		// One pelvis and one torso replace the previous rounded multi-piece body.
		this.addPart(j.hips, PELVIS_GEOMETRY, 'pants', 0.43, 0.23, 0.28, 0, 0.04, 0);
		this.addPart(j.chest, TORSO_GEOMETRY, 'shirt', 0.58, 0.6, 0.3, 0, -0.16, 0);
		this.addPart(j.neck, BOX_GEOMETRY, 'skin', 0.11, 0.13, 0.11, 0, 0.03, 0);
		this.addPart(j.head, HEAD_GEOMETRY, 'skin', 0.48, 0.46, 0.42, 0, 0.02, -0.01);

		this.buildArm(j.upperArmLeft, j.forearmLeft, j.handLeft, -1);
		this.buildArm(j.upperArmRight, j.forearmRight, j.handRight, 1);
		this.buildLeg(j.thighLeft, j.shinLeft, j.shoeLeft);
		this.buildLeg(j.thighRight, j.shinRight, j.shoeRight);
	}

	private buildFace(): {
		eyeLeft: Mesh;
		eyeRight: Mesh;
		eyelidLeft: Mesh;
		eyelidRight: Mesh;
	} {
		const face = this.joints.face;
		const frontZ = -0.225;

		const eyeLeft = this.addPart(
			face,
			BOX_GEOMETRY,
			'face',
			0.052,
			0.07,
			0.014,
			-0.105,
			0.055,
			frontZ
		);
		const eyeRight = this.addPart(
			face,
			BOX_GEOMETRY,
			'face',
			0.052,
			0.07,
			0.014,
			0.105,
			0.055,
			frontZ
		);
		const eyelidLeft = this.addPart(
			face,
			BOX_GEOMETRY,
			'face',
			0.064,
			0.012,
			0.014,
			-0.105,
			0.055,
			frontZ - 0.001
		);
		const eyelidRight = this.addPart(
			face,
			BOX_GEOMETRY,
			'face',
			0.064,
			0.012,
			0.014,
			0.105,
			0.055,
			frontZ - 0.001
		);

		eyelidLeft.visible = false;
		eyelidRight.visible = false;

		// The face stays intentionally minimal: two eyes and one small mouth.
		this.addPart(face, BOX_GEOMETRY, 'face', 0.082, 0.014, 0.014, 0, -0.085, frontZ);

		return {
			eyeLeft,
			eyeRight,
			eyelidLeft,
			eyelidRight
		};
	}

	private buildArm(upperArm: Group, forearm: Group, hand: Group, side: -1 | 1): void {
		this.addPart(
			upperArm,
			BOX_GEOMETRY,
			'shirt',
			0.16,
			HUMANOID_PROPORTIONS.upperArm,
			0.16,
			side * 0.012,
			-HUMANOID_PROPORTIONS.upperArm * 0.5,
			0
		);
		this.addPart(
			forearm,
			BOX_GEOMETRY,
			'skin',
			0.145,
			HUMANOID_PROPORTIONS.forearm,
			0.145,
			0,
			-HUMANOID_PROPORTIONS.forearm * 0.5,
			0
		);
		this.addPart(hand, BOX_GEOMETRY, 'skin', 0.16, 0.11, 0.15, 0, -0.055, -0.005);
	}

	private buildLeg(thigh: Group, shin: Group, shoe: Group): void {
		this.addPart(
			thigh,
			BOX_GEOMETRY,
			'pants',
			0.2,
			HUMANOID_PROPORTIONS.thigh,
			0.21,
			0,
			-HUMANOID_PROPORTIONS.thigh * 0.5,
			0
		);
		this.addPart(
			shin,
			BOX_GEOMETRY,
			'pants',
			0.18,
			HUMANOID_PROPORTIONS.shin,
			0.19,
			0,
			-HUMANOID_PROPORTIONS.shin * 0.5,
			0
		);
		this.addPart(shoe, BOX_GEOMETRY, 'shoes', 0.22, 0.11, 0.36, 0, -0.045, -0.085);
	}

	private buildHair(style: CharacterAppearanceV1['hairStyle']): void {
		const hair = this.joints.hair;

		if (style === 'none') {
			return;
		}

		if (style === 'shaved') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.455, 0.075, 0.395, 0, 0.22, -0.008);
			return;
		}

		// A shared block cap is used by every non-shaved style.
		this.addPart(hair, BOX_GEOMETRY, 'hair', 0.5, 0.13, 0.44, 0, 0.205, -0.002);

		if (style === 'short') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.18, 0.075, 0.05, -0.115, 0.125, -0.218);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.16, 0.06, 0.05, 0.105, 0.135, -0.218);
			return;
		}

		if (style === 'curly') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.18, 0.15, 0.16, -0.145, 0.205, -0.03);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.18, 0.17, 0.16, 0.145, 0.215, -0.03);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.18, 0.15, 0.15, 0, 0.255, -0.02);
			return;
		}

		if (style === 'afro') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.24, 0.22, 0.23, -0.16, 0.235, -0.01);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.24, 0.22, 0.23, 0.16, 0.235, -0.01);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.25, 0.22, 0.22, 0, 0.31, 0);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.42, 0.17, 0.16, 0, 0.22, 0.14);
			return;
		}

		if (style === 'long') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.13, 0.4, 0.11, -0.215, -0.015, 0.035);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.13, 0.4, 0.11, 0.215, -0.015, 0.035);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.42, 0.42, 0.1, 0, -0.02, 0.185);
			return;
		}

		if (style === 'braids_simple') {
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.075, 0.4, 0.075, -0.17, -0.045, 0.11);
			this.addPart(hair, BOX_GEOMETRY, 'hair', 0.075, 0.4, 0.075, 0.17, -0.045, 0.11);
		}
	}

	private clearHair(): void {
		const hair = this.joints.hair;

		for (let index = hair.children.length - 1; index >= 0; index -= 1) {
			const child = hair.children[index];
			hair.remove(child);

			if (!(child instanceof Mesh)) {
				continue;
			}

			const meshIndex = this.meshes.indexOf(child);

			if (meshIndex >= 0) {
				this.meshes.splice(meshIndex, 1);
			}
		}
	}

	private addPart(
		parent: Group,
		geometry: BufferGeometry,
		role: HumanoidMaterialRole,
		width: number,
		height: number,
		depth: number,
		x: number,
		y: number,
		z: number
	): Mesh {
		const mesh = new Mesh(geometry, this.material(role));
		mesh.name = role;
		mesh.scale.set(width, height, depth);
		mesh.position.set(x, y, z);
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		mesh.userData.avatarPart = role;
		parent.add(mesh);
		this.meshes.push(mesh);

		return mesh;
	}

	private material(role: HumanoidMaterialRole): MeshLambertMaterial {
		const cached = this.materialByRole.get(role);

		if (cached) {
			return cached;
		}

		const material = new MeshLambertMaterial({
			color: role === 'face' ? 0x1d1716 : 0xffffff,
			flatShading: true
		});
		material.name = `avatar-${role}`;

		this.materialByRole.set(role, material);
		this.materials.push(material);

		return material;
	}
}

interface TaperedBoxOptions {
	bottomX: number;
	topX: number;
	bottomZ: number;
	topZ: number;
}

function createTaperedBoxGeometry(options: TaperedBoxOptions): BoxGeometry {
	const geometry = new BoxGeometry(1, 1, 1);
	const position = geometry.getAttribute('position');

	for (let index = 0; index < position.count; index += 1) {
		const y = position.getY(index);
		const heightRatio = y + 0.5;
		const xScale = options.bottomX + (options.topX - options.bottomX) * heightRatio;
		const zScale = options.bottomZ + (options.topZ - options.bottomZ) * heightRatio;

		position.setX(index, position.getX(index) * xScale);
		position.setZ(index, position.getZ(index) * zScale);
	}

	position.needsUpdate = true;
	geometry.computeVertexNormals();

	return geometry;
}

function joint(name: string, x: number, y: number, z: number): Group {
	const group = new Group();
	group.name = name;
	group.position.set(x, y, z);

	return group;
}

function countObjects(group: Group): number {
	let count = 1;

	for (const child of group.children) {
		count += child instanceof Group ? countObjects(child) : 1;
	}

	return count;
}
