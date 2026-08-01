import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Material } from 'three';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	type CharacterAppearanceV1
} from '../character/CharacterAppearance';
import type { PlayerState } from './PlayerState';

const UNIT = new BoxGeometry(1, 1, 1);

export class PlayerAvatar {
	readonly object = new Group();
	private readonly materials: Material[] = [];
	private readonly leftArm: Mesh;
	private readonly rightArm: Mesh;
	private readonly leftLeg: Mesh;
	private readonly rightLeg: Mesh;
	private walkTime = 0;

	constructor(private appearance: CharacterAppearanceV1 = DEFAULT_CHARACTER_APPEARANCE) {
		const skin = this.material(appearance.skinTone);
		const hair = this.material(appearance.hairColor);
		const shirt = this.material(appearance.shirtColor);
		const pants = this.material(appearance.pantsColor);
		const shoes = this.material(appearance.shoesColor);

		const head = this.part(0.58, 0.58, 0.58, skin, 0, 1.58, 0);
		const torso = this.part(0.72, 0.82, 0.34, shirt, 0, 0.92, 0);
		this.leftArm = this.part(0.2, 0.78, 0.22, shirt, -0.56, 0.92, 0);
		this.rightArm = this.part(0.2, 0.78, 0.22, shirt, 0.56, 0.92, 0);
		this.leftLeg = this.part(0.26, 0.72, 0.24, pants, -0.2, 0.2, 0);
		this.rightLeg = this.part(0.26, 0.72, 0.24, pants, 0.2, 0.2, 0);
		const leftShoe = this.part(0.28, 0.16, 0.3, shoes, -0.2, -0.24, 0.03);
		const rightShoe = this.part(0.28, 0.16, 0.3, shoes, 0.2, -0.24, 0.03);

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
			this.object.add(this.part(0.64, hairHeight, 0.62, hair, 0, 1.92, -0.01));
		}
	}

	updateAppearance(appearance: CharacterAppearanceV1): void {
		this.dispose();
		this.appearance = appearance;
	}

	update(player: PlayerState, moving: boolean, deltaSeconds: number): void {
		this.object.position.set(player.position.x, player.position.y + 0.25, player.position.z);
		this.object.rotation.y = player.yaw;

		if (moving) {
			this.walkTime += deltaSeconds * 9;
		} else {
			this.walkTime *= 0.82;
		}

		const swing = Math.sin(this.walkTime) * (moving ? 0.55 : 0.06);
		this.leftArm.rotation.x = swing;
		this.rightArm.rotation.x = -swing;
		this.leftLeg.rotation.x = -swing * 0.7;
		this.rightLeg.rotation.x = swing * 0.7;
		this.object.position.y += Math.abs(Math.sin(this.walkTime * 2)) * (moving ? 0.035 : 0);
	}

	dispose(): void {
		for (const material of this.materials) {
			material.dispose();
		}

		this.materials.length = 0;
	}

	private part(
		width: number,
		height: number,
		depth: number,
		material: Material,
		x: number,
		y: number,
		z: number
	): Mesh {
		const mesh = new Mesh(UNIT, material);
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
