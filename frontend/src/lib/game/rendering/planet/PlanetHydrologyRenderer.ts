import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Group,
	LineBasicMaterial,
	LineSegments,
	Points,
	PointsMaterial,
	Vector3
} from 'three';
import { WatershedResolver, type WatershedGrid } from '../../geography/hydrology/WatershedResolver';
import { cubeSphereSurfacePoint } from '../../planet/CubeSphere';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';
import type { PlanetGeographySystem } from '../../planet/PlanetGeographySystem';
import { planetTileKey, planetTileUvBounds, type PlanetTileId } from '../../planet/PlanetTileId';

export interface PlanetHydrologyRendererDiagnostics {
	ready: boolean;
	riverSegments: number;
	lakePoints: number;
	waterfalls: number;
}

const point = new Vector3();
const normal = new Vector3();
const MAXIMUM_RIVER_SEGMENTS = 48_000;
const MAXIMUM_LAKE_POINTS = 24_000;
const MAXIMUM_CACHED_TILES = 2048;

interface PreparedHydrologyTile {
	resolution: number;
	elevations: Float32Array;
	hydrology: WatershedGrid;
}

/** Lightweight relief-derived globe overlay for rivers, lakes and river mouths. */
export class PlanetHydrologyRenderer {
	readonly object = new Group();
	private riverGeometry = new BufferGeometry();
	private lakeGeometry = new BufferGeometry();
	private readonly rivers = new LineSegments(
		this.riverGeometry,
		new LineBasicMaterial({
			color: new Color('#55c8ff'),
			transparent: true,
			opacity: 0.78,
			depthWrite: false
		})
	);
	private readonly lakes = new Points(
		this.lakeGeometry,
		new PointsMaterial({
			color: new Color('#72d8ff'),
			size: 2.4,
			sizeAttenuation: true,
			transparent: true,
			opacity: 0.76,
			depthWrite: false
		})
	);
	private readonly tileCache = new Map<string, PreparedHydrologyTile>();
	private diagnosticsState: PlanetHydrologyRendererDiagnostics = {
		ready: false,
		riverSegments: 0,
		lakePoints: 0,
		waterfalls: 0
	};
	private disposed = false;

	constructor(private readonly definition: Readonly<PlanetDefinition>) {
		this.rivers.renderOrder = 3;
		this.lakes.renderOrder = 3;
		this.object.add(this.rivers, this.lakes);
	}

	get diagnostics(): PlanetHydrologyRendererDiagnostics {
		return { ...this.diagnosticsState };
	}

