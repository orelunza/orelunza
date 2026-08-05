import { Scene, Vector3, type WebGLRenderer } from 'three';
import { hashStringToUint32 } from './EnvironmentMath';
import {
	CelestialClock,
	DEFAULT_DAY_LENGTH_SECONDS,
	type CelestialClockState
} from './CelestialClock';
import { EnvironmentState } from './EnvironmentState';
import { WeatherScheduler } from './weather/WeatherScheduler';
import type { WeatherKind, WeatherSaveState } from './weather/WeatherState';
import { WindSystem } from './wind/WindSystem';
import type { WindSaveState } from './wind/WindState';
import { CloudSystem } from './clouds/CloudSystem';
import type { CloudSaveState } from './clouds/CloudState';
import { CloudRenderer } from './clouds/CloudRenderer';
import { resolveEnvironmentQuality, type EnvironmentQuality } from './EnvironmentQuality';
import { AtmosphereRenderer } from './AtmosphereRenderer';
import { CelestialBodyRenderer } from './CelestialBodyRenderer';
import { StarFieldRenderer } from './StarFieldRenderer';
import { EnvironmentLighting } from './EnvironmentLighting';
import type { RenderQuality } from '../rendering/QualitySettings';
import { PrecipitationSystem } from './weather/PrecipitationSystem';
import type { PrecipitationSaveState } from './weather/PrecipitationState';
import { FogController } from './weather/FogController';
import { LightningSystem } from './weather/LightningSystem';
import type { LightningSaveState } from './weather/LightningState';
import type { WeatherWorldQuery } from './weather/WeatherWorldQuery';
import { RainOcclusionSystem } from './weather/rendering/RainOcclusionSystem';
import { RainRenderer } from './weather/rendering/RainRenderer';
import { RainSplashRenderer } from './weather/rendering/RainSplashRenderer';
import { LightningRenderer } from './weather/rendering/LightningRenderer';
import { SnowRenderer } from './weather/rendering/SnowRenderer';
import { ClimateSystem } from './climate/ClimateSystem';
import type { ClimateSaveState } from './climate/ClimateState';
import { SurfaceWeatherController } from './surface/SurfaceWeatherController';
import type { SurfaceWeatherSaveState } from './surface/SurfaceWeatherState';

export interface EnvironmentSaveState {
	version: 1;
	clock: CelestialClockState;
	dayLengthSeconds: number;
	weather: WeatherSaveState;
	/** Added in weather Phase 2B; optional for older Phase 1/2A saves. */
	wind?: WindSaveState;
	/** Added in weather Phase 2C; optional for older saves. */
	clouds?: CloudSaveState;
	/** Added in weather Lot 2; optional for older saves. */
	precipitation?: PrecipitationSaveState;
	/** Added in weather Lot 2; optional for older saves. */
	lightning?: LightningSaveState;
	/** Added in climate Lot 3; optional for older saves. */
	climate?: ClimateSaveState;
	/** Added in climate Lot 3; optional for older saves. */
	surfaceWeather?: SurfaceWeatherSaveState;
}

export interface EnvironmentSystemOptions {
	scene: Scene;
	renderer: WebGLRenderer;
	seed: string;
	quality: RenderQuality;
	dayLengthSeconds?: number;
	worldQuery?: WeatherWorldQuery;
}

export interface EnvironmentDebugApi {
	setTimeOfDay(fraction: number): void;
	advanceTime(seconds: number): void;
	setDayLengthSeconds(seconds: number): void;
	setDevelopmentTimeScale(scale: number): void;
	pauseCycle(): void;
	resumeCycle(): void;
	setWeather(weather: WeatherKind): void;
	setCloudCoverage(coverage: number): void;
	triggerLightning(): void;
	getState(): EnvironmentInspect;
}

