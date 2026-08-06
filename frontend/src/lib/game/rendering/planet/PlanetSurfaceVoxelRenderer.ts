import { Group, Raycaster, Vector3, type Intersection, type Object3D } from 'three';
import { BlockMeshFactory, type BlockInstanceLookup } from '../../world/BlockMeshFactory';
import type { BlockCoordinate, BlockType } from '../../world/voxel-types';
import type { PlanetVoxelBridge } from '../../world/planet/PlanetVoxelBridge';

export interface PlanetSurfaceVoxelHit {
	block: BlockCoordinate;
	normal: BlockCoordinate;
	type: BlockType;
	distance: number;
}

export class PlanetSurfaceVoxelRenderer {
	readonly object = new Group();
	private readonly meshFactory = new BlockMeshFactory();
	private lookups: BlockInstanceLookup[] = [];
	private disposed = false;

	constructor(readonly bridge: PlanetVoxelBridge) {
		this.object.name = 'orelunzaPlanetSurfaceVoxels';
		this.rebuild();
	}

	rebuild(): void {
		this.assertUsable();
		for (const lookup of this.lookups) {
			this.object.remove(lookup.mesh);
		}
		this.lookups = this.meshFactory.createMeshes(
			this.bridge.world.getVisibleBlocks(),
			this.bridge.world
		);
		for (const lookup of this.lookups) {
			this.object.add(lookup.mesh);
		}
	}

	pick(raycaster: Raycaster): PlanetSurfaceVoxelHit | null {
		this.assertUsable();
		const intersections = raycaster.intersectObjects(
			this.lookups.map((lookup) => lookup.mesh),
			false
		);
		for (const intersection of intersections) {
			const hit = this.resolveIntersection(intersection);
			if (hit) {
				return hit;
			}
		}
		return null;
	}

	remove(hit: Readonly<PlanetSurfaceVoxelHit>): boolean {
		const removed = this.bridge.removeBlock(hit.block);
		if (!removed) {
			return false;
		}
		this.rebuild();
		return true;
	}

	placeAdjacent(hit: Readonly<PlanetSurfaceVoxelHit>, type: BlockType = 'stone'): boolean {
		const position = {
			x: hit.block.x + hit.normal.x,
			y: hit.block.y + hit.normal.y,
			z: hit.block.z + hit.normal.z
		};
		const placed = this.bridge.placeBlock(position, type);
		if (!placed) {
			return false;
		}
		this.rebuild();
		return true;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		for (const lookup of this.lookups) {
			this.object.remove(lookup.mesh);
		}
		this.lookups = [];
		this.meshFactory.dispose();
		this.object.clear();
	}

	private resolveIntersection(intersection: Intersection<Object3D>): PlanetSurfaceVoxelHit | null {
		if (intersection.instanceId === undefined) {
			return null;
		}
		const lookup = this.lookups.find((candidate) => candidate.mesh === intersection.object);
		const block = lookup?.blocks[intersection.instanceId];
		if (!lookup || !block) {
			return null;
		}
		const faceNormal = intersection.face?.normal ?? new Vector3(0, 1, 0);
		return {
			block: { ...block },
			normal: {
				x: Math.round(faceNormal.x),
				y: Math.round(faceNormal.y),
				z: Math.round(faceNormal.z)
			},
			type: lookup.type,
			distance: intersection.distance
		};
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('PlanetSurfaceVoxelRenderer has been disposed.');
		}
	}
}
