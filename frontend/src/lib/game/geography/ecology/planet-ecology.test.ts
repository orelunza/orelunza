import { describe, expect, test } from 'vitest';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import { EARTH_PLANET } from '../../planet/PlanetDefinition';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import { createPlanetSurfaceAnchor } from '../../planet/surface/PlanetSurfaceAnchor';
import type { GeographicSample } from '../GeographicTile';
import type { GeographicTileId } from '../GeographicTileId';
import type { PlanetDataManifest } from '../PlanetDataManifest';
import { decodeEcologicalTile } from './EcologicalTileDecoder';
import type { EcologicalTileProvider } from './EcologicalTileProvider';
import { PlanetBiomeResolver } from './PlanetBiomeResolver';
import { PlanetEcologyQuery } from './PlanetEcologyQuery';
import { PlanetTerrainColumnSampler } from '../../world/planet/PlanetTerrainColumnSampler';
import { PlanetTerrainGenerator } from '../../world/planet/PlanetTerrainGenerator';
import type { PlanetSurfaceEcology } from './PlanetSurfaceEcology';

const land: GeographicSample = {
	elevationMeters: 200,
	land: 1,
	bathymetryMeters: 0,
	coastProximity: 0
};

function coordinate(latitudeDegrees: number, longitudeDegrees: number): GeodeticCoordinate {
	return {
		latitudeRadians: (latitudeDegrees * Math.PI) / 180,
		longitudeRadians: (longitudeDegrees * Math.PI) / 180,
		altitudeMeters: 0
	};
}

describe('planet ecology and geographic vegetation', () => {
	test('decodes the bounded OREC binary payload', () => {
		const buffer = ecologicalBuffer({ face: 'positive-x', level: 0, x: 0, y: 0 }, 2, 1, 82, 190);
		const tile = decodeEcologicalTile(buffer);
		expect(tile.resolution).toBe(2);
		expect([...tile.landCoverCodes]).toEqual([1, 1, 1, 1]);
		expect([...tile.treeCoverDensity]).toEqual([82, 82, 82, 82]);
	});

	test('resolves globally distinct biomes from land cover and geography', () => {
		const resolver = new PlanetBiomeResolver();
		expect(
			resolver.resolve(coordinate(-3, -60), land, {
				landCover: 'tree-cover',
				treeCoverDensity: 0.9,
				confidence: 0.8
			})
		).toBe('tropical-rainforest');
		expect(
			resolver.resolve(coordinate(24, 14), land, {
				landCover: 'bare-sparse',
				treeCoverDensity: 0.01,
				confidence: 0.8
			})
		).toBe('desert');
		expect(
			resolver.resolve(
				coordinate(47, 10),
				{ ...land, elevationMeters: 3200 },
				{
					landCover: 'grassland',
					treeCoverDensity: 0.05,
					confidence: 0.8
				}
			)
		).toBe('alpine');
		expect(
			resolver.resolve(
				coordinate(0, -140),
				{ ...land, land: 0, elevationMeters: -4000 },
				{
					landCover: 'permanent-water',
					treeCoverDensity: 0,
					confidence: 0.9
				}
			)
		).toBe('ocean');
	});

	test('falls back to an available parent ecology tile', async () => {
		const provider = new MemoryEcologyProvider();
		const query = new PlanetEcologyQuery(provider, 2);
		const sample = await query.sample(coordinate(0, 0), 3);
		expect(sample.landCover).toBe('tree-cover');
		expect(sample.treeCoverDensity).toBeCloseTo(0.76, 5);
		expect(query.diagnostics.fallbacks).toBeGreaterThan(0);
		query.dispose();
	});

	test('keeps dense forests wooded and deserts free of generated trees', () => {
		const coordinates = new PlanetCoordinateSystem(EARTH_PLANET);
		const anchor = createPlanetSurfaceAnchor(coordinates, coordinate(0, 25), 200);
		const grid = {
			resolution: 3,
			halfExtentMeters: 64,
			referenceElevationMeters: 200,
			elevationMeters: new Float32Array(9).fill(200),
			landMask: new Uint8Array(9).fill(255),
			minimumElevationMeters: 200,
			maximumElevationMeters: 200
		};
		const columns = new PlanetTerrainColumnSampler(grid);
		const rainforest = new PlanetTerrainGenerator(anchor, columns, {
			ecology: ecology('tropical-rainforest', 'Planet Tropical Rainforest', 0.9, 0.95)
		});
		const desert = new PlanetTerrainGenerator(anchor, columns, {
			ecology: ecology('desert', 'Planet Desert', 0, 0.02)
		});
		expect(rainforest.generateChunk(1, 1).blocks.some((block) => block.type === 'wood')).toBe(true);
		expect(desert.generateChunk(1, 1).blocks.some((block) => block.type === 'wood')).toBe(false);
	});
});