export interface EnvironmentInspect {
	timeOfDay: number;
	dayNumber: number;
	sunAltitude: number;
	daylight: number;
	night: number;
	lunarPhase: number;
	lunarIllumination: number;
	starVisibility: number;
	weather: WeatherKind;
	nextWeather: WeatherKind;
	weatherTransition: number;
	cloudCoverage: number;
	cloudDensity: number;
	cloudDarkness: number;
	cloudSunOcclusion: number;
	humidity: number;
	precipitation: number;
	rainIntensity: number;
	rainVisibleIntensity: number;
	rainShelter: number;
	fogDensity: number;
	visibility: number;
	windDirection: number;
	windStrength: number;
	windGust: number;
	temperatureOffset: number;
	climateZone: string;
	temperatureCelsius: number;
	windChillCelsius: number;
	precipitationType: string;
	snowIntensity: number;
	snowVisibleIntensity: number;
	wetness: number;
	snowCoverage: number;
	frost: number;
	breathVisibility: number;
	lightningFlash: number;
	lightningStrikeId: number;
	lastThunderDelay: number | null;
	paused: boolean;
}

/** Single owner of the celestial clock, weather, wind, clouds and lighting. */
export class EnvironmentSystem {
	private readonly scene: Scene;
	private readonly renderer: WebGLRenderer;
	private readonly seedValue: number;

	private readonly clock: CelestialClock;
	private readonly weatherScheduler: WeatherScheduler;
	private readonly windSystem: WindSystem;
	private readonly cloudSystem = new CloudSystem();
	private readonly climateSystem = new ClimateSystem();
	private readonly precipitationSystem = new PrecipitationSystem();
	private readonly surfaceWeather = new SurfaceWeatherController();
	private readonly fogController = new FogController();
	private readonly lightningSystem: LightningSystem;
	private readonly rainOcclusion: RainOcclusionSystem;
	private readonly worldQuery?: WeatherWorldQuery;
	private readonly state = new EnvironmentState();
	private quality: EnvironmentQuality;

	private atmosphere: AtmosphereRenderer;
	private bodies: CelestialBodyRenderer;
	private stars: StarFieldRenderer;
	private clouds: CloudRenderer;
	private readonly lighting: EnvironmentLighting;
	private readonly rain: RainRenderer;
	private readonly snow: SnowRenderer;
	private readonly splashes: RainSplashRenderer;
	private readonly lightning: LightningRenderer;

	private disposed = false;

	constructor(options: EnvironmentSystemOptions) {
		this.scene = options.scene;
		this.renderer = options.renderer;
		this.seedValue = hashStringToUint32(options.seed);
		this.quality = resolveEnvironmentQuality(options.quality);

		this.clock = new CelestialClock({
			dayLengthSeconds: options.dayLengthSeconds ?? DEFAULT_DAY_LENGTH_SECONDS
		});
		this.weatherScheduler = new WeatherScheduler({ seed: this.seedValue });
		this.windSystem = new WindSystem({ seed: this.seedValue ^ 0x7a4f3c19 });
		this.lightningSystem = new LightningSystem(this.seedValue ^ 0x4c544e47);
		this.worldQuery = options.worldQuery;
		this.rainOcclusion = new RainOcclusionSystem(options.worldQuery);

		this.atmosphere = new AtmosphereRenderer(this.scene, this.quality);
		this.bodies = new CelestialBodyRenderer(this.scene, this.quality);
		this.stars = new StarFieldRenderer(this.scene, this.quality, this.seedValue);
		this.clouds = new CloudRenderer(this.scene, this.quality);
		this.lighting = new EnvironmentLighting(this.scene, this.quality);
		this.rain = new RainRenderer(this.scene, this.quality, this.seedValue);
		this.snow = new SnowRenderer(this.scene, this.quality, this.seedValue);
		this.splashes = new RainSplashRenderer(
			this.scene,
			this.quality,
			this.seedValue,
			this.rainOcclusion
		);
		this.lightning = new LightningRenderer(this.scene);

		this.renderer.shadowMap.enabled = this.quality.sunShadows;
		this.refreshState(0, ORIGIN);
		this.lighting.snapTo(this.state, ORIGIN);
	}

