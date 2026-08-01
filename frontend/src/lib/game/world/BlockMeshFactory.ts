import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
	InstancedMesh,
	Matrix4,
	MeshLambertMaterial,
	Object3D,
	type Material
} from 'three';
import { BlockRegistry } from './BlockRegistry';
import type { BlockCoordinate, BlockType, VoxelBlock } from './voxel-types';

export interface BlockInstanceLookup {
	mesh: InstancedMesh;
	blocks: BlockCoordinate[];
	type: BlockType;
}

const FLOWER_GEOMETRY = new ConeGeometry(0.18, 0.52, 5);
const BLOCK_GEOMETRY = new BoxGeometry(1, 1, 1);
const TRUNK_GEOMETRY = new CylinderGeometry(0.22, 0.3, 1, 6);
const LEAVES_GEOMETRY = new DodecahedronGeometry(0.62, 0);

export class BlockMeshFactory {
	private readonly materials = new Map<BlockType, Material>();

	createMeshes(blocks: VoxelBlock[]): BlockInstanceLookup[] {
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

			mesh.castShadow = type !== 'water' && type !== 'flower';
			mesh.receiveShadow = true;

			typedBlocks.forEach((block, index) => {
				helper.position.set(block.position.x + 0.5, block.position.y + 0.5, block.position.z + 0.5);

				if (type === 'flower') {
					helper.position.y = block.position.y + 0.31;
					helper.scale.setScalar(0.75 + pseudoRandom(block.position.x, block.position.z) * 0.45);
					helper.rotation.y = pseudoRandom(block.position.z, block.position.x) * Math.PI;
				} else if (type === 'wood') {
					helper.scale.set(0.82, 1, 0.82);
					helper.rotation.y = pseudoRandom(block.position.x, block.position.z) * Math.PI;
				} else if (type === 'leaves') {
					const scale = 0.95 + pseudoRandom(block.position.x, block.position.z) * 0.3;
					helper.scale.set(scale, scale * 0.86, scale);
					helper.rotation.set(
						pseudoRandom(block.position.x, block.position.y) * 0.18,
						pseudoRandom(block.position.z, block.position.y) * Math.PI,
						pseudoRandom(block.position.x, block.position.z) * 0.18
					);
				} else {
					helper.scale.setScalar(1);
					helper.rotation.set(0, 0, 0);
				}

				helper.updateMatrix();
				matrix.copy(helper.matrix);
				mesh.setMatrixAt(index, matrix);
			});

			mesh.instanceMatrix.needsUpdate = true;
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
		const material = new MeshLambertMaterial({
			color: definition.color,
			transparent: definition.transparent,
			opacity: type === 'water' ? 0.62 : type === 'glass' ? 0.45 : type === 'leaves' ? 0.86 : 1
		});

		this.materials.set(type, material);

		return material;
	}
}

function geometryFor(type: BlockType) {
	if (type === 'flower') {
		return FLOWER_GEOMETRY;
	}

	if (type === 'wood') {
		return TRUNK_GEOMETRY;
	}

	if (type === 'leaves') {
		return LEAVES_GEOMETRY;
	}

	return BLOCK_GEOMETRY;
}

function pseudoRandom(x: number, z: number): number {
	const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;

	return value - Math.floor(value);
}
