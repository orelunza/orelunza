import { Vector3 } from 'three';
import { directionToCubeFaceUv } from '../planet/CubeSphere';
import type { GeodeticCoordinate } from '../planet/GeodeticCoordinate';
import { GeographicTileCache } from './GeographicTileCache';
import type { GeographicTileProvider } from './GeographicTileProvider';
import { sampleGeographicTile } from './GeographicTileSampler';
import type { GeographicSample } from './GeographicTile';
import type { PlanetDataManifest } from './PlanetDataManifest';
import { StaticGeographicTileProvider } from './StaticGeographicTileProvider';

export interface PlanetGeographyQueryDiagnostics {
	ready: boolean;
	requests: number;
	cacheEntries: number;
	cacheHits: number;
	cacheMisses: number;
	failedRequests: number;
}

/** On-demand geographic sampler used by surface travel and local terrain preparation. */
export class PlanetGeographyQuery {
	private readonly cache: GeographicTileCache;
	private manifestState: PlanetDataManifest | null = null;
	private initializePromise: Promise<PlanetDataManifest> | null = null;
	private requests = 0;
	private failedRequests = 0;
	private disposed = false;

	constructor(
		private readonly provider: GeographicTileProvider = new StaticGeographicTileProvider(),
		maximumCacheEntries = 24
	) {
		this.cache = new GeographicTileCache(provider, maximumCacheEntries);
	}

	get diagnostics(): PlanetGeographyQueryDiagnostics {
		const cache = this.cache.diagnostics;
		return {
			ready: this.manifestState !== null,
			requests: this.requests,
			cacheEntries: cache.entries,
			cacheHits: cache.hits,
			cacheMisses: cache.misses,
			failedRequests: this.failedRequests
		};
	}

	async initialize(signal?: AbortSignal): Promise<PlanetDataManifest> {
		this.assertUsable();
		if (!this.initializePromise) {
			this.initializePromise = this.provider.loadManifest(signal).then((manifest) => {
				this.manifestState = manifest;
				return manifest;
			});
		}
		return this.initializePromise;
	}

	async sample(
		coordinate: Readonly<GeodeticCoordinate>,
		signal?: AbortSignal
	): Promise<GeographicSample> {
		return this.sampleAtLevel(coordinate, undefined, signal);
	}

	async sampleAtLevel(
		coordinate: Readonly<GeodeticCoordinate>,
		requestedLevel?: number,
		signal?: AbortSignal
	): Promise<GeographicSample> {
		this.assertUsable();
		const manifest = await this.initialize(signal);
		const latitude = coordinate.latitudeRadians;
		const longitude = coordinate.longitudeRadians;
		if (![latitude, longitude].every(Number.isFinite)) {
			throw new RangeError('Geographic query coordinate must be finite.');
		}
		const direction = new Vector3(
			Math.cos(latitude) * Math.cos(longitude),
			Math.sin(latitude),
			Math.cos(latitude) * Math.sin(longitude)
		);
		const faceUv = directionToCubeFaceUv(direction);
		const level = Math.max(
			manifest.minimumLevel,
			Math.min(manifest.maximumLevel, Math.trunc(requestedLevel ?? manifest.maximumLevel))
		);
		const side = 2 ** level;
		const x = Math.min(side - 1, Math.max(0, Math.floor(faceUv.u * side)));
		const y = Math.min(side - 1, Math.max(0, Math.floor(faceUv.v * side)));
		this.requests += 1;
		try {
			const tile = await this.cache.getOrLoad(manifest, { face: faceUv.face, level, x, y });
			if (!tile) {
				throw new Error('Geographic tile is unavailable.');
			}
			return sampleGeographicTile(tile, faceUv.u * side - x, faceUv.v * side - y);
		} catch (error) {
			this.failedRequests += 1;
			throw error;
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.cache.dispose();
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('PlanetGeographyQuery has been disposed.');
		}
	}
}
