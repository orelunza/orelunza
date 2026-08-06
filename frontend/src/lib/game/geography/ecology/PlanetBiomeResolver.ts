import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import type { GeographicSample } from '../GeographicTile';
import type { EcologicalSample } from './EcologicalTile';
import type { PlanetBiomeId } from './PlanetBiome';

export class PlanetBiomeResolver {
	resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		geography: Readonly<GeographicSample>,
		ecology: Readonly<EcologicalSample>
	): PlanetBiomeId {
		if (geography.land < 0.5) return 'ocean';
		if (ecology.landCover === 'permanent-water') return 'freshwater';
		if (ecology.landCover === 'mangrove') return 'mangrove';
		if (ecology.landCover === 'herbaceous-wetland') return 'wetland';
		if (ecology.landCover === 'built-up') return 'urban';
		if (ecology.landCover === 'cropland') return 'cropland';
		const latitude = Math.abs((coordinate.latitudeRadians * 180) / Math.PI);
		if (ecology.landCover === 'snow-ice' || latitude > 76) return 'polar';
		if (geography.elevationMeters > 4500 || (geography.elevationMeters > 2800 && latitude > 18))
			return 'alpine';
		if (geography.coastProximity > 0.72) return 'coast';
		if (ecology.landCover === 'bare-sparse') return 'desert';
		if (ecology.landCover === 'shrubland') return 'shrubland';
		if (ecology.landCover === 'grassland') return latitude < 28 ? 'savanna' : 'grassland';
		if (ecology.landCover === 'moss-lichen') return latitude > 60 ? 'polar' : 'shrubland';
		if (ecology.landCover === 'tree-cover') {
			if (latitude < 23)
				return ecology.treeCoverDensity > 0.72 ? 'tropical-rainforest' : 'tropical-seasonal-forest';
			if (latitude > 50) return 'boreal-forest';
			return 'temperate-forest';
		}
		return latitude < 25 ? 'savanna' : latitude > 55 ? 'boreal-forest' : 'grassland';
	}
}
