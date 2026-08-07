import type { WeatherKind, WeatherParameters } from './WeatherState';

export interface WeatherPreset {
	kind: WeatherKind;
	parameters: Readonly<WeatherParameters>;
	holdSeconds: readonly [minimum: number, maximum: number];
	transitionSeconds: readonly [minimum: number, maximum: number];
}

const PRESETS: Record<WeatherKind, WeatherPreset> = {
	clear: preset('clear', [1200, 3600], [180, 420], {
		cloudCoverage: 0.06,
		cloudDensity: 0.1,
		cloudDarkness: 0,
		humidity: 0.28,
		precipitation: 0,
		fogDensity: 0.02,
		windStrength: 0.12,
		temperatureOffset: 1.5,
		lightningProbability: 0,
		overcast: 0
	}),
	partly_cloudy: preset('partly_cloudy', [900, 2700], [180, 420], {
		cloudCoverage: 0.38,
		cloudDensity: 0.42,
		cloudDarkness: 0.12,
		humidity: 0.46,
		precipitation: 0,
		fogDensity: 0.04,
		windStrength: 0.24,
		temperatureOffset: 0.3,
		lightningProbability: 0,
		overcast: 0.14
	}),
	overcast: preset('overcast', [600, 1800], [150, 360], {
		cloudCoverage: 0.88,
		cloudDensity: 0.83,
		cloudDarkness: 0.48,
		humidity: 0.7,
		precipitation: 0,
		fogDensity: 0.12,
		windStrength: 0.32,
		temperatureOffset: -1.5,
		lightningProbability: 0.01,
		overcast: 0.82
	}),
	mist: preset('mist', [420, 1200], [120, 300], {
		cloudCoverage: 0.42,
		cloudDensity: 0.36,
		cloudDarkness: 0.1,
		humidity: 0.84,
		precipitation: 0,
		fogDensity: 0.38,
		windStrength: 0.08,
		temperatureOffset: -1,
		lightningProbability: 0,
		overcast: 0.22
	}),
	fog: preset('fog', [360, 1080], [120, 300], {
		cloudCoverage: 0.62,
		cloudDensity: 0.54,
		cloudDarkness: 0.22,
		humidity: 0.96,
		precipitation: 0,
		fogDensity: 0.76,
		windStrength: 0.04,
		temperatureOffset: -2.2,
		lightningProbability: 0,
		overcast: 0.48
	}),
	light_rain: preset('light_rain', [420, 1320], [120, 300], {
		cloudCoverage: 0.9,
		cloudDensity: 0.86,
		cloudDarkness: 0.5,
		humidity: 0.92,
		precipitation: 0.32,
		fogDensity: 0.24,
		windStrength: 0.36,
		temperatureOffset: -2.4,
		lightningProbability: 0.01,
		overcast: 0.86
	}),
	heavy_rain: preset('heavy_rain', [300, 960], [100, 260], {
		cloudCoverage: 0.98,
		cloudDensity: 0.96,
		cloudDarkness: 0.72,
		humidity: 1,
		precipitation: 0.78,
		fogDensity: 0.42,
		windStrength: 0.58,
		temperatureOffset: -4.2,
		lightningProbability: 0.05,
		overcast: 0.96
	}),
	storm: preset('storm', [180, 600], [80, 220], {
		cloudCoverage: 1,
		cloudDensity: 1,
		cloudDarkness: 1,
		humidity: 1,
		precipitation: 1,
		fogDensity: 0.56,
		windStrength: 0.9,
		temperatureOffset: -6,
		lightningProbability: 0.72,
		overcast: 1
	}),
	snow: preset('snow', [420, 1440], [120, 320], {
		cloudCoverage: 0.94,
		cloudDensity: 0.88,
		cloudDarkness: 0.38,
		humidity: 0.86,
		precipitation: 0.62,
		fogDensity: 0.45,
		windStrength: 0.34,
		temperatureOffset: -9,
		lightningProbability: 0,
		overcast: 0.84
	})
};

const TRANSITION_TARGETS: Record<WeatherKind, readonly WeatherKind[]> = {
	clear: ['clear', 'partly_cloudy', 'overcast', 'mist', 'fog', 'light_rain'],
	partly_cloudy: ['clear', 'partly_cloudy', 'overcast', 'mist', 'fog', 'light_rain'],
	overcast: [
		'partly_cloudy',
		'overcast',
		'mist',
		'fog',
		'light_rain',
		'heavy_rain',
		'storm',
		'snow'
	],
	mist: ['clear', 'partly_cloudy', 'overcast', 'mist', 'fog', 'light_rain'],
	fog: ['clear', 'partly_cloudy', 'overcast', 'mist', 'fog', 'light_rain'],
	light_rain: ['partly_cloudy', 'overcast', 'mist', 'light_rain', 'heavy_rain', 'storm'],
	heavy_rain: ['overcast', 'light_rain', 'heavy_rain', 'storm'],
	storm: ['partly_cloudy', 'overcast', 'light_rain', 'heavy_rain'],
	snow: ['clear', 'partly_cloudy', 'overcast', 'fog', 'snow']
};

const TRANSITION_WEIGHTS: Record<WeatherKind, readonly number[]> = {
	clear: [0.14, 0.54, 0.16, 0.07, 0.03, 0.06],
	partly_cloudy: [0.28, 0.12, 0.34, 0.06, 0.03, 0.17],
	overcast: [0.2, 0.1, 0.06, 0.07, 0.31, 0.13, 0.09, 0.04],
	mist: [0.12, 0.25, 0.25, 0.12, 0.13, 0.13],
	fog: [0.08, 0.2, 0.28, 0.2, 0.1, 0.14],
	light_rain: [0.12, 0.28, 0.08, 0.22, 0.2, 0.1],
	heavy_rain: [0.25, 0.34, 0.16, 0.25],
	storm: [0.08, 0.32, 0.22, 0.38],
	snow: [0.12, 0.17, 0.34, 0.14, 0.23]
};

export function getWeatherPreset(kind: WeatherKind): WeatherPreset {
	return PRESETS[kind];
}

export function getWeatherTransitionTargets(kind: WeatherKind): readonly WeatherKind[] {
	return TRANSITION_TARGETS[kind];
}

export function getWeatherTransitionWeights(kind: WeatherKind): readonly number[] {
	return TRANSITION_WEIGHTS[kind];
}

function preset(
	kind: WeatherKind,
	holdSeconds: readonly [number, number],
	transitionSeconds: readonly [number, number],
	parameters: WeatherParameters
): WeatherPreset {
	return {
		kind,
		holdSeconds,
		transitionSeconds,
		parameters: Object.freeze(parameters)
	};
}
