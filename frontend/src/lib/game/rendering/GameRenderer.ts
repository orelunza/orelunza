import {
	BoxGeometry,
	Group,
	Mesh,
	MeshLambertMaterial,
	Scene,
	WebGLRenderer,
	type Camera
} from 'three';
import { addWorldLighting } from './Lighting';
import { SelectionOutline } from './SelectionOutline';
import { configureSky } from './Sky';
import { BlockMeshFactory, type BlockInstanceLookup } from '../world/BlockMeshFactory';
import type { VoxelWorld } from '../world/VoxelWorld';
import { CENTRAL_CITY_CENTER, type BlockCoordinate } from '../world/voxel-types';

export class GameRenderer {
	readonly scene = new Scene();
	readonly renderer: WebGLRenderer;
	readonly selection = new SelectionOutline();
	private readonly citySilhouette = createCitySilhouette();
	private readonly meshFactory = new BlockMeshFactory();
	private blockMeshes: BlockInstanceLookup[] = [];

	constructor(readonly canvas: HTMLCanvasElement) {
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance'
		});
		this.renderer.setPixelRatio(1);
		this.renderer.shadowMap.enabled = false;
		configureSky(this.scene);
		addWorldLighting(this.scene);
		this.scene.add(this.selection.object);
		this.scene.add(this.citySilhouette);
	}

	get lookups(): BlockInstanceLookup[] {
		return this.blockMeshes;
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
	}

	rebuildWorld(world: VoxelWorld): void {
		for (const lookup of this.blockMeshes) {
			this.scene.remove(lookup.mesh);
			const material = lookup.mesh.material;

			if (Array.isArray(material)) {
				for (const item of material) {
					item.dispose();
				}
			}
		}

		this.blockMeshes = this.meshFactory.createMeshes(world.getVisibleBlocks());

		for (const lookup of this.blockMeshes) {
			this.scene.add(lookup.mesh);
		}
	}

	setSelection(block: BlockCoordinate | null): void {
		this.selection.setTarget(block);
	}

	render(camera: Camera): void {
		this.renderer.render(this.scene, camera);
	}

	dispose(): void {
		for (const lookup of this.blockMeshes) {
			this.scene.remove(lookup.mesh);
		}

		this.blockMeshes = [];
		this.selection.dispose();
		this.scene.remove(this.citySilhouette);
		this.meshFactory.dispose();
		this.renderer.dispose();
	}
}

function createCitySilhouette(): Group {
	const group = new Group();
	const geometry = new BoxGeometry(1, 1, 1);
	const material = new MeshLambertMaterial({
		color: 0xc78d5c
	});
	const towers = [
		{ x: 0, y: 15, z: 0, sx: 7, sy: 16, sz: 7 },
		{ x: -12, y: 12, z: 4, sx: 7, sy: 10, sz: 7 },
		{ x: 12, y: 11, z: -3, sx: 7, sy: 9, sz: 7 },
		{ x: -22, y: 10, z: -6, sx: 6, sy: 7, sz: 6 },
		{ x: 22, y: 10, z: 7, sx: 6, sy: 7, sz: 6 }
	];

	for (const tower of towers) {
		const mesh = new Mesh(geometry, material);
		mesh.position.set(CENTRAL_CITY_CENTER.x + tower.x, tower.y, CENTRAL_CITY_CENTER.z + tower.z);
		mesh.scale.set(tower.sx, tower.sy, tower.sz);
		group.add(mesh);
	}

	return group;
}
