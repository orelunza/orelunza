import { Scene, WebGLRenderer, type Camera } from 'three';
import { addWorldLighting } from './Lighting';
import { SelectionOutline } from './SelectionOutline';
import { configureSky } from './Sky';
import { BlockMeshFactory, type BlockInstanceLookup } from '../world/BlockMeshFactory';
import type { VoxelWorld } from '../world/VoxelWorld';
import { type BlockCoordinate } from '../world/voxel-types';

export class GameRenderer {
	readonly scene = new Scene();
	readonly renderer: WebGLRenderer;
	readonly selection = new SelectionOutline();
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
		this.meshFactory.dispose();
		this.renderer.dispose();
	}
}
