import { decodeGeographicTile } from './GeographicTileDecoder';
import type { GeographicTileProvider } from './GeographicTileProvider';
import { geographicTilePath, type GeographicTileId } from './GeographicTileId';
import { validatePlanetDataManifest, type PlanetDataManifest } from './PlanetDataManifest';

export class StaticGeographicTileProvider implements GeographicTileProvider {
	private disposed = false;

	constructor(private readonly baseUrl = '/planet-data/preview') {}

	async loadManifest(signal?: AbortSignal): Promise<PlanetDataManifest> {
		this.assertUsable();
		const response = await fetch(`${this.baseUrl}/manifest.json`, { signal });
		if (!response.ok) {
			throw new Error(`Unable to load planet data manifest (${response.status}).`);
		}
		return validatePlanetDataManifest(await response.json());
	}

	async loadTile(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>,
		signal?: AbortSignal
	) {
		this.assertUsable();
		const relativePath = geographicTilePath(manifest.tilePathTemplate, id);
		const response = await fetch(`${this.baseUrl}/${relativePath}`, { signal });
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw new Error(`Unable to load geographic tile (${response.status}).`);
		}
		return decodeGeographicTile(await response.arrayBuffer());
	}

	dispose(): void {
		this.disposed = true;
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('Geographic tile provider has been disposed.');
		}
	}
}
