import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import type { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

export class PlanetDestinationMarker {
	readonly object = new Group();
	private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>;
	private disposed = false;

	constructor(
		private readonly definition: Readonly<PlanetDefinition>,
		private readonly coordinates: PlanetCoordinateSystem
	) {
		this.ring = new Mesh(
			new RingGeometry(1.1, 1.55, 48),
			new MeshBasicMaterial({
				color: new Color('#f7c65e'),
				transparent: true,
				opacity: 0.95,
				depthWrite: false,
				side: DoubleSide
			})
		);
		this.ring.renderOrder = 8;
		this.object.add(this.ring);
		this.object.visible = false;
	}

	setDestination(coordinate: Readonly<GeodeticCoordinate> | null, allowed = true): void {
		if (!coordinate) {
			this.object.visible = false;
			return;
		}
		const position = this.coordinates.geodeticToPlanet({ ...coordinate, altitudeMeters: 0 });
		const normal = new Vector3(position.x, position.y, position.z).normalize();
		this.object.position.copy(normal).multiplyScalar(this.definition.renderRadiusUnits * 1.006);
		this.object.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
		this.object.scale.setScalar(this.definition.renderRadiusUnits * 0.025);
		this.ring.material.color.set(allowed ? '#f7c65e' : '#ef6464');
		this.object.visible = true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.ring.geometry.dispose();
		this.ring.material.dispose();
		this.object.clear();
	}
}
