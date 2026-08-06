import type { PlanetLodQuality } from './PlanetLodSystem';
import { planetTileKey, type PlanetTileId } from './PlanetTileId';
import type { GeographicSample, GeographicTile } from '../geography/GeographicTile';
import { GeographicTileCache } from '../geography/GeographicTileCache';
import type { GeographicTileProvider } from '../geography/GeographicTileProvider';
import { geographicTileAncestor } from '../geography/GeographicTileId';
import type { PlanetDataManifest } from '../geography/PlanetDataManifest';
import { StaticGeographicTileProvider } from '../geography/StaticGeographicTileProvider';
import { PlanetTerrainSampler } from './PlanetTerrainSampler';

export interface PlanetGeographyDiagnostics {
	ready: boolean;
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
	low: 48,
	medium: 96,
	high: 160
});

export class PlanetGeographySystem {
	private readonly cache: GeographicTileCache;
	private readonly sampler = new PlanetTerrainSampler();
	private manifestState: PlanetDataManifest | null = null;
	private initializePromise: Promise<void> | null = null;
	private requested = new Map<string, PlanetTileId>();
	private failedRequests = 0;
	private revisionState = 0;
	private disposed = false;

	constructor(
		private readonly provider: GeographicTileProvider = new StaticGeographicTileProvider(),
		quality: PlanetLodQuality = 'medium'
	) {
		this.cache = new GeographicTileCache(provider, CACHE_ENTRIES[quality]);
	}

	get manifest(): Readonly<PlanetDataManifest> | null {
		return this.manifestState;
	}

	get revision(): number {
		return this.revisionState;
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
		this.cache.setMaximumEntries(CACHE_ENTRIES[quality]);
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
		const nextRequested = new Map<string, PlanetTileId>();
		const dataRequests = new Map<string, PlanetTileId>();
		for (const renderTile of renderTiles) {
			nextRequested.set(planetTileKey(renderTile), { ...renderTile });
			const maximumDataLevel = Math.min(renderTile.level, manifest.maximumLevel);
			for (let level = manifest.minimumLevel; level <= maximumDataLevel; level += 1) {
				const dataTile = geographicTileAncestor(renderTile, level);
				dataRequests.set(planetTileKey(dataTile), dataTile);
			}
		}
		for (const dataTile of dataRequests.values()) {
			if (!this.cache.peek(dataTile)) {
				void this.cache
					.getOrLoad(manifest, dataTile)
					.then((loaded) => {
						if (loaded && !this.disposed) {
							this.revisionState += 1;
						}
					})
					.catch(() => {
						this.failedRequests += 1;
					});
			}
		}
		this.requested = nextRequested;
	}

	resolveTile(renderTile: Readonly<PlanetTileId>): GeographicTile | null {
		const manifest = this.manifestState;
		if (!manifest) {
			return null;
		}
		for (
			let level = Math.min(renderTile.level, manifest.maximumLevel);
			level >= manifest.minimumLevel;
			level -= 1
		) {
			const candidate = geographicTileAncestor(renderTile, level);
			const tile = this.cache.peek(candidate);
			if (tile) {
				return tile;
			}
		}
		return null;
	}

	sample(renderTile: Readonly<PlanetTileId>, faceU: number, faceV: number): GeographicSample {
		return this.sampler.sample(renderTile, this.resolveTile(renderTile), faceU, faceV);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.requested.clear();
		this.cache.dispose();
	}
}
