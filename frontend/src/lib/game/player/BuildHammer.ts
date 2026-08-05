import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Material } from 'three';

const SWING_DURATION_SECONDS = 0.22;
const BASE_ROTATION_X = -0.18;
const BASE_ROTATION_Z = -0.18;

/** Lightweight procedural hammer attached to the avatar's right hand. */
export class BuildHammer {
	readonly object = new Group();

	private readonly geometries: BoxGeometry[] = [];
	private readonly materials: Material[] = [];
	private swingRemaining = 0;

	constructor() {
		this.object.name = 'buildHammer';
		this.object.visible = false;
		this.object.position.set(0.02, -0.06, -0.045);
		this.object.rotation.set(BASE_ROTATION_X, 0, BASE_ROTATION_Z);

		const wood = this.material(0x815a3a);
		const metal = this.material(0x687078);
		const metalLight = this.material(0x8e969d);

		this.part(wood, 0.055, 0.34, 0.055, 0, -0.19, 0);
		this.part(metal, 0.3, 0.12, 0.13, 0, -0.39, 0);
		this.part(metalLight, 0.08, 0.16, 0.1, 0.17, -0.39, 0);
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;

		if (!visible) {
			this.swingRemaining = 0;
			this.object.rotation.x = BASE_ROTATION_X;
		}
	}

	swing(): void {
		if (this.object.visible) {
			this.swingRemaining = SWING_DURATION_SECONDS;
		}
	}

	update(deltaSeconds: number): void {
		if (!this.object.visible || this.swingRemaining <= 0) {
			this.object.rotation.x = BASE_ROTATION_X;
			return;
		}

		const delta = Math.max(0, Math.min(0.05, finiteOr(deltaSeconds, 0)));
		this.swingRemaining = Math.max(0, this.swingRemaining - delta);
		const progress = 1 - this.swingRemaining / SWING_DURATION_SECONDS;
		this.object.rotation.x = BASE_ROTATION_X - Math.sin(progress * Math.PI) * 0.9;
	}

	dispose(): void {
		for (const geometry of this.geometries) {
			geometry.dispose();
		}

		for (const material of this.materials) {
			material.dispose();
		}

		this.object.clear();
	}

	private material(color: number): MeshLambertMaterial {
		const material = new MeshLambertMaterial({ color });
		this.materials.push(material);
		return material;
	}

	private part(
		material: MeshLambertMaterial,
		width: number,
		height: number,
		depth: number,
		x: number,
		y: number,
		z: number
	): void {
		const geometry = new BoxGeometry(width, height, depth);
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		this.geometries.push(geometry);
		this.object.add(mesh);
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
