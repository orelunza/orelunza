import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	ConeGeometry,
	Euler,
	Matrix3,
	Matrix4,
	Quaternion,
	Vector3
} from 'three';
import type { CanopyShape } from '../vegetation/VegetationFamily';
import { createLeafClusterGeometry } from './LeafClusterGeometry';
import { vegetationRandom01, type VegetationZone } from './VegetationPalette';
import type { BlockCoordinate } from './voxel-types';

interface Lobe {
	position: readonly [number, number, number];
	rotation: readonly [number, number, number];
	scale: readonly [number, number, number];
	shade: number;
}

const AIRY_LOBES: readonly Lobe[] = [
	{
		position: [-0.28, 0.05, 0],
		rotation: [0.08, 0.4, -0.1],
		scale: [0.48, 0.4, 0.46],
		shade: 0.92
	},
	{
		position: [0.3, 0.08, -0.06],
		rotation: [-0.06, -0.5, 0.08],
		scale: [0.46, 0.38, 0.48],
		shade: 1.04
	},
	{ position: [0, 0.3, 0.12], rotation: [0.04, 0.2, 0.02], scale: [0.42, 0.32, 0.42], shade: 1.12 },
	{
		position: [0.02, -0.2, -0.25],
		rotation: [-0.12, -0.2, 0.05],
		scale: [0.4, 0.32, 0.44],
		shade: 0.72
	}
];

const BROAD_LOBES: readonly Lobe[] = [
	{ position: [0, 0.05, 0], rotation: [0.02, 0.2, 0], scale: [0.92, 0.32, 0.82], shade: 0.95 },
	{
		position: [-0.36, 0.12, 0.08],
		rotation: [0.08, -0.35, -0.05],
		scale: [0.62, 0.28, 0.58],
		shade: 1.02
	},
	{
		position: [0.38, 0.16, -0.1],
		rotation: [-0.05, 0.45, 0.06],
		scale: [0.6, 0.26, 0.56],
		shade: 1.08
	},
	{
		position: [0.04, -0.2, 0.14],
		rotation: [0.06, 0.1, -0.04],
		scale: [0.68, 0.22, 0.62],
		shade: 0.7
	}
];

const DROOPING_LOBES: readonly Lobe[] = [
	{
		position: [-0.24, 0.1, 0],
		rotation: [0.18, 0.25, 0.12],
		scale: [0.42, 0.78, 0.4],
		shade: 0.92
	},
	{
		position: [0.24, 0.05, -0.04],
		rotation: [-0.14, -0.35, -0.08],
		scale: [0.4, 0.82, 0.42],
		shade: 0.98
	},
	{ position: [0, 0.28, 0.22], rotation: [0.08, 0.1, 0], scale: [0.44, 0.56, 0.42], shade: 1.08 },
	{
		position: [0, -0.34, -0.18],
		rotation: [-0.12, 0.45, 0.06],
		scale: [0.38, 0.6, 0.4],
		shade: 0.68
	}
];

export function createLeafCanopyGeometry(shape: CanopyShape): BufferGeometry {
	if (shape === 'round') {
		return createLeafClusterGeometry();
	}

	if (shape === 'umbrella' || shape === 'emergent') {
		return createLobedGeometry(BROAD_LOBES, shape === 'emergent' ? 1.08 : 1);
	}

	if (shape === 'drooping') {
		return createLobedGeometry(DROOPING_LOBES, 1);
	}

	if (shape === 'layered') {
		return createNeedleGeometry();
	}

	if (shape === 'frond') {
		return createFrondGeometry();
	}

	return createLobedGeometry(AIRY_LOBES, 1);
}

export function leafCanopyShapeAt(position: BlockCoordinate, zone: VegetationZone): CanopyShape {
	const broad = vegetationRandom01(
		Math.floor(position.x / 7),
		Math.floor(position.y / 5),
		Math.floor(position.z / 7),
		0x619d
	);

	if (zone === 'Amazon Rainforest') {
		return broad < 0.35
			? 'emergent'
			: broad < 0.65
				? 'frond'
				: broad < 0.84
					? 'umbrella'
					: 'drooping';
	}

	if (zone === 'Pine Highlands') {
		return broad < 0.78 ? 'layered' : 'round';
	}

	if (zone === 'Riverbank') {
		return broad < 0.62 ? 'drooping' : broad < 0.82 ? 'frond' : 'round';
	}

	if (zone === 'Forest Edge') {
		return broad < 0.36
			? 'round'
			: broad < 0.58
				? 'layered'
				: broad < 0.8
					? 'drooping'
					: 'emergent';
	}

	return broad < 0.48 ? 'round' : broad < 0.76 ? 'umbrella' : 'drooping';
}

