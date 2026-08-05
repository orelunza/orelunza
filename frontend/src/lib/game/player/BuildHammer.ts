import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Material } from 'three';

export const BUILD_HAMMER_SWING_DURATION_SECONDS = 0.46;

const BASE_ROTATION_X = -0.12;
const BASE_ROTATION_Y = 0;
const BASE_ROTATION_Z = -0.14;

/** Lightweight procedural hammer attached to the avatar's right hand. */
export class BuildHammer {
	readonly object = new Group();

	private readonly geometries: BoxGeometry[] = [];
	private readonly materials: Material[] = [];
	private swingElapsed = BUILD_HAMMER_SWING_DURATION_SECONDS;

	constructor() {
		this.object.name = 'buildHammer';
		this.object.visible = false;
		this.object.position.set(0.015, -0.025, -0.045);
		this.resetLocalRotation();

		const wood = this.material(0x815a3a);
		const metal = this.material(0x687078);
		const metalLight = this.material(0x9aa2a8);

		this.part(wood, 0.06, 0.38, 0.06, 0, -0.2, 0);
		this.part(metal, 0.34, 0.13, 0.14, 0, -0.43, 0);
		this.part(metalLight, 0.09, 0.17, 0.11, 0.195, -0.43, 0);
	}

	get swinging(): boolean {
		return this.object.visible && this.swingElapsed < BUILD_HAMMER_SWING_DURATION_SECONDS;
	}

	/** Normalized 0..1 action time. Returns 0 while no swing is active. */
	get swingProgress(): number {
		return this.swinging ? clamp01(this.swingElapsed / BUILD_HAMMER_SWING_DURATION_SECONDS) : 0;
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;

		if (!visible) {
			this.cancelSwing();
		}
	}

	swing(): void {
		if (this.object.visible) {
			this.swingElapsed = 0;
		}
	}

	cancelSwing(): void {
		this.swingElapsed = BUILD_HAMMER_SWING_DURATION_SECONDS;
		this.resetLocalRotation();
	}

	update(deltaSeconds: number): void {
		if (!this.object.visible || !this.swinging) {
			this.resetLocalRotation();
			return;
		}

		const delta = Math.max(0, Math.min(0.05, finiteOr(deltaSeconds, 0)));
		this.swingElapsed = Math.min(BUILD_HAMMER_SWING_DURATION_SECONDS, this.swingElapsed + delta);

		const progress = this.swingElapsed / BUILD_HAMMER_SWING_DURATION_SECONDS;
		const follow = localHammerFollow(progress);
		this.object.rotation.set(
			BASE_ROTATION_X + follow.x,
			BASE_ROTATION_Y,
			BASE_ROTATION_Z + follow.z
		);
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

	private resetLocalRotation(): void {
		this.object.rotation.set(BASE_ROTATION_X, BASE_ROTATION_Y, BASE_ROTATION_Z);
	}

	private material(color: number): MeshLambertMaterial {
		const material = new MeshLambertMaterial({ color, flatShading: true });
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

function localHammerFollow(progress: number): { x: number; z: number } {
	if (progress < 0.22) {
		const amount = smoothstep01(progress / 0.22);
		return { x: 0.24 * amount, z: -0.12 * amount };
	}

	if (progress < 0.58) {
		const amount = smoothstep01((progress - 0.22) / 0.36);
		return {
			x: lerp(0.24, -0.38, amount),
			z: lerp(-0.12, 0.08, amount)
		};
	}

	if (progress < 0.68) {
		return { x: -0.38, z: 0.08 };
	}

	const amount = 1 - smoothstep01((progress - 0.68) / 0.32);
	return { x: -0.38 * amount, z: 0.08 * amount };
}

function smoothstep01(value: number): number {
	const clamped = clamp01(value);
	return clamped * clamped * (3 - 2 * clamped);
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * clamp01(amount);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
