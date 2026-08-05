import { Color, Vector3 } from 'three';
import { clamp01, lerp, smoothstep } from './EnvironmentMath';
import type { CelestialClock } from './CelestialClock';

/**
 * Discrete weather kinds. Only `clear` is driven in Phase 1; the rest are part
 * of the stable interface so later phases can populate them without changing
 * the type or any consumer. Keeping the full set here now is what lets the save
 * format and the debug API stay unchanged across phases.
 */
export type WeatherKind =
	| 'clear'
	| 'partly_cloudy'
	| 'overcast'
	| 'mist'
	| 'fog'
	| 'light_rain'
	| 'heavy_rain'
	| 'storm'
	| 'snow';

/** Serializable weather portion of the environment, embedded in the save. */
export interface WeatherSaveState {
	current: WeatherKind;
	next: WeatherKind;
	/** Progress of the transition from `current` toward `next`, in [0, 1]. */
	transition: number;
	/** Seed used for deterministic weather scheduling in later phases. */
	seed: number;
}

/**
 * The fully-derived environment snapshot for the current frame.
 *
 * This is a plain data object updated in place every frame; nothing here is
 * allocated during {@link EnvironmentState.update}. Renderers and the lighting
 * controller read from it rather than each recomputing the same values, which
 * keeps a single source of truth and avoids duplicated trig in hot paths.
 */
export class EnvironmentState {
	/** Normalized time of day in [0, 1). */
	timeOfDay = 0;
	/** Day counter since world creation. */
	dayNumber = 0;

	/** Sun altitude in [-1, 1]; 1 = zenith. */
	sunAltitude = 1;
	/** 0 while the sun is below the horizon, ramping to 1 in daylight. */
	daylight = 1;
	/** 1 only during the sunrise/sunset band around the horizon. */
	goldenHour = 0;
	/** 1 during civil twilight just after sunset / before sunrise. */
	twilight = 0;
	/** 1 in full night. */
	night = 0;

	/** Lunar phase in [0, 1); 0.5 = full. */
	lunarPhase = 0;
	/** Illuminated fraction in [0, 1]; drives moon brightness. */
	lunarIllumination = 0;

	/** How visible the star field should be, in [0, 1]. */
	starVisibility = 0;

	/**
	 * Weather-derived scalars. In Phase 1 these stay at their clear-sky values;
	 * later phases animate them. They live here so lighting, fog and cloud code
	 * can already consume a stable shape.
	 */
	cloudCoverage = 0;
	fogDensity = 0;
	windDirection = 0;
	windStrength = 0.15;
	precipitation = 0;
	overcast = 0;

	/** Unit direction toward the sun (shared reference, do not retain). */
	readonly sunDirection = new Vector3(0, 1, 0);
	/** Unit direction toward the moon (shared reference, do not retain). */
	readonly moonDirection = new Vector3(0, -1, 0);

	/** Zenith and horizon colours for the atmosphere, updated in place. */
	readonly zenithColor = new Color('#3f6fb0');
	readonly horizonColor = new Color('#cfe0ec');
	/** Warm tint injected near the horizon at golden hour. */
	readonly sunTint = new Color('#ffd9a0');
	/** Directional (sun/moon) light colour for this frame. */
	readonly lightColor = new Color('#fff3e0');
	/** Ambient light colour for this frame. */
	readonly ambientColor = new Color('#b9c6d4');
	/** Scene fog colour for this frame. */
	readonly fogColor = new Color('#cfe0ec');

	/** Directional light intensity for this frame. */
	lightIntensity = 1;
	/** Ambient light intensity for this frame. */
	ambientIntensity = 0.6;
	/** Global tone-mapping exposure for this frame. */
	exposure = 1;

	readonly weather: WeatherSaveState = {
		current: 'clear',
		next: 'clear',
		transition: 0,
		seed: 0
	};

	// Scratch colours reused across updates to avoid per-frame allocation.
	private readonly scratchDay = new Color();
	private readonly scratchNight = new Color();

