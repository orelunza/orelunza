import {
	BufferAttribute,
	BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
	DoubleSide,
	InstancedMesh,
	Matrix4,
	Group,
	Mesh,
	MeshLambertMaterial,
	MeshPhongMaterial,
	Object3D,
	PlaneGeometry
} from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import { CHUNK_SIZE, WATER_LEVEL } from '../world/voxel-types';

const GRASS = new Color(0x6d9f63);
const FOREST = new Color(0x4f8351);
const SAND = new Color(0xc9b27b);
const PATH = new Color(0xa8895c);
const CITY = new Color(0x8f816e);

export class NaturalTerrainRenderer {
	readonly object = new Group();
	private readonly terrainMaterial = new MeshLambertMaterial({
		vertexColors: true
	});
	private readonly waterMaterial = new MeshPhongMaterial({
		color: 0x5d93a0,
		transparent: true,
		opacity: 0.58,
		shininess: 24,
		side: DoubleSide
	});
	private readonly trunkGeometry = new CylinderGeometry(0.24, 0.34, 1, 6);
	private readonly crownGeometry = new DodecahedronGeometry(0.78, 0);
	private readonly flowerGeometry = new ConeGeometry(0.12, 0.38, 5);
	private readonly trunkMaterial = new MeshLambertMaterial({ color: 0x6b4f38 });
	private readonly crownMaterial = new MeshLambertMaterial({ color: 0x4f8351 });
	private readonly flowerMaterial = new MeshLambertMaterial({ color: 0xc98fbc });

	rebuild(world: VoxelWorld): void {
		this.clear();

		for (const chunk of world.getLoadedChunks()) {
			const terrain = new Mesh(
				this.createTerrainGeometry(world, chunk.x, chunk.z),
				this.terrainMaterial
			);
			terrain.receiveShadow = true;
			this.object.add(terrain);

			const water = this.createWaterMesh(world, chunk.x, chunk.z);

			if (water) {
				this.object.add(water);
			}

			this.addNatureInstances(world, chunk.x, chunk.z);
		}
	}

	dispose(): void {
		this.clear();
		this.terrainMaterial.dispose();
		this.waterMaterial.dispose();
		this.trunkGeometry.dispose();
		this.crownGeometry.dispose();
		this.flowerGeometry.dispose();
		this.trunkMaterial.dispose();
		this.crownMaterial.dispose();
		this.flowerMaterial.dispose();
	}

	private clear(): void {
		for (const child of [...this.object.children]) {
			this.object.remove(child);

			if (child instanceof Mesh) {
				if (
					child.geometry !== this.trunkGeometry &&
					child.geometry !== this.crownGeometry &&
					child.geometry !== this.flowerGeometry
				) {
					child.geometry.dispose();
				}
			}
		}
	}

	private createTerrainGeometry(world: VoxelWorld, chunkX: number, chunkZ: number): BufferGeometry {
		const positions: number[] = [];
		const colors: number[] = [];
		const indices: number[] = [];
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;

		for (let x = 0; x <= CHUNK_SIZE; x += 1) {
			for (let z = 0; z <= CHUNK_SIZE; z += 1) {
				const wx = startX + x;
				const wz = startZ + z;
				const height = world.terrainGenerator.visualHeightAt(wx, wz) + 1;
				const color = terrainColor(world, wx, wz);

				positions.push(wx, height, wz);
				colors.push(color.r, color.g, color.b);
			}
		}

		for (let x = 0; x < CHUNK_SIZE; x += 1) {
			for (let z = 0; z < CHUNK_SIZE; z += 1) {
				const a = x * (CHUNK_SIZE + 1) + z;
				const b = (x + 1) * (CHUNK_SIZE + 1) + z;
				const c = (x + 1) * (CHUNK_SIZE + 1) + z + 1;
				const d = x * (CHUNK_SIZE + 1) + z + 1;

				indices.push(a, b, d, b, c, d);
			}
		}

		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
		geometry.setIndex(indices);
		geometry.computeVertexNormals();

		return geometry;
	}

	private createWaterMesh(world: VoxelWorld, chunkX: number, chunkZ: number): Mesh | null {
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;
		let hasWater = false;

		for (let x = 0; x < CHUNK_SIZE && !hasWater; x += 1) {
			for (let z = 0; z < CHUNK_SIZE; z += 1) {
				if (world.terrainGenerator.isWater(startX + x, startZ + z)) {
					hasWater = true;
					break;
				}
			}
		}

		if (!hasWater) {
			return null;
		}

		const geometry = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 1, 1);
		geometry.rotateX(-Math.PI / 2);
		const mesh = new Mesh(geometry, this.waterMaterial);
		mesh.position.set(startX + CHUNK_SIZE / 2, WATER_LEVEL + 0.08, startZ + CHUNK_SIZE / 2);
		mesh.receiveShadow = false;

