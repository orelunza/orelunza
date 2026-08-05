import { clamp, lerp } from '../EnvironmentMath';
import type { WindFrameState } from '../wind/WindState';
import type { WeatherCellSaveState } from './WeatherCellState';

/** One moving, serializable regional weather volume. */
export class WeatherCell {
	readonly state: WeatherCellSaveState;

	constructor(state: WeatherCellSaveState) {
		this.state = sanitizeState(state);
	}

	update(deltaSeconds: number, wind: Readonly<WindFrameState>): void {
		const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
		if (delta <= 0) {
			return;
		}

		const currentSpeed = Math.hypot(this.state.velocityX, this.state.velocityZ);
		const targetSpeed = clamp(2.2 + wind.strength * 5.8 + wind.gust * 1.8, 1.4, 10);
		const steering = 1 - Math.exp(-delta / 18);
		const targetX = wind.directionX * targetSpeed;
		const targetZ = wind.directionZ * targetSpeed;
		this.state.velocityX = lerp(this.state.velocityX, targetX, steering);
		this.state.velocityZ = lerp(this.state.velocityZ, targetZ, steering);

		if (currentSpeed <= 0.001 && Math.hypot(this.state.velocityX, this.state.velocityZ) <= 0.001) {
			this.state.velocityX = targetX;
			this.state.velocityZ = targetZ;
		}

		this.state.x += this.state.velocityX * delta;
		this.state.z += this.state.velocityZ * delta;
		this.state.ageSeconds += delta;
	}

	get expired(): boolean {
		return this.state.ageSeconds >= this.state.lifetimeSeconds;
	}

	get lifecycleIntensity(): number {
		const age = this.state.ageSeconds;
		const grow = this.state.growthSeconds <= 0 ? 1 : clamp(age / this.state.growthSeconds, 0, 1);
		const remaining = this.state.lifetimeSeconds - age;
		const decay =
			this.state.decaySeconds <= 0 ? 1 : clamp(remaining / this.state.decaySeconds, 0, 1);
		const growSmooth = grow * grow * (3 - 2 * grow);
		const decaySmooth = decay * decay * (3 - 2 * decay);

		return clamp(this.state.intensity * growSmooth * decaySmooth, 0, 1);
	}

	serialize(): WeatherCellSaveState {
		return { ...this.state };
	}
}

function sanitizeState(state: WeatherCellSaveState): WeatherCellSaveState {
	return {
		id: finiteUint32(state.id),
		kind: state.kind,
		x: finiteOr(state.x, 0),
		z: finiteOr(state.z, 0),
		radius: clamp(finiteOr(state.radius, 120), 24, 500),
		intensity: clamp(finiteOr(state.intensity, 1), 0, 1),
		velocityX: clamp(finiteOr(state.velocityX, 0), -20, 20),
		velocityZ: clamp(finiteOr(state.velocityZ, 0), -20, 20),
		ageSeconds: Math.max(0, finiteOr(state.ageSeconds, 0)),
		lifetimeSeconds: clamp(finiteOr(state.lifetimeSeconds, 240), 10, 3600),
		growthSeconds: clamp(finiteOr(state.growthSeconds, 24), 0, 600),
		decaySeconds: clamp(finiteOr(state.decaySeconds, 36), 0, 600)
	};
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function finiteUint32(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value >>> 0 : 0;
}
