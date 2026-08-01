import {
	BoxGeometry,
	CapsuleGeometry,
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
import type { PlayerState } from './PlayerState';

const UNIT = new BoxGeometry(1, 1, 1);
const HEAD = new SphereGeometry(0.5, 10, 8);
const LIMB = new CapsuleGeometry(0.5, 0.8, 4, 8);

export class PlayerAvatar {
	readonly object = new Group();
	private readonly materials: Material[] = [];
	private readonly leftArm: Mesh;
	private readonly rightArm: Mesh;
	private readonly leftLeg: Mesh;
	private readonly rightLeg: Mesh;
	private walkTime = 0;
	private visualYaw = 0;

	constructor(private appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE) {
		const skin = this.material(appearance.skinTone);
		const hair = this.material(appearance.hairColor);
		const shirt = this.material(appearance.shirtColor);
		const pants = this.material(appearance.pantsColor);
		const shoes = this.material(appearance.shoesColor);

		const head = this.part(HEAD, 0.58, 0.62, 0.58, skin, 0, 1.58, 0);
		const torso = this.part(UNIT, 0.62, 0.86, 0.32, shirt, 0, 0.9, 0);
		this.leftArm = this.part(LIMB, 0.18, 0.58, 0.18, shirt, -0.5, 0.92, 0);
		this.rightArm = this.part(LIMB, 0.18, 0.58, 0.18, shirt, 0.5, 0.92, 0);
		this.leftLeg = this.part(LIMB, 0.22, 0.58, 0.2, pants, -0.18, 0.22, 0);
		this.rightLeg = this.part(LIMB, 0.22, 0.58, 0.2, pants, 0.18, 0.22, 0);
		const leftShoe = this.part(UNIT, 0.28, 0.14, 0.38, shoes, -0.18, -0.2, -0.02);
		const rightShoe = this.part(UNIT, 0.28, 0.14, 0.38, shoes, 0.18, -0.2, -0.02);

		this.object.add(
			head,
			torso,
			this.leftArm,
			this.rightArm,
			this.leftLeg,
			this.rightLeg,
			leftShoe,
			rightShoe
		);

		if (appearance.hairStyle !== 'none') {
			const hairHeight = appearance.hairStyle === 'long' ? 0.3 : 0.16;
			this.object.add(this.part(UNIT, 0.62, hairHeight, 0.58, hair, 0, 1.9, -0.03));
		}
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		this.dispose();
		this.appearance = appearance;
	}

	update(player: PlayerState, moving: boolean, deltaSeconds: number): void {
		this.object.position.set(player.position.x, player.position.y + 0.25, player.position.z);
		this.visualYaw = lerpAngle(this.visualYaw, player.yaw, moving ? 0.22 : 0.1);
		this.object.rotation.y = this.visualYaw;

		if (moving) {
			this.walkTime += deltaSeconds * 9;
		} else {
			this.walkTime *= 0.82;
		}

		const speed = Math.hypot(player.velocity.x, player.velocity.z);
		const runFactor = Math.min(1, speed / 8);
		const swing = Math.sin(this.walkTime) * (moving ? 0.42 + runFactor * 0.25 : 0.04);
		this.leftArm.rotation.x = swing;
		this.rightArm.rotation.x = -swing;
		this.leftLeg.rotation.x = -swing * 0.7;
		this.rightLeg.rotation.x = swing * 0.7;
		this.object.position.y +=
			Math.abs(Math.sin(this.walkTime * 2)) * (moving ? 0.025 + runFactor * 0.02 : 0);
	}

	dispose(): void {
		for (const material of this.materials) {
			material.dispose();
		}

		this.materials.length = 0;
	}

	private part(
		geometry: BufferGeometry,
		width: number,
		height: number,
		depth: number,
		material: Material,
		x: number,
		y: number,
		z: number
	): Mesh {
		const mesh = new Mesh(geometry, material);
		mesh.scale.set(width, height, depth);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;

		return mesh;
	}

	private material(color: string): Material {
		const material = new MeshLambertMaterial({
			color
		});

		this.materials.push(material);

		return material;
	}
}

function lerpAngle(current: number, target: number, alpha: number): number {
	const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));

	return current + delta * alpha;
}
