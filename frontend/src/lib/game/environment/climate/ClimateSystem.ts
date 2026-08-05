import type { Vector3 } from 'three';
import { clamp, clamp01, lerp, smoothstep, TWO_PI } from '../EnvironmentMath';
import type { WeatherFrameState } from '../weather/WeatherState';
import type { WeatherWorldQuery } from '../weather/WeatherWorldQuery';
import type { WindFrameState } from '../wind/WindState';
import { resolveBiomeClimateProfile } from './BiomeClimateProfile';
import {
	createClimateFrameState,
	type ClimateFrameState,
	type ClimatePrecipitationType,
	type ClimateSaveState
} from './ClimateState';

const REFERENCE_ALTITUDE = 9;
const SNOW_START_CELSIUS = 2.2;
const ALL_SNOW_CELSIUS = -1.5;

/** Renderer-free local climate authority around the active player. */
export class ClimateSystem {
	private readonly frame = createClimateFrameState();

	get currentState(): Readonly<ClimateFrameState> {
		return this.frame;
	}

	update(
		deltaSeconds: number,
		cameraPosition: Readonly<Vector3>,
		timeOfDay: number,
		weather: Readonly<WeatherFrameState>,
		wind: Readonly<WindFrameState>,
		worldQuery?: WeatherWorldQuery
	): void {
		if (!this.frame.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.frame.elapsedSeconds += deltaSeconds;
		}

		const x = finiteOr(cameraPosition.x, 0);
		const y = finiteOr(cameraPosition.y, REFERENCE_ALTITUDE);
		const z = finiteOr(cameraPosition.z, 0);
		const zone = worldQuery?.climateZoneAt?.(x, z) ?? 'Spawn Meadow';
		const profile = resolveBiomeClimateProfile(zone);
		const dayFraction = wrap01(finiteOr(timeOfDay, 0.5));
		// Warmest around 14:00, coldest around 02:00.
		const dailyWave = Math.cos((dayFraction - 0.58) * TWO_PI);
		const altitudeCooling = Math.max(0, y - REFERENCE_ALTITUDE) * profile.lapseRateCelsiusPerMeter;
		const baseTemperature =
			profile.baseTemperatureCelsius + dailyWave * profile.dailyRangeCelsius - altitudeCooling;
		const temperature = clamp(baseTemperature + weather.parameters.temperatureOffset, -45, 55);
		const humidity = clamp01(lerp(profile.humidity, weather.parameters.humidity, 0.68));
		const windSpeed = clamp01(wind.strength + wind.gust * 0.45);
		const windCooling =
			temperature < 12 ? windSpeed * lerp(1.4, 7.2, clamp01((12 - temperature) / 22)) : 0;
		const windChill = clamp(temperature - windCooling, -55, 55);
		const precipitation = clamp01(weather.parameters.precipitation);
		const thermalSnow = 1 - smoothstep(ALL_SNOW_CELSIUS, SNOW_START_CELSIUS, temperature);
		const currentSnow = weather.current === 'snow' ? 1 : 0;
		const nextSnow = weather.next === 'snow' ? 1 : 0;
		const scheduledSnow = lerp(currentSnow, nextSnow, clamp01(weather.transition));
		const snowBlend = clamp01(Math.max(thermalSnow, scheduledSnow * 0.9) * precipitation);
		const rainBlend = clamp01(precipitation - snowBlend);
		const precipitationType = resolvePrecipitationType(precipitation, rainBlend, snowBlend);
		const frostPotential = clamp01(
			(1 - smoothstep(-1, 3, temperature)) * smoothstep(0.58, 0.92, humidity)
		);
		const breathVisibility = clamp01(
			(1 - smoothstep(-3, 8, windChill)) * smoothstep(0.42, 0.82, humidity)
		);

		this.frame.zone = zone;
		this.frame.baseTemperatureCelsius = baseTemperature;
		this.frame.temperatureCelsius = temperature;
		this.frame.humidity = humidity;
		this.frame.windChillCelsius = windChill;
		this.frame.precipitationType = precipitationType;
		this.frame.rainBlend = rainBlend;
		this.frame.snowBlend = snowBlend;
		this.frame.frostPotential = frostPotential;
		this.frame.breathVisibility = breathVisibility;
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): ClimateSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			paused: this.frame.paused,
			zone: this.frame.zone,
			temperatureCelsius: this.frame.temperatureCelsius,
			humidity: this.frame.humidity,
			windChillCelsius: this.frame.windChillCelsius,
			precipitationType: this.frame.precipitationType,
			snowBlend: this.frame.snowBlend
		};
	}

	restore(save: ClimateSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds = nonNegative(save.elapsedSeconds);
		this.frame.paused = save.paused === true;
		this.frame.zone =
			typeof save.zone === 'string' && save.zone.length > 0 ? save.zone : 'Spawn Meadow';
		this.frame.temperatureCelsius = clamp(finiteOr(save.temperatureCelsius, 19), -45, 55);
		this.frame.humidity = safeUnit(save.humidity);
		this.frame.windChillCelsius = clamp(finiteOr(save.windChillCelsius, 19), -55, 55);
		this.frame.precipitationType = validPrecipitationType(save.precipitationType);
		this.frame.snowBlend = safeUnit(save.snowBlend);
		this.frame.rainBlend = clamp01(1 - this.frame.snowBlend);
	}
}

function resolvePrecipitationType(
	precipitation: number,
	rainBlend: number,
	snowBlend: number
): ClimatePrecipitationType {
	if (precipitation <= 0.005) {
		return 'none';
	}

	if (snowBlend > 0.08 && rainBlend > 0.08) {
		return 'mixed';
	}

	return snowBlend >= rainBlend ? 'snow' : 'rain';
}

function validPrecipitationType(value: unknown): ClimatePrecipitationType {
	return value === 'rain' || value === 'snow' || value === 'mixed' ? value : 'none';
}

function safeUnit(value: number): number {
	return Number.isFinite(value) ? clamp01(value) : 0;
}

function nonNegative(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function wrap01(value: number): number {
	const wrapped = value % 1;
	return wrapped < 0 ? wrapped + 1 : wrapped;
}