	update(cameraPosition: Vector3, deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		this.clock.advance(deltaSeconds);
		this.weatherScheduler.update(deltaSeconds);
		this.rainOcclusion.update(cameraPosition, deltaSeconds);
		this.refreshState(deltaSeconds, cameraPosition);

		this.atmosphere.update(this.state, cameraPosition);
		this.bodies.update(this.state, cameraPosition);
		this.stars.update(this.state, cameraPosition);
		this.clouds.update(this.state, this.cloudSystem.currentState, cameraPosition);
		this.rain.update(this.precipitationSystem.currentState, cameraPosition);
		this.snow.update(this.precipitationSystem.currentState, cameraPosition);
		this.splashes.update(this.precipitationSystem.currentState, cameraPosition, deltaSeconds);
		this.lightning.update(this.lightningSystem.currentState, cameraPosition);
		this.lighting.update(this.state, cameraPosition, deltaSeconds);
		this.renderer.toneMappingExposure = Math.max(0.25, this.state.exposure);
	}

	setQuality(quality: RenderQuality): void {
		if (this.disposed) {
			return;
		}

		const resolved = resolveEnvironmentQuality(quality);
		if (resolved.quality === this.quality.quality) {
			return;
		}

		this.quality = resolved;
		this.atmosphere.applyQuality(resolved);
		this.clouds.applyQuality(resolved);
		this.rain.applyQuality(resolved);
		this.snow.applyQuality(resolved);
		this.splashes.applyQuality(resolved);
		this.lighting.applyQuality(resolved, this.renderer);
		this.renderer.shadowMap.enabled = resolved.sunShadows;

		this.stars.dispose();
		this.stars = new StarFieldRenderer(this.scene, resolved, this.seedValue);
		this.bodies.dispose();
		this.bodies = new CelestialBodyRenderer(this.scene, resolved);
	}

	serialize(): EnvironmentSaveState {
		return {
			version: 1,
			clock: this.clock.serialize(),
			dayLengthSeconds: this.clock.dayLength,
			weather: this.weatherScheduler.serialize(),
			wind: this.windSystem.serialize(),
			clouds: this.cloudSystem.serialize(),
			precipitation: this.precipitationSystem.serialize(),
			lightning: this.lightningSystem.serialize(),
			climate: this.climateSystem.serialize(),
			surfaceWeather: this.surfaceWeather.serialize()
		};
	}

	restore(save: EnvironmentSaveState | null | undefined): void {
		if (this.disposed || !save || save.version !== 1) {
			return;
		}

		this.clock.setDayLengthSeconds(save.dayLengthSeconds);
		this.clock.restore(save.clock);
		this.weatherScheduler.restore(save.weather);
		this.windSystem.restore(save.wind);
		this.cloudSystem.restore(save.clouds);
		this.precipitationSystem.restore(save.precipitation);
		this.lightningSystem.restore(save.lightning);
		this.climateSystem.restore(save.climate);
		this.surfaceWeather.restore(save.surfaceWeather);
		this.refreshState(0, ORIGIN);
		this.lighting.snapTo(this.state, ORIGIN);
	}

	get currentState(): EnvironmentState {
		return this.state;
	}