		return mesh;
	}

	private addNatureInstances(world: VoxelWorld, chunkX: number, chunkZ: number): void {
		const startX = chunkX * CHUNK_SIZE;
		const startZ = chunkZ * CHUNK_SIZE;
		const trees: Array<{ x: number; z: number; scale: number }> = [];
		const flowers: Array<{ x: number; z: number; scale: number }> = [];

		for (let x = 1; x < CHUNK_SIZE; x += 3) {
			for (let z = 1; z < CHUNK_SIZE; z += 3) {
				const wx = startX + x + jitter(startX + x, startZ + z, 0) * 1.4;
				const wz = startZ + z + jitter(startX + x, startZ + z, 1) * 1.4;

				if (
					world.isProtectedBuildPosition({ x: wx, z: wz }) ||
					world.terrainGenerator.isWater(wx, wz) ||
					world.terrainGenerator.isPath(wx, wz)
				) {
					continue;
				}

				if (Math.hypot(wx, wz) < 8) {
					continue;
				}

				const zone = world.terrainGenerator.zoneAt(wx, wz);
				const roll = random01(wx, wz);

				if ((zone === 'Forest Edge' && roll > 0.55) || roll > 0.92) {
					trees.push({
						x: wx,
						z: wz,
						scale: 0.85 + random01(wx + 4, wz - 2) * 0.65
					});
				} else if (zone === 'Spawn Meadow' && roll > 0.82) {
					flowers.push({
						x: wx,
						z: wz,
						scale: 0.7 + random01(wx - 1, wz + 3) * 0.6
					});
				}
			}
		}

		if (trees.length > 0) {
			const trunks = new InstancedMesh(this.trunkGeometry, this.trunkMaterial, trees.length);
			const crowns = new InstancedMesh(this.crownGeometry, this.crownMaterial, trees.length);
			const helper = new Object3D();
			const matrix = new Matrix4();

			trees.forEach((tree, index) => {
				const y = world.terrainGenerator.visualHeightAt(tree.x, tree.z) + 1;
				helper.position.set(tree.x, y + 0.65 * tree.scale, tree.z);
				helper.scale.set(0.8 * tree.scale, 1.25 * tree.scale, 0.8 * tree.scale);
				helper.rotation.y = random01(tree.x, tree.z + 7) * Math.PI;
				helper.updateMatrix();
				matrix.copy(helper.matrix);
				trunks.setMatrixAt(index, matrix);

				helper.position.set(tree.x, y + 1.65 * tree.scale, tree.z);
				helper.scale.set(1.2 * tree.scale, 0.95 * tree.scale, 1.2 * tree.scale);
				helper.rotation.set(0.08 * random01(tree.x, tree.z), random01(tree.z, tree.x) * Math.PI, 0);
				helper.updateMatrix();
				matrix.copy(helper.matrix);
				crowns.setMatrixAt(index, matrix);
			});

			trunks.instanceMatrix.needsUpdate = true;
			crowns.instanceMatrix.needsUpdate = true;
			trunks.castShadow = true;
			crowns.castShadow = true;
			this.object.add(trunks, crowns);
		}

		if (flowers.length > 0) {
			const mesh = new InstancedMesh(this.flowerGeometry, this.flowerMaterial, flowers.length);
			const helper = new Object3D();

			flowers.forEach((flower, index) => {
				const y = world.terrainGenerator.visualHeightAt(flower.x, flower.z) + 1.18;
				helper.position.set(flower.x, y, flower.z);
				helper.scale.setScalar(flower.scale);
				helper.rotation.y = random01(flower.x, flower.z) * Math.PI;
				helper.updateMatrix();
				mesh.setMatrixAt(index, helper.matrix);
			});

			mesh.instanceMatrix.needsUpdate = true;
			this.object.add(mesh);
		}
	}
}

function terrainColor(world: VoxelWorld, x: number, z: number): Color {
	if (world.terrainGenerator.isPath(x, z)) {
		return PATH;
	}

	if (world.terrainGenerator.isWater(x, z)) {
		return SAND;
	}

	const zone = world.terrainGenerator.zoneAt(x, z);

	if (zone === 'Central City') {
		return CITY;
	}

	if (zone === 'Forest Edge') {
		return FOREST;
	}

	return GRASS;
}

function random01(x: number, z: number): number {
	const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;

	return value - Math.floor(value);
}

function jitter(x: number, z: number, salt: number): number {
	return (random01(x + salt * 11, z - salt * 7) - 0.5) * 2;
}
