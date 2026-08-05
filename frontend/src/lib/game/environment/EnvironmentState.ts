import { Color, Vector3 } from 'three';
import { clamp01, lerp, smoothstep } from './EnvironmentMath';
import type { CelestialClock } from './CelestialClock';
import type { CloudFrameState } from './clouds/CloudState';
import { isWeatherKind } from './weather/WeatherState';
import type { WeatherFrameState, WeatherKind, WeatherSaveState } from './weather/WeatherState';
import type { WindFrameState } from './wind/WindState';
import type { PrecipitationFrameState } from './weather/PrecipitationState';
import type { WeatherFogFrameState } from './weather/FogController';
import type { LightningFrameState } from './weather/LightningState';
import type { ClimateFrameState } from './climate/ClimateState';
import type { SurfaceWeatherFrameState } from './surface/SurfaceWeatherState';
import type { RegionalWeatherInspect } from './regions/RegionalWeatherSystem';
import type { SpecialWeatherFrameState, SpecialWeatherKind } from './special/SpecialWeatherState';

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
	rainIntensity = 0;
	rainVisibleIntensity = 0;
	rainShelter = 0;
	rainHaze = 0;
	visibility = 1;
	lightningFlash = 0;
	lightningStrikeId = 0;

	climateZone = 'Spawn Meadow';
	temperatureCelsius = 19;
	windChillCelsius = 19;
	precipitationType: ClimateFrameState['precipitationType'] = 'none';
	rainBlend = 0;
	snowBlend = 0;
	frostPotential = 0;
	breathVisibility = 0;
	wetness = 0;
	snowCoverage = 0;
	frost = 0;

	climateRegionId = 'spawn_meadow';
	climateBoundaryBlend = 0;
	localWeather: WeatherKind = 'clear';
	weatherCellCount = 0;
	dominantWeatherCellId: number | null = null;
	dominantWeatherCellKind: WeatherKind | null = null;
	weatherCellCloudInfluence = 0;
	weatherCellCoreInfluence = 0;

	specialWeather: SpecialWeatherKind = 'none';
	specialWeatherTarget: SpecialWeatherKind = 'none';
	specialWeatherTransition = 1;
	specialWeatherIntensity = 0;
	ashIntensity = 0;
	dustIntensity = 0;
	hotHazeIntensity = 0;
	smokeIntensity = 0;
	specialVisibilityLoss = 0;
	specialSunOcclusion = 0;
	specialFogBoost = 0;
	specialTintR = 0.55;
	specialTintG = 0.58;
	specialTintB = 0.62;

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
		clouds?: Readonly<CloudFrameState>,
		precipitation?: Readonly<PrecipitationFrameState>,
		fog?: Readonly<WeatherFogFrameState>,
		lightning?: Readonly<LightningFrameState>,
		climate?: Readonly<ClimateFrameState>,
		surface?: Readonly<SurfaceWeatherFrameState>,
		regional?: Readonly<RegionalWeatherInspect>,
		special?: Readonly<SpecialWeatherFrameState>
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

		if (precipitation) {
			this.applyPrecipitation(precipitation);
		}

		if (fog) {
			this.applyFog(fog);
		}

		if (lightning) {
			this.applyLightning(lightning);
		}

		if (climate) {
			this.applyClimate(climate);
		}

		if (surface) {
			this.applySurfaceWeather(surface);
		}

		if (regional) {
			this.applyRegionalWeather(regional);
		}

		if (special) {
			this.applySpecialWeather(special);
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

	applyPrecipitation(frame: Readonly<PrecipitationFrameState>): void {
		this.rainIntensity = clamp01(frame.rainIntensity);
		this.rainVisibleIntensity = clamp01(frame.visibleRainIntensity);
		this.rainShelter = clamp01(frame.shelter);
	}

	applyFog(frame: Readonly<WeatherFogFrameState>): void {
		this.fogDensity = clamp01(frame.density);
		this.rainHaze = clamp01(frame.rainHaze);
		this.visibility = clamp01(frame.visibility);
	}

	applyLightning(frame: Readonly<LightningFrameState>): void {
		this.lightningFlash = clamp01(frame.flashIntensity);
		this.lightningStrikeId = frame.strikeId >>> 0;
	}

	applyClimate(frame: Readonly<ClimateFrameState>): void {
		this.climateZone = frame.zone;
		this.temperatureCelsius = finiteOr(frame.temperatureCelsius, 19);
		this.humidity = clamp01(frame.humidity);
		this.windChillCelsius = finiteOr(frame.windChillCelsius, this.temperatureCelsius);
		this.precipitationType = frame.precipitationType;
		this.rainBlend = clamp01(frame.rainBlend);
		this.snowBlend = clamp01(frame.snowBlend);
		this.frostPotential = clamp01(frame.frostPotential);
		this.breathVisibility = clamp01(frame.breathVisibility);
	}

	applySurfaceWeather(frame: Readonly<SurfaceWeatherFrameState>): void {
		this.wetness = clamp01(frame.wetness);
		this.snowCoverage = clamp01(frame.snowCoverage);
		this.frost = clamp01(frame.frost);
	}

	applyRegionalWeather(frame: Readonly<RegionalWeatherInspect>): void {
		this.climateRegionId = frame.regionId;
		this.climateBoundaryBlend = clamp01(frame.boundaryBlend);
		this.localWeather = frame.localWeather;
		this.weatherCellCount = Math.max(0, Math.floor(frame.activeCellCount));
		this.dominantWeatherCellId = frame.dominantCellId;
		this.dominantWeatherCellKind = frame.dominantCellKind;
		this.weatherCellCloudInfluence = clamp01(frame.cellCloudInfluence);
		this.weatherCellCoreInfluence = clamp01(frame.cellCoreInfluence);
	}

	applySpecialWeather(frame: Readonly<SpecialWeatherFrameState>): void {
		const parameters = frame.parameters;
		this.specialWeather = frame.current;
		this.specialWeatherTarget = frame.target;
		this.specialWeatherTransition = clamp01(frame.transition);
		this.ashIntensity = clamp01(parameters.ash);
		this.dustIntensity = clamp01(parameters.dust);
		this.hotHazeIntensity = clamp01(parameters.haze);
		this.smokeIntensity = clamp01(parameters.smoke);
		this.specialWeatherIntensity = Math.max(
			this.ashIntensity,
			this.dustIntensity,
			this.hotHazeIntensity,
			this.smokeIntensity
		);
		this.specialVisibilityLoss = clamp01(parameters.visibilityLoss);
		this.specialSunOcclusion = clamp01(parameters.sunOcclusion);
		this.specialFogBoost = clamp01(parameters.fogBoost);
		this.specialTintR = clamp01(parameters.tintR);
		this.specialTintG = clamp01(parameters.tintG);
		this.specialTintB = clamp01(parameters.tintB);
		this.cloudDarkness = clamp01(this.cloudDarkness + parameters.cloudDarkening * 0.72);
		this.cloudSunOcclusion = clamp01(Math.max(this.cloudSunOcclusion, parameters.sunOcclusion));
		this.cloudMoonOcclusion = clamp01(
			Math.max(this.cloudMoonOcclusion, parameters.sunOcclusion * 0.9)
		);
		this.fogDensity = clamp01(Math.max(this.fogDensity, parameters.fogBoost));
		this.visibility = clamp01(this.visibility * (1 - parameters.visibilityLoss * 0.9));
		this.temperatureCelsius += parameters.temperatureOffset;
		this.windChillCelsius += parameters.temperatureOffset;
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

		if (this.specialWeatherIntensity > 0) {
			this.scratchCloud.setRGB(this.specialTintR, this.specialTintG, this.specialTintB);
			this.zenithColor.lerp(this.scratchCloud, this.specialWeatherIntensity * 0.58);
			this.horizonColor.lerp(this.scratchCloud, this.specialWeatherIntensity * 0.72);
		}

		const coldInfluence = clamp01((6 - this.windChillCelsius) / 18);
		if (coldInfluence > 0) {
			this.scratchCloud.setRGB(0.64, 0.75, 0.9);
			this.zenithColor.lerp(this.scratchCloud, coldInfluence * 0.16);
			this.horizonColor.lerp(this.scratchCloud, coldInfluence * 0.22);
		}

		if (this.lightningFlash > 0) {
			this.scratchCloud.setRGB(0.72, 0.82, 1);
			this.zenithColor.lerp(this.scratchCloud, this.lightningFlash * 0.72);
			this.horizonColor.lerp(this.scratchCloud, this.lightningFlash * 0.86);
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
		if (this.rainHaze > 0) {
			this.scratchCloud.setRGB(0.48, 0.55, 0.62);
			this.fogColor.lerp(this.scratchCloud, this.rainHaze * 0.62);
		}

		const coldLighting = clamp01((5 - this.windChillCelsius) / 20);
		if (coldLighting > 0) {
			this.scratchCloud.setRGB(0.66, 0.76, 0.92);
			this.lightColor.lerp(this.scratchCloud, coldLighting * 0.2);
			this.ambientColor.lerp(this.scratchCloud, coldLighting * 0.18);
			this.fogColor.lerp(this.scratchCloud, coldLighting * 0.2);
		}

		if (this.specialWeatherIntensity > 0) {
			this.scratchCloud.setRGB(this.specialTintR, this.specialTintG, this.specialTintB);
			this.lightColor.lerp(this.scratchCloud, this.specialWeatherIntensity * 0.42);
			this.ambientColor.lerp(this.scratchCloud, this.specialWeatherIntensity * 0.5);
			this.fogColor.lerp(this.scratchCloud, this.specialWeatherIntensity * 0.76);
			this.lightIntensity *= 1 - this.specialSunOcclusion * 0.76;
			this.ambientIntensity *= 1 - this.specialSunOcclusion * 0.34;
		}

		const flash = this.lightningFlash;
		if (flash > 0) {
			this.scratchCloud.setRGB(0.82, 0.9, 1);
			this.lightColor.lerp(this.scratchCloud, flash * 0.92);
			this.ambientColor.lerp(this.scratchCloud, flash * 0.84);
			this.lightIntensity += flash * 2.8;
			this.ambientIntensity += flash * 1.55;
			this.fogColor.lerp(this.scratchCloud, flash * 0.72);
		}

		this.exposure =
			lerp(1.18, 1, daylight) -
			this.overcast * 0.13 -
			this.cloudDarkness * 0.04 -
			this.rainHaze * 0.08 -
			this.specialSunOcclusion * 0.16 +
			flash * 0.32;
		this.shadowSoftness = clamp01(this.cloudShadowStrength * daylight + this.rainHaze * 0.18);
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function validWeatherKind(value: unknown, fallback: WeatherKind): WeatherKind {
	return isWeatherKind(value) ? value : fallback;
}
