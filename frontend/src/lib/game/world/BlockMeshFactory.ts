import {
	BoxGeometry,
	BufferAttribute,
	Color,
	ConeGeometry,
	CylinderGeometry,
	InstancedMesh,
	Matrix4,
	MeshLambertMaterial,
	Object3D,
	type BufferGeometry,
	type Material
} from 'three';
import { BlockRegistry } from './BlockRegistry';
import { createLeafClusterGeometry } from './LeafClusterGeometry';
import { vegetationRandom01, vegetationTintAt } from './VegetationPalette';
import type { VoxelWorld } from './VoxelWorld';
import type { BlockCoordinate, BlockType, VoxelBlock } from './voxel-types';

export interface BlockInstanceLookup {
	mesh: InstancedMesh;
	blocks: BlockCoordinate[];
	type: BlockType;
}

const FLOWER_GEOMETRY = new ConeGeometry(0.18, 0.52, 5);
const BLOCK_GEOMETRY = new BoxGeometry(1, 1, 1);
const GRASS_GEOMETRY = createGrassGeometry();
const TRUNK_GEOMETRY = new CylinderGeometry(0.22, 0.3, 1, 6);
const LEAVES_GEOMETRY = createLeafClusterGeometry();
const INSTANCE_COLOR_TYPES = new Set<BlockType>(['grass', 'leaves']);

export class BlockMeshFactory {
	private readonly materials = new Map<BlockType, Material>();
	private readonly instanceColor = new Color();

	createMeshes(blocks: VoxelBlock[], world?: VoxelWorld): BlockInstanceLookup[] {
		const byType = new Map<BlockType, VoxelBlock[]>();

		for (const block of blocks) {
			if (block.type === 'air') {
				continue;
			}

			const list = byType.get(block.type) ?? [];
			list.push(block);
			byType.set(block.type, list);
		}

		const lookups: BlockInstanceLookup[] = [];
		const helper = new Object3D();
		const matrix = new Matrix4();

		for (const [type, typedBlocks] of byType) {
			const mesh = new InstancedMesh(geometryFor(type), this.materialFor(type), typedBlocks.length);

			mesh.name = `orelunzaBlocks:${type}`;
			mesh.castShadow = type !== 'water' && type !== 'flower' && type !== 'glass';
			mesh.receiveShadow = type !== 'water';

			typedBlocks.forEach((block, index) => {
				helper.position.set(block.position.x + 0.5, block.position.y + 0.5, block.position.z + 0.5);
				helper.rotation.set(0, 0, 0);
				helper.scale.set(1, 1, 1);

				if (type === 'flower') {
					helper.position.y = block.position.y + 0.31;
					helper.scale.setScalar(0.75 + pseudoRandom(block.position.x, block.position.z) * 0.45);
					helper.rotation.y = pseudoRandom(block.position.z, block.position.x) * Math.PI;
				} else if (type === 'wood') {
					helper.scale.set(0.82, 1, 0.82);
					helper.rotation.y = pseudoRandom(block.position.x, block.position.z) * Math.PI;
				} else if (type === 'leaves') {
					const width =
						0.88 +
						vegetationRandom01(block.position.x, block.position.y, block.position.z, 0x51) * 0.3;
					const height =
						0.86 +
						vegetationRandom01(block.position.z, block.position.y, block.position.x, 0x93) * 0.26;
					const depth =
						0.88 +
						vegetationRandom01(block.position.y, block.position.x, block.position.z, 0xb7) * 0.28;
					const jitterX =
						(vegetationRandom01(block.position.x, block.position.y, block.position.z, 0xc1) - 0.5) *
						0.1;
					const jitterY =
						(vegetationRandom01(block.position.z, block.position.x, block.position.y, 0xd3) - 0.5) *
						0.08;
					const jitterZ =
						(vegetationRandom01(block.position.y, block.position.z, block.position.x, 0xe5) - 0.5) *
						0.1;

					helper.position.x += jitterX;
					helper.position.y += jitterY;
					helper.position.z += jitterZ;
					helper.scale.set(width, height, depth);
					helper.rotation.set(
						(vegetationRandom01(block.position.x, block.position.y, block.position.z, 0x13) - 0.5) *
							0.18,
						vegetationRandom01(block.position.z, block.position.y, block.position.x, 0x27) *
							Math.PI *
							2,
						(vegetationRandom01(block.position.x, block.position.z, block.position.y, 0x39) - 0.5) *
							0.16
					);
				}

				helper.updateMatrix();
				matrix.copy(helper.matrix);
				mesh.setMatrixAt(index, matrix);

				if (INSTANCE_COLOR_TYPES.has(type)) {
					const zone = world?.terrainGenerator.zoneAt(block.position.x, block.position.z) ?? '';
					this.instanceColor.setHex(
						vegetationTintAt(type as 'grass' | 'leaves', block.position, zone)
					);
					mesh.setColorAt(index, this.instanceColor);
				}
			});

			mesh.instanceMatrix.needsUpdate = true;

			if (mesh.instanceColor) {
				mesh.instanceColor.needsUpdate = true;
			}

			lookups.push({
				mesh,
				blocks: typedBlocks.map((block) => block.position),
				type
			});
		}

		return lookups;
	}

