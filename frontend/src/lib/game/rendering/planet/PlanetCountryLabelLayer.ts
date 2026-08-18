import {
	CanvasTexture,
	Group,
	LinearFilter,
	PerspectiveCamera,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
	Vector2,
	Vector3
} from 'three';

import type { CountryBoundary } from '../../geography/countries/CountryBoundary';
import type { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

interface CountryLabelEntry {
	country: CountryBoundary;
	sprite: Sprite;
	texture: CanvasTexture;
	aspect: number;
	lineCount: number;
	importance: number;
	anchorLocal: Vector3;
}

export interface ScreenRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface ScreenCircle {
	x: number;
	y: number;
	radius: number;
}

interface PlacementCandidate {
	dx: number;
	dy: number;
}

const WORLD_POSITION = new Vector3();
const PLANET_CENTER = new Vector3();
const CAMERA_DIRECTION = new Vector3();
const CAMERA_RIGHT = new Vector3();
const CAMERA_UP = new Vector3();
const LABEL_NORMAL = new Vector3();
const PROJECTED = new Vector3();
const PROJECTED_CENTER = new Vector3();
const ANCHOR_WORLD = new Vector3();
const OFFSET_WORLD = new Vector3();
const SCREEN_OFFSET = new Vector2();

const MIN_FRONTNESS = 0.09;
const HORIZON_FADE_END = 0.24;
const GLOBE_EDGE_MARGIN_PX = 5;
const COLLISION_PADDING_PX = 2;

export function countryLabelImportance(country: Readonly<CountryBoundary>): number {
	const [minLon, minLat, maxLon, maxLat] = country.bounds;
	const longitudeSpan = Math.min(360, Math.abs(maxLon - minLon));
	const latitudeSpan = Math.abs(maxLat - minLat);
	const latitude = (country.label[1] * Math.PI) / 180;
	return longitudeSpan * latitudeSpan * Math.max(0.2, Math.cos(latitude));
}

/**
 * Legacy helper kept for marker labels that share the old distance scaling.
 */
export function countryLabelHeightUnits(country: Readonly<CountryBoundary>): number {
	const importance = Math.max(0, countryLabelImportance(country));
	return Math.max(0.7, Math.min(2.2, 0.62 + Math.sqrt(importance) * 0.085));
}

/**
 * Legacy helper kept for PlanetLocationLabel.
 */
export function countryLabelDistanceScale(cameraDistance: number, planetRadius: number): number {
	const surfaceDistance = Math.max(1, cameraDistance - planetRadius);
	return Math.max(0.34, Math.min(1.35, Math.sqrt(surfaceDistance / 185)));
}

export function countryLabelPixelHeight(
	country: Readonly<CountryBoundary>,
	cameraDistance: number,
	planetRadius: number
): number {
	const importance = Math.max(0, countryLabelImportance(country));
	const sizeFromArea = 11.5 + Math.log10(importance + 1) * 1.65;
	const surfaceDistance = Math.max(1, cameraDistance - planetRadius);
	const zoomAdjustment = Math.max(-1.25, Math.min(2.25, (185 - surfaceDistance) / 135));
	return Math.max(11, Math.min(18, sizeFromArea + zoomAdjustment));
}

/**
 * Wrap long country names into a compact footprint. This deliberately allows
 * three lines for very long names so labels near the edge of the globe do not
 * become extremely wide.
 */
export function countryLabelLines(name: string): string[] {
	const trimmed = name.trim();
	if (trimmed.length <= 18 || !trimmed.includes(' ')) return [trimmed];

	const words = trimmed.split(/\s+/);
	const targetLines = trimmed.length > 28 && words.length >= 4 ? 3 : 2;
	return balancedLines(words, targetLines);
}

export function screenRectFitsCircle(
	rect: Readonly<ScreenRect>,
	circle: Readonly<ScreenCircle>,
	margin = 0
): boolean {
	const radius = Math.max(0, circle.radius - margin);
	const radiusSquared = radius * radius;
	const corners = [
		[rect.left, rect.top],
		[rect.right, rect.top],
		[rect.left, rect.bottom],
		[rect.right, rect.bottom]
	] as const;
	return corners.every(([x, y]) => {
		const dx = x - circle.x;
		const dy = y - circle.y;
		return dx * dx + dy * dy <= radiusSquared;
	});
}

export function countryLabelPlacementCandidates(
	anchorX: number,
	anchorY: number,
	globe: Readonly<ScreenCircle>
): readonly PlacementCandidate[] {
	const towardCenterX = globe.x - anchorX;
	const towardCenterY = globe.y - anchorY;
	const length = Math.hypot(towardCenterX, towardCenterY);
	const inwardX = length > 1e-6 ? towardCenterX / length : 0;
	const inwardY = length > 1e-6 ? towardCenterY / length : 0;
	const tangentX = -inwardY;
	const tangentY = inwardX;

	return [
		{ dx: 0, dy: 0 },
		{ dx: inwardX * 6, dy: inwardY * 6 },
		{ dx: inwardX * 12, dy: inwardY * 12 },
		{ dx: inwardX * 18, dy: inwardY * 18 },
		{ dx: inwardX * 12 + tangentX * 7, dy: inwardY * 12 + tangentY * 7 },
		{ dx: inwardX * 12 - tangentX * 7, dy: inwardY * 12 - tangentY * 7 }
	];
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
		this.entries.sort(
			(a, b) => b.importance - a.importance || a.country.name.localeCompare(b.country.name)
		);
	}

	update(camera: PerspectiveCamera, viewportWidth: number, viewportHeight: number): void {
		this.assertUsable();
		if (viewportWidth <= 0 || viewportHeight <= 0) return;

		camera.updateMatrixWorld();
		this.object.updateWorldMatrix(true, false);
		this.object.getWorldPosition(PLANET_CENTER);
		CAMERA_DIRECTION.copy(camera.position).sub(PLANET_CENTER).normalize();
		CAMERA_RIGHT.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
		CAMERA_UP.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

		const cameraDistance = camera.position.distanceTo(PLANET_CENTER);
		const verticalFovRadians = (camera.fov * Math.PI) / 180;
		const worldHeightAtUnitDistance = 2 * Math.tan(verticalFovRadians / 2);
		const globe = projectedGlobeCircle(
			camera,
			PLANET_CENTER,
			this.definition.renderRadiusUnits,
			viewportWidth,
			viewportHeight
		);
		const occupied: ScreenRect[] = [];

		for (const entry of this.entries) {
			ANCHOR_WORLD.copy(entry.anchorLocal);
			this.object.localToWorld(ANCHOR_WORLD);
			LABEL_NORMAL.copy(ANCHOR_WORLD).sub(PLANET_CENTER).normalize();
			const frontness = LABEL_NORMAL.dot(CAMERA_DIRECTION);
			if (frontness <= MIN_FRONTNESS) {
				entry.sprite.visible = false;
				continue;
			}

			PROJECTED.copy(ANCHOR_WORLD).project(camera);
			if (PROJECTED.z < -1 || PROJECTED.z > 1) {
				entry.sprite.visible = false;
				continue;
			}

			const anchorX = (PROJECTED.x * 0.5 + 0.5) * viewportWidth;
			const anchorY = (-PROJECTED.y * 0.5 + 0.5) * viewportHeight;
			const textPixelHeight = countryLabelPixelHeight(
				entry.country,
				cameraDistance,
				this.definition.renderRadiusUnits
			);
			const pixelHeight = textPixelHeight * entry.lineCount * 1.08 + 3;
			const pixelWidth = pixelHeight * entry.aspect;
			const candidates = countryLabelPlacementCandidates(anchorX, anchorY, globe);
			let acceptedRect: ScreenRect | null = null;
			let acceptedOffset: PlacementCandidate | null = null;

			for (const candidate of candidates) {
				const centerX = anchorX + candidate.dx;
				const centerY = anchorY + candidate.dy;
				const rect = screenRect(centerX, centerY, pixelWidth, pixelHeight, COLLISION_PADDING_PX);
				if (!screenRectFitsCircle(rect, globe, GLOBE_EDGE_MARGIN_PX)) continue;
				if (occupied.some((other) => rectanglesOverlap(rect, other))) continue;
				acceptedRect = rect;
				acceptedOffset = candidate;
				break;
			}

			if (!acceptedRect || !acceptedOffset) {
				entry.sprite.visible = false;
				continue;
			}

			const distanceToLabel = camera.position.distanceTo(ANCHOR_WORLD);
			const worldPerPixel =
				(worldHeightAtUnitDistance * distanceToLabel) / Math.max(1, viewportHeight);
			SCREEN_OFFSET.set(acceptedOffset.dx, acceptedOffset.dy);
			OFFSET_WORLD.copy(ANCHOR_WORLD)
				.addScaledVector(CAMERA_RIGHT, SCREEN_OFFSET.x * worldPerPixel)
				.addScaledVector(CAMERA_UP, -SCREEN_OFFSET.y * worldPerPixel);
			this.object.worldToLocal(OFFSET_WORLD);
			entry.sprite.position.copy(OFFSET_WORLD);

			const worldHeight = worldPerPixel * pixelHeight;
			entry.sprite.scale.set(worldHeight * entry.aspect, worldHeight, 1);
			entry.sprite.material.opacity = smoothstep(MIN_FRONTNESS, HORIZON_FADE_END, frontness);
			entry.sprite.visible = true;
			occupied.push(acceptedRect);
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clear();
		this.object.removeFromParent();
	}

	private addCountry(country: CountryBoundary): void {
		const { texture, aspect, lineCount } = createCountryLabelTexture(country.name);
		const material = new SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: true,
			depthWrite: false,
			alphaTest: 0.08,
			toneMapped: false
		});
		const sprite = new Sprite(material);
		sprite.name = `country-label:${country.id}`;
		sprite.center.set(0.5, 0.5);

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
		const anchorLocal = surface.clone().addScaledVector(normal, 0.22);
		sprite.position.copy(anchorLocal);
		sprite.visible = false;

		this.object.add(sprite);
		this.entries.push({
			country,
			sprite,
			texture,
			aspect,
			lineCount,
			importance: countryLabelImportance(country),
			anchorLocal
		});
	}

	private clear(): void {
		for (const entry of this.entries) {
			entry.sprite.removeFromParent();
			entry.sprite.material.dispose();
			entry.texture.dispose();
		}
		this.entries.length = 0;
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error('Planet country label layer has been disposed.');
	}
}

