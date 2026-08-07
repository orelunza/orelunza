import {
	BoxGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	PointLight,
	type Scene,
	type Vector3
} from 'three';
import { CENTRAL_CITY_CENTER } from '../world/voxel-types';
import { CIVIC_ELEVATOR_LAYOUT } from '../world/civilization/UrbanBuildingRegistry';
import type { UrbanElevatorSnapshot } from '../world/civilization/UrbanElevatorSystem';

export class UrbanElevatorRenderer {
	private readonly group = new Group();
	private readonly material = new MeshStandardMaterial({
		color: 0x70787c,
		roughness: 0.48,
		metalness: 0.45
	});
	private readonly glass = new MeshStandardMaterial({
		color: 0xc8e7ec,
		roughness: 0.16,
		metalness: 0.08,
		transparent: true,
		opacity: 0.46
	});
	private readonly panelMaterial = new MeshStandardMaterial({
		color: 0x252b2f,
		roughness: 0.35,
		metalness: 0.55,
		emissive: 0x21445c,
		emissiveIntensity: 0.55
	});
	private readonly doorMaterial = new MeshStandardMaterial({
		color: 0x9ca6ab,
		roughness: 0.28,
		metalness: 0.72
	});
	private readonly ceilingMaterial = new MeshStandardMaterial({
		color: 0xffefc8,
		emissive: 0xffd990,
		emissiveIntensity: 1.6,
		roughness: 0.5,
		metalness: 0
	});
	private readonly cabinLight = new PointLight(0xffe4b3, 0.9, 4, 2);
	private readonly geometries: BoxGeometry[] = [];
	private readonly cabinDoors: Mesh[] = [];

	constructor(private readonly scene: Scene) {
		this.group.name = 'urbanElevatorCabin';
		this.group.visible = false;
		this.addPart(0.96, 0.12, 0.96, 0, 0, 0, this.material);
		this.addPart(0.96, 0.1, 0.96, 0, 2.35, 0, this.material);
		this.addPart(0.08, 2.25, 0.96, -0.46, 1.17, 0, this.material);
		this.addPart(0.08, 2.25, 0.96, 0.46, 1.17, 0, this.material);
		this.addPart(0.96, 2.25, 0.06, 0, 1.17, -0.43, this.glass);
		this.addPart(0.56, 0.055, 0.56, 0, 2.25, 0, this.ceilingMaterial);

		// A real illuminated cabin panel travels with the lift. The landing panel
		// remains an interaction fallback, while E inside a stopped cabin opens the
		// same floor selector directly.
		this.addPart(0.035, 0.62, 0.28, 0.405, 1.2, 0.18, this.panelMaterial);

		// The cabin now faces the visible lobby-side landing (+Z). This makes the
		// elevator immediately readable when entering the civic tower instead of
		// hiding its doors on the back of the shaft.
		this.cabinDoors.push(
			this.addPart(0.44, 2.12, 0.045, -0.22, 1.08, 0.445, this.doorMaterial),
			this.addPart(0.44, 2.12, 0.045, 0.22, 1.08, 0.445, this.doorMaterial)
		);
		this.cabinLight.position.set(0, 2.08, 0);
		this.cabinLight.castShadow = false;
		this.group.add(this.cabinLight);
		this.scene.add(this.group);
	}

	update(snapshot: UrbanElevatorSnapshot, camera: Readonly<Vector3>): void {
		const x = CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.shaftLocalX + 0.5;
		const z = CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.shaftLocalZ + 0.5;
		const dx = camera.x - x;
		const dz = camera.z - z;
		this.group.visible = dx * dx + dz * dz <= 56 * 56;
		this.group.position.set(x, snapshot.cabinY + 1, z);
		const doorsClosed = snapshot.phase !== 'idle';
		for (const door of this.cabinDoors) door.visible = doorsClosed;
		this.cabinLight.intensity = snapshot.powered && this.group.visible ? 0.9 : 0;
	}

	dispose(): void {
		this.scene.remove(this.group);
		for (const geometry of this.geometries) geometry.dispose();
		this.material.dispose();
		this.glass.dispose();
		this.panelMaterial.dispose();
		this.doorMaterial.dispose();
		this.ceilingMaterial.dispose();
	}

	private addPart(
		width: number,
		height: number,
		depth: number,
		x: number,
		y: number,
		z: number,
		material: MeshStandardMaterial
	): Mesh {
		const geometry = new BoxGeometry(width, height, depth);
		this.geometries.push(geometry);
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		this.group.add(mesh);
		return mesh;
	}
}
