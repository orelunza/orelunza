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
import type { CanopyShape } from '../vegetation/VegetationFamily';
import { BlockRegistry } from './BlockRegistry';
import { createLeafCanopyGeometry, leafCanopyShapeAt } from './LeafCanopyGeometry';
import { vegetationRandom01, vegetationTintAt, woodTintAt } from './VegetationPalette';
import type { VoxelWorld } from './VoxelWorld';
import type { SurfaceWeatherFrameState } from '../environment/surface/SurfaceWeatherState';
import type { BlockCoordinate, BlockType, VoxelBlock } from './voxel-types';

export interface BlockInstanceLookup {
	mesh: InstancedMesh;
	blocks: BlockCoordinate[];
	type: BlockType;
}

interface RenderGroup {
	type: BlockType;
	variant: CanopyShape | 'default';
	blocks: VoxelBlock[];
}

const FLOWER_GEOMETRY = new ConeGeometry(0.18, 0.52, 5);
const BLOCK_GEOMETRY = new BoxGeometry(1, 1, 1);
const GRASS_GEOMETRY = createGrassGeometry();
const TRUNK_GEOMETRY = new CylinderGeometry(0.22, 0.3, 1, 6);
const LEAF_SHAPES: readonly CanopyShape[] = [
	'round',
	'umbrella',
	'layered',
	'emergent',
	'frond',
	'drooping'
];
const LEAF_GEOMETRIES = new Map<CanopyShape, BufferGeometry>(
	LEAF_SHAPES.map((shape) => [shape, createLeafCanopyGeometry(shape)])
);
const INSTANCE_COLOR_TYPES = new Set<BlockType>(['grass', 'leaves', 'wood']);

export class BlockMeshFactory {
	private readonly materials = new Map<BlockType, Material>();
	private readonly baseMaterialColors = new Map<BlockType, Color>();
	private readonly instanceColor = new Color();
	private readonly surfaceTint = new Color();
	private surfaceWetness = 0;
	private surfaceSnowCoverage = 0;
	private surfaceFrost = 0;