function ecology(
	biome: PlanetSurfaceEcology['biome'],
	zoneName: string,
	treeCoverDensity: number,
	vegetationDensity: number
): PlanetSurfaceEcology {
	return {
		country: null,
		landCover: biome === 'desert' ? 'bare-sparse' : 'tree-cover',
		biome,
		biomeLabel: zoneName.replace('Planet ', ''),
		zoneName,
		treeCoverDensity,
		vegetationDensity,
		surfaceMoisture: biome === 'desert' ? 0.03 : 0.9,
		confidence: 0.8,
		dataQuality: 'test'
	};
}

function ecologicalBuffer(
	id: GeographicTileId,
	resolution: number,
	landCover: number,
	treeDensity: number,
	confidence: number
): ArrayBuffer {
	const count = resolution * resolution;
	const buffer = new ArrayBuffer(24 + count * 3);
	const view = new DataView(buffer);
	view.setUint32(0, 0x4345524f, true);
	view.setUint8(4, 1);
	view.setUint8(5, 0);
	view.setUint8(6, id.level);
	view.setUint16(8, id.x, true);
	view.setUint16(10, id.y, true);
	view.setUint16(12, resolution, true);
	view.setUint32(20, count, true);
	new Uint8Array(buffer, 24, count).fill(landCover);
	new Uint8Array(buffer, 24 + count, count).fill(treeDensity);
	new Uint8Array(buffer, 24 + count * 2, count).fill(confidence);
	return buffer;
}

class MemoryEcologyProvider implements EcologicalTileProvider {
	private disposed = false;
	readonly manifest: PlanetDataManifest = {
		format: 'orelunza-geography-pack',
		version: 1,
		planetId: 'earth',
		dataQuality: 'preview',
		tileResolution: 2,
		minimumLevel: 0,
		maximumLevel: 3,
		tileExtension: 'orgt',
		elevationEncoding: 'int16-meters',
		maskEncoding: 'uint8-land-255-ocean-0',
		minimumElevationMeters: -1,
		maximumElevationMeters: 1,
		sources: [],
		coastlinePath: '',
		countriesIndexPath: '',
		tilePathTemplate: 'tiles/{face}/{level}/{x}/{y}.orgt',
		ecologyFormat: 'orelunza-ecology-pack',
		ecologyVersion: 1,
		ecologyDataQuality: 'preview-proxy',
		ecologyTileResolution: 2,
		ecologyMinimumLevel: 0,
		ecologyMaximumLevel: 3,
		ecologyTileExtension: 'orec',
		ecologyTilePathTemplate: 'ecology/{face}/{level}/{x}/{y}.orec'
	};

	async loadManifest(): Promise<PlanetDataManifest> {
		return this.manifest;
	}

	async loadTile(_manifest: Readonly<PlanetDataManifest>, id: Readonly<GeographicTileId>) {
		if (this.disposed || id.level > 1) return null;
		return decodeEcologicalTile(ecologicalBuffer({ ...id, level: id.level }, 2, 1, 76, 200));
	}

	dispose(): void {
		this.disposed = true;
	}
}
