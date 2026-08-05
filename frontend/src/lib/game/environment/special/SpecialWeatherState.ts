export const SPECIAL_WEATHER_KINDS = [
	'none',
	'volcanic_ash',
	'dust_storm',
	'hot_haze',
	'dense_smoke'
] as const;

export type SpecialWeatherKind = (typeof SPECIAL_WEATHER_KINDS)[number];

export interface SpecialWeatherParameters {
	ash: number;
	dust: number;
	haze: number;
	smoke: number;
	particleIntensity: number;
	visibilityLoss: number;
	cloudDarkening: number;
	sunOcclusion: number;
	fogBoost: number;
	windMultiplier: number;
	temperatureOffset: number;
	tintR: number;
	tintG: number;
	tintB: number;
}

export interface SpecialWeatherSaveState {
	current: SpecialWeatherKind;
	target: SpecialWeatherKind;
	transition: number;
	transitionElapsedSeconds: number;
	transitionDurationSeconds: number;
	elapsedSeconds: number;
	forcedTarget?: SpecialWeatherKind | null;
	paused?: boolean;
	fromParameters?: Partial<SpecialWeatherParameters>;
}

export interface SpecialWeatherFrameState {
	current: SpecialWeatherKind;
	target: SpecialWeatherKind;
	transition: number;
	transitionElapsedSeconds: number;
	transitionDurationSeconds: number;
	elapsedSeconds: number;
	forcedTarget: SpecialWeatherKind | null;
	paused: boolean;
	readonly parameters: SpecialWeatherParameters;
}

export function createSpecialWeatherParameters(): SpecialWeatherParameters {
	return {
		ash: 0,
		dust: 0,
		haze: 0,
		smoke: 0,
		particleIntensity: 0,
		visibilityLoss: 0,
		cloudDarkening: 0,
		sunOcclusion: 0,
		fogBoost: 0,
		windMultiplier: 1,
		temperatureOffset: 0,
		tintR: 0.5,
		tintG: 0.5,
		tintB: 0.5
	};
}

export function copySpecialWeatherParameters(
	target: SpecialWeatherParameters,
	source: Readonly<SpecialWeatherParameters>
): SpecialWeatherParameters {
	target.ash = source.ash;
	target.dust = source.dust;
	target.haze = source.haze;
	target.smoke = source.smoke;
	target.particleIntensity = source.particleIntensity;
	target.visibilityLoss = source.visibilityLoss;
	target.cloudDarkening = source.cloudDarkening;
	target.sunOcclusion = source.sunOcclusion;
	target.fogBoost = source.fogBoost;
	target.windMultiplier = source.windMultiplier;
	target.temperatureOffset = source.temperatureOffset;
	target.tintR = source.tintR;
	target.tintG = source.tintG;
	target.tintB = source.tintB;
	return target;
}

export function createSpecialWeatherFrameState(): SpecialWeatherFrameState {
	return {
		current: 'none',
		target: 'none',
		transition: 1,
		transitionElapsedSeconds: 0,
		transitionDurationSeconds: 1,
		elapsedSeconds: 0,
		forcedTarget: null,
		paused: false,
		parameters: createSpecialWeatherParameters()
	};
}

export function isSpecialWeatherKind(value: unknown): value is SpecialWeatherKind {
	return typeof value === 'string' && (SPECIAL_WEATHER_KINDS as readonly string[]).includes(value);
}
