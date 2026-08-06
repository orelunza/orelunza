import { Color, Mesh, MeshPhysicalMaterial, SphereGeometry } from 'three';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

export class PlanetOceanRenderer {
	readonly object: Mesh;
	private disposed = false;

	constructor(definition: Readonly<PlanetDefinition>) {
		this.object = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits, 96, 64),
			new MeshPhysicalMaterial({
				color: new Color('#126aa2'),
				transparent: true,
				opacity: 0.78,
				roughness: 0.3,
				metalness: 0.02,
				clearcoat: 0.35,
				clearcoatRoughness: 0.28,
				depthWrite: true
			})
		);
		this.object.castShadow = false;
		this.object.receiveShadow = true;
		this.object.renderOrder = 1;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.object.geometry.dispose();
		(this.object.material as MeshPhysicalMaterial).dispose();
	}
}
