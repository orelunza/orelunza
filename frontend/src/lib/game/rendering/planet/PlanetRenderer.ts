import {
	BufferGeometry,
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
import { PlanetStreamingSystem } from '../../planet/PlanetStreamingSystem';
import { planetTileKey } from '../../planet/PlanetTileId';
import { CoastlineRenderer } from './CoastlineRenderer';
import { CountryBoundaryRenderer } from './CountryBoundaryRenderer';
import {
	PlanetEcologyOverlayRenderer,
	type PlanetEcologyOverlayMode
} from './PlanetEcologyOverlayRenderer';
import { PlanetDebugOverlay } from './PlanetDebugOverlay';
import { PlanetGeographyDebugOverlay } from './PlanetGeographyDebugOverlay';
import { createPlanetTerrainMaterial } from './PlanetTerrainMaterial';
import { PlanetTerrainRenderer } from './PlanetTerrainRenderer';
import { PlanetOceanRenderer } from './PlanetOceanRenderer';
import { PlanetHydrologyRenderer } from './PlanetHydrologyRenderer';

export interface PlanetRendererDiagnostics {
	activeTiles: number;
	maximumLodLevel: number;
	triangles: number;
	drawCalls: number;
	geometryRebuilds: number;
	cameraAltitudeMeters: number;
	geographyReady: boolean;
	geographyQuality: 'unavailable' | 'preview' | 'production';
	loadedDataTiles: number;
	requestedDataTiles: number;
	fallbackDataTiles: number;
	cacheEntries: number;
	cacheBytes: number;
	cacheEvictions: number;
	landVertexFraction: number;
	minimumElevationMeters: number;
	maximumElevationMeters: number;
	reliefExaggeration: number;
	coastlinesReady: boolean;
	countriesReady: boolean;
	ecologyOverlayReady: boolean;
	hydrologyReady: boolean;
	riverSegments: number;
	lakePoints: number;
	waterfalls: number;
}

const MAXIMUM_HYDROLOGY_ALTITUDE_METERS = 1_500_000;

const SEGMENTS_PER_QUALITY: Readonly<Record<PlanetLodQuality, number>> = Object.freeze({
	low: 2,
	medium: 4,
	high: 6
});

export class PlanetRenderer {
	readonly object = new Group();
	readonly coordinateSystem: PlanetCoordinateSystem;
	private readonly lod: PlanetLodSystem;
	private readonly streaming: PlanetStreamingSystem;
	private readonly surface: Mesh;
	private readonly ocean: PlanetOceanRenderer;
	private readonly hydrology: PlanetHydrologyRenderer;
	private readonly coastline: CoastlineRenderer;
	private readonly countries: CountryBoundaryRenderer;
	private readonly ecologyOverlay: PlanetEcologyOverlayRenderer;
	private readonly debugOverlay = new PlanetDebugOverlay();
	private readonly geographyDebug = new PlanetGeographyDebugOverlay();
	private readonly atmosphere: Mesh;
	private readonly logicalCameraPosition = new Vector3();
	private tileSignature = '';
	private disposed = false;
	private geometryRebuilds = 0;
	private reliefExaggeration = 1;
	private hydrologyRequestedVisible = false;
	private hydrologyDisplayActive = false;
	private diagnosticsState: PlanetRendererDiagnostics = {
		activeTiles: 0,
		maximumLodLevel: 0,
		triangles: 0,
		drawCalls: 9,
		geometryRebuilds: 0,
		cameraAltitudeMeters: 0,
		geographyReady: false,
		geographyQuality: 'unavailable',
		loadedDataTiles: 0,
		requestedDataTiles: 0,
		fallbackDataTiles: 0,
		cacheEntries: 0,
		cacheBytes: 0,
		cacheEvictions: 0,
		landVertexFraction: 0,
		minimumElevationMeters: 0,
		maximumElevationMeters: 0,
		reliefExaggeration: 1,
		coastlinesReady: false,
		countriesReady: false,
		ecologyOverlayReady: false,
		hydrologyReady: false,
		riverSegments: 0,
		lakePoints: 0,
		waterfalls: 0
	};

	constructor(
		private readonly scene: Scene,
		readonly definition: Readonly<PlanetDefinition> = EARTH_PLANET,
		private quality: PlanetLodQuality = 'medium'
	) {
		this.coordinateSystem = new PlanetCoordinateSystem(definition);
		this.lod = new PlanetLodSystem(definition);
		this.streaming = new PlanetStreamingSystem(quality);
		this.surface = new Mesh(new BufferGeometry(), createPlanetTerrainMaterial());
		this.surface.frustumCulled = false;
		this.surface.castShadow = false;
		this.surface.receiveShadow = true;
		this.surface.renderOrder = 2;
		this.ocean = new PlanetOceanRenderer(definition);
		this.hydrology = new PlanetHydrologyRenderer(definition);
		this.hydrology.setVisible(false);
		this.coastline = new CoastlineRenderer(definition);
		void this.coastline.load();
		this.countries = new CountryBoundaryRenderer(definition);
		void this.countries.load().catch(() => undefined);
		this.ecologyOverlay = new PlanetEcologyOverlayRenderer(definition);
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
		this.object.add(
			this.surface,
			this.ocean.object,
			this.hydrology.object,
			this.coastline.object,
			this.ecologyOverlay.object,
			this.countries.object,
			this.debugOverlay.object,
			this.atmosphere
		);
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
		this.streaming.update(snapshot.tiles);
		this.ocean.update(
			typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
		);

		const geodetic = this.coordinateSystem.planetToGeodetic(this.logicalCameraPosition);
		const cameraDistance = this.logicalCameraPosition.length();
		const cameraAltitudeMeters = Number.isFinite(geodetic.altitudeMeters)
			? geodetic.altitudeMeters
			: Math.max(0, cameraDistance - this.definition.equatorialRadiusMeters);
		this.reliefExaggeration = PlanetRenderer.reliefForAltitude(cameraAltitudeMeters);
		const hydrologyDisplayActive =
			this.hydrologyRequestedVisible && cameraAltitudeMeters <= MAXIMUM_HYDROLOGY_ALTITUDE_METERS;
		if (hydrologyDisplayActive !== this.hydrologyDisplayActive) {
			this.hydrologyDisplayActive = hydrologyDisplayActive;
			this.hydrology.setVisible(hydrologyDisplayActive);
			if (hydrologyDisplayActive) this.tileSignature = '';
		}
		const geography = this.streaming.geography.diagnostics;
		this.geographyDebug.update(geography);
		const signature = `${snapshot.tiles.map(planetTileKey).join('|')}@${geography.revision}@${this.reliefExaggeration}`;
		if (signature !== this.tileSignature) {
			this.tileSignature = signature;
			this.rebuild(snapshot);
		}
		const hydrology = this.hydrology.diagnostics;

		this.diagnosticsState = {
			...this.diagnosticsState,
			activeTiles: snapshot.visibleTileCount,
			maximumLodLevel: snapshot.maximumLevel,
			geometryRebuilds: this.geometryRebuilds,
			cameraAltitudeMeters,
			geographyReady: geography.ready,
			geographyQuality: geography.dataQuality,
			loadedDataTiles: geography.resolvedTiles,
			requestedDataTiles: geography.requestedTiles,
			fallbackDataTiles: geography.fallbackTiles,
			cacheEntries: geography.cacheEntries,
			cacheBytes: geography.cacheBytes,
			cacheEvictions: geography.cacheEvictions,
			reliefExaggeration: this.reliefExaggeration,
			coastlinesReady: this.coastline.ready,
			countriesReady: this.countries.ready,
			ecologyOverlayReady: this.ecologyOverlay.ready,
			hydrologyReady: hydrology.ready,
			riverSegments: hydrology.riverSegments,
			lakePoints: hydrology.lakePoints,
			waterfalls: hydrology.waterfalls
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
		this.streaming.setQuality(quality);
	}

	setDebugVisible(visible: boolean): void {
		this.debugOverlay.setVisible(visible);
	}

	setCoastlinesVisible(visible: boolean): void {
		this.coastline.setVisible(visible);
	}

	setHydrologyVisible(visible: boolean): void {
		if (visible === this.hydrologyRequestedVisible) return;
		this.hydrologyRequestedVisible = visible;
		if (!visible) {
			this.hydrologyDisplayActive = false;
			this.hydrology.setVisible(false);
		}
		this.tileSignature = '';
	}

	setCountryBoundariesVisible(visible: boolean): void {
		this.countries.setVisible(visible);
	}

	setSelectedCountry(id: string | null): void {
		this.countries.setSelectedCountry(id);
	}

	setEcologyOverlayMode(mode: PlanetEcologyOverlayMode): void {
		this.ecologyOverlay.setMode(mode);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.scene.remove(this.object);
		this.surface.geometry.dispose();
		(this.surface.material as ReturnType<typeof createPlanetTerrainMaterial>).dispose();
		this.ocean.dispose();
		this.hydrology.dispose();
		this.coastline.dispose();
		this.countries.dispose();
		this.ecologyOverlay.dispose();
		this.debugOverlay.dispose();
		this.geographyDebug.dispose();
		this.streaming.dispose();
		this.atmosphere.geometry.dispose();
		(this.atmosphere.material as MeshBasicMaterial).dispose();
		this.object.clear();
	}

	private rebuild(snapshot: Readonly<PlanetLodSnapshot>): void {
		const geometry = PlanetTerrainRenderer.build(
			snapshot.tiles,
			SEGMENTS_PER_QUALITY[this.quality],
			this.definition,
			this.streaming.geography,
			this.reliefExaggeration
		);
		this.surface.geometry.dispose();
		this.surface.geometry = geometry.surface;
		this.debugOverlay.setGeometry(geometry.grid);
		if (this.hydrologyDisplayActive) {
			this.hydrology.rebuild(snapshot.tiles, this.streaming.geography, this.reliefExaggeration);
		}
		this.geometryRebuilds += 1;
		this.diagnosticsState = {
			...this.diagnosticsState,
			triangles: geometry.triangleCount,
			landVertexFraction: geometry.landVertexFraction,
			minimumElevationMeters: geometry.minimumElevationMeters,
			maximumElevationMeters: geometry.maximumElevationMeters
		};
	}

	private static reliefForAltitude(altitudeMeters: number): number {
		if (!Number.isFinite(altitudeMeters) || altitudeMeters >= 5_000_000) {
			return 3;
		}
		if (altitudeMeters >= 1_000_000) {
			return 2.5;
		}
		if (altitudeMeters >= 250_000) {
			return 2;
		}
		if (altitudeMeters >= 60_000) {
			return 1.4;
		}
		return 1;
	}
}
