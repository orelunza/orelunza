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

export interface EnvironmentSaveState {
	version: 1;
	clock: CelestialClockState;
	dayLengthSeconds: number;
	weather: WeatherSaveState;
	/** Added in weather Phase 2B; optional for older Phase 1/2A saves. */
	wind?: WindSaveState;
	/** Added in weather Phase 2C; optional for older saves. */
	clouds?: CloudSaveState;
}

export interface EnvironmentSystemOptions {
	scene: Scene;
	renderer: WebGLRenderer;
	seed: string;
	quality: RenderQuality;
	dayLengthSeconds?: number;
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
	fogDensity: number;
	windDirection: number;
	windStrength: number;
	windGust: number;
	temperatureOffset: number;
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
	private readonly state = new EnvironmentState();
	private quality: EnvironmentQuality;

	private atmosphere: AtmosphereRenderer;
	private bodies: CelestialBodyRenderer;
	private stars: StarFieldRenderer;
	private clouds: CloudRenderer;
	private readonly lighting: EnvironmentLighting;

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

		this.atmosphere = new AtmosphereRenderer(this.scene, this.quality);
		this.bodies = new CelestialBodyRenderer(this.scene, this.quality);
		this.stars = new StarFieldRenderer(this.scene, this.quality, this.seedValue);
		this.clouds = new CloudRenderer(this.scene, this.quality);
		this.lighting = new EnvironmentLighting(this.scene, this.quality);

		this.renderer.shadowMap.enabled = this.quality.sunShadows;
		this.refreshState(0);
		this.lighting.snapTo(this.state, ORIGIN);
	}

	update(cameraPosition: Vector3, deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		this.clock.advance(deltaSeconds);
		this.weatherScheduler.update(deltaSeconds);
		this.refreshState(deltaSeconds);

		this.atmosphere.update(this.state, cameraPosition);
		this.bodies.update(this.state, cameraPosition);
		this.stars.update(this.state, cameraPosition);
		this.clouds.update(this.state, this.cloudSystem.currentState, cameraPosition);
		this.lighting.update(this.state, cameraPosition, deltaSeconds);
		this.renderer.toneMappingExposure = this.state.exposure;
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
			clouds: this.cloudSystem.serialize()
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
		this.refreshState(0);
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
			},
			resumeCycle: () => {
				this.clock.resume();
				this.weatherScheduler.resume();
				this.windSystem.resume();
			},
			setWeather: (weather) => {
				this.weatherScheduler.forceWeather(weather);
				this.refreshState(0);
			},
			setCloudCoverage: (coverage) => {
				this.weatherScheduler.setCloudCoverageOverride(coverage);
				this.refreshState(0);
			},
			triggerLightning: () => {
				// Stable hook reserved for Lot 2's lightning system.
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
				fogDensity: this.state.fogDensity,
				windDirection: this.state.windDirection,
				windStrength: this.state.windStrength,
				windGust: this.state.windGust,
				temperatureOffset: this.state.temperatureOffset,
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
		this.lighting.dispose();
	}

	private refreshState(deltaSeconds: number): void {
		const weather = this.weatherScheduler.currentState;
		this.windSystem.update(deltaSeconds, weather.parameters.windStrength);
		this.cloudSystem.update(weather.parameters, this.windSystem.currentState, deltaSeconds);
		this.state.update(
			this.clock,
			weather,
			this.windSystem.currentState,
			this.cloudSystem.currentState
		);
	}
}

const ORIGIN = new Vector3(0, 0, 0);
