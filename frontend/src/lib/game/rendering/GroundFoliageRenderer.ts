import {
	Color,
	Group,
	InstancedMesh,
	MeshLambertMaterial,
	Object3D,
	StaticDrawUsage,
	Vector2,
	type BufferGeometry,
	type Scene,
	type Vector3
} from 'three';
import {
	createGroundFoliageGeometry,
	GROUND_FOLIAGE_SIDE
} from '../vegetation/GroundFoliageGeometry';
import type { GroundShape } from '../vegetation/VegetationFamily';
import {
	groundVegetationPlacementAt,
	vegetationSeedValue,
	type GroundVegetationPlacement
} from '../vegetation/VegetationDistribution';
import { VegetationRegistry } from '../vegetation/VegetationRegistry';
import type { VoxelWorld } from '../world/VoxelWorld';
import { CHUNK_SIZE, chunkKey, type ChunkCoordinate } from '../world/voxel-types';
import type { QualitySettings } from './QualitySettings';
import {
	VegetationInteractionIndex,
	type VegetationInteractionInstance
} from '../vegetation/VegetationInteractionIndex';
import { VegetationRemovalState } from '../vegetation/VegetationRemovalState';
import { groundVegetationInstanceId } from '../vegetation/VegetationInstanceId';

export interface GroundFoliageProfile {
	density: number;
	fadeStart: number;
	fadeEnd: number;
}

interface UniformValue<T> {
	value: T;
}

interface GroundFoliageChunkEntry {
	meshes: InstancedMesh[];
	chunk: ChunkCoordinate;
	centerX: number;
	centerZ: number;
}

interface IndexedGroundVegetationPlacement extends GroundVegetationPlacement {
	instanceId: string;
}

interface CollectedGroundFoliage {
	grouped: Map<GroundShape, IndexedGroundVegetationPlacement[]>;
	interactions: VegetationInteractionInstance[];
}

export function resolveGroundFoliageProfile(quality: QualitySettings): GroundFoliageProfile {
	if (quality.quality === 'low') {
		return { density: quality.vegetationDensity * 0.72, fadeStart: 18, fadeEnd: 30 };
	}

	if (quality.quality === 'high') {
		return { density: quality.vegetationDensity, fadeStart: 48, fadeEnd: 72 };
	}

	return { density: quality.vegetationDensity * 0.9, fadeStart: 32, fadeEnd: 52 };
}

/**
 * Streams several families of ground vegetation without creating one Mesh per plant.
 * Each visible chunk owns at most one InstancedMesh per present species.
 */
export class GroundFoliageRenderer {
	readonly object = new Group();

