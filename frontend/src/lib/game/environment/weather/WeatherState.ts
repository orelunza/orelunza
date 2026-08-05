export const WEATHER_KINDS = [
	'clear',
	'partly_cloudy',
	'overcast',
	'mist',
	'fog',
	'light_rain',
	'heavy_rain',
	'storm',
	'snow'
] as const;

export type WeatherKind = (typeof WEATHER_KINDS)[number];
export type WeatherPhase = 'holding' | 'transitioning';

/** Continuous weather values consumed by the environment and future renderers. */
export interface WeatherParameters {
	cloudCoverage: number;
	cloudDensity: number;
	cloudDarkness: number;
	humidity: number;
	precipitation: number;
	fogDensity: number;
	windStrength: number;
	temperatureOffset: number;
	lightningProbability: number;
	overcast: number;
}

/**
 * Serializable weather block. The first four fields are the Phase 1 shape.
 * Every newer field is optional so existing V3 world saves remain readable.
 */
export interface WeatherSaveState {
	current: WeatherKind;
	next: WeatherKind;
	/** Linear progress from current toward next, in [0, 1]. */
	transition: number;
	seed: number;
	phase?: WeatherPhase;
	phaseElapsedSeconds?: number;
	phaseDurationSeconds?: number;
	scheduleIndex?: number;
	paused?: boolean;
	cloudCoverageOverride?: number | null;
}

/** Mutable, allocation-free frame snapshot owned by WeatherScheduler. */
export interface WeatherFrameState {
	current: WeatherKind;
	next: WeatherKind;
	transition: number;
	seed: number;
	phase: WeatherPhase;
	phaseElapsedSeconds: number;
	phaseDurationSeconds: number;
	scheduleIndex: number;
	paused: boolean;
	readonly parameters: WeatherParameters;
}

export function createWeatherParameters(): WeatherParameters {
	return {
		cloudCoverage: 0,
		cloudDensity: 0,
		cloudDarkness: 0,
		humidity: 0,
		precipitation: 0,
		fogDensity: 0,
		windStrength: 0,
		temperatureOffset: 0,
		lightningProbability: 0,
		overcast: 0
	};
}

export function copyWeatherParameters(
	target: WeatherParameters,
	source: Readonly<WeatherParameters>
): WeatherParameters {
	target.cloudCoverage = source.cloudCoverage;
	target.cloudDensity = source.cloudDensity;
	target.cloudDarkness = source.cloudDarkness;
	target.humidity = source.humidity;
	target.precipitation = source.precipitation;
	target.fogDensity = source.fogDensity;
	target.windStrength = source.windStrength;
	target.temperatureOffset = source.temperatureOffset;
	target.lightningProbability = source.lightningProbability;
	target.overcast = source.overcast;

	return target;
}

export function isWeatherKind(value: unknown): value is WeatherKind {
	return typeof value === 'string' && (WEATHER_KINDS as readonly string[]).includes(value);
}
