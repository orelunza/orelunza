import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	Euler,
	Matrix3,
	Matrix4,
	Quaternion,
	Vector3
} from 'three';

interface LeafLobe {
	position: readonly [number, number, number];
	rotation: readonly [number, number, number];
	scale: readonly [number, number, number];
	shade: number;
	tint: number;
}

const LEAF_LOBES: readonly LeafLobe[] = [
	{
		position: [-0.2, 0.03, 0.05],
		rotation: [0.08, 0.3, -0.12],
		scale: [0.66, 0.52, 0.58],
		shade: 0.96,
		tint: 0xf2f6df
	},
	{
		position: [0.2, 0.02, -0.04],
		rotation: [-0.06, -0.42, 0.09],
		scale: [0.62, 0.48, 0.6],
		shade: 1.02,
		tint: 0xe5efd3
	},
	{
		position: [0.01, 0.24, 0.04],
		rotation: [0.05, 0.18, 0.04],
		scale: [0.56, 0.42, 0.54],
		shade: 1.12,
		tint: 0xf8f2cf
	},
	{
		position: [-0.02, -0.2, 0.07],
		rotation: [-0.1, 0.56, 0.06],
		scale: [0.58, 0.38, 0.54],
		shade: 0.7,
		tint: 0xb8c8aa
	},
	{
		position: [0.02, 0.02, -0.22],
		rotation: [0.12, -0.18, -0.08],
		scale: [0.54, 0.5, 0.58],
		shade: 0.84,
		tint: 0xd0ddc1
	}
];

const TOP_COLOR = new Color(0xf5f3d7);
const SIDE_COLOR = new Color(0xc3cfad);
const BOTTOM_COLOR = new Color(0x66725b);
const CORE_COLOR = new Color(0x3f4d39);

/**
 * Builds one reusable low-poly foliage cluster.
 *
 * The geometry is intentionally asymmetric. Per-instance rotation and scale then
 * create many silhouettes while preserving one leaf draw call per chunk.
 */
export function createLeafClusterGeometry(): BufferGeometry {
	const source = new BoxGeometry(1, 1, 1).toNonIndexed();
	const sourcePositions = source.getAttribute('position');
	const sourceNormals = source.getAttribute('normal');
	const vertexCount = sourcePositions.count * LEAF_LOBES.length;
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
	const inward = new Vector3();
	const directionalColor = new Color();
	const lobeTint = new Color();
	const resultColor = new Color();
	let outputIndex = 0;

	for (const lobe of LEAF_LOBES) {
		lobePosition.fromArray(lobe.position);
		lobeScale.fromArray(lobe.scale);
		euler.set(lobe.rotation[0], lobe.rotation[1], lobe.rotation[2]);
		quaternion.setFromEuler(euler);
		transform.compose(lobePosition, quaternion, lobeScale);
		normalMatrix.getNormalMatrix(transform);
		inward.copy(lobePosition).multiplyScalar(-1);

		if (inward.lengthSq() > Number.EPSILON) {
			inward.normalize();
		}

		lobeTint.setHex(lobe.tint);

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
			directionalColor.copy(SIDE_COLOR);

			if (upward > 0) {
				directionalColor.lerp(TOP_COLOR, upward);
			} else if (downward > 0) {
				directionalColor.lerp(BOTTOM_COLOR, downward);
			}

			const inwardFacing = Math.max(0, normal.dot(inward));
			const coreDistance = Math.hypot(position.x, position.y * 0.9, position.z);
			const coreAmount = clamp01((0.48 - coreDistance) / 0.3);
			const interiorAmount = clamp01(inwardFacing * 0.52 + coreAmount * 0.68);

			resultColor
				.copy(directionalColor)
				.multiply(lobeTint)
				.multiplyScalar(lobe.shade)
				.lerp(CORE_COLOR, interiorAmount * 0.72);

			const offset = outputIndex * 3;
			positions[offset] = position.x;
			positions[offset + 1] = position.y;
			positions[offset + 2] = position.z;
			normals[offset] = normal.x;
			normals[offset + 1] = normal.y;
			normals[offset + 2] = normal.z;
			colors[offset] = resultColor.r;
			colors[offset + 1] = resultColor.g;
			colors[offset + 2] = resultColor.b;
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

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
