import type { GeographicTile } from '../geography/GeographicTile';
import type { PlanetTileId } from './PlanetTileId';

export interface PlanetTileDataState {
	requested: PlanetTileId;
	resolved: GeographicTile | null;
	fallbackLevels: number;
	loading: boolean;
}
