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

const DEFAULT_PROFILE: BiomeClimateProfile = profile('Spawn Meadow', 19, 5.5, 0.5, 0.18);

const PROFILES = new Map<string, BiomeClimateProfile>([
	['Central City', profile('Central City', 21, 4.8, 0.43, 0.16)],
	['Riverbank', profile('Riverbank', 19, 4.2, 0.76, 0.17)],
	['Amazon Rainforest', profile('Amazon Rainforest', 27, 3.4, 0.9, 0.14)],
	['Pine Highlands', profile('Pine Highlands', 7, 6.8, 0.62, 0.24)],
	['Forest Edge', profile('Forest Edge', 17, 4.7, 0.69, 0.19)],
	['Free Build Meadow', profile('Free Build Meadow', 20, 5.6, 0.47, 0.18)],
	['Spawn Meadow', DEFAULT_PROFILE]
]);

export function resolveBiomeClimateProfile(zone: string): BiomeClimateProfile {
	return PROFILES.get(zone) ?? DEFAULT_PROFILE;
}

export function allBiomeClimateProfiles(): readonly BiomeClimateProfile[] {
	return [...PROFILES.values()];
}

function profile(
	zone: string,
	baseTemperatureCelsius: number,
	dailyRangeCelsius: number,
	humidity: number,
	lapseRateCelsiusPerMeter: number
): BiomeClimateProfile {
	return Object.freeze({
		zone,
		baseTemperatureCelsius,
		dailyRangeCelsius,
		humidity,
		lapseRateCelsiusPerMeter
	});
}
