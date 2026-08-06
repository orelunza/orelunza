import { Vector3 } from 'three';
import { planetTileAngularRadius, planetTileCenterDirection } from './CubeSphere';
import { EARTH_PLANET, type PlanetDefinition } from './PlanetDefinition';
import { PlanetQuadtree } from './PlanetQuadtree';
import { isPlanetTileAboveHorizon } from './PlanetVisibility';
import { planetTileKey, type PlanetTileId } from './PlanetTileId';

export type PlanetLodQuality = 'low' | 'medium' | 'high';

export interface PlanetLodUpdateOptions {
	cameraPlanetPosition: Readonly<Vector3>;
	verticalFieldOfViewRadians: number;
	viewportHeightPixels: number;
	quality?: PlanetLodQuality;
	maximumLevel?: number;
	maximumTiles?: number;
}

export interface PlanetLodSnapshot {
	tiles: readonly PlanetTileId[];
	maximumLevel: number;
	visibleTileCount: number;
	splitTileCount: number;
}

const QUALITY_ERROR_PIXELS: Readonly<Record<PlanetLodQuality, number>> = Object.freeze({
	low: 88,
	medium: 56,
	high: 36
});

const QUALITY_MAX_LEVEL: Readonly<Record<PlanetLodQuality, number>> = Object.freeze({
	low: 7,
	medium: 9,
	high: 11
});

export class PlanetLodSystem {
	private readonly quadtree = new PlanetQuadtree();
	private readonly splitTiles = new Set<string>();
	private readonly tileDirection = new Vector3();
	private readonly tilePlanetPosition = new Vector3();
	private selectedTiles: PlanetTileId[] = [];

	constructor(readonly definition: Readonly<PlanetDefinition> = EARTH_PLANET) {}

	update(options: Readonly<PlanetLodUpdateOptions>): PlanetLodSnapshot {
		const quality = options.quality ?? 'medium';
		const maximumLevel = Math.min(
			this.definition.maximumLodLevel,
			Math.max(0, Math.floor(options.maximumLevel ?? QUALITY_MAX_LEVEL[quality]))
		);
		const viewportHeight = Math.max(1, options.viewportHeightPixels);
		const fov = Math.max(0.05, Math.min(Math.PI - 0.05, options.verticalFieldOfViewRadians));
		const projectionFactor = viewportHeight / (2 * Math.tan(fov * 0.5));
		const splitThreshold = QUALITY_ERROR_PIXELS[quality];
		const mergeThreshold = splitThreshold * 0.72;
		const nextSplitTiles = new Set<string>();
		let splitTileCount = 0;

		this.selectedTiles = this.quadtree.select({
			maximumLevel,
			maximumTiles: options.maximumTiles ?? 2048,
			isVisible: (tile) =>
				isPlanetTileAboveHorizon(tile, options.cameraPlanetPosition, this.definition),
			shouldSubdivide: (tile) => {
				const key = planetTileKey(tile);
				const screenError = this.screenSpaceError(
					tile,
					options.cameraPlanetPosition,
					projectionFactor
				);
				const threshold = this.splitTiles.has(key) ? mergeThreshold : splitThreshold;
				const split = screenError > threshold;
				if (split) {
					nextSplitTiles.add(key);
					splitTileCount += 1;
				}
				return split;
			}
		});

		this.splitTiles.clear();
		for (const key of nextSplitTiles) {
			this.splitTiles.add(key);
		}

		return {
			tiles: this.selectedTiles,
			maximumLevel,
			visibleTileCount: this.selectedTiles.length,
			splitTileCount
		};
	}

	reset(): void {
		this.splitTiles.clear();
		this.selectedTiles = [];
	}

	private screenSpaceError(
		tile: Readonly<PlanetTileId>,
		camera: Readonly<Vector3>,
		projectionFactor: number
	): number {
		planetTileCenterDirection(tile, this.tileDirection);
		const surfaceRadius = this.definition.equatorialRadiusMeters;
		this.tilePlanetPosition.copy(this.tileDirection).multiplyScalar(surfaceRadius);
		const distance = Math.max(1, this.tilePlanetPosition.distanceTo(camera as Vector3));
		const arcLength = surfaceRadius * planetTileAngularRadius(tile) * 2;
		return (arcLength / distance) * projectionFactor;
	}
}
