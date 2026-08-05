import type { WeatherKind, WeatherParameters } from '../weather/WeatherState';

export const WEATHER_CELL_KINDS = [
	'overcast',
	'mist',
	'fog',
	'light_rain',
	'heavy_rain',
	'storm',
	'snow'
] as const;

export type WeatherCellKind = (typeof WEATHER_CELL_KINDS)[number];

export interface WeatherCellSaveState {
	id: number;
	kind: WeatherCellKind;
	x: number;
	z: number;
	radius: number;
	intensity: number;
	velocityX: number;
	velocityZ: number;
	ageSeconds: number;
	lifetimeSeconds: number;
	growthSeconds: number;
	decaySeconds: number;
}

export interface WeatherCellManagerSaveState {
	elapsedSeconds: number;
	nextSpawnAtSeconds: number;
	spawnIndex: number;
	paused?: boolean;
	cells: WeatherCellSaveState[];
}

export interface WeatherCellInfluenceFrame {
	activeCellCount: number;
	dominantCellId: number | null;
	dominantKind: WeatherKind | null;
	cloudInfluence: number;
	coreInfluence: number;
	readonly cloudParameters: WeatherParameters;
	readonly coreParameters: WeatherParameters;
}

export function createWeatherCellInfluenceFrame(): WeatherCellInfluenceFrame {
	return {
		activeCellCount: 0,
		dominantCellId: null,
		dominantKind: null,
		cloudInfluence: 0,
		coreInfluence: 0,
		cloudParameters: emptyWeatherParameters(),
		coreParameters: emptyWeatherParameters()
	};
}

export function isWeatherCellKind(value: unknown): value is WeatherCellKind {
	return typeof value === 'string' && (WEATHER_CELL_KINDS as readonly string[]).includes(value);
}

function emptyWeatherParameters(): WeatherParameters {
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
