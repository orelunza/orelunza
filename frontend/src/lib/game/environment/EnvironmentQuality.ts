import type { RenderQuality } from '../rendering/QualitySettings';

/**
 * Resolved environment tuning for a given render-quality profile.
 *
 * These are the only knobs the environment sub-renderers read. Centralising
 * them here means switching quality is a single object swap: no renderer needs
 * to inspect the raw `RenderQuality` string, and Phase 2+ systems can extend
 * the shape without touching call sites.
 */
export interface EnvironmentQuality {
	readonly quality: RenderQuality;
	/** Sky dome tessellation (segments); higher is smoother, no seams. */
	readonly skySegments: number;
	/** Whether the atmosphere shader uses the richer scattering branch. */
	readonly richAtmosphere: boolean;
	/** Number of stars in the deterministic star field. */
	readonly starCount: number;
	/** Enable the sun/moon glow halo billboards. */
	readonly celestialGlow: boolean;
	/** Procedural cloud shell tessellation. */
	readonly cloudSegments: number;
	/** Number of procedural noise octaves evaluated by the cloud shader. */
	readonly cloudDetail: number;
	/** Maximum pooled rain streaks. */
	readonly rainDropCount: number;
	/** Maximum pooled ground splash points. */
	readonly rainSplashCount: number;
	/** Whether the sun should drive real-time shadows. */
	readonly sunShadows: boolean;
	/** Shadow map resolution when shadows are enabled. */
	readonly shadowMapSize: number;
}

const LOW: EnvironmentQuality = {
	quality: 'low',
	skySegments: 16,
	richAtmosphere: false,
	starCount: 420,
	celestialGlow: false,
	cloudSegments: 16,
	cloudDetail: 2,
	rainDropCount: 180,
	rainSplashCount: 18,
	sunShadows: false,
	shadowMapSize: 512
};

const MEDIUM: EnvironmentQuality = {
	quality: 'medium',
	skySegments: 32,
	richAtmosphere: true,
	starCount: 900,
	celestialGlow: true,
	cloudSegments: 28,
	cloudDetail: 4,
	rainDropCount: 420,
	rainSplashCount: 36,
	sunShadows: true,
	shadowMapSize: 1024
};

const HIGH: EnvironmentQuality = {
	quality: 'high',
	skySegments: 48,
	richAtmosphere: true,
	starCount: 1600,
	celestialGlow: true,
	cloudSegments: 40,
	cloudDetail: 5,
	rainDropCount: 760,
	rainSplashCount: 64,
	sunShadows: true,
	shadowMapSize: 2048
};

/** Returns the frozen environment tuning for a render-quality profile. */
export function resolveEnvironmentQuality(quality: RenderQuality): EnvironmentQuality {
	if (quality === 'low') {
		return LOW;
	}

	if (quality === 'high') {
		return HIGH;
	}

	return MEDIUM;
}