	rebuild(
		tiles: readonly PlanetTileId[],
		geography: PlanetGeographySystem,
		reliefExaggeration: number
	): void {
		if (this.disposed) return;
		const riverPositions: number[] = [];
		const lakePositions: number[] = [];
		let waterfalls = 0;
		const renderScale = this.definition.renderRadiusUnits / this.definition.equatorialRadiusMeters;
		const exaggeration = Math.max(0, Number.isFinite(reliefExaggeration) ? reliefExaggeration : 1);

		for (const tile of tiles) {
			if (riverPositions.length / 6 >= MAXIMUM_RIVER_SEGMENTS) break;
			const dataTile = geography.resolveTile(tile);
			if (!dataTile) continue;
			const resolution = tile.level <= 3 ? 5 : 7;
			const cacheKey = `${planetTileKey(tile)}@${planetTileKey(dataTile.id)}@${resolution}`;
			const prepared =
				this.takeCachedTile(cacheKey) ?? this.prepareTile(cacheKey, tile, resolution, geography);
			const { resolution: tileResolution, elevations, hydrology } = prepared;
			const bounds = planetTileUvBounds(tile);
			const count = tileResolution * tileResolution;

			for (let index = 0; index < count; index += 1) {
				const downstream = hydrology.flowTo[index] ?? -1;
				const strength = hydrology.riverStrength[index] ?? 0;
				if (
					strength > 0.08 &&
					downstream >= 0 &&
					riverPositions.length / 6 < MAXIMUM_RIVER_SEGMENTS
				) {
					this.pushCellPosition(
						riverPositions,
						tile,
						index,
						tileResolution,
						bounds,
						elevations[index] ?? 0,
						exaggeration,
						renderScale
					);
					this.pushCellPosition(
						riverPositions,
						tile,
						downstream,
						tileResolution,
						bounds,
						elevations[downstream] ?? 0,
						exaggeration,
						renderScale
					);
					waterfalls += Number((hydrology.waterfallDropMeters[index] ?? 0) > 0);
				}
				if (
					(hydrology.lakeDepthMeters[index] ?? 0) > 0 &&
					lakePositions.length / 3 < MAXIMUM_LAKE_POINTS
				) {
					this.pushCellPosition(
						lakePositions,
						tile,
						index,
						tileResolution,
						bounds,
						hydrology.filledElevationMeters[index] ?? 0,
						exaggeration,
						renderScale
					);
				}
			}
		}

		const riverGeometry = new BufferGeometry();
		riverGeometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array(riverPositions), 3)
		);
		riverGeometry.computeBoundingSphere();
		const lakeGeometry = new BufferGeometry();
		lakeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(lakePositions), 3));
		lakeGeometry.computeBoundingSphere();
		this.riverGeometry.dispose();
		this.lakeGeometry.dispose();
		this.riverGeometry = riverGeometry;
		this.lakeGeometry = lakeGeometry;
		this.rivers.geometry = riverGeometry;
		this.lakes.geometry = lakeGeometry;
		this.diagnosticsState = {
			ready: riverPositions.length > 0 || lakePositions.length > 0,
			riverSegments: riverPositions.length / 6,
			lakePoints: lakePositions.length / 3,
			waterfalls
		};
	}

	setVisible(visible: boolean): void {
		this.object.visible = visible;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.tileCache.clear();
		this.riverGeometry.dispose();
		this.lakeGeometry.dispose();
		(this.rivers.material as LineBasicMaterial).dispose();
		(this.lakes.material as PointsMaterial).dispose();
		this.object.clear();
	}

	private takeCachedTile(cacheKey: string): PreparedHydrologyTile | null {
		const cached = this.tileCache.get(cacheKey);
		if (!cached) return null;
		this.tileCache.delete(cacheKey);
		this.tileCache.set(cacheKey, cached);
		return cached;
	}

	private prepareTile(
		cacheKey: string,
		tile: Readonly<PlanetTileId>,
		resolution: number,
		geography: PlanetGeographySystem
	): PreparedHydrologyTile {
		const bounds = planetTileUvBounds(tile);
		const count = resolution * resolution;
		const elevations = new Float32Array(count);
		const land = new Uint8Array(count);
		const runoff = new Float32Array(count);

		for (let row = 0; row < resolution; row += 1) {
			for (let column = 0; column < resolution; column += 1) {
				const index = row * resolution + column;
				const u = lerp(bounds.minU, bounds.maxU, column / (resolution - 1));
				const v = lerp(bounds.minV, bounds.maxV, row / (resolution - 1));
				const sample = geography.sample(tile, u, v);
				elevations[index] = sample.elevationMeters;
				land[index] = sample.land >= 0.5 ? 1 : 0;
				cubeSphereSurfacePoint(tile.face, u, v, this.definition, point);
				const latitudeMoisture =
					1 - Math.min(1, Math.abs(point.y) / this.definition.polarRadiusMeters);
				runoff[index] = land[index] === 1 ? 0.35 + latitudeMoisture * 0.65 : 0;
			}
		}

		const angularWidth = Math.PI / 2 / 2 ** tile.level;
		const halfExtentMeters = Math.max(
			32,
			(this.definition.equatorialRadiusMeters * angularWidth) / 2
		);
		const prepared: PreparedHydrologyTile = {
			resolution,
			elevations,
			hydrology: new WatershedResolver().resolve({
				resolution,
				halfExtentMeters,
				elevationMeters: elevations,
				landMask: land,
				runoff,
				riverThreshold: Math.max(2.5, resolution * 0.48),
				minimumLakeDepthMeters: 18,
				minimumWaterfallDropMeters: 90
			})
		};
		this.tileCache.set(cacheKey, prepared);
		while (this.tileCache.size > MAXIMUM_CACHED_TILES) {
			const oldest = this.tileCache.keys().next().value;
			if (typeof oldest !== 'string') break;
			this.tileCache.delete(oldest);
		}
		return prepared;
	}

	private pushCellPosition(
		positions: number[],
		tile: Readonly<PlanetTileId>,
		index: number,
		resolution: number,
		bounds: ReturnType<typeof planetTileUvBounds>,
		elevationMeters: number,
		exaggeration: number,
		renderScale: number
	): void {
		const column = index % resolution;
		const row = Math.floor(index / resolution);
		const u = lerp(bounds.minU, bounds.maxU, column / (resolution - 1));
		const v = lerp(bounds.minV, bounds.maxV, row / (resolution - 1));
		cubeSphereSurfacePoint(tile.face, u, v, this.definition, point);
		normal.copy(point).normalize();
		const oceanShellClearanceMeters = this.definition.equatorialRadiusMeters * 0.0002;
		point
			.addScaledVector(
				normal,
				Math.max(oceanShellClearanceMeters, elevationMeters * exaggeration + 65)
			)
			.multiplyScalar(renderScale);
		positions.push(point.x, point.y, point.z);
	}
}

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * Math.max(0, Math.min(1, amount));
}
