import type { WorldSeason } from '../time/WorldDate';
import type { ClimateRegionId } from '../regions/ClimateRegionProfile';

const REGION_SEASONAL_PRECIPITATION: Record<ClimateRegionId, Record<WorldSeason, number>> = {
	spawn_meadow: { winter: 0.88, spring: 1.08, summer: 0.62, autumn: 1.12 },
	free_build_meadow: { winter: 0.82, spring: 1.02, summer: 0.55, autumn: 1.06 },
	forest_edge: { winter: 0.94, spring: 1.12, summer: 0.72, autumn: 1.18 },
	amazon_rainforest: { winter: 1.12, spring: 1.2, summer: 0.82, autumn: 1.04 },
	pine_highlands: { winter: 1.08, spring: 1.02, summer: 0.58, autumn: 0.94 },
	riverbank: { winter: 0.96, spring: 1.15, summer: 0.7, autumn: 1.12 },
	central_city: { winter: 0.82, spring: 1, summer: 0.58, autumn: 1.02 }
};

/**
 * Seasonal precipitation is a bias, never a daily trigger. Values above one
 * make wet regimes/cells more likely; values below one allow long dry spells.
 */
export function seasonalPrecipitationScale(regionId: ClimateRegionId, season: WorldSeason): number {
	return REGION_SEASONAL_PRECIPITATION[regionId]?.[season] ?? 1;
}
