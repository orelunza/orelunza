import type { WeatherKind, WeatherParameters } from '../weather/WeatherState';

export const CLIMATE_REGION_IDS = [
	'spawn_meadow',
	'free_build_meadow',
	'forest_edge',
	'amazon_rainforest',
	'pine_highlands',
	'riverbank',
	'central_city'
] as const;

export type ClimateRegionId = (typeof CLIMATE_REGION_IDS)[number];

export interface ClimateRegionProfile {
	readonly id: ClimateRegionId;
	readonly zone: string;
	readonly baseTemperatureCelsius: number;
	readonly dailyRangeCelsius: number;
	readonly humidity: number;
	readonly lapseRateCelsiusPerMeter: number;
	/** Multiplies the unified wind target after local weather is resolved. */
	readonly windMultiplier: number;
	/** Continuous local modifiers applied to the synoptic weather timeline. */
	readonly weatherBias: Readonly<
		Pick<
			WeatherParameters,
			'cloudCoverage' | 'humidity' | 'fogDensity' | 'windStrength' | 'temperatureOffset'
		>
	>;
	readonly backgroundPrecipitationScale: number;
	readonly lightningScale: number;
	/** Relative deterministic weights used when a moving weather cell is born. */
	readonly cellWeatherWeights: Readonly<Partial<Record<WeatherKind, number>>>;
	readonly cellSpawnSeconds: readonly [minimum: number, maximum: number];
	readonly cellRadius: readonly [minimum: number, maximum: number];
}

const PROFILE_LIST: readonly ClimateRegionProfile[] = [
	profile(
		'spawn_meadow',
		'Spawn Meadow',
		19,
		5.5,
		0.5,
		0.18,
		1,
		{
			cloudCoverage: 0,
			humidity: 0,
			fogDensity: 0,
			windStrength: 0,
			temperatureOffset: 0
		},
		0.72,
		0.7,
		{
			overcast: 0.2,
			mist: 0.08,
			fog: 0.04,
			light_rain: 0.38,
			heavy_rain: 0.18,
			storm: 0.08,
			snow: 0.04
		},
		[105, 220],
		[95, 165]
	),
	profile(
		'free_build_meadow',
		'Free Build Meadow',
		20,
		5.6,
		0.47,
		0.18,
		0.96,
		{
			cloudCoverage: -0.04,
			humidity: -0.04,
			fogDensity: -0.02,
			windStrength: 0.01,
			temperatureOffset: 0.35
		},
		0.56,
		0.55,
		{
			overcast: 0.25,
			mist: 0.05,
			fog: 0.02,
			light_rain: 0.4,
			heavy_rain: 0.16,
			storm: 0.08,
			snow: 0.04
		},
		[125, 250],
		[90, 155]
	),
	profile(
		'forest_edge',
		'Forest Edge',
		17,
		4.7,
		0.69,
		0.19,
		0.82,
		{
			cloudCoverage: 0.08,
			humidity: 0.1,
			fogDensity: 0.08,
			windStrength: -0.05,
			temperatureOffset: -0.6
		},
		0.9,
		0.75,
		{
			overcast: 0.16,
			mist: 0.16,
			fog: 0.12,
			light_rain: 0.34,
			heavy_rain: 0.14,
			storm: 0.06,
			snow: 0.02
		},
		[85, 190],
		[100, 175]
	),
	profile(
		'amazon_rainforest',
		'Amazon Rainforest',
		27,
		3.4,
		0.9,
		0.14,
		0.88,
		{
			cloudCoverage: 0.16,
			humidity: 0.18,
			fogDensity: 0.1,
			windStrength: -0.02,
			temperatureOffset: 0.8
		},
		1.28,
		1.35,
		{
			overcast: 0.08,
			mist: 0.08,
			fog: 0.06,
			light_rain: 0.32,
			heavy_rain: 0.29,
			storm: 0.17,
			snow: 0
		},
		[55, 135],
		[115, 205]
	),
	profile(
		'pine_highlands',
		'Pine Highlands',
		7,
		6.8,
		0.62,
		0.24,
		1.34,
		{
			cloudCoverage: 0.1,
			humidity: 0.04,
			fogDensity: 0.1,
			windStrength: 0.14,
			temperatureOffset: -2.2
		},
		0.86,
		0.72,
		{
			overcast: 0.2,
			mist: 0.08,
			fog: 0.14,
			light_rain: 0.1,
			heavy_rain: 0.05,
			storm: 0.05,
			snow: 0.38
		},
		[75, 170],
		[105, 190]
	),
	profile(
		'riverbank',
		'Riverbank',
		19,
		4.2,
		0.76,
		0.17,
		0.72,
		{
			cloudCoverage: 0.06,
			humidity: 0.15,
			fogDensity: 0.14,
			windStrength: -0.06,
			temperatureOffset: -0.35
		},
		0.96,
		0.7,
		{
			overcast: 0.14,
			mist: 0.22,
			fog: 0.18,
			light_rain: 0.3,
			heavy_rain: 0.1,
			storm: 0.04,
			snow: 0.02
		},
		[70, 165],
		[90, 165]
	),
	profile(
		'central_city',
		'Central City',
		21,
		4.8,
		0.43,
		0.16,
		1.06,
		{
			cloudCoverage: -0.02,
			humidity: -0.05,
			fogDensity: -0.03,
			windStrength: 0.04,
			temperatureOffset: 0.7
		},
		0.64,
		0.65,
		{
			overcast: 0.26,
			mist: 0.06,
			fog: 0.04,
			light_rain: 0.38,
			heavy_rain: 0.16,
			storm: 0.07,
			snow: 0.03
		},
		[120, 240],
		[95, 160]
	)
];

const BY_ID = new Map(PROFILE_LIST.map((entry) => [entry.id, entry]));
const BY_ZONE = new Map(PROFILE_LIST.map((entry) => [entry.zone, entry]));
const DEFAULT_PROFILE = BY_ID.get('spawn_meadow') as ClimateRegionProfile;

export function getClimateRegionProfile(id: ClimateRegionId): ClimateRegionProfile {
	return BY_ID.get(id) ?? DEFAULT_PROFILE;
}

export function resolveClimateRegionProfile(zone: string): ClimateRegionProfile {
	return BY_ZONE.get(zone) ?? DEFAULT_PROFILE;
}

export function climateRegionIdForZone(zone: string): ClimateRegionId {
	return resolveClimateRegionProfile(zone).id;
}

export function allClimateRegionProfiles(): readonly ClimateRegionProfile[] {
	return PROFILE_LIST;
}

function profile(
	id: ClimateRegionId,
	zone: string,
	baseTemperatureCelsius: number,
	dailyRangeCelsius: number,
	humidity: number,
	lapseRateCelsiusPerMeter: number,
	windMultiplier: number,
	weatherBias: ClimateRegionProfile['weatherBias'],
	backgroundPrecipitationScale: number,
	lightningScale: number,
	cellWeatherWeights: ClimateRegionProfile['cellWeatherWeights'],
	cellSpawnSeconds: ClimateRegionProfile['cellSpawnSeconds'],
	cellRadius: ClimateRegionProfile['cellRadius']
): ClimateRegionProfile {
	return Object.freeze({
		id,
		zone,
		baseTemperatureCelsius,
		dailyRangeCelsius,
		humidity,
		lapseRateCelsiusPerMeter,
		windMultiplier,
		weatherBias: Object.freeze(weatherBias),
		backgroundPrecipitationScale,
		lightningScale,
		cellWeatherWeights: Object.freeze(cellWeatherWeights),
		cellSpawnSeconds,
		cellRadius
	});
}
