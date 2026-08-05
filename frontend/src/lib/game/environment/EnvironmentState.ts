import { Color, Vector3 } from 'three';
import { clamp01, lerp, smoothstep } from './EnvironmentMath';
import type { CelestialClock } from './CelestialClock';
import type { CloudFrameState } from './clouds/CloudState';
import { isWeatherKind } from './weather/WeatherState';
import type { WeatherFrameState, WeatherKind, WeatherSaveState } from './weather/WeatherState';
import type { WindFrameState } from './wind/WindState';

export type { WeatherFrameState, WeatherKind, WeatherSaveState } from './weather/WeatherState';

/** Shared, allocation-free environment snapshot for the current frame. */
export class EnvironmentState {
	timeOfDay = 0;
	dayNumber = 0;

	sunAltitude = 1;
	daylight = 1;
	goldenHour = 0;
	twilight = 0;
	night = 0;

	lunarPhase = 0;
	lunarIllumination = 0;
	starVisibility = 0;

	cloudCoverage = 0;
	cloudDensity = 0;
	cloudDarkness = 0;
	cloudOpacity = 0;
	cloudSunOcclusion = 0;
	cloudMoonOcclusion = 0;
	cloudShadowStrength = 0;

	humidity = 0.28;
	fogDensity = 0;
	windDirection = 0;
	windStrength = 0.15;
	windGust = 0;
	weatherWindStrength = 0.15;
	precipitation = 0;
	temperatureOffset = 0;
	lightningProbability = 0;
	overcast = 0;

	readonly sunDirection = new Vector3(0, 1, 0);
	readonly moonDirection = new Vector3(0, -1, 0);

	readonly zenithColor = new Color('#3f6fb0');
	readonly horizonColor = new Color('#cfe0ec');
	readonly sunTint = new Color('#ffd9a0');
	readonly lightColor = new Color('#fff3e0');
	readonly ambientColor = new Color('#b9c6d4');
	readonly fogColor = new Color('#cfe0ec');

	lightIntensity = 1;
	ambientIntensity = 0.6;
	exposure = 1;
	shadowSoftness = 0;

	readonly weather: WeatherSaveState = {
		current: 'clear',
		next: 'clear',
		transition: 0,
		seed: 0
	};

	private readonly scratchDay = new Color();
	private readonly scratchNight = new Color();
	private readonly scratchCloud = new Color();

	update(
		clock: CelestialClock,
		weather?: Readonly<WeatherFrameState>,
		wind?: Readonly<WindFrameState>,
		clouds?: Readonly<CloudFrameState>
	): void {
		if (weather) {
			this.applyWeather(weather);
		}

		if (wind) {
			this.applyWind(wind);
		}

		if (clouds) {
			this.applyClouds(clouds);
		}

		this.timeOfDay = clock.normalizedTimeOfDay;
		this.dayNumber = clock.currentDayNumber;
		this.sunAltitude = clock.sunAltitude;
		this.lunarPhase = clock.lunarPhase;
		this.lunarIllumination = clock.lunarIllumination;
		this.sunDirection.copy(clock.sunDirectionRef);
		this.moonDirection.copy(clock.moonDirectionRef);

		const altitude = this.sunAltitude;
		this.daylight = smoothstep(-0.08, 0.22, altitude);
		this.goldenHour = 1 - smoothstep(0, 0.22, Math.abs(altitude));
		this.twilight = smoothstep(-0.25, -0.02, altitude) * (1 - this.daylight);
		this.night = clamp01(1 - smoothstep(-0.18, 0.04, altitude));
		this.starVisibility = clamp01(this.night * (1 - this.cloudMoonOcclusion * 0.96));

		this.updateAtmosphereColors();
		this.updateLighting();
	}

	applyWeather(frame: Readonly<WeatherFrameState>): void {
		this.weather.current = frame.current;
		this.weather.next = frame.next;
		this.weather.transition = clamp01(frame.transition);
		this.weather.seed = frame.seed >>> 0;
		this.weather.phase = frame.phase;
		this.weather.phaseElapsedSeconds = frame.phaseElapsedSeconds;
		this.weather.phaseDurationSeconds = frame.phaseDurationSeconds;
		this.weather.scheduleIndex = frame.scheduleIndex;
		this.weather.paused = frame.paused;

		const parameters = frame.parameters;
		this.cloudCoverage = clamp01(parameters.cloudCoverage);
		this.cloudDensity = clamp01(parameters.cloudDensity);
		this.cloudDarkness = clamp01(parameters.cloudDarkness);
		this.humidity = clamp01(parameters.humidity);
		this.precipitation = clamp01(parameters.precipitation);
		this.fogDensity = clamp01(parameters.fogDensity);
		this.weatherWindStrength = clamp01(parameters.windStrength);
		this.windStrength = this.weatherWindStrength;
		this.temperatureOffset = finiteOr(parameters.temperatureOffset, 0);
		this.lightningProbability = clamp01(parameters.lightningProbability);
		this.overcast = clamp01(parameters.overcast);
	}

