import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { cubeSphereSurfacePoint } from '../../planet/CubeSphere';
import { EARTH_PLANET, type PlanetDefinition } from '../../planet/PlanetDefinition';
import type { PlanetGeographySystem } from '../../planet/PlanetGeographySystem';
import { PlanetTerrainSampler } from '../../planet/PlanetTerrainSampler';
import { planetTileUvBounds, type PlanetTileId } from '../../planet/PlanetTileId';

export interface PlanetTileGeometryResult {
	surface: BufferGeometry;
	grid: BufferGeometry;
	triangleCount: number;
	loadedDataTiles: number;
	landVertexFraction: number;
	minimumElevationMeters: number;
	maximumElevationMeters: number;
}

const point = new Vector3();
const normal = new Vector3();
const colour = new Color();
const deepOcean = new Color('#071f4d');
const shelfOcean = new Color('#217fb0');
const beach = new Color('#d8c58e');
const lowland = new Color('#4d8651');
const highland = new Color('#8b7645');
const mountain = new Color('#81766b');
const snow = new Color('#e7e8e5');
const terrainSampler = new PlanetTerrainSampler();

export class PlanetTileRenderer {
	static buildGeometry(
		tiles: readonly PlanetTileId[],
		segmentsPerTile: number,
		definition: Readonly<PlanetDefinition> = EARTH_PLANET,
		geography?: PlanetGeographySystem,
		reliefExaggeration = 1
	): PlanetTileGeometryResult {
		const segments = Math.max(1, Math.floor(segmentsPerTile));
		const verticesPerSide = segments + 1;
		const verticesPerTile = verticesPerSide * verticesPerSide;
		const indicesPerTile = segments * segments * 6;
		const positions = new Float32Array(tiles.length * verticesPerTile * 3);
		const normals = new Float32Array(tiles.length * verticesPerTile * 3);
		const colours = new Float32Array(tiles.length * verticesPerTile * 3);
		const IndexArray = tiles.length * verticesPerTile > 65_535 ? Uint32Array : Uint16Array;
		const indices = new IndexArray(tiles.length * indicesPerTile);
		const gridPositions: number[] = [];
		const renderScale = definition.renderRadiusUnits / definition.equatorialRadiusMeters;
		const exaggeration = Math.max(0, Number.isFinite(reliefExaggeration) ? reliefExaggeration : 1);
		let positionOffset = 0;
		let indexOffset = 0;
		let loadedDataTiles = 0;
		let landVertices = 0;
		let minimumElevationMeters = Number.POSITIVE_INFINITY;
		let maximumElevationMeters = Number.NEGATIVE_INFINITY;

		for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
			const tile = tiles[tileIndex];
			const bounds = planetTileUvBounds(tile);
			const baseVertex = tileIndex * verticesPerTile;
			const dataTile = geography?.resolveTile(tile) ?? null;
			loadedDataTiles += Number(dataTile !== null);

			for (let row = 0; row <= segments; row += 1) {
				const v = bounds.minV + ((bounds.maxV - bounds.minV) * row) / segments;
				for (let column = 0; column <= segments; column += 1) {
					const u = bounds.minU + ((bounds.maxU - bounds.minU) * column) / segments;
					const sample = terrainSampler.sample(tile, dataTile, u, v);
					const elevationMeters =
						sample.land >= 0.5
							? Math.max(25, sample.elevationMeters)
							: Math.min(-10, sample.elevationMeters);
					minimumElevationMeters = Math.min(minimumElevationMeters, elevationMeters);
					maximumElevationMeters = Math.max(maximumElevationMeters, elevationMeters);
					landVertices += Number(sample.land >= 0.5);

					cubeSphereSurfacePoint(tile.face, u, v, definition, point);
					normal.copy(point).normalize();
					point.addScaledVector(normal, elevationMeters * exaggeration).multiplyScalar(renderScale);
					positions[positionOffset] = point.x;
					positions[positionOffset + 1] = point.y;
					positions[positionOffset + 2] = point.z;
					normals[positionOffset] = normal.x;
					normals[positionOffset + 1] = normal.y;
					normals[positionOffset + 2] = normal.z;
					PlanetTileRenderer.sampleColour(
						sample.land,
						elevationMeters,
						sample.coastProximity,
						colour
					);
					colours[positionOffset] = colour.r;
					colours[positionOffset + 1] = colour.g;
					colours[positionOffset + 2] = colour.b;
					positionOffset += 3;
				}
			}

			for (let row = 0; row < segments; row += 1) {
				for (let column = 0; column < segments; column += 1) {
					const topLeft = baseVertex + row * verticesPerSide + column;
					const topRight = topLeft + 1;
					const bottomLeft = topLeft + verticesPerSide;
					const bottomRight = bottomLeft + 1;
					indices[indexOffset++] = topLeft;
					indices[indexOffset++] = bottomLeft;
					indices[indexOffset++] = topRight;
					indices[indexOffset++] = topRight;
					indices[indexOffset++] = bottomLeft;
					indices[indexOffset++] = bottomRight;
				}
			}

			PlanetTileRenderer.appendTileGrid(gridPositions, tile, definition, renderScale, segments);
		}

