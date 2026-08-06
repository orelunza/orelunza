import {
	BufferAttribute,
	BufferGeometry,
	Group,
	LineBasicMaterial,
	LineSegments,
	Vector3
} from 'three';
import {
	validateCountryBoundaryPayload,
	type CountryBoundary,
	type CountryBoundaryPayload,
	type GeographicRing
} from '../../geography/countries/CountryBoundary';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

export class CountryBoundaryRenderer {
	readonly object = new Group();
	private readonly coordinateSystem: PlanetCoordinateSystem;
	private readonly base = new LineSegments(
		new BufferGeometry(),
		new LineBasicMaterial({
			color: 0xb9ddff,
			transparent: true,
			opacity: 0.24,
			depthWrite: false,
			depthTest: true
		})
	);
	private readonly highlight = new LineSegments(
		new BufferGeometry(),
		new LineBasicMaterial({
			color: 0xffcf5a,
			transparent: true,
			opacity: 0.96,
			depthWrite: false,
			depthTest: true
		})
	);
	private payload: CountryBoundaryPayload | null = null;
	private selectedId: string | null = null;
	private disposed = false;
	private loaded = false;

	constructor(
		private readonly definition: Readonly<PlanetDefinition>,
		private readonly url = '/planet-data/preview/countries-110m.json'
	) {
		this.coordinateSystem = new PlanetCoordinateSystem(definition);
		this.base.renderOrder = 7;
		this.highlight.renderOrder = 8;
		this.object.add(this.base, this.highlight);
	}

	get ready(): boolean {
		return this.loaded;
	}

	async load(signal?: AbortSignal): Promise<void> {
		if (this.loaded || this.disposed) return;
		const response = await fetch(this.url, { signal });
		if (!response.ok) throw new Error(`Unable to load country boundaries (${response.status}).`);
		this.payload = validateCountryBoundaryPayload(await response.json());
		this.replaceGeometry(this.base, this.buildGeometry(this.payload.countries));
		this.loaded = true;
		this.refreshHighlight();
	}

	updateForAltitude(altitudeMeters: number): void {
		const normalized = Math.max(0, Math.min(1, (altitudeMeters - 250_000) / 5_000_000));
		(this.base.material as LineBasicMaterial).opacity = 0.34 - normalized * 0.2;
		(this.highlight.material as LineBasicMaterial).opacity = 0.96;
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;
	}

	setSelectedCountry(id: string | null): void {
		if (id === this.selectedId) return;
		this.selectedId = id;
		this.refreshHighlight();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.base.geometry.dispose();
		this.highlight.geometry.dispose();
		(this.base.material as LineBasicMaterial).dispose();
		(this.highlight.material as LineBasicMaterial).dispose();
		this.object.clear();
		this.payload = null;
	}

	private refreshHighlight(): void {
		const selected = this.payload?.countries.find((country) => country.id === this.selectedId);
		this.replaceGeometry(this.highlight, this.buildGeometry(selected ? [selected] : []));
	}

	private buildGeometry(countries: readonly CountryBoundary[]): BufferGeometry {
		const positions: number[] = [];
		const scale = this.definition.equatorialRadiusMeters / this.definition.renderRadiusUnits;
		const point = new Vector3();
		for (const country of countries) {
			for (const polygon of country.polygons) {
				for (const ring of polygon) this.appendRing(positions, ring, point, scale);
			}
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		return geometry;
	}

	private appendRing(
		positions: number[],
		ring: GeographicRing,
		point: Vector3,
		metersPerRenderUnit: number
	): void {
		for (let index = 1; index < ring.length; index += 1) {
			const previous = ring[index - 1];
			const current = ring[index];
			if (Math.abs(current[0] - previous[0]) > 180) continue;
			this.appendPoint(positions, previous[1], previous[0], point, metersPerRenderUnit);
			this.appendPoint(positions, current[1], current[0], point, metersPerRenderUnit);
		}
	}

	private appendPoint(
		positions: number[],
		latitudeDegrees: number,
		longitudeDegrees: number,
		point: Vector3,
		metersPerRenderUnit: number
	): void {
		const planet = this.coordinateSystem.geodeticToPlanet({
			latitudeRadians: (latitudeDegrees * Math.PI) / 180,
			longitudeRadians: (longitudeDegrees * Math.PI) / 180,
			altitudeMeters: 26_000
		});
		point.set(
			planet.x / metersPerRenderUnit,
			planet.y / metersPerRenderUnit,
			planet.z / metersPerRenderUnit
		);
		positions.push(point.x, point.y, point.z);
	}

	private replaceGeometry(target: LineSegments, next: BufferGeometry): void {
		target.geometry.dispose();
		target.geometry = next;
	}
}
