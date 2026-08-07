import {
	BoxGeometry,
	BufferAttribute,
	Color,
	ConeGeometry,
	CylinderGeometry,
	InstancedMesh,
	Matrix4,
	MeshLambertMaterial,
	MeshStandardMaterial,
	Object3D,
	Vector2,
	type BufferGeometry,
	type Material
} from 'three';
import type { CanopyShape } from '../vegetation/VegetationFamily';
import type { SurfaceWeatherFrameState } from '../environment/surface/SurfaceWeatherState';
import { BlockRegistry } from './BlockRegistry';
import { createLeafCanopyGeometry, leafCanopyShapeAt } from './LeafCanopyGeometry';
import { vegetationRandom01, vegetationTintAt, woodTintAt } from './VegetationPalette';
import type { VoxelWorld } from './VoxelWorld';
import {
	civilizationGeometry,
	disposeCivilizationGeometries
} from './civilization/CivilizationGeometry';
import { yawForFacing } from './civilization/CivilizationBlocks';
import type { BlockCoordinate, BlockType, VoxelBlock } from './voxel-types';

export interface BlockInstanceLookup {
	mesh: InstancedMesh;
	blocks: BlockCoordinate[];
	type: BlockType;
}

interface RenderGroup {
	type: BlockType;
	geometryVariant: CanopyShape | 'default';
	stateVariant: string;
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
	private readonly materials = new Map<string, Material>();
	private readonly materialTypes = new Map<string, BlockType>();
	private readonly baseMaterialColors = new Map<string, Color>();
	private readonly instanceColor = new Color();
	private readonly surfaceTint = new Color();
	private surfaceWetness = 0;
	private surfaceSnowCoverage = 0;
	private surfaceFrost = 0;
	private readonly leafTimeUniform = { value: 0 };
	private readonly leafWindDirectionUniform = { value: new Vector2(1, 0) };
	private readonly leafWindStrengthUniform = { value: 0 };