	createMeshes(blocks: VoxelBlock[], world?: VoxelWorld): BlockInstanceLookup[] {
		const groups = new Map<string, RenderGroup>();

		for (const block of blocks) {
			if (block.type === 'air') {
				continue;
			}

			const zone = world?.terrainGenerator.zoneAt(block.position.x, block.position.z) ?? '';
			const variant =
				block.type === 'leaves' ? leafCanopyShapeAt(block.position, zone) : ('default' as const);
			const key = `${block.type}:${variant}`;
			const group = groups.get(key) ?? { type: block.type, variant, blocks: [] };
			group.blocks.push(block);
			groups.set(key, group);
		}

		const lookups: BlockInstanceLookup[] = [];
		const helper = new Object3D();
		const matrix = new Matrix4();

		for (const group of groups.values()) {
			const { type, variant, blocks: typedBlocks } = group;
			const mesh = new InstancedMesh(
				geometryFor(type, variant),
				this.materialFor(type),
				typedBlocks.length
			);

			mesh.name = `orelunzaBlocks:${type}:${variant}`;
			mesh.castShadow = type !== 'water' && type !== 'flower' && type !== 'glass';
			mesh.receiveShadow = type !== 'water';

			typedBlocks.forEach((block, index) => {
				helper.position.set(block.position.x + 0.5, block.position.y + 0.5, block.position.z + 0.5);
				helper.rotation.set(0, 0, 0);
				helper.scale.set(1, 1, 1);

				if (type === 'water') {
					const fillLevel = Math.max(0.02, Math.min(1, block.fillLevel ?? 1));
					helper.position.y = block.position.y + fillLevel * 0.5;
					helper.scale.y = fillLevel;
				} else if (type === 'flower') {
					helper.position.y = block.position.y + 0.31;
					helper.scale.setScalar(0.75 + pseudoRandom(block.position.x, block.position.z) * 0.45);
					helper.rotation.y = pseudoRandom(block.position.z, block.position.x) * Math.PI;
				} else if (type === 'wood') {
					helper.scale.set(0.82, 1, 0.82);
					helper.rotation.y = pseudoRandom(block.position.x, block.position.z) * Math.PI;
				} else if (type === 'leaves') {
					this.configureLeafTransform(helper, block.position, variant as CanopyShape);
				}

				helper.updateMatrix();
				matrix.copy(helper.matrix);
				mesh.setMatrixAt(index, matrix);

				if (INSTANCE_COLOR_TYPES.has(type)) {
					const zone = world?.terrainGenerator.zoneAt(block.position.x, block.position.z) ?? '';
					const color =
						type === 'wood'
							? woodTintAt(block.position, zone)
							: vegetationTintAt(type as 'grass' | 'leaves', block.position, zone);
					this.instanceColor.setHex(color);
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

	updateSurfaceWeather(
		state: Readonly<Pick<SurfaceWeatherFrameState, 'wetness' | 'snowCoverage' | 'frost'>>
	): void {
		this.surfaceWetness = clamp01(state.wetness);
		this.surfaceSnowCoverage = clamp01(state.snowCoverage);
		this.surfaceFrost = clamp01(state.frost);

		for (const [type, material] of this.materials) {
			if (material instanceof MeshLambertMaterial) {
				this.applySurfaceWeatherToMaterial(type, material);
			}
		}
	}

	dispose(): void {
		BLOCK_GEOMETRY.dispose();
		GRASS_GEOMETRY.dispose();
		FLOWER_GEOMETRY.dispose();
		TRUNK_GEOMETRY.dispose();

		for (const geometry of LEAF_GEOMETRIES.values()) {
			geometry.dispose();
		}

		for (const material of this.materials.values()) {
			material.dispose();
		}

		this.materials.clear();
		this.baseMaterialColors.clear();
	}

	private configureLeafTransform(
		helper: Object3D,
		position: BlockCoordinate,
		shape: CanopyShape
	): void {
		let width = 0.88 + vegetationRandom01(position.x, position.y, position.z, 0x51) * 0.3;
		let height = 0.86 + vegetationRandom01(position.z, position.y, position.x, 0x93) * 0.26;
		let depth = 0.88 + vegetationRandom01(position.y, position.x, position.z, 0xb7) * 0.28;

		if (shape === 'umbrella' || shape === 'emergent') {
			width *= 1.16;
			depth *= 1.14;
			height *= 0.82;
		} else if (shape === 'layered') {
			width *= 0.84;
			depth *= 0.84;
			height *= 1.16;
		} else if (shape === 'frond') {
			width *= 1.22;
			depth *= 1.22;
			height *= 0.72;
		} else if (shape === 'drooping') {
			width *= 0.9;
			depth *= 0.9;
			height *= 1.22;
		}

		const jitterX = (vegetationRandom01(position.x, position.y, position.z, 0xc1) - 0.5) * 0.1;
		const jitterY = (vegetationRandom01(position.z, position.x, position.y, 0xd3) - 0.5) * 0.08;
		const jitterZ = (vegetationRandom01(position.y, position.z, position.x, 0xe5) - 0.5) * 0.1;
		helper.position.x += jitterX;
		helper.position.y += jitterY;
		helper.position.z += jitterZ;
		helper.scale.set(width, height, depth);
		helper.rotation.set(
			(vegetationRandom01(position.x, position.y, position.z, 0x13) - 0.5) * 0.18,
			vegetationRandom01(position.z, position.y, position.x, 0x27) * Math.PI * 2,
			(vegetationRandom01(position.x, position.z, position.y, 0x39) - 0.5) * 0.16
		);
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
		this.baseMaterialColors.set(type, material.color.clone());
		this.applySurfaceWeatherToMaterial(type, material);

		return material;
	}

	private applySurfaceWeatherToMaterial(type: BlockType, material: MeshLambertMaterial): void {
		const base = this.baseMaterialColors.get(type);
		if (!base) {
			return;
		}

		material.color.copy(base);
		const wettable = type !== 'glass' && type !== 'water' && type !== 'leaves' && type !== 'flower';
		if (wettable && this.surfaceWetness > 0) {
			material.color.multiplyScalar(1 - this.surfaceWetness * 0.2);
		}

		if (type === 'water') {
			this.surfaceTint.setRGB(0.63, 0.78, 0.9);
			material.color.lerp(
				this.surfaceTint,
				Math.max(this.surfaceFrost, this.surfaceSnowCoverage) * 0.38
			);
			return;
		}

		const supportsSnow =
			type === 'grass' || type === 'dirt' || type === 'stone' || type === 'sand' || type === 'wood';
		if (supportsSnow && this.surfaceSnowCoverage > 0) {
			this.surfaceTint.setRGB(0.9, 0.94, 1);
			material.color.lerp(this.surfaceTint, this.surfaceSnowCoverage * 0.68);
		}

		if (this.surfaceFrost > 0 && type !== 'glass') {
			this.surfaceTint.setRGB(0.76, 0.86, 0.96);
			material.color.lerp(this.surfaceTint, this.surfaceFrost * 0.3);
		}
	}
}

function geometryFor(type: BlockType, variant: CanopyShape | 'default'): BufferGeometry {
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
		return LEAF_GEOMETRIES.get(variant as CanopyShape) ?? LEAF_GEOMETRIES.get('round')!;
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

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