	dispose(): void {
		BLOCK_GEOMETRY.dispose();
		GRASS_GEOMETRY.dispose();
		FLOWER_GEOMETRY.dispose();
		TRUNK_GEOMETRY.dispose();
		LEAVES_GEOMETRY.dispose();

		for (const material of this.materials.values()) {
			material.dispose();
		}

		this.materials.clear();
	}

	private materialFor(type: BlockType): Material {
		const cached = this.materials.get(type);

		if (cached) {
			return cached;
		}

		const definition = BlockRegistry.get(type);
		const usesInstanceColor = INSTANCE_COLOR_TYPES.has(type);
		const renderTransparent = type === 'water' || type === 'glass';
		const material = new MeshLambertMaterial({
			color: usesInstanceColor ? 0xffffff : definition.color,
			vertexColors: type === 'grass' || type === 'leaves',
			transparent: renderTransparent,
			opacity: type === 'water' ? 0.62 : type === 'glass' ? 0.45 : 1,
			depthWrite: type !== 'water' && type !== 'glass'
		});

		this.materials.set(type, material);

		return material;
	}
}

function geometryFor(type: BlockType): BufferGeometry {
	if (type === 'flower') {
		return FLOWER_GEOMETRY;
	}

	if (type === 'grass') {
		return GRASS_GEOMETRY;
	}

	if (type === 'wood') {
		return TRUNK_GEOMETRY;
	}

	if (type === 'leaves') {
		return LEAVES_GEOMETRY;
	}

	return BLOCK_GEOMETRY;
}

function createGrassGeometry(): BoxGeometry {
	const geometry = new BoxGeometry(1, 1, 1);

	applyDirectionalColors(geometry, {
		top: 0xffffff,
		side: 0xb5b79a,
		bottom: 0x72745b
	});

	return geometry;
}

function applyDirectionalColors(
	geometry: BufferGeometry,
	colors: { top: number; side: number; bottom: number }
): void {
	const normals = geometry.getAttribute('normal');
	const values = new Float32Array(normals.count * 3);
	const top = new Color(colors.top);
	const side = new Color(colors.side);
	const bottom = new Color(colors.bottom);
	const result = new Color();

	for (let index = 0; index < normals.count; index += 1) {
		const normalY = normals.getY(index);
		const upward = Math.max(0, normalY);
		const downward = Math.max(0, -normalY);

		result.copy(side);

		if (upward > 0) {
			result.lerp(top, upward);
		} else if (downward > 0) {
			result.lerp(bottom, downward);
		}

		values[index * 3] = result.r;
		values[index * 3 + 1] = result.g;
		values[index * 3 + 2] = result.b;
	}

	geometry.setAttribute('color', new BufferAttribute(values, 3));
}

function pseudoRandom(x: number, z: number): number {
	const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;

	return value - Math.floor(value);
}