function createLobedGeometry(lobes: readonly Lobe[], globalScale: number): BufferGeometry {
	const source = new BoxGeometry(1, 1, 1).toNonIndexed();
	const sourcePositions = source.getAttribute('position');
	const sourceNormals = source.getAttribute('normal');
	const vertexCount = sourcePositions.count * lobes.length;
	const positions = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const colors = new Float32Array(vertexCount * 3);
	const transform = new Matrix4();
	const normalMatrix = new Matrix3();
	const quaternion = new Quaternion();
	const euler = new Euler();
	const lobePosition = new Vector3();
	const lobeScale = new Vector3();
	const position = new Vector3();
	const normal = new Vector3();
	const color = new Color();
	let outputIndex = 0;

	for (const lobe of lobes) {
		lobePosition.fromArray(lobe.position).multiplyScalar(globalScale);
		lobeScale.fromArray(lobe.scale).multiplyScalar(globalScale);
		euler.set(lobe.rotation[0], lobe.rotation[1], lobe.rotation[2]);
		quaternion.setFromEuler(euler);
		transform.compose(lobePosition, quaternion, lobeScale);
		normalMatrix.getNormalMatrix(transform);

		for (let index = 0; index < sourcePositions.count; index += 1) {
			position
				.set(sourcePositions.getX(index), sourcePositions.getY(index), sourcePositions.getZ(index))
				.applyMatrix4(transform);
			normal
				.set(sourceNormals.getX(index), sourceNormals.getY(index), sourceNormals.getZ(index))
				.applyMatrix3(normalMatrix)
				.normalize();

			const upward = Math.max(0, normal.y);
			const downward = Math.max(0, -normal.y);
			const shade = lobe.shade * (0.64 + upward * 0.4 - downward * 0.22);
			color.setRGB(shade * 0.88, shade, shade * 0.76);
			const offset = outputIndex * 3;
			positions[offset] = position.x;
			positions[offset + 1] = position.y;
			positions[offset + 2] = position.z;
			normals[offset] = normal.x;
			normals[offset + 1] = normal.y;
			normals[offset + 2] = normal.z;
			colors[offset] = color.r;
			colors[offset + 1] = color.g;
			colors[offset + 2] = color.b;
			outputIndex += 1;
		}
	}

	source.dispose();

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new BufferAttribute(normals, 3));
	geometry.setAttribute('color', new BufferAttribute(colors, 3));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;
}

function createNeedleGeometry(): BufferGeometry {
	const sources: BufferGeometry[] = [];

	for (let layer = 0; layer < 3; layer += 1) {
		const geometry = new ConeGeometry(0.62 - layer * 0.12, 0.58, 7, 1, false).toNonIndexed();
		geometry.translate(0, -0.22 + layer * 0.35, 0);
		sources.push(geometry);
	}

	const result = mergeGeometries(sources, (normalY) => {
		const shade = 0.58 + Math.max(0, normalY) * 0.34;
		return [shade * 0.72, shade, shade * 0.78] as const;
	});

	for (const source of sources) {
		source.dispose();
	}

	return result;
}

function createFrondGeometry(): BufferGeometry {
	const lobes: Lobe[] = [];

	for (let index = 0; index < 8; index += 1) {
		const angle = (index / 8) * Math.PI * 2;
		lobes.push({
			position: [Math.cos(angle) * 0.32, -0.05, Math.sin(angle) * 0.32],
			rotation: [0.22, -angle, Math.sin(angle) * 0.08],
			scale: [0.16, 0.12, 0.86],
			shade: 0.78 + (index % 3) * 0.1
		});
	}

	return createLobedGeometry(lobes, 1);
}

function mergeGeometries(
	geometries: readonly BufferGeometry[],
	colorForNormal: (normalY: number) => readonly [number, number, number]
): BufferGeometry {
	let vertexCount = 0;

	for (const geometry of geometries) {
		vertexCount += geometry.getAttribute('position').count;
	}

	const positions = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const colors = new Float32Array(vertexCount * 3);
	let cursor = 0;

	for (const geometry of geometries) {
		const sourcePositions = geometry.getAttribute('position');
		const sourceNormals = geometry.getAttribute('normal');

		for (let index = 0; index < sourcePositions.count; index += 1) {
			const offset = cursor * 3;
			const normalY = sourceNormals.getY(index);
			const color = colorForNormal(normalY);
			positions[offset] = sourcePositions.getX(index);
			positions[offset + 1] = sourcePositions.getY(index);
			positions[offset + 2] = sourcePositions.getZ(index);
			normals[offset] = sourceNormals.getX(index);
			normals[offset + 1] = normalY;
			normals[offset + 2] = sourceNormals.getZ(index);
			colors[offset] = color[0];
			colors[offset + 1] = color[1];
			colors[offset + 2] = color[2];
			cursor += 1;
		}
	}

	const result = new BufferGeometry();
	result.setAttribute('position', new BufferAttribute(positions, 3));
	result.setAttribute('normal', new BufferAttribute(normals, 3));
	result.setAttribute('color', new BufferAttribute(colors, 3));
	result.computeBoundingBox();
	result.computeBoundingSphere();

	return result;
}
