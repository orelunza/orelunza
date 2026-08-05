export type ClimatePrecipitationType = 'none' | 'rain' | 'snow' | 'mixed';

export interface ClimateSaveState {
	elapsedSeconds: number;
	paused: boolean;
	zone: string;
	temperatureCelsius: number;
	humidity: number;
	windChillCelsius: number;
	precipitationType: ClimatePrecipitationType;
	snowBlend: number;
}

/** Allocation-free climate snapshot consumed by precipitation and cold effects. */
export interface ClimateFrameState {
	elapsedSeconds: number;
	paused: boolean;
	zone: string;
	baseTemperatureCelsius: number;
	temperatureCelsius: number;
	humidity: number;
	windChillCelsius: number;
	precipitationType: ClimatePrecipitationType;
	rainBlend: number;
	snowBlend: number;
	frostPotential: number;
	breathVisibility: number;
}

export function createClimateFrameState(): ClimateFrameState {
	return {
		elapsedSeconds: 0,
		paused: false,
		zone: 'Spawn Meadow',
		baseTemperatureCelsius: 19,
		temperatureCelsius: 19,
		humidity: 0.5,
		windChillCelsius: 19,
		precipitationType: 'none',
		rainBlend: 0,
		snowBlend: 0,
		frostPotential: 0,
		breathVisibility: 0
	};
}
