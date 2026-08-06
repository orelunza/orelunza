import type { PlanetDataManifest } from '../PlanetDataManifest';
import type { GeographicTileId } from '../GeographicTileId';
import type { EcologicalTile } from './EcologicalTile';

export interface EcologicalTileProvider {
	loadManifest(signal?: AbortSignal): Promise<PlanetDataManifest>;
	loadTile(
		manifest: Readonly<PlanetDataManifest>,
		id: Readonly<GeographicTileId>,
		signal?: AbortSignal
	): Promise<EcologicalTile | null>;
	dispose(): void;
}
