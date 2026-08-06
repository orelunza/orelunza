import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

interface CoastlinePayload {
	version: 1;
	lines: number[][][];
}

export class CoastlineRenderer {
	readonly object: LineSegments;
	private readonly coordinateSystem: PlanetCoordinateSystem;
	private disposed = false;
	private loaded = false;

	constructor(private readonly definition: Readonly<PlanetDefinition>) {
		this.coordinateSystem = new PlanetCoordinateSystem(definition);
		this.object = new LineSegments(
			new BufferGeometry(),
			new LineBasicMaterial({ color: 0xd6e6cf, transparent: true, opacity: 0.58 })
		);
		this.object.renderOrder = 3;
		this.object.frustumCulled = false;
	}

	get ready(): boolean {
		return this.loaded;
	}

	async load(url = '/planet-data/preview/coastlines-110m.json'): Promise<void> {
		if (this.disposed || this.loaded) {
			return;
		}
		try {
			const response = await fetch(url);
			if (!response.ok) {
				return;
			}
			const payload = (await response.json()) as CoastlinePayload;
			if (payload.version !== 1 || !Array.isArray(payload.lines)) {
				return;
			}
			const geometry = this.buildGeometry(payload.lines);
			if (this.disposed) {
				geometry.dispose();
				return;
			}
			this.object.geometry.dispose();
			this.object.geometry = geometry;
			this.loaded = true;
		} catch {
			// The terrain remains usable when optional vector coastlines are unavailable.
		}
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.object.geometry.dispose();
		(this.object.material as LineBasicMaterial).dispose();
	}

	private buildGeometry(lines: readonly number[][][]): BufferGeometry {
		const positions: number[] = [];
		const renderScale = this.definition.renderRadiusUnits / this.definition.equatorialRadiusMeters;
		const previous = new Vector3();
		const current = new Vector3();
		for (const line of lines) {
			for (let index = 1; index < line.length; index += 1) {
				const previousCoordinate = line[index - 1];
				const coordinate = line[index];
				if (!previousCoordinate || !coordinate) {
					continue;
				}
				const previousLongitude = previousCoordinate[0];
				const previousLatitude = previousCoordinate[1];
				const longitude = coordinate[0];
				const latitude = coordinate[1];
				if (
					typeof previousLongitude !== 'number' ||
					typeof previousLatitude !== 'number' ||
					typeof longitude !== 'number' ||
					typeof latitude !== 'number' ||
					![previousLongitude, previousLatitude, longitude, latitude].every(Number.isFinite)
				) {
					continue;
				}
				this.coordinateSystem.geodeticToPlanet(
					{
						latitudeRadians: (previousLatitude * Math.PI) / 180,
						longitudeRadians: (previousLongitude * Math.PI) / 180,
						altitudeMeters: 80
					},
					previous
				);
				previous.multiplyScalar(renderScale);
				this.coordinateSystem.geodeticToPlanet(
					{
						latitudeRadians: (latitude * Math.PI) / 180,
						longitudeRadians: (longitude * Math.PI) / 180,
						altitudeMeters: 80
					},
					current
				);
				current.multiplyScalar(renderScale);
				positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
			}
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		geometry.computeBoundingSphere();
		return geometry;
	}
}
