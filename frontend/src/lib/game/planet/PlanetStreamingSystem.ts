import type { PlanetLodQuality } from './PlanetLodSystem';
import type { PlanetTileId } from './PlanetTileId';
import { StaticGeographicTileProvider } from '../geography/StaticGeographicTileProvider';
import { PlanetGeographySystem } from './PlanetGeographySystem';

export class PlanetStreamingSystem {
	readonly geography: PlanetGeographySystem;

	constructor(quality: PlanetLodQuality = 'medium') {
		this.geography = new PlanetGeographySystem(new StaticGeographicTileProvider(), quality);
		void this.geography.initialize();
	}

	update(tiles: readonly PlanetTileId[]): void {
		this.geography.update(tiles);
	}

	setQuality(quality: PlanetLodQuality): void {
		this.geography.setQuality(quality);
	}

	dispose(): void {
		this.geography.dispose();
	}
}