	/**
	 * Recomputes every derived value from the clock. Pure with respect to
	 * allocation: only mutates existing fields and the shared scratch colours.
	 */
	update(clock: CelestialClock): void {
		this.timeOfDay = clock.normalizedTimeOfDay;
		this.dayNumber = clock.currentDayNumber;
		this.sunAltitude = clock.sunAltitude;
		this.lunarPhase = clock.lunarPhase;
		this.lunarIllumination = clock.lunarIllumination;
		this.sunDirection.copy(clock.sunDirectionRef);
		this.moonDirection.copy(clock.moonDirectionRef);

		const altitude = this.sunAltitude;

		// Daylight ramps in as the sun climbs above the horizon.
		this.daylight = smoothstep(-0.08, 0.22, altitude);
		// Golden hour peaks when the sun sits right on the horizon.
		this.goldenHour = 1 - smoothstep(0.0, 0.22, Math.abs(altitude));
		// Twilight is the band just below the horizon.
		this.twilight = smoothstep(-0.25, -0.02, altitude) * (1 - this.daylight);
		// Night is the complement of any daylight/twilight glow.
		this.night = clamp01(1 - smoothstep(-0.18, 0.04, altitude));

		// Stars appear as the sky darkens; clouds later suppress them.
		this.starVisibility = clamp01(this.night * (1 - this.cloudCoverage * 0.85));

		this.updateAtmosphereColors();
		this.updateLighting();
	}

	/** Applies restored weather state (called during save restore). */
	restoreWeather(state: WeatherSaveState): void {
		this.weather.current = state.current;
		this.weather.next = state.next;
		this.weather.transition = clamp01(state.transition);
		this.weather.seed = state.seed >>> 0;
	}

	private updateAtmosphereColors(): void {
		const daylight = this.daylight;
		const golden = this.goldenHour;

		// Daytime palette: deep blue zenith, pale blue horizon.
		this.scratchDay.setRGB(
			lerp(0.16, 0.28, daylight),
			lerp(0.26, 0.45, daylight),
			lerp(0.42, 0.72, daylight)
		);
		// Night palette: near-black navy.
		this.scratchNight.setRGB(0.02, 0.03, 0.07);

		this.zenithColor.copy(this.scratchNight).lerp(this.scratchDay, daylight);

		// Horizon is lighter than zenith and warms up at golden hour.
		this.horizonColor.setRGB(
			lerp(0.05, 0.82, daylight),
			lerp(0.06, 0.88, daylight),
			lerp(0.12, 0.95, daylight)
		);
		this.sunTint.setRGB(1.0, lerp(0.55, 0.85, 1 - golden), lerp(0.3, 0.62, 1 - golden));
		this.horizonColor.lerp(this.sunTint, golden * 0.6 * daylight);

		// Overcast desaturates and greys the sky; unused (0) in Phase 1.
		if (this.overcast > 0) {
			const grey = lerp(0.5, 0.62, daylight);
			this.zenithColor.lerp(this.scratchDay.setRGB(grey, grey, grey), this.overcast * 0.7);
			this.horizonColor.lerp(this.scratchDay.setRGB(grey, grey, grey), this.overcast * 0.7);
		}
	}

	private updateLighting(): void {
		const daylight = this.daylight;
		const golden = this.goldenHour;

		// Sun light: warm and bright by day, warmer at golden hour.
		this.lightColor.setRGB(
			1.0,
			lerp(0.86, 0.97, 1 - golden),
			lerp(0.68, 0.92, 1 - golden * (1 - daylight * 0.4))
		);

		// At night the directional light becomes cool, dim moonlight scaled by
		// the illuminated fraction so a new moon is genuinely dark.
		const moonStrength = this.night * (0.05 + this.lunarIllumination * 0.22);
		this.lightIntensity = lerp(moonStrength, 1.35, daylight);

		if (daylight < 0.5) {
			// Blend the light colour toward cool moonlight after dusk.
			this.lightColor.lerp(this.scratchNight.setRGB(0.55, 0.62, 0.85), (0.5 - daylight) * 2);
		}

		// Ambient follows the sky: cool-blue and dim at night, brighter by day.
		this.ambientColor.setRGB(
			lerp(0.12, 0.72, daylight),
			lerp(0.16, 0.78, daylight),
			lerp(0.24, 0.82, daylight)
		);
		this.ambientIntensity = lerp(0.18, 0.62, daylight);

		// Fog colour tracks the horizon so distant geometry melts into the sky.
		this.fogColor.copy(this.horizonColor);

		// Exposure lifts slightly at night so the scene is readable without
		// washing out the day. Overcast pulls it down a touch.
		this.exposure = lerp(1.18, 1.0, daylight) - this.overcast * 0.12;
	}
}
