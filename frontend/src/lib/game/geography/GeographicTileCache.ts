import type { GeographicTile } from './GeographicTile';
import type { GeographicTileProvider } from './GeographicTileProvider';
import { geographicTileKey, type GeographicTileId } from './GeographicTileId';
import type { PlanetDataManifest } from './PlanetDataManifest';

export interface GeographicTileCacheDiagnostics {
	entries: number;
	inFlight: number;
	bytes: number;
	hits: number;
	misses: number;
	evictions: number;
}

interface CacheEntry {
	tile: GeographicTile;
	lastUsed: number;
}

export class GeographicTileCache {
	private readonly entries = new Map<string, CacheEntry>();
	private readonly inFlight = new Map<string, Promise<GeographicTile | null>>();
	private clock = 0;
	private bytes = 0;
	private hits = 0;
	private misses = 0;
	private evictions = 0;
	private disposed = false;

	constructor(
		private readonly provider: GeographicTileProvider,
		private maximumEntries: number
	) {
		if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
			throw new RangeError('Geographic cache size must be a positive integer.');
		}
	}

	get diagnostics(): GeographicTileCacheDiagnostics {
		return {
			entries: this.entries.size,
			inFlight: this.inFlight.size,
			bytes: this.bytes,
			hits: this.hits,
			misses: this.misses,
			evictions: this.evictions
		};
	}

	has(id: Readonly<GeographicTileId>): boolean {
		return this.entries.has(geographicTileKey(id));
	}

	peek(id: Readonly<GeographicTileId>): GeographicTile | null {
		const entry = this.entries.get(geographicTileKey(id));
		if (!entry) {
			return null;
		}
		entry.lastUsed = ++this.clock;
		this.hits += 1;
		return entry.tile;
	}

	getOrLoad(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>
	): Promise<GeographicTile | null> {
		if (this.disposed) {
			return Promise.resolve(null);
		}
		const key = geographicTileKey(id);
		const cached = this.entries.get(key);
		if (cached) {
			cached.lastUsed = ++this.clock;
			this.hits += 1;
			return Promise.resolve(cached.tile);
		}
		const pending = this.inFlight.get(key);
		if (pending) {
			return pending;
		}
		this.misses += 1;
		const request = this.provider
			.loadTile(manifest, id)
			.then((tile) => {
				if (tile && !this.disposed) {
					this.insert(key, tile);
				}
				return tile;
			})
			.finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, request);
		return request;
	}

	setMaximumEntries(maximumEntries: number): void {
		if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
			throw new RangeError('Geographic cache size must be a positive integer.');
		}
		this.maximumEntries = maximumEntries;
		this.evictIfNeeded();
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.entries.clear();
		this.inFlight.clear();
		this.bytes = 0;
		this.provider.dispose();
	}

	private insert(key: string, tile: GeographicTile): void {
		const previous = this.entries.get(key);
		if (previous) {
			this.bytes -= previous.tile.byteLength;
		}
		this.entries.set(key, { tile, lastUsed: ++this.clock });
		this.bytes += tile.byteLength;
		this.evictIfNeeded();
	}

	private evictIfNeeded(): void {
		while (this.entries.size > this.maximumEntries) {
			let oldestKey: string | null = null;
			let oldestUse = Number.POSITIVE_INFINITY;
			for (const [key, entry] of this.entries) {
				if (entry.lastUsed < oldestUse) {
					oldestUse = entry.lastUsed;
					oldestKey = key;
				}
			}
			if (!oldestKey) {
				break;
			}
			const removed = this.entries.get(oldestKey)!;
			this.entries.delete(oldestKey);
			this.bytes -= removed.tile.byteLength;
			this.evictions += 1;
		}
	}
}
