import { Vector3 } from 'three';
import { directionToCubeFaceUv } from '../../planet/CubeSphere';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import { geographicTileAncestor } from '../GeographicTileId';
import type { PlanetDataManifest } from '../PlanetDataManifest';
import { EcologicalTileCache } from './EcologicalTileCache';
import type { EcologicalTileProvider } from './EcologicalTileProvider';
import { sampleEcologicalTile } from './EcologicalTileSampler';
import type { EcologicalSample } from './EcologicalTile';
import { StaticEcologicalTileProvider } from './StaticEcologicalTileProvider';

export interface PlanetEcologyDiagnostics {
	ready: boolean;
	dataQuality: string;
	requests: number;
	fallbacks: number;
	failedRequests: number;
	cacheEntries: number;
	cacheBytes: number;
}

export class PlanetEcologyQuery {
	private readonly cache: EcologicalTileCache;
	private manifestState: PlanetDataManifest | null = null;
	private initializePromise: Promise<PlanetDataManifest> | null = null;
	private requests = 0;
	private fallbacks = 0;
	private failedRequests = 0;
	private disposed = false;

	constructor(
		private readonly provider: EcologicalTileProvider = new StaticEcologicalTileProvider(),
		maximumCacheEntries = 32
	) {
		this.cache = new EcologicalTileCache(provider, maximumCacheEntries);
	}

	get diagnostics(): PlanetEcologyDiagnostics {
		const cache = this.cache.diagnostics;
		return {
			ready: this.manifestState !== null,
			dataQuality: this.manifestState?.ecologyDataQuality ?? 'unavailable',
			requests: this.requests,
			fallbacks: this.fallbacks,
			failedRequests: this.failedRequests,
			cacheEntries: cache.entries,
			cacheBytes: cache.bytes
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
		requestedLevel?: number,
		signal?: AbortSignal
	): Promise<EcologicalSample> {
		this.assertUsable();
		const manifest = await this.initialize(signal);
		const minimum = manifest.ecologyMinimumLevel ?? manifest.minimumLevel;
		const maximum = manifest.ecologyMaximumLevel ?? manifest.maximumLevel;
		const latitude = coordinate.latitudeRadians;
		const longitude = coordinate.longitudeRadians;
		if (![latitude, longitude].every(Number.isFinite)) {
			throw new RangeError('Ecology query coordinate must be finite.');
		}
		const direction = new Vector3(
			Math.cos(latitude) * Math.cos(longitude),
			Math.sin(latitude),
			Math.cos(latitude) * Math.sin(longitude)
		);
		const faceUv = directionToCubeFaceUv(direction);
		const targetLevel = Math.max(minimum, Math.min(maximum, Math.trunc(requestedLevel ?? maximum)));
		const targetSide = 2 ** targetLevel;
		const target = {
			face: faceUv.face,
			level: targetLevel,
			x: Math.min(targetSide - 1, Math.max(0, Math.floor(faceUv.u * targetSide))),
			y: Math.min(targetSide - 1, Math.max(0, Math.floor(faceUv.v * targetSide)))
		};
		this.requests += 1;
		try {
			for (let level = targetLevel; level >= minimum; level -= 1) {
				const id = geographicTileAncestor(target, level);
				const tile = await this.cache.getOrLoad(manifest, id);
				if (!tile) continue;
				if (level !== targetLevel) this.fallbacks += 1;
				const side = 2 ** level;
				return sampleEcologicalTile(tile, faceUv.u * side - id.x, faceUv.v * side - id.y);
			}
			throw new Error('Ecological tile is unavailable.');
		} catch (error) {
			this.failedRequests += 1;
			throw error;
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.cache.dispose();
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error('PlanetEcologyQuery has been disposed.');
	}
}
