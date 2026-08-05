import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CylinderGeometry,
	DoubleSide,
	PlaneGeometry
} from 'three';
import type { GroundShape } from './VegetationFamily';

export function createGroundFoliageGeometry(shape: GroundShape): BufferGeometry {
	switch (shape) {
		case 'short-grass':
			return createBladeFanGeometry(5, 0.48, 0.12, 0.02);
		case 'fern':
			return createFernGeometry(6, 0.68, 0.16, 0.26);
		case 'tropical-fern':
			return createFernGeometry(8, 1.02, 0.22, 0.34);
		case 'shrub':
			return createShrubGeometry();
		case 'flower':
			return createFlowerGeometry();
		case 'moss':
			return createMossGeometry();
	}
}

export const GROUND_FOLIAGE_SIDE = DoubleSide;

function createBladeFanGeometry(
	bladeCount: number,
	height: number,
	baseHalfWidth: number,
	topHalfWidth: number
): BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];

	for (let blade = 0; blade < bladeCount; blade += 1) {
		const angle = (blade / bladeCount) * Math.PI;
		const tangentX = Math.cos(angle);
		const tangentZ = Math.sin(angle);
		const normalX = tangentZ;
		const normalZ = -tangentX;
		const localHeight = height * (0.82 + ((blade * 37) % 5) * 0.045);
		const vertices = [
			[-tangentX * baseHalfWidth, 0, -tangentZ * baseHalfWidth],
			[tangentX * baseHalfWidth, 0, tangentZ * baseHalfWidth],
			[tangentX * topHalfWidth, localHeight, tangentZ * topHalfWidth],
			[-tangentX * baseHalfWidth, 0, -tangentZ * baseHalfWidth],
			[tangentX * topHalfWidth, localHeight, tangentZ * topHalfWidth],
			[-tangentX * topHalfWidth, localHeight, -tangentZ * topHalfWidth]
		] as const;

		for (const vertex of vertices) {
			positions.push(vertex[0], vertex[1], vertex[2]);
			normals.push(normalX, 0.18, normalZ);
			const amount = vertex[1] / localHeight;
			colors.push(0.58 + amount * 0.38, 0.66 + amount * 0.34, 0.5 + amount * 0.35);
		}
	}

	return geometryFromArrays(positions, normals, colors);
}

function createFernGeometry(
	frondCount: number,
	length: number,
	width: number,
	height: number
): BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];

	for (let frond = 0; frond < frondCount; frond += 1) {
		const angle = (frond / frondCount) * Math.PI * 2;
		const directionX = Math.cos(angle);
		const directionZ = Math.sin(angle);
		const tangentX = -directionZ;
		const tangentZ = directionX;
		const tipX = directionX * length;
		const tipZ = directionZ * length;
		const centerY = height * (0.75 + (frond % 3) * 0.08);
		const vertices = [
			[-tangentX * width, 0.04, -tangentZ * width],
			[tangentX * width, 0.04, tangentZ * width],
			[tipX, centerY, tipZ],
			[-tangentX * width, 0.04, -tangentZ * width],
			[tipX, centerY, tipZ],
			[
				directionX * length * 0.52 - tangentX * width * 0.72,
				centerY * 0.72,
				directionZ * length * 0.52 - tangentZ * width * 0.72
			]
		] as const;

		for (const vertex of vertices) {
			positions.push(vertex[0], vertex[1], vertex[2]);
			normals.push(-directionX * 0.2, 0.96, -directionZ * 0.2);
			const amount = Math.min(1, Math.hypot(vertex[0], vertex[2]) / length);
			colors.push(0.54 + amount * 0.3, 0.66 + amount * 0.3, 0.5 + amount * 0.22);
		}
	}

	return geometryFromArrays(positions, normals, colors);
}

function createShrubGeometry(): BufferGeometry {
	const parts: BufferGeometry[] = [];
	const lobes = [
		[-0.22, 0.3, 0.02, 0.55, 0.52, 0.5],
		[0.24, 0.32, -0.04, 0.52, 0.58, 0.54],
		[0.02, 0.55, 0.08, 0.48, 0.5, 0.46],
		[0.03, 0.23, -0.24, 0.5, 0.44, 0.5]
	] as const;

	for (const [x, y, z, sx, sy, sz] of lobes) {
		const geometry = new BoxGeometry(sx, sy, sz).toNonIndexed();
		geometry.translate(x, y, z);
		parts.push(geometry);
	}

	const merged = mergeGeometries(parts, 0.7, 0.86, 0.64);

	for (const part of parts) {
		part.dispose();
	}

	return merged;
}

function createFlowerGeometry(): BufferGeometry {
	const parts: BufferGeometry[] = [];
	const stem = new CylinderGeometry(0.025, 0.035, 0.62, 4, 1, false).toNonIndexed();
	stem.translate(0, 0.31, 0);
	parts.push(stem);

	for (let petal = 0; petal < 6; petal += 1) {
		const angle = (petal / 6) * Math.PI * 2;
		const plane = new PlaneGeometry(0.23, 0.13).toNonIndexed();
		plane.rotateX(-Math.PI / 2 + 0.34);
		plane.rotateY(-angle);
		plane.translate(Math.cos(angle) * 0.13, 0.67, Math.sin(angle) * 0.13);
		parts.push(plane);
	}

	const center = new BoxGeometry(0.12, 0.08, 0.12).toNonIndexed();
	center.translate(0, 0.68, 0);
	parts.push(center);
	const merged = mergeGeometries(parts, 0.82, 0.92, 0.78, true);

	for (const part of parts) {
		part.dispose();
	}

	return merged;
}

function createMossGeometry(): BufferGeometry {
	const positions = [
		-0.45, 0.018, -0.3, 0.42, 0.024, -0.35, 0.33, 0.02, 0.38, -0.45, 0.018, -0.3, 0.33, 0.02, 0.38,
		-0.36, 0.026, 0.32
	];
	const normals = new Array(positions.length).fill(0);
	const colors = new Array(positions.length).fill(0);

	for (let index = 0; index < positions.length / 3; index += 1) {
		normals[index * 3 + 1] = 1;
		colors[index * 3] = 0.68;
		colors[index * 3 + 1] = 0.78;
		colors[index * 3 + 2] = 0.56;
	}

	return geometryFromArrays(positions, normals, colors);
}

function mergeGeometries(
	geometries: readonly BufferGeometry[],
	r: number,
	g: number,
	b: number,
	flower = false
): BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];

	for (let geometryIndex = 0; geometryIndex < geometries.length; geometryIndex += 1) {
		const geometry = geometries[geometryIndex];
		const sourcePositions = geometry.getAttribute('position');
		const sourceNormals = geometry.getAttribute('normal');
		const isStem = flower && geometryIndex === 0;

		for (let index = 0; index < sourcePositions.count; index += 1) {
			positions.push(
				sourcePositions.getX(index),
				sourcePositions.getY(index),
				sourcePositions.getZ(index)
			);
			normals.push(sourceNormals.getX(index), sourceNormals.getY(index), sourceNormals.getZ(index));

			if (isStem) {
				colors.push(0.26, 0.5, 0.23);
			} else {
				const light = 0.84 + Math.max(0, sourceNormals.getY(index)) * 0.16;
				colors.push(r * light, g * light, b * light);
			}
		}
	}

	return geometryFromArrays(positions, normals, colors);
}

function geometryFromArrays(
	positions: readonly number[],
	normals: readonly number[],
	colors: readonly number[]
): BufferGeometry {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
	geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
	geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;
}