function balancedLines(words: readonly string[], targetLines: number): string[] {
	if (targetLines <= 1 || words.length <= 1) return [words.join(' ')];
	if (targetLines === 2) {
		let bestIndex = 1;
		let bestScore = Number.POSITIVE_INFINITY;
		for (let index = 1; index < words.length; index += 1) {
			const first = words.slice(0, index).join(' ');
			const second = words.slice(index).join(' ');
			const score =
				Math.max(first.length, second.length) * 2 + Math.abs(first.length - second.length);
			if (score < bestScore) {
				bestScore = score;
				bestIndex = index;
			}
		}
		return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
	}

	let best: string[] = [words.join(' ')];
	let bestScore = Number.POSITIVE_INFINITY;
	for (let firstBreak = 1; firstBreak <= words.length - 2; firstBreak += 1) {
		for (let secondBreak = firstBreak + 1; secondBreak <= words.length - 1; secondBreak += 1) {
			const lines = [
				words.slice(0, firstBreak).join(' '),
				words.slice(firstBreak, secondBreak).join(' '),
				words.slice(secondBreak).join(' ')
			];
			const lengths = lines.map((line) => line.length);
			const maxLength = Math.max(...lengths);
			const minLength = Math.min(...lengths);
			const score = maxLength * 3 + (maxLength - minLength);
			if (score < bestScore) {
				bestScore = score;
				best = lines;
			}
		}
	}
	return best;
}

