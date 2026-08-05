import { BufferAttribute, BufferGeometry } from 'three';

export const TALL_GRASS_PLANE_COUNT = 3;

const BLADE_HEIGHT = 1;
const BLADE_BASE_HALF_WIDTH = 0.2;
const BLADE_TOP_HALF_WIDTH = 0.045;

/**
 * Creates one reusable tuft made from three crossed, tapered cards.
 *
 * The cards are real low-poly geometry rather than transparent rectangles, so
 * the tuft has no alpha sorting cost and remains readable from every angle.
 * Every tall-grass instance reuses this geometry.
 */
export function createTallGrassGeometry(): BufferGeometry {
	const verticesPerPlane = 6;
	const vertexCount = TALL_GRASS_PLANE_COUNT * verticesPerPlane;
	const positions = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const colors = new Float32Array(vertexCount * 3);
	const uvs = new Float32Array(vertexCount * 2);
	let vertexIndex = 0;

	for (let planeIndex = 0; planeIndex < TALL_GRASS_PLANE_COUNT; planeIndex += 1) {
		const angle = (planeIndex / TALL_GRASS_PLANE_COUNT) * Math.PI;
		const tangentX = Math.cos(angle);
		const tangentZ = Math.sin(angle);
		const normalLength = Math.hypot(tangentZ, 0.18, -tangentX);
		const normalX = tangentZ / normalLength;
		const normalY = 0.18 / normalLength;
		const normalZ = -tangentX / normalLength;
		const bottomLeft: readonly [number, number, number] = [
			-tangentX * BLADE_BASE_HALF_WIDTH,
			0,
			-tangentZ * BLADE_BASE_HALF_WIDTH
		];
		const bottomRight: readonly [number, number, number] = [
			tangentX * BLADE_BASE_HALF_WIDTH,
			0,
			tangentZ * BLADE_BASE_HALF_WIDTH
		];
		const topLeft: readonly [number, number, number] = [
			-tangentX * BLADE_TOP_HALF_WIDTH,
			BLADE_HEIGHT,
			-tangentZ * BLADE_TOP_HALF_WIDTH
		];
		const topRight: readonly [number, number, number] = [
			tangentX * BLADE_TOP_HALF_WIDTH,
			BLADE_HEIGHT,
			tangentZ * BLADE_TOP_HALF_WIDTH
		];

		const triangleVertices: ReadonlyArray<{
			position: readonly [number, number, number];
			uv: readonly [number, number];
		}> = [
			{ position: bottomLeft, uv: [0, 0] },
			{ position: bottomRight, uv: [1, 0] },
			{ position: topRight, uv: [0.62, 1] },
			{ position: bottomLeft, uv: [0, 0] },
			{ position: topRight, uv: [0.62, 1] },
			{ position: topLeft, uv: [0.38, 1] }
		];

		for (const vertex of triangleVertices) {
			const positionOffset = vertexIndex * 3;
			const uvOffset = vertexIndex * 2;
			const height = vertex.position[1] / BLADE_HEIGHT;
			const shade = 0.56 + height * 0.44;

			positions[positionOffset] = vertex.position[0];
			positions[positionOffset + 1] = vertex.position[1];
			positions[positionOffset + 2] = vertex.position[2];
			normals[positionOffset] = normalX;
			normals[positionOffset + 1] = normalY;
			normals[positionOffset + 2] = normalZ;
			colors[positionOffset] = shade;
			colors[positionOffset + 1] = shade;
			colors[positionOffset + 2] = shade * (0.92 + height * 0.08);
			uvs[uvOffset] = vertex.uv[0];
			uvs[uvOffset + 1] = vertex.uv[1];
			vertexIndex += 1;
		}
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new BufferAttribute(normals, 3));
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;
}
