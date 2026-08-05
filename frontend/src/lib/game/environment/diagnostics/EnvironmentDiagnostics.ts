import type { EnvironmentQuality } from '../EnvironmentQuality';
import type { EnvironmentState } from '../EnvironmentState';
import type { SpecialWeatherFrameState } from '../special/SpecialWeatherState';

export interface EnvironmentDiagnosticsSnapshot {
	quality: EnvironmentQuality['quality'];
	averageFps: number;
	averageUpdateMilliseconds: number;
	peakUpdateMilliseconds: number;
	sampleCount: number;
	visibleParticles: number;
	particleBudget: number;
	activeWeatherCells: number;
	weatherDrawCalls: number;
	qualityRebuilds: number;
	disposed: boolean;
}

/** Lightweight rolling diagnostics; it never allocates during frame sampling. */
export class EnvironmentDiagnostics {
	private elapsedSeconds = 0;
	private frameCount = 0;
	private updateTotalMilliseconds = 0;
	private peakUpdateMilliseconds = 0;
	private averageFps = 0;
	private averageUpdateMilliseconds = 0;
	private visibleParticles = 0;
	private particleBudget = 0;
	private activeWeatherCells = 0;
	private weatherDrawCalls = 0;
	private qualityRebuilds = 0;
	private disposed = false;

	record(
		deltaSeconds: number,
		updateMilliseconds: number,
		state: Readonly<EnvironmentState>,
		special: Readonly<SpecialWeatherFrameState>,
		quality: Readonly<EnvironmentQuality>
	): void {
		if (this.disposed) {
			return;
		}
		const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		const duration =
			Number.isFinite(updateMilliseconds) && updateMilliseconds >= 0 ? updateMilliseconds : 0;
		this.elapsedSeconds += delta;
		this.frameCount += 1;
		this.updateTotalMilliseconds += duration;
		this.peakUpdateMilliseconds = Math.max(this.peakUpdateMilliseconds, duration);
		this.visibleParticles = estimateVisibleParticles(state, special, quality);
		this.particleBudget =
			quality.rainDropCount +
			quality.rainSplashCount +
			quality.snowFlakeCount +
			quality.ashParticleCount +
			quality.dustParticleCount;
		this.activeWeatherCells = state.weatherCellCount;
		this.weatherDrawCalls = estimateWeatherDrawCalls(state, special);

		if (this.elapsedSeconds >= 1) {
			this.averageFps = this.frameCount / Math.max(0.001, this.elapsedSeconds);
			this.averageUpdateMilliseconds = this.updateTotalMilliseconds / Math.max(1, this.frameCount);
			this.elapsedSeconds = 0;
			this.frameCount = 0;
			this.updateTotalMilliseconds = 0;
			this.peakUpdateMilliseconds *= 0.92;
		}
	}

	recordQualityRebuild(): void {
		this.qualityRebuilds += 1;
	}

	snapshot(quality: Readonly<EnvironmentQuality>): EnvironmentDiagnosticsSnapshot {
		return {
			quality: quality.quality,
			averageFps: this.averageFps,
			averageUpdateMilliseconds: this.averageUpdateMilliseconds,
			peakUpdateMilliseconds: this.peakUpdateMilliseconds,
			sampleCount: this.frameCount,
			visibleParticles: this.visibleParticles,
			particleBudget: this.particleBudget,
			activeWeatherCells: this.activeWeatherCells,
			weatherDrawCalls: this.weatherDrawCalls,
			qualityRebuilds: this.qualityRebuilds,
			disposed: this.disposed
		};
	}

	dispose(): void {
		this.disposed = true;
		this.visibleParticles = 0;
		this.weatherDrawCalls = 0;
	}
}

function estimateVisibleParticles(
	state: Readonly<EnvironmentState>,
	special: Readonly<SpecialWeatherFrameState>,
	quality: Readonly<EnvironmentQuality>
): number {
	return (
		Math.ceil(quality.rainDropCount * state.rainVisibleIntensity) +
		Math.ceil(quality.rainSplashCount * state.rainVisibleIntensity * (1 - state.rainShelter)) +
		Math.ceil(quality.snowFlakeCount * state.snowBlend) +
		Math.ceil(
			quality.ashParticleCount * Math.max(special.parameters.ash, special.parameters.smoke)
		) +
		Math.ceil(quality.dustParticleCount * special.parameters.dust)
	);
}

function estimateWeatherDrawCalls(
	state: Readonly<EnvironmentState>,
	special: Readonly<SpecialWeatherFrameState>
): number {
	let calls = 5; // atmosphere, celestial bodies, stars, clouds and lighting helpers.
	if (state.rainVisibleIntensity > 0.005) calls += 1;
	if (state.snowBlend > 0.005) calls += 1;
	if (state.lightningFlash > 0.005) calls += 1;
	if (special.parameters.ash > 0.005 || special.parameters.smoke > 0.005) calls += 1;
	if (special.parameters.dust > 0.005) calls += 1;
	if (special.parameters.haze > 0.005) calls += 1;
	return calls;
}
