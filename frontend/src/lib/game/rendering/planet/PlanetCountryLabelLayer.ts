import {
	CanvasTexture,
	FrontSide,
	Group,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	Vector3
} from 'three';

import type { CountryBoundary } from '../../geography/countries/CountryBoundary';
import type { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

interface CountryLabelEntry {
	mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
	texture: CanvasTexture;
	baseWidth: number;
	baseHeight: number;
}

const PLANE_NORMAL = new Vector3(0, 0, 1);

export function countryLabelImportance(country: Readonly<CountryBoundary>): number {
	const [minLon, minLat, maxLon, maxLat] = country.bounds;
	const longitudeSpan = Math.min(360, Math.abs(maxLon - minLon));
	const latitudeSpan = Math.abs(maxLat - minLat);
	const latitude = (country.label[1] * Math.PI) / 180;
	return longitudeSpan * latitudeSpan * Math.max(0.2, Math.cos(latitude));
}

export function countryLabelHeightUnits(country: Readonly<CountryBoundary>): number {
	const importance = Math.max(0, countryLabelImportance(country));
	return Math.max(0.7, Math.min(2.2, 0.62 + Math.sqrt(importance) * 0.085));
}

export function countryLabelDistanceScale(cameraDistance: number, planetRadius: number): number {
	const surfaceDistance = Math.max(1, cameraDistance - planetRadius);
	return Math.max(0.34, Math.min(1.35, Math.sqrt(surfaceDistance / 185)));
}

export class PlanetCountryLabelLayer {
	readonly object = new Group();
	private readonly entries: CountryLabelEntry[] = [];
	private disposed = false;

	constructor(
		private readonly definition: Readonly<PlanetDefinition>,
		private readonly coordinateSystem: PlanetCoordinateSystem
	) {
		this.object.name = 'planet-country-labels';
	}

	setCountries(countries: readonly CountryBoundary[]): void {
		this.assertUsable();
		this.clear();
		for (const country of countries) this.addCountry(country);
	}

	update(cameraDistance: number): void {
		this.assertUsable();
		const distanceScale = countryLabelDistanceScale(
			cameraDistance,
			this.definition.renderRadiusUnits
		);
		for (const entry of this.entries) {
			entry.mesh.scale.set(entry.baseWidth * distanceScale, entry.baseHeight * distanceScale, 1);
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clear();
		this.object.removeFromParent();
	}

	private addCountry(country: CountryBoundary): void {
		const { texture, aspect } = createCountryLabelTexture(country.name);
		const material = new MeshBasicMaterial({
			map: texture,
			transparent: true,
			depthTest: true,
			depthWrite: false,
			alphaTest: 0.06,
			side: FrontSide,
			toneMapped: false
		});
		const geometry = new PlaneGeometry(1, 1);
		const mesh = new Mesh(geometry, material);
		mesh.name = `country-label:${country.id}`;

		const planetPosition = this.coordinateSystem.geodeticToPlanet({
			latitudeRadians: (country.label[1] * Math.PI) / 180,
			longitudeRadians: (country.label[0] * Math.PI) / 180,
			altitudeMeters: 0
		});
		const renderScale = this.definition.renderRadiusUnits / this.definition.equatorialRadiusMeters;
		const surface = new Vector3(
			planetPosition.x * renderScale,
			planetPosition.y * renderScale,
			planetPosition.z * renderScale
		);
		const normal = surface.clone().normalize();
		mesh.position.copy(surface).addScaledVector(normal, 0.16);
		mesh.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);

		const baseHeight = countryLabelHeightUnits(country);
		const baseWidth = Math.min(15, Math.max(baseHeight * 1.4, baseHeight * aspect));
		mesh.scale.set(baseWidth, baseHeight, 1);
		this.object.add(mesh);
		this.entries.push({ mesh, texture, baseWidth, baseHeight });
	}

	private clear(): void {
		for (const entry of this.entries) {
			entry.mesh.removeFromParent();
			entry.mesh.geometry.dispose();
			entry.mesh.material.dispose();
			entry.texture.dispose();
		}
		this.entries.length = 0;
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error('Planet country label layer has been disposed.');
	}
}

function createCountryLabelTexture(name: string): { texture: CanvasTexture; aspect: number } {
	const fontSize = 58;
	const horizontalPadding = 24;
	const verticalPadding = 18;
	const measuringCanvas = document.createElement('canvas');
	const measuringContext = measuringCanvas.getContext('2d');
	if (!measuringContext) throw new Error('Unable to create country label canvas context.');
	measuringContext.font = `700 ${fontSize}px system-ui, sans-serif`;
	const measuredWidth = Math.ceil(measuringContext.measureText(name).width);

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(128, nextPowerOfTwo(measuredWidth + horizontalPadding * 2));
	canvas.height = 128;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Unable to create country label canvas context.');
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = `700 ${fontSize}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.lineJoin = 'round';
	context.strokeStyle = 'rgba(0, 0, 0, 0.92)';
	context.lineWidth = 10;
	context.strokeText(name, canvas.width / 2, canvas.height / 2);
	context.fillStyle = 'rgba(255, 255, 255, 0.96)';
	context.fillText(name, canvas.width / 2, canvas.height / 2);

	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.needsUpdate = true;
	return {
		texture,
		aspect: Math.max(1, (measuredWidth + horizontalPadding * 2) / (fontSize + verticalPadding * 2))
	};
}

function nextPowerOfTwo(value: number): number {
	let result = 1;
	while (result < value) result *= 2;
	return result;
}
