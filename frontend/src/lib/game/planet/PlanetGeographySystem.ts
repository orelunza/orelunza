import type { PlanetLodQuality } from './PlanetLodSystem';
import { PLANET_FACES } from './PlanetFace';
import { planetTileKey, type PlanetTileId } from './PlanetTileId';
import type { GeographicSample, GeographicTile } from '../geography/GeographicTile';
import { GeographicTileCache } from '../geography/GeographicTileCache';
import type { GeographicTileProvider } from '../geography/GeographicTileProvider';
import { geographicTileAncestor } from '../geography/GeographicTileId';
import {
	resolvePlanetDataCoordinateConvention,
	type PlanetDataCoordinateConvention,
	type PlanetDataManifest
} from '../geography/PlanetDataManifest';
import { canonicalTileToDataTile } from '../geography/PlanetDataProjection';
import { StaticGeographicTileProvider } from '../geography/StaticGeographicTileProvider';
import { PlanetTerrainSampler } from './PlanetTerrainSampler';

export interface PlanetGeographyDiagnostics {
	ready: boolean;
	baseCoverageReady: boolean;
	dataQuality: 'unavailable' | 'preview' | 'production';
	requestedTiles: number;
	resolvedTiles: number;
	fallbackTiles: number;
	cacheEntries: number;
	cacheBytes: number;
	cacheHits: number;
	cacheMisses: number;
	cacheEvictions: number;
	failedRequests: number;
	revision: number;
}

const CACHE_ENTRIES: Readonly<Record<PlanetLodQuality, number>> = Object.freeze({
	low: 96,
	medium: 192,
	high: 320
});

const COMPLETE_PACK_CACHE_LEVEL_LIMIT = 4;

export class PlanetGeographySystem {
	private readonly cache: GeographicTileCache;
	private readonly sampler = new PlanetTerrainSampler();
	private manifestState: PlanetDataManifest | null = null;
	private initializePromise: Promise<void> | null = null;
	private requested = new Map<string, PlanetTileId>();
	private failedRequests = 0;
	private revisionState = 0;
	private loadedTilesDirty = false;
	private disposed = false;
	private qualityState: PlanetLodQuality;

	constructor(
		private readonly provider: GeographicTileProvider = new StaticGeographicTileProvider(),
		quality: PlanetLodQuality = 'medium'
	) {
		this.qualityState = quality;
		this.cache = new GeographicTileCache(provider, CACHE_ENTRIES[quality]);
	}

	get manifest(): Readonly<PlanetDataManifest> | null {
		return this.manifestState;
	}

	get dataCoordinateConvention(): PlanetDataCoordinateConvention {
		return this.manifestState
			? resolvePlanetDataCoordinateConvention(this.manifestState)
			: 'legacy-positive-z-east';
	}

	get revision(): number {
		return this.revisionState;
	}

	get readyForRendering(): boolean {
		return this.manifestState !== null && this.hasBaseCoverage(this.manifestState);
	}

	get diagnostics(): PlanetGeographyDiagnostics {
		const cache = this.cache.diagnostics;
		let resolvedTiles = 0;
		let fallbackTiles = 0;
		for (const tile of this.requested.values()) {
			const resolved = this.resolveTile(tile);
			if (resolved) {
				resolvedTiles += 1;
				fallbackTiles += Number(resolved.id.level < tile.level);
			}
		}
		return {
			ready: this.manifestState !== null,
			baseCoverageReady: this.readyForRendering,
			dataQuality: this.manifestState?.dataQuality ?? 'unavailable',
			requestedTiles: this.requested.size,
			resolvedTiles,
			fallbackTiles,
			cacheEntries: cache.entries,
			cacheBytes: cache.bytes,
			cacheHits: cache.hits,
			cacheMisses: cache.misses,
			cacheEvictions: cache.evictions,
			failedRequests: this.failedRequests,
			revision: this.revisionState
		};
	}

	initialize(): Promise<void> {
		if (this.disposed) {
			return Promise.resolve();
		}
		if (!this.initializePromise) {
			this.initializePromise = this.provider
				.loadManifest()
				.then((manifest) => {
					if (!this.disposed) {
						this.manifestState = manifest;
						this.configureCache(manifest);
						this.revisionState += 1;
					}
				})
				.catch(() => {
					this.failedRequests += 1;
				});
		}
		return this.initializePromise;
	}

	setQuality(quality: PlanetLodQuality): void {
		this.qualityState = quality;
		if (this.manifestState) {
			this.configureCache(this.manifestState);
		} else {
			this.cache.setMaximumEntries(CACHE_ENTRIES[quality]);
		}
	}