	private readonly geometries = new Map<GroundShape, BufferGeometry>();
	private readonly materials = new Map<GroundShape, MeshLambertMaterial>();
	private readonly chunks = new Map<string, GroundFoliageChunkEntry>();
	private readonly helper = new Object3D();
	private readonly instanceColor = new Color();
	private readonly windVector = new Vector2(1, 0);
	private readonly timeUniform: UniformValue<number> = { value: 0 };
	private readonly windDirectionUniform: UniformValue<Vector2> = { value: this.windVector };
	private readonly windStrengthUniform: UniformValue<number> = { value: 0.12 };
	private readonly fadeStartUniform: UniformValue<number> = { value: 32 };
	private readonly fadeEndUniform: UniformValue<number> = { value: 52 };
	private profile: GroundFoliageProfile;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: QualitySettings,
		private readonly interactionIndex = new VegetationInteractionIndex(),
		private readonly removalState = new VegetationRemovalState()
	) {
		this.object.name = 'orelunzaGroundFoliage';
		this.profile = resolveGroundFoliageProfile(quality);
		this.fadeStartUniform.value = this.profile.fadeStart;
		this.fadeEndUniform.value = this.profile.fadeEnd;
		this.scene.add(this.object);
	}

	get chunkCount(): number {
		return this.chunks.size;
	}

	get meshCount(): number {
		let total = 0;

		for (const entry of this.chunks.values()) {
			total += entry.meshes.length;
		}

		return total;
	}

	get instanceCount(): number {
		let total = 0;

		for (const entry of this.chunks.values()) {
			for (const mesh of entry.meshes) {
				total += mesh.count;
			}
		}

		return total;
	}

	get visibleChunkCount(): number {
		let total = 0;

		for (const entry of this.chunks.values()) {
			if (entry.meshes.some((mesh) => mesh.visible)) {
				total += 1;
			}
		}

		return total;
	}

	rebuild(world: VoxelWorld): void {
		if (this.disposed) {
			return;
		}

		this.clear();

		for (const chunk of world.getLoadedChunks()) {
			this.replaceChunk(world, chunk);
		}
	}

	replaceChunk(world: VoxelWorld, chunk: ChunkCoordinate): void {
		if (this.disposed) {
			return;
		}

		this.removeChunk(chunk);
		const collected = this.collectPlacements(world, chunk);
		this.interactionIndex.replaceChunk('ground-foliage', chunk, collected.interactions);
		const meshes: InstancedMesh[] = [];

		for (const [shape, placements] of collected.grouped) {
			if (placements.length === 0) {
				continue;
			}

			const geometry = this.geometryFor(shape);
			const material = this.materialFor(shape);
			const mesh = new InstancedMesh(geometry, material, placements.length);
			mesh.name = `orelunzaGroundFoliage:${chunkKey(chunk)}:${shape}`;
			mesh.castShadow = false;
			mesh.receiveShadow = true;
			mesh.instanceMatrix.setUsage(StaticDrawUsage);

			for (let index = 0; index < placements.length; index += 1) {
				const placement = placements[index];
				this.helper.position.set(placement.x, placement.y, placement.z);
				this.helper.rotation.set(0, placement.rotationY, 0);
				this.helper.scale.setScalar(placement.scale);
				this.helper.updateMatrix();
				mesh.setMatrixAt(index, this.helper.matrix);
				this.instanceColor.setHex(placement.color);
				mesh.setColorAt(index, this.instanceColor);
			}

			mesh.instanceMatrix.needsUpdate = true;

			if (mesh.instanceColor) {
				mesh.instanceColor.setUsage(StaticDrawUsage);
				mesh.instanceColor.needsUpdate = true;
			}

			mesh.computeBoundingBox();
			mesh.computeBoundingSphere();
			this.object.add(mesh);
			meshes.push(mesh);
		}

		if (meshes.length === 0) {
			return;
		}

		this.chunks.set(chunkKey(chunk), {
			meshes,
			chunk: { ...chunk },
			centerX: chunk.x * CHUNK_SIZE + CHUNK_SIZE * 0.5,
			centerZ: chunk.z * CHUNK_SIZE + CHUNK_SIZE * 0.5
		});
	}

	removeChunk(chunk: ChunkCoordinate): void {
		const key = chunkKey(chunk);
		const entry = this.chunks.get(key);

		this.interactionIndex.removeChunk('ground-foliage', chunk);

		if (!entry) {
			return;
		}

		for (const mesh of entry.meshes) {
			this.object.remove(mesh);
			mesh.dispose();
		}

		this.chunks.delete(key);
	}

	clear(): void {
		for (const entry of this.chunks.values()) {
			for (const mesh of entry.meshes) {
				this.object.remove(mesh);
				mesh.dispose();
			}

			this.interactionIndex.removeChunk('ground-foliage', entry.chunk);
		}

		this.chunks.clear();
	}

	update(
		cameraPosition: Readonly<Vector3>,
		deltaSeconds: number,
		windDirection = 0,
		windStrength = 0.15
	): void {
		if (this.disposed) {
			return;
		}

		const delta = clampFinite(deltaSeconds, 0, 0.05, 0);
		const direction = Number.isFinite(windDirection) ? windDirection : 0;
		const strength = clampFinite(windStrength, 0, 1, 0.15);
		this.timeUniform.value = (this.timeUniform.value + delta) % 4096;
		this.windVector.set(Math.cos(direction), Math.sin(direction)).normalize();
		this.windStrengthUniform.value = 0.025 + strength * 0.38;
		const visibleRadius = this.profile.fadeEnd + CHUNK_SIZE;
		const visibleRadiusSquared = visibleRadius * visibleRadius;

		for (const entry of this.chunks.values()) {
			const dx = cameraPosition.x - entry.centerX;
			const dz = cameraPosition.z - entry.centerZ;
			const visible = dx * dx + dz * dz <= visibleRadiusSquared;

			for (const mesh of entry.meshes) {
				mesh.visible = visible;
			}
		}
	}

	setQuality(quality: QualitySettings): void {
		if (this.disposed) {
			return;
		}

		this.profile = resolveGroundFoliageProfile(quality);
		this.fadeStartUniform.value = this.profile.fadeStart;
		this.fadeEndUniform.value = this.profile.fadeEnd;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.clear();
		this.scene.remove(this.object);

		for (const geometry of this.geometries.values()) {
			geometry.dispose();
		}

		for (const material of this.materials.values()) {
			material.dispose();
		}

		this.geometries.clear();
		this.materials.clear();
	}

	private collectPlacements(world: VoxelWorld, chunk: ChunkCoordinate): CollectedGroundFoliage {
		const grouped = new Map<GroundShape, IndexedGroundVegetationPlacement[]>();
		const interactions: VegetationInteractionInstance[] = [];
		const seedValue = vegetationSeedValue(world.seed);
		const startX = chunk.x * CHUNK_SIZE;
		const startZ = chunk.z * CHUNK_SIZE;

		for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
			for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
				const x = startX + localX;
				const z = startZ + localZ;
				const surfaceY = world.terrainGenerator.heightAt(x, z);
				const surface = world.getLoadedBlock({ x, y: surfaceY, z });
				const above = world.getLoadedBlock({ x, y: surfaceY + 1, z });

				if (surface?.type !== 'grass' || above?.type !== 'air') {
					continue;
				}

				const zone = world.terrainGenerator.zoneAt(x, z);
				const placement = groundVegetationPlacementAt(
					x,
					surfaceY,
					z,
					zone,
					this.profile.density,
					seedValue
				);

				if (!placement) {
					continue;
				}

				const species = VegetationRegistry.ground(placement.speciesId);
				const instanceId = groundVegetationInstanceId(placement.speciesId, x, surfaceY, z);

				if (this.removalState.has(instanceId)) {
					continue;
				}

				const indexedPlacement = { ...placement, instanceId };
				const list = grouped.get(species.shape) ?? [];
				list.push(indexedPlacement);
				grouped.set(species.shape, list);
				interactions.push(
					interactionForGroundPlacement(
						indexedPlacement,
						species.label,
						species.family,
						species.shape,
						chunk
					)
				);
			}
		}

		return { grouped, interactions };
	}

	private geometryFor(shape: GroundShape): BufferGeometry {
		const cached = this.geometries.get(shape);

		if (cached) {
			return cached;
		}

		const geometry = createGroundFoliageGeometry(shape);
		this.geometries.set(shape, geometry);

		return geometry;
	}

	private materialFor(shape: GroundShape): MeshLambertMaterial {
		const cached = this.materials.get(shape);

		if (cached) {
			return cached;
		}

		const material = new MeshLambertMaterial({
			color: 0xffffff,
			vertexColors: true,
			side: GROUND_FOLIAGE_SIDE
		});
		this.configureMaterialShader(material, windFlexForShape(shape), shape);
		this.materials.set(shape, material);

		return material;
	}

	private configureMaterialShader(
		material: MeshLambertMaterial,
		windFlex: number,
		shape: GroundShape
	): void {
		const flexUniform: UniformValue<number> = { value: Math.max(0, windFlex) };
		material.onBeforeCompile = (shader) => {
			shader.uniforms.uGroundFoliageTime = this.timeUniform;
			shader.uniforms.uGroundFoliageWindDirection = this.windDirectionUniform;
			shader.uniforms.uGroundFoliageWindStrength = this.windStrengthUniform;
			shader.uniforms.uGroundFoliageFlex = flexUniform;
			shader.uniforms.uGroundFoliageFadeStart = this.fadeStartUniform;
			shader.uniforms.uGroundFoliageFadeEnd = this.fadeEndUniform;
			shader.vertexShader = shader.vertexShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform float uGroundFoliageTime;
					uniform vec2 uGroundFoliageWindDirection;
					uniform float uGroundFoliageWindStrength;
					uniform float uGroundFoliageFlex;
					varying float vGroundFoliageDistance;
					varying float vGroundFoliageRandom;`
				)
				.replace(
					'#include <begin_vertex>',
					`vec3 transformed = vec3(position);
					vec3 groundFoliageOrigin = vec3(0.0);
					#ifdef USE_INSTANCING
						groundFoliageOrigin = instanceMatrix[3].xyz;
					#endif
					float groundFoliageHeight = clamp(position.y, 0.0, 1.4);
					float groundFoliagePhase = dot(groundFoliageOrigin.xz, vec2(0.173, 0.317));
					float groundFoliageGust = sin(uGroundFoliageTime * 1.4 + groundFoliagePhase)
						+ sin(uGroundFoliageTime * 2.7 + groundFoliagePhase * 1.61) * 0.28;
					float groundFoliageBend = groundFoliageGust * uGroundFoliageWindStrength
						* uGroundFoliageFlex * groundFoliageHeight * groundFoliageHeight;
					transformed.xz += uGroundFoliageWindDirection * groundFoliageBend;
					vGroundFoliageDistance = distance(
						cameraPosition,
						(modelMatrix * vec4(groundFoliageOrigin, 1.0)).xyz
					);
					vGroundFoliageRandom = fract(
						sin(dot(groundFoliageOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453
					);`
				);
			shader.fragmentShader = shader.fragmentShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform float uGroundFoliageFadeStart;
					uniform float uGroundFoliageFadeEnd;
					varying float vGroundFoliageDistance;
					varying float vGroundFoliageRandom;`
				)
				.replace(
					'#include <dithering_fragment>',
					`float groundFoliageVisibility = 1.0 - smoothstep(
						uGroundFoliageFadeStart,
						uGroundFoliageFadeEnd,
						vGroundFoliageDistance
					);
					if (groundFoliageVisibility <= vGroundFoliageRandom) {
						discard;
					}
					#include <dithering_fragment>`
				);
		};
		material.customProgramCacheKey = () => `orelunza-ground-foliage-v1:${shape}`;
	}
}

