import {
	Color,
	DoubleSide,
	Group,
	InstancedMesh,
	MeshLambertMaterial,
	Object3D,
	StaticDrawUsage,
	Vector2,
	type Scene,
	type Vector3
} from 'three';
import { createTallGrassGeometry } from '../world/TallGrassGeometry';
import {
	tallGrassPlacementAt,
	tallGrassSeedValue,
	type TallGrassPlacement
} from '../world/TallGrassField';
import type { VoxelWorld } from '../world/VoxelWorld';
import { CHUNK_SIZE, chunkKey, type ChunkCoordinate } from '../world/voxel-types';
import type { QualitySettings } from './QualitySettings';
import {
	VegetationInteractionIndex,
	type VegetationInteractionInstance
} from '../vegetation/VegetationInteractionIndex';
import { VegetationRemovalState } from '../vegetation/VegetationRemovalState';
import { tallGrassInstanceId } from '../vegetation/VegetationInstanceId';
import type { SurfaceWeatherFrameState } from '../environment/surface/SurfaceWeatherState';

export interface TallGrassProfile {
	density: number;
	fadeStart: number;
	fadeEnd: number;
}

interface TallGrassChunkEntry {
	mesh: InstancedMesh;
	chunk: ChunkCoordinate;
	centerX: number;
	centerZ: number;
}

interface IndexedTallGrassPlacement extends TallGrassPlacement {
	instanceId: string;
}

interface UniformValue<T> {
	value: T;
}

export function resolveTallGrassProfile(quality: QualitySettings): TallGrassProfile {
	if (quality.quality === 'low') {
		return {
			density: quality.vegetationDensity,
			fadeStart: 22,
			fadeEnd: 34
		};
	}

	if (quality.quality === 'high') {
		return {
			density: quality.vegetationDensity,
			fadeStart: 52,
			fadeEnd: 78
		};
	}

	return {
		density: quality.vegetationDensity,
		fadeStart: 36,
		fadeEnd: 56
	};
}

/**
 * Chunk-aware tall-grass renderer.
 *
 * Each chunk owns one InstancedMesh, while every chunk shares the same geometry,
 * material and shader uniforms. Wind is a vertex deformation, and distance
 * disappearance removes stable instances progressively so no transparency or
 * screen-space shimmer is introduced.
 */
export class TallGrassRenderer {
	readonly object = new Group();

