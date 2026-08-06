import {
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	Vector3
} from 'three';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import { EARTH_PLANET, type PlanetDefinition } from '../../planet/PlanetDefinition';
import {
	PlanetLodSystem,
	type PlanetLodQuality,
	type PlanetLodSnapshot
} from '../../planet/PlanetLodSystem';
import { planetTileKey } from '../../planet/PlanetTileId';
import { PlanetDebugOverlay } from './PlanetDebugOverlay';
import { createPlanetSurfaceMaterial } from './PlanetMaterial';
import { PlanetTileRenderer } from './PlanetTileRenderer';

export interface PlanetRendererDiagnostics {
	activeTiles: number;
	maximumLodLevel: number;
	triangles: number;
	drawCalls: number;
	geometryRebuilds: number;
	cameraAltitudeMeters: number;
}

const SEGMENTS_PER_QUALITY: Readonly<Record<PlanetLodQuality, number>> = Object.freeze({
	low: 2,
	medium: 4,
	high: 6
});

export class PlanetRenderer {
	readonly object = new Group();
	readonly coordinateSystem: PlanetCoordinateSystem;
	private readonly lod: PlanetLodSystem;
	private readonly surface: Mesh;
	private readonly debugOverlay = new PlanetDebugOverlay();
	private readonly atmosphere: Mesh;
	private readonly logicalCameraPosition = new Vector3();
	private tileSignature = '';
	private disposed = false;
	private geometryRebuilds = 0;
	private diagnosticsState: PlanetRendererDiagnostics = {
		activeTiles: 0,
		maximumLodLevel: 0,
		triangles: 0,
		drawCalls: 3,
		geometryRebuilds: 0,
		cameraAltitudeMeters: 0
	};

	constructor(
		private readonly scene: Scene,
		readonly definition: Readonly<PlanetDefinition> = EARTH_PLANET,
		private quality: PlanetLodQuality = 'medium'
	) {
		this.coordinateSystem = new PlanetCoordinateSystem(definition);
		this.lod = new PlanetLodSystem(definition);
		this.surface = new Mesh(undefined, createPlanetSurfaceMaterial());
		this.surface.frustumCulled = false;
		this.surface.castShadow = false;
		this.surface.receiveShadow = true;
		this.atmosphere = new Mesh(
			new SphereGeometry(definition.renderRadiusUnits * 1.025, 48, 32),
			new MeshBasicMaterial({
				color: new Color('#6cbcff'),
				transparent: true,
				opacity: 0.075,
				depthWrite: false
			})
		);
		this.atmosphere.renderOrder = 4;
		this.object.add(this.surface, this.debugOverlay.object, this.atmosphere);
		this.scene.add(this.object);
	}

	get diagnostics(): PlanetRendererDiagnostics {
		return { ...this.diagnosticsState };
	}

	update(camera: PerspectiveCamera, viewportHeightPixels: number): PlanetLodSnapshot {
		if (this.disposed) {
			return { tiles: [], maximumLevel: 0, visibleTileCount: 0, splitTileCount: 0 };
		}

		const metersPerRenderUnit =
			this.definition.equatorialRadiusMeters / this.definition.renderRadiusUnits;
		this.logicalCameraPosition.copy(camera.position).multiplyScalar(metersPerRenderUnit);
		const snapshot = this.lod.update({
			cameraPlanetPosition: this.logicalCameraPosition,
			verticalFieldOfViewRadians: (camera.fov * Math.PI) / 180,
			viewportHeightPixels,
			quality: this.quality,
			maximumTiles: this.quality === 'low' ? 768 : this.quality === 'medium' ? 1280 : 2048
		});
		const signature = snapshot.tiles.map(planetTileKey).join('|');
		if (signature !== this.tileSignature) {
			this.tileSignature = signature;
			this.rebuild(snapshot);
		}

		const cameraDistance = this.logicalCameraPosition.length();
		const geodetic = this.coordinateSystem.planetToGeodetic(this.logicalCameraPosition);
		this.diagnosticsState = {
			...this.diagnosticsState,
			activeTiles: snapshot.visibleTileCount,
			maximumLodLevel: snapshot.maximumLevel,
			geometryRebuilds: this.geometryRebuilds,
			cameraAltitudeMeters: Number.isFinite(geodetic.altitudeMeters)
				? geodetic.altitudeMeters
				: Math.max(0, cameraDistance - this.definition.equatorialRadiusMeters)
		};
		return snapshot;
	}

	setQuality(quality: PlanetLodQuality): void {
		if (quality === this.quality) {
			return;
		}
		this.quality = quality;
		this.tileSignature = '';
		this.lod.reset();
	}

	setDebugVisible(visible: boolean): void {
		this.debugOverlay.setVisible(visible);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.scene.remove(this.object);
		this.surface.geometry.dispose();
		(this.surface.material as ReturnType<typeof createPlanetSurfaceMaterial>).dispose();
		this.debugOverlay.dispose();
		this.atmosphere.geometry.dispose();
		(this.atmosphere.material as MeshBasicMaterial).dispose();
		this.object.clear();
	}

	private rebuild(snapshot: Readonly<PlanetLodSnapshot>): void {
		const geometry = PlanetTileRenderer.buildGeometry(
			snapshot.tiles,
			SEGMENTS_PER_QUALITY[this.quality],
			this.definition
		);
		this.surface.geometry.dispose();
		this.surface.geometry = geometry.surface;
		this.debugOverlay.setGeometry(geometry.grid);
		this.geometryRebuilds += 1;
		this.diagnosticsState.triangles = geometry.triangleCount;
	}
}