function interactionForGroundPlacement(
	placement: IndexedGroundVegetationPlacement,
	label: string,
	family: VegetationInteractionInstance['family'],
	shape: GroundShape,
	chunk: ChunkCoordinate
): VegetationInteractionInstance {
	const bounds = groundBounds(shape, placement.scale);

	return {
		instanceId: placement.instanceId,
		layer: 'ground-foliage',
		speciesId: placement.speciesId,
		label,
		family,
		chunk: { ...chunk },
		position: {
			x: placement.x,
			y: placement.y + bounds.height * 0.5,
			z: placement.z
		},
		halfExtents: {
			x: bounds.radius,
			y: Math.max(0.04, bounds.height * 0.5),
			z: bounds.radius
		}
	};
}

function groundBounds(shape: GroundShape, scale: number): { radius: number; height: number } {
	const safeScale = Math.max(0.1, scale);

	switch (shape) {
		case 'moss':
			return { radius: 0.48 * safeScale, height: 0.1 * safeScale };
		case 'flower':
			return { radius: 0.26 * safeScale, height: 0.92 * safeScale };
		case 'fern':
			return { radius: 0.5 * safeScale, height: 0.72 * safeScale };
		case 'tropical-fern':
			return { radius: 0.72 * safeScale, height: 1.15 * safeScale };
		case 'shrub':
			return { radius: 0.62 * safeScale, height: 0.85 * safeScale };
		case 'short-grass':
		default:
			return { radius: 0.38 * safeScale, height: 0.46 * safeScale };
	}
}

function windFlexForShape(shape: GroundShape): number {
	switch (shape) {
		case 'short-grass':
			return 1;
		case 'fern':
			return 0.55;
		case 'tropical-fern':
			return 0.7;
		case 'shrub':
			return 0.2;
		case 'flower':
			return 0.85;
		case 'moss':
			return 0;
	}
}

function clampFinite(value: number, minimum: number, maximum: number, fallback: number): number {
	return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}
