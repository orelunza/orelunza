import {
	CanvasTexture,
	FrontSide,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	Vector3
} from 'three';

import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import type { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';
import { countryLabelDistanceScale } from './PlanetCountryLabelLayer';

const PLANE_NORMAL = new Vector3(0, 0, 1);

export class PlanetLocationLabel {
	readonly object: Mesh<PlaneGeometry, MeshBasicMaterial>;
	private readonly texture: CanvasTexture;
	private readonly baseWidth: number;
	private readonly baseHeight: number;

	constructor(
		text: string,
		fill: string,
		private readonly definition: Readonly<PlanetDefinition>,
		private readonly coordinateSystem: PlanetCoordinateSystem
	) {
		const label = createLabelTexture(text, fill);
		this.texture = label.texture;
		this.baseHeight = 1.55;
		this.baseWidth = Math.min(10, this.baseHeight * label.aspect);
		this.object = new Mesh(
			new PlaneGeometry(1, 1),
			new MeshBasicMaterial({
				map: this.texture,
				transparent: true,
				depthTest: true,
				depthWrite: false,
				alphaTest: 0.06,
				side: FrontSide,
				toneMapped: false
			})
		);
		this.object.visible = false;
	}

	setCoordinate(coordinate: Readonly<GeodeticCoordinate>): void {
		const planetPosition = this.coordinateSystem.geodeticToPlanet(coordinate);
		const renderScale = this.definition.renderRadiusUnits / this.definition.equatorialRadiusMeters;
		const surface = new Vector3(
			planetPosition.x * renderScale,
			planetPosition.y * renderScale,
			planetPosition.z * renderScale
		);
		const normal = surface.clone().normalize();
		this.object.position.copy(surface).addScaledVector(normal, 0.48);
		this.object.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
		this.object.translateY(1.45);
	}

	update(cameraDistance: number): void {
		const scale = countryLabelDistanceScale(cameraDistance, this.definition.renderRadiusUnits);
		this.object.scale.set(this.baseWidth * scale, this.baseHeight * scale, 1);
	}

	dispose(): void {
		this.object.removeFromParent();
		this.object.geometry.dispose();
		this.object.material.dispose();
		this.texture.dispose();
	}
}

function createLabelTexture(
	text: string,
	fill: string
): { texture: CanvasTexture; aspect: number } {
	const fontSize = 60;
	const measuringCanvas = document.createElement('canvas');
	const measuringContext = measuringCanvas.getContext('2d');
	if (!measuringContext) throw new Error('Unable to create globe marker label canvas context.');
	measuringContext.font = `800 ${fontSize}px system-ui, sans-serif`;
	const textWidth = Math.ceil(measuringContext.measureText(text).width);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(128, nextPowerOfTwo(textWidth + 52));
	canvas.height = 128;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Unable to create globe marker label canvas context.');
	context.font = `800 ${fontSize}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.lineJoin = 'round';
	context.strokeStyle = 'rgba(0, 0, 0, 0.94)';
	context.lineWidth = 11;
	context.strokeText(text, canvas.width / 2, canvas.height / 2);
	context.fillStyle = fill;
	context.fillText(text, canvas.width / 2, canvas.height / 2);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.needsUpdate = true;
	return { texture, aspect: Math.max(1, (textWidth + 52) / 96) };
}

function nextPowerOfTwo(value: number): number {
	let result = 1;
	while (result < value) result *= 2;
	return result;
}
