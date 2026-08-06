import type { OceanCurrentSample } from './OceanCurrentResolver';

export interface OceanSurfaceSample {
	waveHeightMeters: number;
	wavePhase: number;
	foam: number;
}

export interface OceanSurfaceInput {
	xMeters: number;
	zMeters: number;
	elapsedSeconds: number;
	windStrength: number;
	coastProximity: number;
	current: Readonly<OceanCurrentSample>;
}

/** Shared deterministic wave model for rendering, audio and later buoyancy. */
export class OceanSurfaceModel {
	sample(input: Readonly<OceanSurfaceInput>): OceanSurfaceSample {
		const wind = clamp01(input.windStrength);
		const current = input.current;
		const along = input.xMeters * current.directionEast + input.zMeters * current.directionNorth;
		const across = -input.xMeters * current.directionNorth + input.zMeters * current.directionEast;
		const phase = along * 0.045 + input.elapsedSeconds * (0.7 + current.speedMetersPerSecond);
		const secondary = across * 0.077 - input.elapsedSeconds * 0.46;
		const amplitude = 0.12 + wind * 0.72 + current.speedMetersPerSecond * 0.16;
		const wave = (Math.sin(phase) * 0.68 + Math.sin(secondary) * 0.32) * amplitude;
		const crest = clamp01((Math.sin(phase) - 0.55) / 0.45);
		const foam = clamp01(crest * (0.18 + wind * 0.5) + input.coastProximity * 0.78);
		return { waveHeightMeters: wave, wavePhase: phase, foam };
	}
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
