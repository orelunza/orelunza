import type { GeographicTile } from './GeographicTile';
import type { GeographicTileId } from './GeographicTileId';
import type { PlanetDataManifest } from './PlanetDataManifest';

export interface GeographicTileProvider {
	loadManifest(signal?: AbortSignal): Promise<PlanetDataManifest>;
	loadTile(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>,
		signal?: AbortSignal
	): Promise<GeographicTile | null>;
	dispose(): void;
}