function projectedGlobeCircle(
	camera: PerspectiveCamera,
	centerWorld: Readonly<Vector3>,
	radiusWorld: number,
	viewportWidth: number,
	viewportHeight: number
): ScreenCircle {
	PROJECTED_CENTER.copy(centerWorld).project(camera);
	const centerX = (PROJECTED_CENTER.x * 0.5 + 0.5) * viewportWidth;
	const centerY = (-PROJECTED_CENTER.y * 0.5 + 0.5) * viewportHeight;
	const distance = camera.position.distanceTo(centerWorld);
	const safeDistance = Math.max(radiusWorld + 1e-5, distance);
	const angularTangent =
		radiusWorld / Math.sqrt(Math.max(1e-6, safeDistance ** 2 - radiusWorld ** 2));
	const verticalFovRadians = (camera.fov * Math.PI) / 180;
	const radiusPixels = (angularTangent / Math.tan(verticalFovRadians / 2)) * (viewportHeight / 2);
	return { x: centerX, y: centerY, radius: Math.max(0, radiusPixels) };
}

function screenRect(
	centerX: number,
	centerY: number,
	width: number,
	height: number,
	padding: number
): ScreenRect {
	return {
		left: centerX - width / 2 - padding,
		top: centerY - height / 2 - padding,
		right: centerX + width / 2 + padding,
		bottom: centerY + height / 2 + padding
	};
}

function rectanglesOverlap(a: Readonly<ScreenRect>, b: Readonly<ScreenRect>): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function createCountryLabelTexture(name: string): {
	texture: CanvasTexture;
	aspect: number;
	lineCount: number;
} {
	const lines = countryLabelLines(name);
	const fontSize = 48;
	const lineHeight = 51;
	const horizontalPadding = 12;
	const verticalPadding = 9;
	const measuringCanvas = document.createElement('canvas');
	const measuringContext = measuringCanvas.getContext('2d');
	if (!measuringContext) throw new Error('Unable to create country label canvas context.');
	measuringContext.font = `600 ${fontSize}px system-ui, sans-serif`;
	const measuredWidth = Math.ceil(
		Math.max(...lines.map((line) => measuringContext.measureText(line).width))
	);

	const contentWidth = measuredWidth + horizontalPadding * 2;
	const contentHeight = lines.length * lineHeight + verticalPadding * 2;
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(88, Math.ceil(contentWidth));
	canvas.height = Math.max(58, Math.ceil(contentHeight));
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Unable to create country label canvas context.');
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = `600 ${fontSize}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.lineJoin = 'round';
	context.strokeStyle = 'rgba(0, 0, 0, 0.58)';
	context.lineWidth = 3;
	context.fillStyle = 'rgba(255, 255, 255, 0.96)';
	const centerY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
	for (let index = 0; index < lines.length; index += 1) {
		const y = centerY + index * lineHeight;
		context.strokeText(lines[index], canvas.width / 2, y);
		context.fillText(lines[index], canvas.width / 2, y);
	}

	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	texture.needsUpdate = true;
	return {
		texture,
		aspect: Math.max(1, canvas.width / canvas.height),
		lineCount: lines.length
	};
}
