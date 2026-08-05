import type { ClimateRegionId } from './ClimateRegionProfile';

export interface ClimateRegionSaveState {
	elapsedSeconds: number;
	paused?: boolean;
	initialized?: boolean;
	regionId: ClimateRegionId;
	zone: string;
	dominantWeight: number;
	boundaryBlend: number;
	baseTemperatureCelsius: number;
	dailyRangeCelsius: number;
	humidity: number;
	lapseRateCelsiusPerMeter: number;
	windMultiplier: number;
	cloudBias: number;
	fogBias: number;
	windBias: number;
	temperatureBias: number;
	backgroundPrecipitationScale: number;
	lightningScale: number;
}

/** Smooth, allocation-free regional climate snapshot around the active player. */
export interface ClimateRegionFrameState extends ClimateRegionSaveState {
	paused: boolean;
	initialized: boolean;
}

export function createClimateRegionFrameState(): ClimateRegionFrameState {
	return {
		elapsedSeconds: 0,
		paused: false,
		initialized: false,
		regionId: 'spawn_meadow',
		zone: 'Spawn Meadow',
		dominantWeight: 1,
		boundaryBlend: 0,
		baseTemperatureCelsius: 19,
		dailyRangeCelsius: 5.5,
		humidity: 0.5,
		lapseRateCelsiusPerMeter: 0.18,
		windMultiplier: 1,
		cloudBias: 0,
		fogBias: 0,
		windBias: 0,
		temperatureBias: 0,
		backgroundPrecipitationScale: 0.72,
		lightningScale: 0.7
	};
}
