import {
	Mesh,
	MeshBasicMaterial,
	SphereGeometry,
	SRGBColorSpace,
	Texture,
	TextureLoader
} from 'three';
import type { PlanetDefinition } from '../../planet/PlanetDefinition';

export type PlanetEcologyOverlayMode = 'none' | 'land-cover' | 'biome';

export class PlanetEcologyOverlayRenderer {
	readonly object: Mesh;
	private readonly material: MeshBasicMaterial;
	private landCoverTexture: Texture | null = null;
	private biomeTexture: Texture | null = null;
	private mode: PlanetEcologyOverlayMode = 'none';
	private disposed = false;
	private loaded = false;

	constructor(
		definition: Readonly<PlanetDefinition>,
		private readonly baseUrl = '/planet-data/preview'
	) {
		this.material = new MeshBasicMaterial({
			transparent: true,
			opacity: 0.72,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2
		});
		this.object = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits * 1.043, 96, 64),
			this.material
		);
		this.object.frustumCulled = false;
		this.object.renderOrder = 6;
		this.object.visible = false;
		void this.load();
	}

	get ready(): boolean {
		return this.loaded;
	}

	setMode(mode: PlanetEcologyOverlayMode): void {
		this.mode = mode;
		this.applyMode();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.object.geometry.dispose();
		this.material.dispose();
		this.landCoverTexture?.dispose();
		this.biomeTexture?.dispose();
		this.landCoverTexture = null;
		this.biomeTexture = null;
	}

	private async load(): Promise<void> {
		const loader = new TextureLoader();
		try {
			const [landCover, biome] = await Promise.all([
				loader.loadAsync(`${this.baseUrl}/land-cover-overview.png`),
				loader.loadAsync(`${this.baseUrl}/biome-overview.png`)
			]);
			if (this.disposed) {
				landCover.dispose();
				biome.dispose();
				return;
			}
			landCover.colorSpace = SRGBColorSpace;
			biome.colorSpace = SRGBColorSpace;
			this.landCoverTexture = landCover;
			this.biomeTexture = biome;
			this.loaded = true;
			this.applyMode();
		} catch {
			this.loaded = false;
		}
	}

	private applyMode(): void {
		const texture =
			this.mode === 'land-cover'
				? this.landCoverTexture
				: this.mode === 'biome'
					? this.biomeTexture
					: null;
		this.material.map = texture;
		this.material.needsUpdate = true;
		this.object.visible = texture !== null;
	}
}