	private readonly geometry = createTallGrassGeometry();
	private readonly material = new MeshLambertMaterial({
		color: 0xffffff,
		vertexColors: true,
		side: DoubleSide
	});
	private readonly chunks = new Map<string, TallGrassChunkEntry>();
	private readonly helper = new Object3D();
	private readonly instanceColor = new Color();
	private readonly surfaceTint = new Color();
	private readonly windVector = new Vector2(1, 0);
	private readonly timeUniform: UniformValue<number> = { value: 0 };
	private readonly windDirectionUniform: UniformValue<Vector2> = { value: this.windVector };
	private readonly windStrengthUniform: UniformValue<number> = { value: 0.12 };
	private readonly fadeStartUniform: UniformValue<number> = { value: 36 };
	private readonly fadeEndUniform: UniformValue<number> = { value: 56 };
	private profile: TallGrassProfile;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		quality: QualitySettings,
		private readonly interactionIndex = new VegetationInteractionIndex(),
		private readonly removalState = new VegetationRemovalState()
	) {
		this.object.name = 'orelunzaTallGrass';
		this.profile = resolveTallGrassProfile(quality);
		this.fadeStartUniform.value = this.profile.fadeStart;
		this.fadeEndUniform.value = this.profile.fadeEnd;
		this.configureMaterialShader();
		this.scene.add(this.object);
	}

	get chunkCount(): number {
		return this.chunks.size;
	}

	get instanceCount(): number {
		let total = 0;

		for (const entry of this.chunks.values()) {
			total += entry.mesh.count;
		}

		return total;
	}

	get visibleChunkCount(): number {
		let total = 0;

		for (const entry of this.chunks.values()) {
			if (entry.mesh.visible) {
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
		const placements = this.collectPlacements(world, chunk);
		const interactions = placements.map((placement): VegetationInteractionInstance => ({
			instanceId: placement.instanceId,
			layer: 'tall-grass',
			speciesId: 'tall_grass',
			label: 'Tall grass',
			family: 'grass',
			chunk: { ...chunk },
			position: {
				x: placement.x,
				y: placement.y + placement.height * 0.5,
				z: placement.z
			},
			halfExtents: {
				x: Math.max(0.22, placement.width * 0.42),
				y: Math.max(0.3, placement.height * 0.52),
				z: Math.max(0.22, placement.width * 0.42)
			}
		}));
		this.interactionIndex.replaceChunk('tall-grass', chunk, interactions);

		if (placements.length === 0) {
			return;
		}

		const mesh = new InstancedMesh(this.geometry, this.material, placements.length);
		mesh.name = `orelunzaTallGrass:${chunkKey(chunk)}`;
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		mesh.instanceMatrix.setUsage(StaticDrawUsage);

		for (let index = 0; index < placements.length; index += 1) {
			const placement = placements[index];

			this.helper.position.set(placement.x, placement.y, placement.z);
			this.helper.rotation.set(0, placement.rotationY, 0);
			this.helper.scale.set(placement.width, placement.height, placement.width);
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

		this.chunks.set(chunkKey(chunk), {
			mesh,
			chunk: { ...chunk },
			centerX: chunk.x * CHUNK_SIZE + CHUNK_SIZE * 0.5,
			centerZ: chunk.z * CHUNK_SIZE + CHUNK_SIZE * 0.5
		});
	}

	removeChunk(chunk: ChunkCoordinate): void {
		const key = chunkKey(chunk);
		const entry = this.chunks.get(key);

		this.interactionIndex.removeChunk('tall-grass', chunk);

		if (!entry) {
			return;
		}

		this.object.remove(entry.mesh);
		entry.mesh.dispose();
		this.chunks.delete(key);
	}

	clear(): void {
		for (const entry of this.chunks.values()) {
			this.object.remove(entry.mesh);
			entry.mesh.dispose();
			this.interactionIndex.removeChunk('tall-grass', entry.chunk);
		}

		this.chunks.clear();
	}

	updateSurfaceWeather(
		state: Readonly<Pick<SurfaceWeatherFrameState, 'wetness' | 'snowCoverage' | 'frost'>>
	): void {
		const wetness = clamp01(state.wetness);
		const snow = clamp01(state.snowCoverage);
		const frost = clamp01(state.frost);
		this.material.color.setRGB(1, 1, 1).multiplyScalar(1 - wetness * 0.14);
		this.surfaceTint.setRGB(0.9, 0.95, 1);
		this.material.color.lerp(this.surfaceTint, snow * 0.7 + frost * 0.22);
	}

	update(
		cameraPosition: Readonly<Vector3>,
		deltaSeconds: number,
		windDirection = 0,
		windStrength = 0
	): void {
		if (this.disposed) {
			return;
		}

		const delta = clampFinite(deltaSeconds, 0, 0.05, 0);
		const direction = Number.isFinite(windDirection) ? windDirection : 0;
		const strength = clampFinite(windStrength, 0, 1, 0);
		this.timeUniform.value = (this.timeUniform.value + delta) % 4096;
		this.windVector.set(Math.cos(direction), Math.sin(direction)).normalize();
		this.windStrengthUniform.value = strength <= 0.04 ? 0 : (strength - 0.04) * 0.5;
		const visibleRadius = this.profile.fadeEnd + CHUNK_SIZE * 0.8;
		const visibleRadiusSquared = visibleRadius * visibleRadius;

		for (const entry of this.chunks.values()) {
			const dx = cameraPosition.x - entry.centerX;
			const dz = cameraPosition.z - entry.centerZ;
			entry.mesh.visible = dx * dx + dz * dz <= visibleRadiusSquared;
		}
	}

	setQuality(quality: QualitySettings): void {
		if (this.disposed) {
			return;
		}

		this.profile = resolveTallGrassProfile(quality);
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
		this.geometry.dispose();
		this.material.dispose();
	}

	private collectPlacements(
		world: VoxelWorld,
		chunk: ChunkCoordinate
	): IndexedTallGrassPlacement[] {
		const placements: IndexedTallGrassPlacement[] = [];
		const seedValue = tallGrassSeedValue(world.seed);
		const startX = chunk.x * CHUNK_SIZE;
		const startZ = chunk.z * CHUNK_SIZE;

		for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
			for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
				const x = startX + localX;
				const z = startZ + localZ;
				if (world.isProtectedBuildPosition({ x, z })) continue;
				const surfaceY = world.terrainGenerator.heightAt(x, z);
				const surface = world.getLoadedBlock({ x, y: surfaceY, z });
				const above = world.getLoadedBlock({ x, y: surfaceY + 1, z });

				if (surface?.type !== 'grass' || above?.type !== 'air') {
					continue;
				}

				const zone = world.terrainGenerator.zoneAt(x, z);
				const placement = tallGrassPlacementAt(
					x,
					surfaceY,
					z,
					zone,
					this.profile.density,
					seedValue
				);

				if (placement) {
					const instanceId = tallGrassInstanceId(x, surfaceY, z);

					if (!this.removalState.has(instanceId)) {
						placements.push({ ...placement, instanceId });
					}
				}
			}
		}

		return placements;
	}

	private configureMaterialShader(): void {
		this.material.onBeforeCompile = (shader) => {
			shader.uniforms.uTallGrassTime = this.timeUniform;
			shader.uniforms.uTallGrassWindDirection = this.windDirectionUniform;
			shader.uniforms.uTallGrassWindStrength = this.windStrengthUniform;
			shader.uniforms.uTallGrassFadeStart = this.fadeStartUniform;
			shader.uniforms.uTallGrassFadeEnd = this.fadeEndUniform;

			shader.vertexShader = shader.vertexShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform float uTallGrassTime;
					uniform vec2 uTallGrassWindDirection;
					uniform float uTallGrassWindStrength;
					varying float vTallGrassDistance;
					varying float vTallGrassRandom;`
				)
				.replace(
					'#include <begin_vertex>',
					`vec3 transformed = vec3(position);
					vec3 tallGrassOrigin = vec3(0.0);
					#ifdef USE_INSTANCING
						tallGrassOrigin = instanceMatrix[3].xyz;
					#endif
					float tallGrassHeight = clamp(position.y, 0.0, 1.0);
					float tallGrassPhase = dot(tallGrassOrigin.xz, vec2(0.173, 0.317));
					float tallGrassGust = sin(uTallGrassTime * 1.55 + tallGrassPhase)
						+ sin(uTallGrassTime * 3.1 + tallGrassPhase * 1.73) * 0.32;
					float tallGrassBend = tallGrassGust * uTallGrassWindStrength
						* tallGrassHeight * tallGrassHeight;
					transformed.xz += uTallGrassWindDirection * tallGrassBend;
					vTallGrassDistance = distance(
						cameraPosition,
						(modelMatrix * vec4(tallGrassOrigin, 1.0)).xyz
					);
					vTallGrassRandom = fract(
						sin(dot(tallGrassOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453
					);`
				);

			shader.fragmentShader = shader.fragmentShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform float uTallGrassFadeStart;
					uniform float uTallGrassFadeEnd;
					varying float vTallGrassDistance;
					varying float vTallGrassRandom;`
				)
				.replace(
					'#include <dithering_fragment>',
					`float tallGrassVisibility = 1.0 - smoothstep(
						uTallGrassFadeStart,
						uTallGrassFadeEnd,
						vTallGrassDistance
					);
					if (tallGrassVisibility <= vTallGrassRandom) {
						discard;
					}
					#include <dithering_fragment>`
				);
		};
		this.material.customProgramCacheKey = () => 'orelunza-tall-grass-v1';
	}
}

function clampFinite(value: number, minimum: number, maximum: number, fallback: number): number {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
