import type { SpecialWeatherKind, SpecialWeatherParameters } from './SpecialWeatherState';

export interface SpecialWeatherPreset {
	readonly kind: SpecialWeatherKind;
	readonly transitionSeconds: number;
	readonly parameters: Readonly<SpecialWeatherParameters>;
}

const PRESETS: Readonly<Record<SpecialWeatherKind, SpecialWeatherPreset>> = {
	none: preset('none', 8, {
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
		tintR: 0.55,
		tintG: 0.58,
		tintB: 0.62
	}),
	volcanic_ash: preset('volcanic_ash', 18, {
		ash: 1,
		dust: 0.12,
		haze: 0.2,
		smoke: 0.34,
		particleIntensity: 0.82,
		visibilityLoss: 0.62,
		cloudDarkening: 0.58,
		sunOcclusion: 0.72,
		fogBoost: 0.52,
		windMultiplier: 1.12,
		temperatureOffset: -1.5,
		tintR: 0.34,
		tintG: 0.29,
		tintB: 0.27
	}),
	dust_storm: preset('dust_storm', 13, {
		ash: 0,
		dust: 1,
		haze: 0.55,
		smoke: 0,
		particleIntensity: 0.96,
		visibilityLoss: 0.75,
		cloudDarkening: 0.28,
		sunOcclusion: 0.58,
		fogBoost: 0.6,
		windMultiplier: 1.45,
		temperatureOffset: 2.2,
		tintR: 0.63,
		tintG: 0.43,
		tintB: 0.25
	}),
	hot_haze: preset('hot_haze', 20, {
		ash: 0,
		dust: 0.08,
		haze: 1,
		smoke: 0,
		particleIntensity: 0.08,
		visibilityLoss: 0.2,
		cloudDarkening: 0,
		sunOcclusion: 0.04,
		fogBoost: 0.12,
		windMultiplier: 0.82,
		temperatureOffset: 3.8,
		tintR: 0.82,
		tintG: 0.61,
		tintB: 0.37
	}),
	dense_smoke: preset('dense_smoke', 15, {
		ash: 0.18,
		dust: 0.05,
		haze: 0.3,
		smoke: 1,
		particleIntensity: 0.72,
		visibilityLoss: 0.82,
		cloudDarkening: 0.7,
		sunOcclusion: 0.82,
		fogBoost: 0.76,
		windMultiplier: 0.9,
		temperatureOffset: 1.2,
		tintR: 0.24,
		tintG: 0.25,
		tintB: 0.24
	})
};

export function getSpecialWeatherPreset(kind: SpecialWeatherKind): SpecialWeatherPreset {
	return PRESETS[kind];
}

function preset(
	kind: SpecialWeatherKind,
	transitionSeconds: number,
	parameters: SpecialWeatherParameters
): SpecialWeatherPreset {
	return Object.freeze({
		kind,
		transitionSeconds,
		parameters: Object.freeze({ ...parameters })
	});
}