		const surface = new BufferGeometry();
		surface.setAttribute('position', new BufferAttribute(positions, 3));
		surface.setAttribute('normal', new BufferAttribute(normals, 3));
		surface.setAttribute('color', new BufferAttribute(colours, 3));
		surface.setIndex(new BufferAttribute(indices, 1));
		surface.computeBoundingSphere();

		const grid = new BufferGeometry();
		grid.setAttribute('position', new BufferAttribute(new Float32Array(gridPositions), 3));
		grid.computeBoundingSphere();

		const totalVertices = Math.max(1, tiles.length * verticesPerTile);
		return {
			surface,
			grid,
			triangleCount: (tiles.length * indicesPerTile) / 3,
			loadedDataTiles,
			landVertexFraction: landVertices / totalVertices,
			minimumElevationMeters: Number.isFinite(minimumElevationMeters) ? minimumElevationMeters : 0,
			maximumElevationMeters: Number.isFinite(maximumElevationMeters) ? maximumElevationMeters : 0
		};
	}

	private static sampleColour(
		land: number,
		elevationMeters: number,
		coastProximity: number,
		target: Color
	): void {
		if (land < 0.5) {
			const depth = Math.max(0, -elevationMeters);
			target.lerpColors(shelfOcean, deepOcean, Math.min(1, depth / 7500));
			return;
		}
		if (coastProximity > 0.42 && elevationMeters < 260) {
			target.lerpColors(lowland, beach, Math.min(1, coastProximity));
			return;
		}
		if (elevationMeters < 900) {
			target.lerpColors(lowland, highland, Math.max(0, elevationMeters / 900) * 0.34);
			return;
		}
		if (elevationMeters < 3500) {
			target.lerpColors(highland, mountain, (elevationMeters - 900) / 2600);
			return;
		}
		target.lerpColors(mountain, snow, Math.min(1, (elevationMeters - 3500) / 3500));
	}

	private static appendTileGrid(
		positions: number[],
		tile: Readonly<PlanetTileId>,
		definition: Readonly<PlanetDefinition>,
		renderScale: number,
		segments: number
	): void {
		const bounds = planetTileUvBounds(tile);
		const edgeSegments = Math.max(2, segments);
		const pushEdge = (startU: number, startV: number, endU: number, endV: number): void => {
			for (let index = 0; index < edgeSegments; index += 1) {
				const from = index / edgeSegments;
				const to = (index + 1) / edgeSegments;
				cubeSphereSurfacePoint(
					tile.face,
					startU + (endU - startU) * from,
					startV + (endV - startV) * from,
					definition,
					point
				).multiplyScalar(renderScale * 1.0012);
				positions.push(point.x, point.y, point.z);
				cubeSphereSurfacePoint(
					tile.face,
					startU + (endU - startU) * to,
					startV + (endV - startV) * to,
					definition,
					point
				).multiplyScalar(renderScale * 1.0012);
				positions.push(point.x, point.y, point.z);
			}
		};

		pushEdge(bounds.minU, bounds.minV, bounds.maxU, bounds.minV);
		pushEdge(bounds.maxU, bounds.minV, bounds.maxU, bounds.maxV);
		pushEdge(bounds.maxU, bounds.maxV, bounds.minU, bounds.maxV);
		pushEdge(bounds.minU, bounds.maxV, bounds.minU, bounds.minV);
	}
}
