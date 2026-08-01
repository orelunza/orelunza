import {
	BoxGeometry,
	CapsuleGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshLambertMaterial,
	SphereGeometry,
	type BufferGeometry,
	type Material
} from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import type { HumanoidPose } from './HumanoidPose';

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

const HEAD_GEOMETRY = new SphereGeometry(0.5, 12, 8);
const EAR_GEOMETRY = new SphereGeometry(0.5, 8, 6);
const EYE_GEOMETRY = new SphereGeometry(0.5, 8, 6);
const BODY_GEOMETRY = new CapsuleGeometry(0.5, 0.55, 4, 10);
const LIMB_GEOMETRY = new CapsuleGeometry(0.5, 0.45, 4, 8);
const HAND_GEOMETRY = new SphereGeometry(0.5, 8, 6);
const FOOT_GEOMETRY = new BoxGeometry(1, 1, 1);
const NOSE_GEOMETRY = new CylinderGeometry(0.04, 0.055, 0.12, 6);
const MOUTH_GEOMETRY = new BoxGeometry(1, 1, 1);
const HAIR_CAP_GEOMETRY = new SphereGeometry(0.52, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
const HAIR_LOCK_GEOMETRY = new CapsuleGeometry(0.5, 0.3, 3, 6);
const BRAID_GEOMETRY = new CapsuleGeometry(0.5, 0.42, 3, 6);

export class HumanoidRig {
	readonly object = new Group();
	readonly joints: HumanoidRigJointMap;
	private readonly materials: Material[] = [];
	private readonly materialByRole = new Map<string, MeshLambertMaterial>();
	private readonly meshes: Mesh[] = [];
	private readonly eyelidLeft: Mesh;
	private readonly eyelidRight: Mesh;
	private appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE;

	constructor(appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE) {
		this.object.name = 'avatarRoot';
		this.joints = this.createJoints();
		this.object.add(this.joints.hips);
		this.buildSkeleton();
		this.eyelidLeft = this.addPart(
			this.joints.face,
			MOUTH_GEOMETRY,
			'face',
			0.115,
			0.006,
			0.052,
			-0.11,
			0.04,
			-0.244
		);
		this.eyelidRight = this.addPart(
			this.joints.face,
			MOUTH_GEOMETRY,
			'face',
			0.115,
			0.006,
			0.052,
			0.11,
			0.04,
			-0.244
		);
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
			const scale = Math.max(1, mesh.scale.x * mesh.scale.y * mesh.scale.z);

			triangles += Math.round(((index?.count ?? position.count) / 3) * Math.max(1, scale * 0 + 1));
		}

		return triangles;
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
		this.eyelidLeft.visible = pose.blink > 0.45;
		this.eyelidRight.visible = pose.blink > 0.45;
	}

	dispose(): void {
		for (const material of this.materials) {
			material.dispose();
		}

		this.materials.length = 0;
		this.materialByRole.clear();
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

		this.addPart(j.hips, BODY_GEOMETRY, 'pants', 0.34, 0.2, 0.24, 0, 0.04, 0);
		this.addPart(j.spine, BODY_GEOMETRY, 'shirt', 0.38, 0.36, 0.25, 0, 0.16, 0);
		this.addPart(j.chest, BODY_GEOMETRY, 'shirt', 0.52, 0.34, 0.28, 0, 0.04, 0);
		this.addPart(j.neck, LIMB_GEOMETRY, 'skin', 0.08, 0.11, 0.08, 0, 0.03, 0);
		this.addPart(j.head, HEAD_GEOMETRY, 'skin', 0.28, 0.31, 0.27, 0, 0.02, -0.01);
		this.addPart(j.face, EYE_GEOMETRY, 'face', 0.028, 0.02, 0.012, -0.095, 0.045, -0.255);
		this.addPart(j.face, EYE_GEOMETRY, 'face', 0.028, 0.02, 0.012, 0.095, 0.045, -0.255);
		this.addPart(j.face, MOUTH_GEOMETRY, 'face', 0.08, 0.01, 0.012, 0, -0.09, -0.265);
		this.addPart(j.face, NOSE_GEOMETRY, 'skin', 0.5, 0.5, 0.5, 0, -0.015, -0.27).rotation.x =
			Math.PI / 2;
		this.addPart(j.head, EAR_GEOMETRY, 'skin', 0.035, 0.06, 0.025, -0.285, 0.01, -0.005);
		this.addPart(j.head, EAR_GEOMETRY, 'skin', 0.035, 0.06, 0.025, 0.285, 0.01, -0.005);

		this.buildArm(j.upperArmLeft, j.forearmLeft, j.handLeft, -1);
		this.buildArm(j.upperArmRight, j.forearmRight, j.handRight, 1);
		this.buildLeg(j.thighLeft, j.shinLeft, j.footLeft, j.shoeLeft);
		this.buildLeg(j.thighRight, j.shinRight, j.footRight, j.shoeRight);
	}

	private buildArm(upperArm: Group, forearm: Group, hand: Group, side: -1 | 1): void {
		this.addPart(
			upperArm,
			LIMB_GEOMETRY,
			'shirt',
			0.085,
			0.22,
			0.085,
			side * 0.015,
			-HUMANOID_PROPORTIONS.upperArm * 0.5,
			0
		);
		this.addPart(
			forearm,
			LIMB_GEOMETRY,
			'skin',
			0.075,
			0.2,
			0.075,
			0,
			-HUMANOID_PROPORTIONS.forearm * 0.5,
			0
		);
		this.addPart(hand, HAND_GEOMETRY, 'skin', 0.08, 0.095, 0.065, 0, -0.04, 0);
		this.addPart(hand, HAND_GEOMETRY, 'skin', 0.025, 0.045, 0.025, side * 0.062, -0.02, -0.025);
	}

	private buildLeg(thigh: Group, shin: Group, foot: Group, shoe: Group): void {
		this.addPart(
			thigh,
			LIMB_GEOMETRY,
			'pants',
			0.11,
			0.27,
			0.1,
			0,
			-HUMANOID_PROPORTIONS.thigh * 0.5,
			0
		);
		this.addPart(
			shin,
			LIMB_GEOMETRY,
			'pants',
			0.095,
			0.26,
			0.09,
			0,
			-HUMANOID_PROPORTIONS.shin * 0.5,
			0
		);
		this.addPart(foot, FOOT_GEOMETRY, 'shoes', 0.18, 0.08, 0.34, 0, -0.035, -0.12);
		this.addPart(shoe, FOOT_GEOMETRY, 'shoes', 0.19, 0.07, 0.22, 0, -0.015, -0.08);
	}

	private buildHair(style: CharacterAppearanceV1['hairStyle']): void {
		const j = this.joints.hair;

		if (style === 'none' || style === 'shaved') {
			this.addPart(j, HAIR_CAP_GEOMETRY, 'hair', 0.285, 0.09, 0.27, 0, 0.13, -0.005);
			return;
		}

		this.addPart(j, HAIR_CAP_GEOMETRY, 'hair', 0.305, 0.18, 0.29, 0, 0.15, -0.005);

		if (style === 'short') {
			this.addPart(j, HAIR_LOCK_GEOMETRY, 'hair', 0.055, 0.09, 0.045, -0.12, 0.08, -0.2);
			this.addPart(j, HAIR_LOCK_GEOMETRY, 'hair', 0.055, 0.08, 0.045, 0.08, 0.07, -0.21);
		} else if (style === 'curly' || style === 'afro') {
			const scale = style === 'afro' ? 0.11 : 0.075;

			for (let index = 0; index < 7; index += 1) {
				const angle = (index / 7) * Math.PI * 2;
				this.addPart(
					j,
					HAND_GEOMETRY,
					'hair',
					scale,
					scale,
					scale,
					Math.cos(angle) * 0.17,
					0.15 + (index % 2) * 0.03,
					Math.sin(angle) * 0.13 - 0.03
				);
			}
		} else if (style === 'long') {
			this.addPart(j, HAIR_LOCK_GEOMETRY, 'hair', 0.08, 0.24, 0.06, -0.18, -0.05, 0.08);
			this.addPart(j, HAIR_LOCK_GEOMETRY, 'hair', 0.08, 0.24, 0.06, 0.18, -0.05, 0.08);
			this.addPart(j, HAIR_LOCK_GEOMETRY, 'hair', 0.12, 0.26, 0.055, 0, -0.07, 0.16);
		} else if (style === 'braids_simple') {
			this.addPart(j, BRAID_GEOMETRY, 'hair', 0.055, 0.25, 0.055, -0.17, -0.08, 0.1);
			this.addPart(j, BRAID_GEOMETRY, 'hair', 0.055, 0.25, 0.055, 0.17, -0.08, 0.1);
		}
	}

	private clearHair(): void {
		const hair = this.joints.hair;

		for (let index = hair.children.length - 1; index >= 0; index -= 1) {
			const child = hair.children[index];
			hair.remove(child);

			if (child instanceof Mesh) {
				const meshIndex = this.meshes.indexOf(child);

				if (meshIndex >= 0) {
					this.meshes.splice(meshIndex, 1);
				}
			}
		}
	}

	private addPart(
		parent: Group,
		geometry: BufferGeometry,
		role: 'skin' | 'hair' | 'shirt' | 'pants' | 'shoes' | 'face',
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
		parent.add(mesh);
		this.meshes.push(mesh);

		return mesh;
	}

	private material(role: string): MeshLambertMaterial {
		const cached = this.materialByRole.get(role);

		if (cached) {
			return cached;
		}

		const material = new MeshLambertMaterial({
			color: role === 'face' ? 0x1d1716 : 0xffffff
		});
		this.materialByRole.set(role, material);
		this.materials.push(material);

		return material;
	}
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
