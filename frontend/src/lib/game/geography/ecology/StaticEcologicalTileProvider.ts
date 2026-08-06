import { geographicTilePath, type GeographicTileId } from '../GeographicTileId';
import { validatePlanetDataManifest, type PlanetDataManifest } from '../PlanetDataManifest';
import { decodeEcologicalTile } from './EcologicalTileDecoder';
import type { EcologicalTileProvider } from './EcologicalTileProvider';

export class StaticEcologicalTileProvider implements EcologicalTileProvider {
	private disposed = false;

	constructor(private readonly baseUrl = '/planet-data/preview') {}

	async loadManifest(signal?: AbortSignal): Promise<PlanetDataManifest> {
		this.assertUsable();
		const response = await fetch(`${this.baseUrl}/manifest.json`, { signal });
		if (!response.ok) throw new Error(`Unable to load ecology manifest (${response.status}).`);
		return validatePlanetDataManifest(await response.json());
	}

	async loadTile(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>,
		signal?: AbortSignal
	) {
		this.assertUsable();
		const template = manifest.ecologyTilePathTemplate;
		if (!template) return null;
		const response = await fetch(`${this.baseUrl}/${geographicTilePath(template, id)}`, { signal });
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`Unable to load ecological tile (${response.status}).`);
		return decodeEcologicalTile(await response.arrayBuffer());
	}

	dispose(): void {
		this.disposed = true;
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error('Ecological tile provider has been disposed.');
	}
}
