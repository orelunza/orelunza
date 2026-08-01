import {
	BoxGeometry,
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

const FLOWER_GEOMETRY = new BoxGeometry(0.28, 0.62, 0.28);
const BLOCK_GEOMETRY = new BoxGeometry(1, 1, 1);

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
			const mesh = new InstancedMesh(
				type === 'flower' ? FLOWER_GEOMETRY : BLOCK_GEOMETRY,
				this.materialFor(type),
				typedBlocks.length
			);

			mesh.castShadow = type !== 'water' && type !== 'flower';
			mesh.receiveShadow = true;

			typedBlocks.forEach((block, index) => {
				helper.position.set(block.position.x + 0.5, block.position.y + 0.5, block.position.z + 0.5);

				if (type === 'flower') {
					helper.position.y = block.position.y + 0.31;
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
