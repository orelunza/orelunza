import { geographicTileKey, type GeographicTileId } from '../GeographicTileId';
import type { PlanetDataManifest } from '../PlanetDataManifest';
import type { EcologicalTile } from './EcologicalTile';
import type { EcologicalTileProvider } from './EcologicalTileProvider';

export interface EcologicalTileCacheDiagnostics {
	entries: number;
	inFlight: number;
	bytes: number;
	hits: number;
	misses: number;
	evictions: number;
}

interface Entry {
	tile: EcologicalTile;
	lastUsed: number;
}

export class EcologicalTileCache {
	private readonly entries = new Map<string, Entry>();
	private readonly inFlight = new Map<string, Promise<EcologicalTile | null>>();
	private clock = 0;
	private bytes = 0;
	private hits = 0;
	private misses = 0;
	private evictions = 0;
	private disposed = false;

	constructor(
		private readonly provider: EcologicalTileProvider,
		private maximumEntries: number
	) {
		if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
			throw new RangeError('Ecology cache size must be a positive integer.');
		}
	}

	get diagnostics(): EcologicalTileCacheDiagnostics {
		return {
			entries: this.entries.size,
			inFlight: this.inFlight.size,
			bytes: this.bytes,
			hits: this.hits,
			misses: this.misses,
			evictions: this.evictions
		};
	}

	getOrLoad(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>
	): Promise<EcologicalTile | null> {
		if (this.disposed) return Promise.resolve(null);
		const key = geographicTileKey(id);
		const cached = this.entries.get(key);
		if (cached) {
			cached.lastUsed = ++this.clock;
			this.hits += 1;
			return Promise.resolve(cached.tile);
		}
		const pending = this.inFlight.get(key);
		if (pending) return pending;
		this.misses += 1;
		const request = this.provider
			.loadTile(manifest, id)
			.then((tile) => {
				if (tile && !this.disposed) this.insert(key, tile);
				return tile;
			})
			.finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, request);
		return request;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.entries.clear();
		this.inFlight.clear();
		this.bytes = 0;
		this.provider.dispose();
	}

	private insert(key: string, tile: EcologicalTile): void {
		const previous = this.entries.get(key);
		if (previous) this.bytes -= previous.tile.byteLength;
		this.entries.set(key, { tile, lastUsed: ++this.clock });
		this.bytes += tile.byteLength;
		while (this.entries.size > this.maximumEntries) {
			let oldestKey: string | null = null;
			let oldest = Number.POSITIVE_INFINITY;
			for (const [candidate, entry] of this.entries) {
				if (entry.lastUsed < oldest) {
					oldest = entry.lastUsed;
					oldestKey = candidate;
				}
			}
			if (!oldestKey) break;
			const removed = this.entries.get(oldestKey)!;
			this.entries.delete(oldestKey);
			this.bytes -= removed.tile.byteLength;
			this.evictions += 1;
		}
	}
}
