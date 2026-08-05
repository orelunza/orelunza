import { Scene, Vector3, type WebGLRenderer } from 'three';
import { hashStringToUint32 } from './EnvironmentMath';
import {
	CelestialClock,
	DEFAULT_DAY_LENGTH_SECONDS,
	type CelestialClockState
} from './CelestialClock';
import { EnvironmentState, type WeatherKind, type WeatherSaveState } from './EnvironmentState';
import { resolveEnvironmentQuality, type EnvironmentQuality } from './EnvironmentQuality';
import { AtmosphereRenderer } from './AtmosphereRenderer';
import { CelestialBodyRenderer } from './CelestialBodyRenderer';
import { StarFieldRenderer } from './StarFieldRenderer';
import { EnvironmentLighting } from './EnvironmentLighting';
import type { RenderQuality } from '../rendering/QualitySettings';

/**
 * Serializable environment block persisted inside the world save. Kept minimal
 * and versioned so later phases can add fields without breaking older saves.
 */
export interface EnvironmentSaveState {
	version: 1;
	clock: CelestialClockState;
	dayLengthSeconds: number;
	weather: WeatherSaveState;
}

export interface EnvironmentSystemOptions {
	scene: Scene;
	renderer: WebGLRenderer;
	/** World seed string; drives all deterministic environment generation. */
	seed: string;
	quality: RenderQuality;
	/** Real length of one in-world day in seconds. Optional. */
	dayLengthSeconds?: number;
}

/**
 * Public, phase-stable debug API. Only wired up in development / tests by the
 * engine; it never affects production players. Later phases add weather-related
 * methods here without changing the shape consumers already use.
 */
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

/** Read-only inspection snapshot returned by the debug API. */
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
	paused: boolean;
}

/**
 * The single entry point for the production sky, weather and lighting.
 *
 * It owns the deterministic {@link CelestialClock}, the derived
 * {@link EnvironmentState}, and the sub-renderers (atmosphere, sun/moon, stars)
 * plus the dynamic lighting. The game loop drives it through {@link update}
 * with a delta and the camera position; everything downstream reads from the
 * shared state. No sub-renderer creates its own WebGLRenderer, timer or
 * per-frame allocation, and {@link dispose} tears every piece down exactly once.
 */
export class EnvironmentSystem {
	private readonly scene: Scene;
	private readonly renderer: WebGLRenderer;
	private readonly seedValue: number;

	private readonly clock: CelestialClock;
	private readonly state = new EnvironmentState();
	private quality: EnvironmentQuality;

	private atmosphere: AtmosphereRenderer;
	private bodies: CelestialBodyRenderer;
	private stars: StarFieldRenderer;
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

		this.state.weather.seed = this.seedValue;

		this.atmosphere = new AtmosphereRenderer(this.scene, this.quality);
		this.bodies = new CelestialBodyRenderer(this.scene, this.quality);
		this.stars = new StarFieldRenderer(this.scene, this.quality, this.seedValue);
		this.lighting = new EnvironmentLighting(this.scene, this.quality);

		// Enable shadow mapping on the shared renderer only when the profile
		// asks for it. This is the single owner of that flag for the sky.
		this.renderer.shadowMap.enabled = this.quality.sunShadows;

		// Compute an initial state so the first rendered frame is already
		// correct, then snap lighting to it to avoid a visible ramp-in.
		this.state.update(this.clock);
		this.lighting.snapTo(this.state, ORIGIN);
	}

	/** Advances time and updates every sub-renderer for this frame. */
	update(cameraPosition: Vector3, deltaSeconds: number): void {
		if (this.disposed) {
			return;
		}

		this.clock.advance(deltaSeconds);
		this.state.update(this.clock);

		this.atmosphere.update(this.state, cameraPosition);
		this.bodies.update(this.state, cameraPosition);
		this.stars.update(this.state, cameraPosition);
		this.lighting.update(this.state, cameraPosition, deltaSeconds);

		this.renderer.toneMappingExposure = this.state.exposure;
	}

	/** Switches the quality profile, reusing light instances where possible. */
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
		this.lighting.applyQuality(resolved, this.renderer);
		this.renderer.shadowMap.enabled = resolved.sunShadows;

		// Star count and glow are baked at construction; rebuild those two.
		this.stars.dispose();
		this.stars = new StarFieldRenderer(this.scene, resolved, this.seedValue);

		this.bodies.dispose();
		this.bodies = new CelestialBodyRenderer(this.scene, resolved);
	}

	/** Serializes clock and weather for the world save. */
	serialize(): EnvironmentSaveState {
		return {
			version: 1,
			clock: this.clock.serialize(),
			dayLengthSeconds: this.clock.dayLength,
			weather: {
				current: this.state.weather.current,
				next: this.state.weather.next,
				transition: this.state.weather.transition,
				seed: this.state.weather.seed
			}
		};
	}

	/** Restores a previously serialized environment block. */
	restore(save: EnvironmentSaveState | null | undefined): void {
		if (this.disposed || !save || save.version !== 1) {
			return;
		}

		this.clock.setDayLengthSeconds(save.dayLengthSeconds);
		this.clock.restore(save.clock);
		this.state.restoreWeather(save.weather);
		this.state.update(this.clock);
		this.lighting.snapTo(this.state, ORIGIN);
	}

	/** Returns the frame's derived state (read-only view for consumers). */
	get currentState(): EnvironmentState {
		return this.state;
	}

	/** Builds the development-only debug API. */
	createDebugApi(): EnvironmentDebugApi {
		return {
			setTimeOfDay: (fraction) => this.clock.setDayFraction(fraction),
			advanceTime: (seconds) => this.clock.advance(seconds),
			setDayLengthSeconds: (seconds) => this.clock.setDayLengthSeconds(seconds),
			setDevelopmentTimeScale: (scale) => this.clock.setDevelopmentTimeScale(scale),
			pauseCycle: () => this.clock.pause(),
			resumeCycle: () => this.clock.resume(),
			setWeather: (weather) => {
				// Phase 1 exposes the setter so the debug surface is stable; the
				// full weather engine that reacts to it lands in Phase 2.
				this.state.weather.current = weather;
				this.state.weather.next = weather;
				this.state.weather.transition = 0;
			},
			setCloudCoverage: (coverage) => {
				this.state.cloudCoverage = Math.min(1, Math.max(0, coverage));
			},
			triggerLightning: () => {
				// Placeholder hook kept stable for Phase 3's lightning system.
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
		this.lighting.dispose();
	}
}

const ORIGIN = new Vector3(0, 0, 0);