	createDebugApi(): EnvironmentDebugApi {
		return {
			setTimeOfDay: (fraction) => this.clock.setDayFraction(fraction),
			advanceTime: (seconds) => this.clock.advance(seconds),
			setDayLengthSeconds: (seconds) => this.clock.setDayLengthSeconds(seconds),
			setDevelopmentTimeScale: (scale) => this.clock.setDevelopmentTimeScale(scale),
			pauseCycle: () => {
				this.clock.pause();
				this.weatherScheduler.pause();
				this.windSystem.pause();
				this.climateSystem.pause();
				this.precipitationSystem.pause();
				this.surfaceWeather.pause();
				this.lightningSystem.pause();
			},
			resumeCycle: () => {
				this.clock.resume();
				this.weatherScheduler.resume();
				this.windSystem.resume();
				this.climateSystem.resume();
				this.precipitationSystem.resume();
				this.surfaceWeather.resume();
				this.lightningSystem.resume();
			},
			setWeather: (weather) => {
				this.weatherScheduler.forceWeather(weather);
				this.refreshState(0, ORIGIN);
			},
			setCloudCoverage: (coverage) => {
				this.weatherScheduler.setCloudCoverageOverride(coverage);
				this.refreshState(0, ORIGIN);
			},
			triggerLightning: () => {
				this.lightningSystem.trigger();
				this.refreshState(0, ORIGIN);
			},
			getState: () => ({
				timeOfDay: this.state.timeOfDay,
				dayNumber: this.state.dayNumber,
				sunAltitude: this.state.sunAltitude,
				daylight: this.state.daylight,
				night: this.state.night,
				lunarPhase: this.state.lunarPhase,
				lunarIllumination: this.state.lunarIllumination,
				starVisibility: this.state.starVisibility,
				weather: this.state.weather.current,
				nextWeather: this.state.weather.next,
				weatherTransition: this.state.weather.transition,
				cloudCoverage: this.state.cloudCoverage,
				cloudDensity: this.state.cloudDensity,
				cloudDarkness: this.state.cloudDarkness,
				cloudSunOcclusion: this.state.cloudSunOcclusion,
				humidity: this.state.humidity,
				precipitation: this.state.precipitation,
				rainIntensity: this.state.rainIntensity,
				rainVisibleIntensity: this.state.rainVisibleIntensity,
				rainShelter: this.state.rainShelter,
				fogDensity: this.state.fogDensity,
				visibility: this.state.visibility,
				windDirection: this.state.windDirection,
				windStrength: this.state.windStrength,
				windGust: this.state.windGust,
				temperatureOffset: this.state.temperatureOffset,
				climateZone: this.state.climateZone,
				temperatureCelsius: this.state.temperatureCelsius,
				windChillCelsius: this.state.windChillCelsius,
				precipitationType: this.state.precipitationType,
				snowIntensity: this.precipitationSystem.currentState.snowIntensity,
				snowVisibleIntensity: this.precipitationSystem.currentState.visibleSnowIntensity,
				wetness: this.state.wetness,
				snowCoverage: this.state.snowCoverage,
				frost: this.state.frost,
				breathVisibility: this.state.breathVisibility,
				lightningFlash: this.state.lightningFlash,
				lightningStrikeId: this.state.lightningStrikeId,
				lastThunderDelay: this.lightningSystem.currentState.lastThunder?.delaySeconds ?? null,
				paused: this.clock.isPaused
			})
		};
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.atmosphere.dispose();
		this.bodies.dispose();
		this.stars.dispose();
		this.clouds.dispose();
		this.rain.dispose();
		this.snow.dispose();
		this.splashes.dispose();
		this.lightning.dispose();
		this.lighting.dispose();
	}

	private refreshState(deltaSeconds: number, cameraPosition: Readonly<Vector3>): void {
		const weather = this.weatherScheduler.currentState;
		this.windSystem.update(deltaSeconds, weather.parameters.windStrength);
		this.cloudSystem.update(weather.parameters, this.windSystem.currentState, deltaSeconds);
		this.climateSystem.update(
			deltaSeconds,
			cameraPosition,
			this.clock.normalizedTimeOfDay,
			weather,
			this.windSystem.currentState,
			this.worldQuery
		);
		this.precipitationSystem.update(
			deltaSeconds,
			weather,
			this.windSystem.currentState,
			this.rainOcclusion.shelterFactor,
			this.climateSystem.currentState
		);
		this.fogController.update(weather, this.precipitationSystem.currentState);
		this.lightningSystem.update(deltaSeconds, weather);
		this.surfaceWeather.update(
			deltaSeconds,
			this.climateSystem.currentState,
			this.precipitationSystem.currentState,
			this.clock.sunAltitude,
			this.windSystem.currentState
		);
		this.state.update(
			this.clock,
			weather,
			this.windSystem.currentState,
			this.cloudSystem.currentState,
			this.precipitationSystem.currentState,
			this.fogController.currentState,
			this.lightningSystem.currentState,
			this.climateSystem.currentState,
			this.surfaceWeather.currentState
		);
	}
}

const ORIGIN = new Vector3(0, 0, 0);
