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
 * Orelunza procedural humanoid — rebuilt from scratch to match the
 * "Humain Orelunza" reference sheet.
 *
 * Design goals taken directly from the reference image:
 *   - a small, softly cubic head seated on a short, visible neck (never floating);
 *   - a slim, gently trapezoidal torso (not a massive block);
 *   - shoulders that sit outboard so the arms hang clearly away from the chest;
 *   - short tunic sleeves with bare forearms and visible hands;
 *   - a distinct pelvis, separate thighs, shins and feet;
 *   - clearly visible boots and a lighter trouser cuff;
 *   - a simple but expressive face (eyes, brows, a small nose, a mouth);
 *   - volumetric voxel hair built from boxes.
 *
 * The rig is a hierarchy of `Group` joints with thin `Mesh` skins. Only boxes
 * and lightly tapered boxes are used — no external assets. Joint names are the
 * stable contract consumed by HumanoidAnimator, PlayerAvatar and diagnostics.
 */

/**
 * Body proportions in metres. The citizen stands ~1.7 m: hip pivot at 0.86,
 * spine/chest stack the torso to the shoulders, and the head crown lands near
 * 1.7. Limb segment lengths describe the distance between successive joints.
 */
export const HUMANOID_PROPORTIONS = {
	height: 1.7,
	hipsY: 0.74,
	spineY: 0.13,
	chestY: 0.23,
	neckY: 0.23,
	headY: 0.1,
	shoulderX: 0.36,
	shoulderY: 0.15,
	upperArm: 0.25,
	forearm: 0.23,
	thigh: 0.34,
	shin: 0.34,
	foot: 0.26
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

type HumanoidMaterialRole =
	'skin' | 'hair' | 'shirt' | 'pants' | 'shoes' | 'face' | 'belt' | 'cuff';

/** Shared unit box reused by every plain body part. */
const UNIT_BOX = new BoxGeometry(1, 1, 1);

/**
 * A softly cubic head: very slightly narrower at the crown and jaw so it does
 * not read as a hard rectangular Minecraft block.
 */
const HEAD_BOX = taperedBox({ bottomX: 0.94, topX: 0.9, bottomZ: 0.96, topZ: 0.92 });

/** A gently trapezoidal torso: broader at the shoulders, slimmer at the waist. */
const TORSO_BOX = taperedBox({ bottomX: 0.82, topX: 1, bottomZ: 0.92, topZ: 1 });

/** A subtly tapered pelvis to avoid a boxy waistline. */
const PELVIS_BOX = taperedBox({ bottomX: 0.94, topX: 1, bottomZ: 0.96, topZ: 1 });

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
		this.object.userData.forwardAxis = '-Z';

		this.joints = this.createJoints();
		this.object.add(this.joints.hips);
		this.buildBody();

		const face = this.buildFace();
		this.eyeLeft = face.eyeLeft;
		this.eyeRight = face.eyeRight;
		this.eyelidLeft = face.eyelidLeft;
		this.eyelidRight = face.eyelidRight;

		this.updateAppearance(appearance);
		this.applyPose(NEUTRAL_RIG_POSE);
	}

	get objectCount(): number {
		return countObjects(this.object);
	}

	get meshCount(): number {
		return this.meshes.length;
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

		// The belt and trouser cuff are derived from persisted colours so old
		// appearance saves keep working without introducing new fields.
		this.material('belt').color.set(appearance.shoesColor);
		this.material('cuff').color.set(appearance.pantsColor).offsetHSL(0, -0.04, 0.14);

		this.clearHair();
		this.buildHair(appearance.hairStyle);
	}

	/**
	 * Apply a local-space pose to the joints. Rotations are in radians; foot
	 * lifts and rootBob are in metres relative to the neutral stance.
	 */
	applyPose(pose: HumanoidPose): void {
		const j = this.joints;

		j.hips.position.y = HUMANOID_PROPORTIONS.hipsY + pose.rootBob;
		j.hips.rotation.set(0, pose.hipsYaw, pose.hipsRoll);
		j.chest.rotation.set(pose.chestPitch, pose.chestYaw, -pose.hipsRoll * 0.5);
		j.neck.rotation.set(pose.headPitch * 0.35, pose.neckYaw, 0);
		j.head.rotation.set(pose.headPitch * 0.65, pose.headYaw, 0);

		j.shoulderLeft.rotation.set(pose.leftShoulderPitch, 0, pose.leftShoulderRoll);
		j.shoulderRight.rotation.set(pose.rightShoulderPitch, 0, pose.rightShoulderRoll);
		// The rig faces local -Z. Procedural poses use negative elbow flexion,
		// so invert it at the rig boundary to bend forearms toward the chest
		// instead of behind the back.
		j.forearmLeft.rotation.x = -pose.leftElbowPitch;
		j.forearmRight.rotation.x = -pose.rightElbowPitch;

		j.thighLeft.rotation.set(pose.leftHipPitch, 0, pose.leftHipRoll);
		j.thighRight.rotation.set(pose.rightHipPitch, 0, pose.rightHipRoll);
		j.shinLeft.rotation.x = pose.leftKneePitch;
		j.shinRight.rotation.x = pose.rightKneePitch;
		j.footLeft.rotation.x = pose.leftAnklePitch;
		j.footRight.rotation.x = pose.rightAnklePitch;
		j.footLeft.position.y = -HUMANOID_PROPORTIONS.shin + pose.leftFootLift;
		j.footRight.position.y = -HUMANOID_PROPORTIONS.shin + pose.rightFootLift;

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
		const P = HUMANOID_PROPORTIONS;

		return {
			avatarRoot: this.object,
			hips: joint('hips', 0, P.hipsY, 0),
			spine: joint('spine', 0, P.spineY, 0),
			chest: joint('chest', 0, P.chestY, 0),
			neck: joint('neck', 0, P.neckY, 0),
			head: joint('head', 0, P.headY, 0),
			face: joint('face', 0, 0.01, 0),
			hair: joint('hair', 0, 0, 0),
			shoulderLeft: joint('shoulderLeft', -P.shoulderX, P.shoulderY, -0.015),
			upperArmLeft: joint('upperArmLeft', 0, 0, 0),
			forearmLeft: joint('forearmLeft', 0, -P.upperArm, 0),
			handLeft: joint('handLeft', 0, -P.forearm, 0),
			shoulderRight: joint('shoulderRight', P.shoulderX, P.shoulderY, -0.015),
			upperArmRight: joint('upperArmRight', 0, 0, 0),
			forearmRight: joint('forearmRight', 0, -P.upperArm, 0),
			handRight: joint('handRight', 0, -P.forearm, 0),
			thighLeft: joint('thighLeft', -0.11, -0.03, 0),
			shinLeft: joint('shinLeft', 0, -P.thigh, 0),
			footLeft: joint('footLeft', 0, -P.shin, 0),
			shoeLeft: joint('shoeLeft', 0, 0, -0.055),
			thighRight: joint('thighRight', 0.11, -0.03, 0),
			shinRight: joint('shinRight', 0, -P.thigh, 0),
			footRight: joint('footRight', 0, -P.shin, 0),
			shoeRight: joint('shoeRight', 0, 0, -0.055)
		};
	}

	private buildBody(): void {
		const j = this.joints;
		const P = HUMANOID_PROPORTIONS;

		// Hierarchy.
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

		// Pelvis, torso, neck, head. The torso is tall enough to reach the neck
		// base so there is never a gap under the head.
		this.addPart(j.hips, PELVIS_BOX, 'pants', 0.36, 0.2, 0.24, 0, 0.02, 0);
		this.addPart(j.chest, TORSO_BOX, 'shirt', 0.46, 0.5, 0.26, 0, -0.04, 0);
		this.addPart(j.hips, UNIT_BOX, 'belt', 0.4, 0.06, 0.255, 0, 0.13, 0);
		this.addPart(j.neck, UNIT_BOX, 'skin', 0.11, 0.11, 0.11, 0, -0.01, 0);
		this.addPart(j.head, HEAD_BOX, 'skin', 0.38, 0.38, 0.36, 0, 0.01, 0);

		this.buildArm(j.upperArmLeft, j.forearmLeft, j.handLeft, -1);
		this.buildArm(j.upperArmRight, j.forearmRight, j.handRight, 1);
		this.buildLeg(j.thighLeft, j.shinLeft, j.shoeLeft);
		this.buildLeg(j.thighRight, j.shinRight, j.shoeRight);
	}

	private buildArm(upperArm: Group, forearm: Group, hand: Group, side: -1 | 1): void {
		const P = HUMANOID_PROPORTIONS;
		const sleeve = P.upperArm * 0.38;

		// Short tunic sleeve, then a bare-skin upper arm so the whole forearm
		// reads as one continuous bare arm hanging clear of the torso.
		this.addPart(upperArm, UNIT_BOX, 'shirt', 0.145, sleeve, 0.145, side * 0.012, -sleeve * 0.5, 0);
		this.addPart(
			upperArm,
			UNIT_BOX,
			'skin',
			0.125,
			P.upperArm - sleeve,
			0.125,
			side * 0.012,
			-sleeve - (P.upperArm - sleeve) * 0.5,
			0
		);
		this.addPart(
			forearm,
			UNIT_BOX,
			'skin',
			0.12,
			P.forearm,
			0.12,
			side * 0.008,
			-P.forearm * 0.5,
			0
		);
		this.addPart(hand, UNIT_BOX, 'skin', 0.13, 0.09, 0.12, side * 0.012, -0.045, -0.008);
	}

	private buildLeg(thigh: Group, shin: Group, shoe: Group): void {
		const P = HUMANOID_PROPORTIONS;

		this.addPart(thigh, UNIT_BOX, 'pants', 0.17, P.thigh, 0.18, 0, -P.thigh * 0.5, 0);
		this.addPart(shin, UNIT_BOX, 'pants', 0.15, P.shin, 0.16, 0, -P.shin * 0.5, 0);
		// Lighter woven cuff just above the boot.
		this.addPart(shin, UNIT_BOX, 'cuff', 0.164, 0.055, 0.174, 0, -P.shin + 0.045, 0);
		// Local avatar forward is -Z; the toe volume extends along that axis.
		this.addPart(shoe, UNIT_BOX, 'shoes', 0.19, 0.1, 0.3, 0, -0.04, -0.075);
	}

	private buildFace(): {
		eyeLeft: Mesh;
		eyeRight: Mesh;
		eyelidLeft: Mesh;
		eyelidRight: Mesh;
	} {
		const face = this.joints.face;
		const frontZ = -0.185;

		const eyeLeft = this.addPart(face, UNIT_BOX, 'face', 0.05, 0.062, 0.014, -0.092, 0.03, frontZ);
		const eyeRight = this.addPart(face, UNIT_BOX, 'face', 0.05, 0.062, 0.014, 0.092, 0.03, frontZ);
		const eyelidLeft = this.addPart(
			face,
			UNIT_BOX,
			'face',
			0.058,
			0.012,
			0.014,
			-0.092,
			0.03,
			frontZ - 0.001
		);
		const eyelidRight = this.addPart(
			face,
			UNIT_BOX,
			'face',
			0.058,
			0.012,
			0.014,
			0.092,
			0.03,
			frontZ - 0.001
		);

		eyelidLeft.visible = false;
		eyelidRight.visible = false;

		// Simple, expressive features: brows, a small nose bridge and a mouth.
		this.addPart(face, UNIT_BOX, 'face', 0.062, 0.012, 0.014, -0.092, 0.085, frontZ);
		this.addPart(face, UNIT_BOX, 'face', 0.062, 0.012, 0.014, 0.092, 0.085, frontZ);
		this.addPart(face, UNIT_BOX, 'skin', 0.03, 0.055, 0.032, 0, -0.02, frontZ + 0.012);
		this.addPart(face, UNIT_BOX, 'face', 0.072, 0.014, 0.014, 0, -0.09, frontZ);

		return { eyeLeft, eyeRight, eyelidLeft, eyelidRight };
	}

	private buildHair(style: CharacterAppearanceV1['hairStyle']): void {
		const hair = this.joints.hair;

		if (style === 'none') {
			return;
		}

		if (style === 'shaved') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.36, 0.06, 0.33, 0, 0.17, -0.005);
			return;
		}

		// A shared blocky cap sits slightly proud of the skull for every style.
		this.addPart(hair, UNIT_BOX, 'hair', 0.4, 0.1, 0.36, 0, 0.16, 0);

		if (style === 'short') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.16, 0.07, 0.05, -0.1, 0.11, -0.2);
			this.addPart(hair, UNIT_BOX, 'hair', 0.14, 0.055, 0.05, 0.095, 0.12, -0.2);
			return;
		}

		if (style === 'curly') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.16, 0.14, 0.15, -0.13, 0.18, -0.02);
			this.addPart(hair, UNIT_BOX, 'hair', 0.16, 0.15, 0.15, 0.13, 0.19, -0.02);
			this.addPart(hair, UNIT_BOX, 'hair', 0.16, 0.13, 0.14, 0, 0.23, -0.01);
			return;
		}

		if (style === 'afro') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.22, 0.2, 0.21, -0.14, 0.2, 0);
			this.addPart(hair, UNIT_BOX, 'hair', 0.22, 0.2, 0.21, 0.14, 0.2, 0);
			this.addPart(hair, UNIT_BOX, 'hair', 0.23, 0.2, 0.2, 0, 0.28, 0.01);
			this.addPart(hair, UNIT_BOX, 'hair', 0.38, 0.15, 0.15, 0, 0.19, 0.13);
			return;
		}

		if (style === 'long') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.12, 0.36, 0.1, -0.19, -0.02, 0.03);
			this.addPart(hair, UNIT_BOX, 'hair', 0.12, 0.36, 0.1, 0.19, -0.02, 0.03);
			this.addPart(hair, UNIT_BOX, 'hair', 0.38, 0.38, 0.09, 0, -0.03, 0.17);
			return;
		}

		if (style === 'braids_simple') {
			this.addPart(hair, UNIT_BOX, 'hair', 0.07, 0.36, 0.07, -0.15, -0.05, 0.1);
			this.addPart(hair, UNIT_BOX, 'hair', 0.07, 0.36, 0.07, 0.15, -0.05, 0.1);
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

function taperedBox(options: TaperedBoxOptions): BoxGeometry {
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

/** Relaxed neutral stance used before the first animation update. */
const NEUTRAL_RIG_POSE: HumanoidPose = {
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
	leftShoulderPitch: 0.04,
	rightShoulderPitch: 0.04,
	leftShoulderRoll: -0.11,
	rightShoulderRoll: 0.11,
	leftElbowPitch: -0.14,
	rightElbowPitch: -0.14,
	leftHipPitch: 0,
	rightHipPitch: 0,
	leftHipRoll: 0,
	rightHipRoll: 0,
	leftKneePitch: 0.06,
	rightKneePitch: 0.06,
	leftAnklePitch: 0,
	rightAnklePitch: 0,
	leftFootLift: 0,
	rightFootLift: 0,
	blink: 0
};