	applyWind(frame: Readonly<WindFrameState>): void {
		this.windDirection = finiteOr(frame.directionRadians, 0);
		this.windStrength = clamp01(frame.strength);
		this.windGust = clamp01(frame.gust);
	}

	applyClouds(frame: Readonly<CloudFrameState>): void {
		this.cloudCoverage = clamp01(frame.coverage);
		this.cloudDensity = clamp01(frame.density);
		this.cloudDarkness = clamp01(frame.darkness);
		this.cloudOpacity = clamp01(frame.opacity);
		this.cloudSunOcclusion = clamp01(frame.sunOcclusion);
		this.cloudMoonOcclusion = clamp01(frame.moonOcclusion);
		this.cloudShadowStrength = clamp01(frame.shadowStrength);
	}

	restoreWeather(state: WeatherSaveState): void {
		this.weather.current = validWeatherKind(state.current, 'clear');
		this.weather.next = validWeatherKind(state.next, this.weather.current);
		this.weather.transition = clamp01(state.transition);
		this.weather.seed = state.seed >>> 0;
		this.weather.phase = state.phase;
		this.weather.phaseElapsedSeconds = state.phaseElapsedSeconds;
		this.weather.phaseDurationSeconds = state.phaseDurationSeconds;
		this.weather.scheduleIndex = state.scheduleIndex;
		this.weather.paused = state.paused;
	}

	private updateAtmosphereColors(): void {
		const daylight = this.daylight;
		const golden = this.goldenHour;

		this.scratchDay.setRGB(
			lerp(0.16, 0.28, daylight),
			lerp(0.26, 0.45, daylight),
			lerp(0.42, 0.72, daylight)
		);
		this.scratchNight.setRGB(0.02, 0.03, 0.07);
		this.zenithColor.copy(this.scratchNight).lerp(this.scratchDay, daylight);

		this.horizonColor.setRGB(
			lerp(0.05, 0.82, daylight),
			lerp(0.06, 0.88, daylight),
			lerp(0.12, 0.95, daylight)
		);
		this.sunTint.setRGB(1, lerp(0.55, 0.85, 1 - golden), lerp(0.3, 0.62, 1 - golden));
		this.horizonColor.lerp(this.sunTint, golden * 0.6 * daylight);

		const cloudInfluence = clamp01(this.overcast * 0.75 + this.cloudDarkness * 0.18);
		if (cloudInfluence > 0) {
			const grey = lerp(0.34, 0.62, daylight);
			this.scratchCloud.setRGB(grey * 0.92, grey * 0.96, grey);
			this.zenithColor.lerp(this.scratchCloud, cloudInfluence);
			this.horizonColor.lerp(this.scratchCloud, cloudInfluence * 0.86);
		}
	}

	private updateLighting(): void {
		const daylight = this.daylight;
		const golden = this.goldenHour;

		this.lightColor.setRGB(
			1,
			lerp(0.86, 0.97, 1 - golden),
			lerp(0.68, 0.92, 1 - golden * (1 - daylight * 0.4))
		);

		const moonStrength = this.night * (0.05 + this.lunarIllumination * 0.22);
		this.lightIntensity = lerp(moonStrength, 1.35, daylight);

		if (daylight < 0.5) {
			this.lightColor.lerp(this.scratchNight.setRGB(0.55, 0.62, 0.85), (0.5 - daylight) * 2);
		}

		this.ambientColor.setRGB(
			lerp(0.12, 0.72, daylight),
			lerp(0.16, 0.78, daylight),
			lerp(0.24, 0.82, daylight)
		);
		this.ambientIntensity = lerp(0.18, 0.62, daylight);

		const directionalOcclusion = daylight > 0.05 ? this.cloudSunOcclusion : this.cloudMoonOcclusion;
		this.lightIntensity *= lerp(1, 0.3, directionalOcclusion);
		this.ambientIntensity *= lerp(1, 0.76, this.overcast);
		this.scratchCloud.setRGB(0.58, 0.64, 0.72);
		this.lightColor.lerp(this.scratchCloud, directionalOcclusion * 0.36);
		this.ambientColor.lerp(this.scratchCloud, this.overcast * 0.24);

		this.fogColor.copy(this.horizonColor);
		this.exposure = lerp(1.18, 1, daylight) - this.overcast * 0.13 - this.cloudDarkness * 0.04;
		this.shadowSoftness = clamp01(this.cloudShadowStrength * daylight);
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function validWeatherKind(value: unknown, fallback: WeatherKind): WeatherKind {
	return isWeatherKind(value) ? value : fallback;
}
