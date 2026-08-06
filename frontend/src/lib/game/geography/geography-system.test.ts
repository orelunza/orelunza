import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PlanetGeographySystem } from '../planet/PlanetGeographySystem';
import type { PlanetTileId } from '../planet/PlanetTileId';
import { PlanetTileRenderer } from '../rendering/planet/PlanetTileRenderer';
import type { GeographicTile } from './GeographicTile';
import { GeographicTileCache } from './GeographicTileCache';
import { decodeGeographicTile } from './GeographicTileDecoder';
import type { GeographicTileProvider } from './GeographicTileProvider';
import { sampleGeographicTile } from './GeographicTileSampler';
import {
	resolvePlanetDataCoordinateConvention,
	validatePlanetDataManifest,
	type PlanetDataManifest
} from './PlanetDataManifest';
import {
	canonicalFaceUvToDataFaceUv,
	canonicalTileToDataTile,
	geodeticToDataFaceUv
} from './PlanetDataProjection';

const previewRoot = 'static/planet-data/preview';

function readArrayBuffer(path: string): ArrayBuffer {
	const bytes = readFileSync(path);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function loadPreviewSample(latitudeDegrees: number, longitudeDegrees: number) {
	const manifest = validatePlanetDataManifest(
		JSON.parse(readFileSync(`${previewRoot}/manifest.json`, 'utf8'))
	);
	const faceUv = geodeticToDataFaceUv(
		{
			latitudeRadians: (latitudeDegrees * Math.PI) / 180,
			longitudeRadians: (longitudeDegrees * Math.PI) / 180
		},
		resolvePlanetDataCoordinateConvention(manifest)
	);
	const level = 3;
	const side = 2 ** level;
	const x = Math.min(side - 1, Math.floor(faceUv.u * side));
	const y = Math.min(side - 1, Math.floor(faceUv.v * side));
	const tile = decodeGeographicTile(
		readArrayBuffer(`${previewRoot}/tiles/${faceUv.face}/${level}/${x}/${y}.orgt`)
	);
	return sampleGeographicTile(tile, faceUv.u * side - x, faceUv.v * side - y);
}

function createTile(id: PlanetTileId, value: number): GeographicTile {
	const resolution = 2;
	return {
		id,
		resolution,
		minimumElevationMeters: value,
		maximumElevationMeters: value,
		elevationMeters: new Int16Array([value, value, value, value]),
		landMask: new Uint8Array([255, 255, 255, 255]),
		byteLength: 28
	};
}

class MemoryProvider implements GeographicTileProvider {
	loads = 0;
	disposed = false;
	readonly manifest: PlanetDataManifest = {
		format: 'orelunza-geography-pack',
		version: 1,
		planetId: 'earth',
		dataQuality: 'preview',
		tileResolution: 2,
		minimumLevel: 0,
		maximumLevel: 0,
		tileExtension: 'orgt',
		elevationEncoding: 'int16-meters',
		maskEncoding: 'uint8-land-255-ocean-0',
		minimumElevationMeters: -100,
		maximumElevationMeters: 100,
		sources: [],
		coastlinePath: 'coast.json',
		countriesIndexPath: 'countries.json',
		tilePathTemplate: 'tiles/{face}/{level}/{x}/{y}.orgt'
	};

	async loadManifest(): Promise<PlanetDataManifest> {
		return this.manifest;
	}

	async loadTile(_manifest: Readonly<PlanetDataManifest>, id: Readonly<PlanetTileId>) {
		this.loads += 1;
		return createTile({ ...id }, 120);
	}

	dispose(): void {
		this.disposed = true;
	}
}

describe('planet Earth Lot 2 geography and streamed terrain', () => {
	test('adapts legacy preview tiles without reflecting canonical Earth coordinates', () => {
		expect(canonicalFaceUvToDataFaceUv('positive-z', 0.25, 0.75, 'legacy-positive-z-east')).toEqual(
			{ face: 'negative-z', u: 0.75, v: 0.75 }
		);
		expect(
			canonicalTileToDataTile(
				{ face: 'positive-z', level: 3, x: 2, y: 5 },
				'legacy-positive-z-east'
			)
		).toEqual({ face: 'negative-z', level: 3, x: 5, y: 5 });
		expect(
			canonicalTileToDataTile(
				{ face: 'positive-y', level: 3, x: 2, y: 1 },
				'legacy-positive-z-east'
			)
		).toEqual({ face: 'positive-y', level: 3, x: 2, y: 6 });
	});

	test('loads a bounded preview manifest with explicit source attribution', () => {
		const manifest = validatePlanetDataManifest(
			JSON.parse(readFileSync(`${previewRoot}/manifest.json`, 'utf8'))
		);
		expect(manifest.dataQuality).toBe('preview');
		expect(manifest.tileResolution).toBe(17);
		expect(manifest.maximumLevel).toBe(3);
		expect(manifest.minimumElevationMeters).toBeLessThan(-9000);
		expect(manifest.maximumElevationMeters).toBeGreaterThan(8000);
		expect(manifest.sources.some((source) => source.name.includes('Natural Earth'))).toBe(true);
		expect(manifest.sources.some((source) => source.name.includes('GEBCO'))).toBe(true);
	});

	test('decodes the production binary tile shape without sharing the source buffer', () => {
		const tile = decodeGeographicTile(
			readArrayBuffer(`${previewRoot}/tiles/positive-x/0/0/0.orgt`)
		);
		expect(tile.id).toEqual({ face: 'positive-x', level: 0, x: 0, y: 0 });
		expect(tile.resolution).toBe(17);
		expect(tile.elevationMeters).toHaveLength(289);
		expect(tile.landMask).toHaveLength(289);
		expect(tile.byteLength).toBe(16 + 289 * 3);
		expect([...tile.landMask].every((value) => value === 0 || value === 255)).toBe(true);
	});

	test('recognizes real continent and ocean samples from the bundled preview pack', () => {
		const uganda = loadPreviewSample(1.4, 32.3);
		const amazon = loadPreviewSample(-3, -60);
		const pacific = loadPreviewSample(0, -150);
		expect(uganda.land).toBeGreaterThan(0.8);
		expect(amazon.land).toBeGreaterThan(0.8);
		expect(pacific.land).toBeLessThan(0.2);
	});

	test('keeps recognizable high mountains and deep ocean trenches in the coarse relief', () => {
		const everest = loadPreviewSample(27.99, 86.93);
		const mariana = loadPreviewSample(11.35, 142.2);
		expect(everest.elevationMeters).toBeGreaterThan(5000);
		expect(everest.land).toBeGreaterThan(0.8);
		expect(mariana.elevationMeters).toBeLessThan(-5000);
		expect(mariana.land).toBeLessThan(0.2);
	});

	test('deduplicates simultaneous tile requests and keeps the LRU cache bounded', async () => {
		const provider = new MemoryProvider();
		const cache = new GeographicTileCache(provider, 2);
		const ids: PlanetTileId[] = [
			{ face: 'positive-x', level: 0, x: 0, y: 0 },
			{ face: 'negative-x', level: 0, x: 0, y: 0 },
			{ face: 'positive-y', level: 0, x: 0, y: 0 }
		];
		const [first, duplicate] = await Promise.all([
			cache.getOrLoad(provider.manifest, ids[0]),
			cache.getOrLoad(provider.manifest, ids[0])
		]);
		expect(first).toBe(duplicate);
		expect(provider.loads).toBe(1);
		await cache.getOrLoad(provider.manifest, ids[1]);
		await cache.getOrLoad(provider.manifest, ids[2]);
		expect(cache.diagnostics.entries).toBe(2);
		expect(cache.diagnostics.evictions).toBe(1);
		cache.dispose();
		cache.dispose();
		expect(provider.disposed).toBe(true);
	});

	test('uses a loaded parent tile as stable fallback for finer render LOD', async () => {
		const provider = new MemoryProvider();
		const geography = new PlanetGeographySystem(provider, 'low');
		await geography.initialize();
		const renderTile: PlanetTileId = { face: 'positive-z', level: 5, x: 17, y: 9 };
		geography.update([renderTile]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const resolved = geography.resolveTile(renderTile);
		expect(resolved?.id).toEqual({ face: 'negative-z', level: 0, x: 0, y: 0 });
		expect(geography.diagnostics.fallbackTiles).toBe(1);
		const geometry = PlanetTileRenderer.buildGeometry([renderTile], 2, undefined, geography, 20);
		expect(geometry.loadedDataTiles).toBe(1);
		expect(geometry.landVertexFraction).toBe(1);
		expect(geometry.maximumElevationMeters).toBe(120);
		geometry.surface.dispose();
		geometry.grid.dispose();
		geography.dispose();
		geography.dispose();
	});
});
