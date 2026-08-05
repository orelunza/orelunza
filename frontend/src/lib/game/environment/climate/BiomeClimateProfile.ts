import {
	allClimateRegionProfiles,
	resolveClimateRegionProfile
} from '../regions/ClimateRegionProfile';

export interface BiomeClimateProfile {
	readonly zone: string;
	/** Neutral ground-level afternoon temperature. */
	readonly baseTemperatureCelsius: number;
	/** Half-range of the daily warm/cold cycle. */
	readonly dailyRangeCelsius: number;
	readonly humidity: number;
	/** Cooling per world metre above the reference meadow altitude. */
	readonly lapseRateCelsiusPerMeter: number;
}

export function resolveBiomeClimateProfile(zone: string): BiomeClimateProfile {
	return resolveClimateRegionProfile(zone);
}

export function allBiomeClimateProfiles(): readonly BiomeClimateProfile[] {
	return allClimateRegionProfiles();
}
