import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { cubeSphereSurfacePoint } from '../../planet/CubeSphere';
import { EARTH_PLANET, type PlanetDefinition } from '../../planet/PlanetDefinition';
import { planetTileUvBounds, type PlanetTileId } from '../../planet/PlanetTileId';

export interface PlanetTileGeometryResult {
	surface: BufferGeometry;
	grid: BufferGeometry;
	triangleCount: number;
}

const point = new Vector3();
const colour = new Color();

export class PlanetTileRenderer {
	static buildGeometry(
		tiles: readonly PlanetTileId[],
		segmentsPerTile: number,
		definition: Readonly<PlanetDefinition> = EARTH_PLANET
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
		let positionOffset = 0;
		let indexOffset = 0;

		for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
			const tile = tiles[tileIndex];
			const bounds = planetTileUvBounds(tile);
			const baseVertex = tileIndex * verticesPerTile;
			const levelTint = Math.min(1, tile.level / Math.max(1, definition.maximumLodLevel));
			colour.setHSL(0.56 + levelTint * 0.018, 0.55, 0.31 + levelTint * 0.08);

			for (let row = 0; row <= segments; row += 1) {
				const v = bounds.minV + ((bounds.maxV - bounds.minV) * row) / segments;
				for (let column = 0; column <= segments; column += 1) {
					const u = bounds.minU + ((bounds.maxU - bounds.minU) * column) / segments;
					cubeSphereSurfacePoint(tile.face, u, v, definition, point).multiplyScalar(renderScale);
					positions[positionOffset] = point.x;
					positions[positionOffset + 1] = point.y;
					positions[positionOffset + 2] = point.z;
					point.normalize();
					normals[positionOffset] = point.x;
					normals[positionOffset + 1] = point.y;
					normals[positionOffset + 2] = point.z;
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

		return {
			surface,
			grid,
			triangleCount: (tiles.length * indicesPerTile) / 3
		};
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
				).multiplyScalar(renderScale * 1.00035);
				positions.push(point.x, point.y, point.z);
				cubeSphereSurfacePoint(
					tile.face,
					startU + (endU - startU) * to,
					startV + (endV - startV) * to,
					definition,
					point
				).multiplyScalar(renderScale * 1.00035);
				positions.push(point.x, point.y, point.z);
			}
		};

		pushEdge(bounds.minU, bounds.minV, bounds.maxU, bounds.minV);
		pushEdge(bounds.maxU, bounds.minV, bounds.maxU, bounds.maxV);
		pushEdge(bounds.maxU, bounds.maxV, bounds.minU, bounds.maxV);
		pushEdge(bounds.minU, bounds.maxV, bounds.minU, bounds.minV);
	}
}