	update(renderTiles: readonly PlanetTileId[]): void {
		if (this.disposed) {
			return;
		}
		void this.initialize();
		const manifest = this.manifestState;
		if (!manifest) {
			return;
		}

		this.flushLoadedRevision();

		const nextRequested = new Map<string, PlanetTileId>();
		for (const renderTile of renderTiles) {
			nextRequested.set(planetTileKey(renderTile), { ...renderTile });
		}
		this.requested = nextRequested;

		// Always establish a complete coarsest-level globe before requesting finer
		// data. Rendering a missing tile as the historical EMPTY_SAMPLE made whole
		// LOD patches appear as moving blue ocean over real continents.
		const baseTiles = PlanetGeographySystem.tilesAtLevel(manifest.minimumLevel);
		this.requestTiles(manifest, baseTiles);
		if (!this.hasBaseCoverage(manifest)) {
			return;
		}

		const convention = resolvePlanetDataCoordinateConvention(manifest);
		const requestsByLevel = new Map<number, Map<string, PlanetTileId>>();
		for (const renderTile of renderTiles) {
			const maximumDataLevel = Math.min(renderTile.level, manifest.maximumLevel);
			for (let level = manifest.minimumLevel + 1; level <= maximumDataLevel; level += 1) {
				const renderAncestor = geographicTileAncestor(renderTile, level);
				const dataTile = canonicalTileToDataTile(renderAncestor, convention);
				let levelRequests = requestsByLevel.get(level);
				if (!levelRequests) {
					levelRequests = new Map();
					requestsByLevel.set(level, levelRequests);
				}
				levelRequests.set(planetTileKey(dataTile), dataTile);
			}
		}
		for (let level = manifest.minimumLevel + 1; level <= manifest.maximumLevel; level += 1) {
			const levelRequests = requestsByLevel.get(level);
			if (levelRequests) {
				this.requestTiles(manifest, levelRequests.values());
			}
		}
	}

	resolveTile(renderTile: Readonly<PlanetTileId>): GeographicTile | null {
		const manifest = this.manifestState;
		if (!manifest) {
			return null;
		}
		const convention = resolvePlanetDataCoordinateConvention(manifest);
		for (
			let level = Math.min(renderTile.level, manifest.maximumLevel);
			level >= manifest.minimumLevel;
			level -= 1
		) {
			const renderAncestor = geographicTileAncestor(renderTile, level);
			const candidate = canonicalTileToDataTile(renderAncestor, convention);
			const tile = this.cache.peek(candidate);
			if (tile) {
				return tile;
			}
		}
		return null;
	}

	sample(renderTile: Readonly<PlanetTileId>, faceU: number, faceV: number): GeographicSample {
		return this.sampler.sample(
			renderTile,
			this.resolveTile(renderTile),
			faceU,
			faceV,
			this.dataCoordinateConvention
		);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.requested.clear();
		this.cache.dispose();
	}

	private configureCache(manifest: Readonly<PlanetDataManifest>): void {
		let maximumEntries = CACHE_ENTRIES[this.qualityState];
		if (
			manifest.dataQuality === 'preview' &&
			manifest.maximumLevel <= COMPLETE_PACK_CACHE_LEVEL_LIMIT
		) {
			// The bundled preview pack contains only 510 geography tiles through L3
			// (well below 1 MiB). Keeping the complete pack prevents parent fallback
			// eviction and the blue LOD rectangles seen while rotating the globe.
			maximumEntries = Math.max(
				maximumEntries,
				PlanetGeographySystem.tileCountBetweenLevels(manifest.minimumLevel, manifest.maximumLevel) +
					16
			);
		}
		this.cache.setMaximumEntries(maximumEntries);
	}

	private requestTiles(
		manifest: Readonly<PlanetDataManifest>,
		tiles: Iterable<Readonly<PlanetTileId>>
	): void {
		for (const tile of tiles) {
			if (this.cache.has(tile)) {
				continue;
			}
			void this.cache
				.getOrLoad(manifest, tile)
				.then((loaded) => {
					if (loaded && !this.disposed) {
						this.loadedTilesDirty = true;
					}
				})
				.catch(() => {
					this.failedRequests += 1;
				});
		}
	}

	private flushLoadedRevision(): void {
		if (this.loadedTilesDirty && this.cache.diagnostics.inFlight === 0) {
			this.loadedTilesDirty = false;
			this.revisionState += 1;
		}
	}

	private hasBaseCoverage(manifest: Readonly<PlanetDataManifest>): boolean {
		for (const tile of PlanetGeographySystem.tilesAtLevel(manifest.minimumLevel)) {
			if (!this.cache.has(tile)) {
				return false;
			}
		}
		return true;
	}

	private static *tilesAtLevel(level: number): Iterable<PlanetTileId> {
		const side = 2 ** level;
		for (const face of PLANET_FACES) {
			for (let y = 0; y < side; y += 1) {
				for (let x = 0; x < side; x += 1) {
					yield { face, level, x, y };
				}
			}
		}
	}

	private static tileCountBetweenLevels(minimumLevel: number, maximumLevel: number): number {
		let count = 0;
		for (let level = minimumLevel; level <= maximumLevel; level += 1) {
			count += PLANET_FACES.length * 4 ** level;
		}
		return count;
	}
}
