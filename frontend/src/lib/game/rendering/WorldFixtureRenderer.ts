import { PointLight, Vector3, type Scene } from 'three';
import { BlockRegistry } from '../world/BlockRegistry';
import type { VoxelWorld } from '../world/VoxelWorld';
import { chunkKey, type ChunkCoordinate } from '../world/voxel-types';

interface LightFixture {
	id: string;
	position: Vector3;
	color: number;
	intensity: number;
	distance: number;
}

const MAX_ACTIVE_LIGHTS = 12;
const RESELECT_DISTANCE_SQUARED = 2.25;

/**
 * Keeps expensive real-time point lights limited to the nearest active city
 * fixtures while every lamp/fire block still renders its own emissive geometry.
 */
export class WorldFixtureRenderer {
	private readonly fixturesByChunk = new Map<string, LightFixture[]>();
	private readonly activeLights = new Map<string, PointLight>();
	private readonly lastCamera = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
	private dirty = true;

	constructor(private readonly scene: Scene) {}

	replaceChunk(world: VoxelWorld, chunk: ChunkCoordinate): void {
		const key = chunkKey(chunk);
		const fixtures: LightFixture[] = [];
		for (const block of world.getVisibleBlocksInChunk(chunk)) {
			const definition = BlockRegistry.get(block.type);
			if (!definition.light || !BlockRegistry.isLit(block)) continue;
			fixtures.push({
				id: `${block.position.x},${block.position.y},${block.position.z}`,
				position: new Vector3(
					block.position.x + 0.5,
					block.position.y + 0.8,
					block.position.z + 0.5
				),
				color: definition.light.color,
				intensity: definition.light.intensity,
				distance: definition.light.distance
			});
		}
		this.fixturesByChunk.set(key, fixtures);
		this.dirty = true;
	}

	removeChunk(chunk: ChunkCoordinate): void {
		this.fixturesByChunk.delete(chunkKey(chunk));
		this.dirty = true;
	}

	update(cameraPosition: Readonly<Vector3>): void {
		const dx = cameraPosition.x - this.lastCamera.x;
		const dy = cameraPosition.y - this.lastCamera.y;
		const dz = cameraPosition.z - this.lastCamera.z;
		if (!this.dirty && dx * dx + dy * dy + dz * dz < RESELECT_DISTANCE_SQUARED) return;
		this.lastCamera.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		const fixtures = [...this.fixturesByChunk.values()].flat();
		fixtures.sort(
			(left, right) =>
				left.position.distanceToSquared(this.lastCamera) -
				right.position.distanceToSquared(this.lastCamera)
		);
		const wanted = new Set(fixtures.slice(0, MAX_ACTIVE_LIGHTS).map((fixture) => fixture.id));
		for (const [id, light] of this.activeLights) {
			if (wanted.has(id)) continue;
			this.scene.remove(light);
			this.activeLights.delete(id);
		}
		for (const fixture of fixtures.slice(0, MAX_ACTIVE_LIGHTS)) {
			let light = this.activeLights.get(fixture.id);
			if (!light) {
				light = new PointLight(fixture.color, fixture.intensity, fixture.distance, 2);
				light.name = `civilizationLight:${fixture.id}`;
				light.castShadow = false;
				this.activeLights.set(fixture.id, light);
				this.scene.add(light);
			}
			light.position.copy(fixture.position);
			light.color.setHex(fixture.color);
			light.intensity = fixture.intensity;
			light.distance = fixture.distance;
		}
		this.dirty = false;
	}

	clear(): void {
		this.fixturesByChunk.clear();
		for (const light of this.activeLights.values()) {
			this.scene.remove(light);
		}
		this.activeLights.clear();
		this.dirty = true;
	}

	dispose(): void {
		this.clear();
	}
}