	createMeshes(blocks: VoxelBlock[], world?: VoxelWorld): BlockInstanceLookup[] {
		const groups = new Map<string, RenderGroup>();

		for (const block of blocks) {
			if (block.type === 'air') continue;
			const zone = world?.terrainGenerator.zoneAt(block.position.x, block.position.z) ?? '';
			const geometryVariant =
				block.type === 'leaves' ? leafCanopyShapeAt(block.position, zone) : ('default' as const);
			const stateVariant = stateVariantFor(block);
			const key = `${block.type}:${geometryVariant}:${stateVariant}`;
			const group = groups.get(key) ?? {
				type: block.type,
				geometryVariant,
				stateVariant,
				blocks: []
			};
			group.blocks.push(block);
			groups.set(key, group);
		}

		const lookups: BlockInstanceLookup[] = [];
		const helper = new Object3D();
		const matrix = new Matrix4();

		for (const group of groups.values()) {
			const { type, geometryVariant, stateVariant, blocks: typedBlocks } = group;
			const mesh = new InstancedMesh(
				geometryFor(type, geometryVariant, stateVariant),
				this.materialFor(type, stateVariant),
				typedBlocks.length
			);
			mesh.name = `orelunzaBlocks:${type}:${geometryVariant}:${stateVariant}`;
			mesh.castShadow = shouldCastShadow(type);
			mesh.receiveShadow = type !== 'water';

			typedBlocks.forEach((block, index) => {
				helper.position.set(block.position.x + 0.5, block.position.y + 0.5, block.position.z + 0.5);
				helper.rotation.set(0, 0, 0);
				helper.scale.set(1, 1, 1);
				this.configureTransform(helper, block, geometryVariant);
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
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			lookups.push({ mesh, blocks: typedBlocks.map((block) => block.position), type });
		}

		return lookups;
	}

	updateVegetationWind(deltaSeconds: number, windDirection: number, windStrength: number): void {
		const delta = Math.max(0, Math.min(0.05, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
		const direction = Number.isFinite(windDirection) ? windDirection : 0;
		const strength = clamp01(windStrength);
		this.leafTimeUniform.value = (this.leafTimeUniform.value + delta) % 4096;
		this.leafWindDirectionUniform.value.set(Math.cos(direction), Math.sin(direction));
		this.leafWindStrengthUniform.value = strength <= 0.04 ? 0 : (strength - 0.04) * 0.2;
	}

	updateSurfaceWeather(
		state: Readonly<Pick<SurfaceWeatherFrameState, 'wetness' | 'snowCoverage' | 'frost'>>
	): void {
		this.surfaceWetness = clamp01(state.wetness);
		this.surfaceSnowCoverage = clamp01(state.snowCoverage);
		this.surfaceFrost = clamp01(state.frost);
		for (const [key, material] of this.materials) {
			const type = this.materialTypes.get(key);
			if (type && isColorMaterial(material))
				this.applySurfaceWeatherToMaterial(type, material, key);
		}
	}

	dispose(): void {
		BLOCK_GEOMETRY.dispose();
		GRASS_GEOMETRY.dispose();
		FLOWER_GEOMETRY.dispose();
		TRUNK_GEOMETRY.dispose();
		for (const geometry of LEAF_GEOMETRIES.values()) geometry.dispose();
		disposeCivilizationGeometries();
		for (const material of this.materials.values()) material.dispose();
		this.materials.clear();
		this.materialTypes.clear();
		this.baseMaterialColors.clear();
	}

	private configureTransform(
		helper: Object3D,
		block: VoxelBlock,
		variant: CanopyShape | 'default'
	): void {
		const type = block.type;
		if (type === 'water') {
			const fillLevel = Math.max(0.005, Math.min(1, block.fillLevel ?? 1));
			helper.position.y = block.position.y + fillLevel * 0.5;
			helper.scale.y = fillLevel;
			return;
		}
		if (type === 'flower') {
			helper.position.y = block.position.y + 0.31;
			helper.scale.setScalar(0.75 + pseudoRandom(block.position.x, block.position.z) * 0.45);
			helper.rotation.y = pseudoRandom(block.position.z, block.position.x) * Math.PI;
			return;
		}
		if (type === 'wood') {
			helper.scale.set(0.82, 1, 0.82);
			helper.rotation.y = pseudoRandom(block.position.x, block.position.z) * Math.PI;
			return;
		}
		if (type === 'leaves') {
			this.configureLeafTransform(helper, block.position, variant as CanopyShape);
			return;
		}

		const definition = BlockRegistry.get(type);
		if (definition.orientable) helper.rotation.y = yawForFacing(block.state?.facing);
		if (type === 'wooden_door' && block.state?.open) {
			const closedYaw = helper.rotation.y;
			const openYaw = closedYaw + Math.PI / 2;
			const halfWidth = 0.45;
			const closedCenterX = Math.cos(closedYaw) * halfWidth;
			const closedCenterZ = -Math.sin(closedYaw) * halfWidth;
			const openCenterX = Math.cos(openYaw) * halfWidth;
			const openCenterZ = -Math.sin(openYaw) * halfWidth;
			helper.position.x += openCenterX - closedCenterX;
			helper.position.z += openCenterZ - closedCenterZ;
			helper.rotation.y = openYaw;
		}
		if (type === 'curtain' && block.state?.open) {
			helper.scale.x = 0.22;
			helper.position.x += Math.cos(helper.rotation.y) * 0.33;
			helper.position.z -= Math.sin(helper.rotation.y) * 0.33;
		}
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
		helper.position.x += (vegetationRandom01(position.x, position.y, position.z, 0xc1) - 0.5) * 0.1;
		helper.position.y +=
			(vegetationRandom01(position.z, position.x, position.y, 0xd3) - 0.5) * 0.08;
		helper.position.z += (vegetationRandom01(position.y, position.z, position.x, 0xe5) - 0.5) * 0.1;
		helper.scale.set(width, height, depth);
		helper.rotation.set(
			(vegetationRandom01(position.x, position.y, position.z, 0x13) - 0.5) * 0.18,
			vegetationRandom01(position.z, position.y, position.x, 0x27) * Math.PI * 2,
			(vegetationRandom01(position.x, position.z, position.y, 0x39) - 0.5) * 0.16
		);
	}

	private materialFor(type: BlockType, stateVariant: string): Material {
		const key = `${type}:${stateVariant}`;
		const cached = this.materials.get(key);
		if (cached) return cached;
		const definition = BlockRegistry.get(type);
		const usesInstanceColor = INSTANCE_COLOR_TYPES.has(type);
		const renderTransparent =
			type === 'water' || type === 'glass' || type === 'glass_panel' || type === 'curtain';
		let material: MeshLambertMaterial | MeshStandardMaterial;

		if ((type === 'floor_lamp' || type === 'fire_pit') && stateVariant === 'lit') {
			const emissiveColor = type === 'fire_pit' ? 0xff6a24 : 0xffcf78;
			material = new MeshStandardMaterial({
				color: definition.color,
				emissive: emissiveColor,
				emissiveIntensity: type === 'fire_pit' ? 1.7 : 1.2,
				roughness: 0.72,
				metalness: 0
			});
		} else {
			material = new MeshLambertMaterial({
				color: usesInstanceColor ? 0xffffff : definition.color,
				vertexColors: type === 'grass' || type === 'leaves',
				transparent: renderTransparent,
				opacity:
					type === 'water'
						? 0.62
						: type === 'glass'
							? 0.45
							: type === 'glass_panel'
								? 0.38
								: type === 'curtain'
									? 0.9
									: 1,
				depthWrite: type !== 'water' && type !== 'glass' && type !== 'glass_panel'
			});
		}

		if (type === 'leaves' && material instanceof MeshLambertMaterial)
			this.configureLeafWindShader(material);
		this.materials.set(key, material);
		this.materialTypes.set(key, type);
		this.baseMaterialColors.set(key, material.color.clone());
		this.applySurfaceWeatherToMaterial(type, material, key);
		return material;
	}

	private configureLeafWindShader(material: MeshLambertMaterial): void {
		material.onBeforeCompile = (shader) => {
			shader.uniforms.uLeafWindTime = this.leafTimeUniform;
			shader.uniforms.uLeafWindDirection = this.leafWindDirectionUniform;
			shader.uniforms.uLeafWindStrength = this.leafWindStrengthUniform;
			shader.vertexShader = shader.vertexShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform float uLeafWindTime;
					uniform vec2 uLeafWindDirection;
					uniform float uLeafWindStrength;`
				)
				.replace(
					'#include <begin_vertex>',
					`vec3 transformed = vec3(position);
					vec3 leafOrigin = vec3(0.0);
					#ifdef USE_INSTANCING
						leafOrigin = instanceMatrix[3].xyz;
					#endif
					float leafPhase = dot(leafOrigin.xz, vec2(0.117, 0.263));
					float leafGust = sin(uLeafWindTime * 1.15 + leafPhase)
						+ sin(uLeafWindTime * 2.35 + leafPhase * 1.71) * 0.28;
					float leafFlex = 0.35 + clamp(position.y + 0.5, 0.0, 1.5) * 0.28;
					transformed.xz += uLeafWindDirection * leafGust * uLeafWindStrength * leafFlex;`
				);
		};
		material.customProgramCacheKey = () => 'orelunza-leaf-wind-v1';
	}

	private applySurfaceWeatherToMaterial(
		type: BlockType,
		material: MeshLambertMaterial | MeshStandardMaterial,
		key: string
	): void {
		const base = this.baseMaterialColors.get(key);
		if (!base) return;
		material.color.copy(base);
		const wettable =
			type !== 'glass' &&
			type !== 'glass_panel' &&
			type !== 'water' &&
			type !== 'leaves' &&
			type !== 'flower' &&
			type !== 'floor_lamp' &&
			type !== 'fire_pit';
		if (wettable && this.surfaceWetness > 0)
			material.color.multiplyScalar(1 - this.surfaceWetness * 0.2);
		if (type === 'water') {
			this.surfaceTint.setRGB(0.63, 0.78, 0.9);
			material.color.lerp(
				this.surfaceTint,
				Math.max(this.surfaceFrost, this.surfaceSnowCoverage) * 0.38
			);
			return;
		}
		const supportsSnow =
			type === 'grass' ||
			type === 'dirt' ||
			type === 'stone' ||
			type === 'sand' ||
			type === 'wood' ||
			type === 'concrete' ||
			type === 'brick';
		if (supportsSnow && this.surfaceSnowCoverage > 0) {
			this.surfaceTint.setRGB(0.9, 0.94, 1);
			material.color.lerp(this.surfaceTint, this.surfaceSnowCoverage * 0.68);
		}
		if (this.surfaceFrost > 0 && type !== 'glass' && type !== 'glass_panel') {
			this.surfaceTint.setRGB(0.76, 0.86, 0.96);
			material.color.lerp(this.surfaceTint, this.surfaceFrost * 0.3);
		}
	}
}

function geometryFor(
	type: BlockType,
	variant: CanopyShape | 'default',
	stateVariant: string
): BufferGeometry {
	if (type === 'flower') return FLOWER_GEOMETRY;
	if (type === 'grass') return GRASS_GEOMETRY;
	if (type === 'wood') return TRUNK_GEOMETRY;
	if (type === 'leaves')
		return LEAF_GEOMETRIES.get(variant as CanopyShape) ?? LEAF_GEOMETRIES.get('round')!;
	const shape = BlockRegistry.get(type).shape ?? 'cube';
	return civilizationGeometry(shape, stateVariant === 'lit') ?? BLOCK_GEOMETRY;
}

function stateVariantFor(block: VoxelBlock): string {
	if ((block.type === 'floor_lamp' || block.type === 'fire_pit') && BlockRegistry.isLit(block))
		return 'lit';
	if ((block.type === 'wooden_door' || block.type === 'curtain') && block.state?.open)
		return 'open';
	return 'default';
}

function shouldCastShadow(type: BlockType): boolean {
	return (
		type !== 'water' &&
		type !== 'flower' &&
		type !== 'glass' &&
		type !== 'glass_panel' &&
		type !== 'curtain'
	);
}

function isColorMaterial(
	material: Material
): material is MeshLambertMaterial | MeshStandardMaterial {
	return material instanceof MeshLambertMaterial || material instanceof MeshStandardMaterial;
}

function createGrassGeometry(): BoxGeometry {
	const geometry = new BoxGeometry(1, 1, 1);
	applyDirectionalColors(geometry, { top: 0xffffff, side: 0xb5b79a, bottom: 0x72745b });
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
		if (upward > 0) result.lerp(top, upward);
		else if (downward > 0) result.lerp(bottom, downward);
		values[index * 3] = result.r;
		values[index * 3 + 1] = result.g;
		values[index * 3 + 2] = result.b;
	}
	geometry.setAttribute('color', new BufferAttribute(values, 3));
}

function pseudoRandom(x: number, z: number): number {
	const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
	return value - Math.floor(value);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
