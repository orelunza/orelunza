import { Vector3 } from 'three';
import type { PlanetPosition } from './GeodeticCoordinate';
import { isFinitePlanetPosition } from './GeodeticCoordinate';

export interface FloatingOriginState {
	globalOrigin: PlanetPosition;
	rebaseCount: number;
}

export interface FloatingOriginRebase {
	rebased: boolean;
	previousOrigin: PlanetPosition;
	nextOrigin: PlanetPosition;
	localShift: Vector3;
}

export class FloatingOrigin {
	private origin: PlanetPosition;
	private count = 0;

	constructor(
		initialOrigin: Readonly<PlanetPosition> = { x: 0, y: 0, z: 0 },
		readonly rebaseThresholdMeters = 10_000
	) {
		if (!isFinitePlanetPosition(initialOrigin)) {
			throw new RangeError('Floating origin must be finite.');
		}
		if (!Number.isFinite(rebaseThresholdMeters) || rebaseThresholdMeters <= 0) {
			throw new RangeError('Floating origin threshold must be finite and positive.');
		}
		this.origin = { ...initialOrigin };
	}

	get state(): FloatingOriginState {
		return { globalOrigin: { ...this.origin }, rebaseCount: this.count };
	}

	toLocal(globalPosition: Readonly<PlanetPosition>, target = new Vector3()): Vector3 {
		if (!isFinitePlanetPosition(globalPosition)) {
			throw new RangeError('Global position must be finite.');
		}
		return target.set(
			globalPosition.x - this.origin.x,
			globalPosition.y - this.origin.y,
			globalPosition.z - this.origin.z
		);
	}

	toGlobal(
		localPosition: Readonly<Vector3>,
		target: PlanetPosition = { x: 0, y: 0, z: 0 }
	): PlanetPosition {
		if (![localPosition.x, localPosition.y, localPosition.z].every(Number.isFinite)) {
			throw new RangeError('Local position must be finite.');
		}
		target.x = this.origin.x + localPosition.x;
		target.y = this.origin.y + localPosition.y;
		target.z = this.origin.z + localPosition.z;
		return target;
	}

	rebaseIfNeeded(anchorGlobalPosition: Readonly<PlanetPosition>): FloatingOriginRebase {
		if (!isFinitePlanetPosition(anchorGlobalPosition)) {
			throw new RangeError('Rebase anchor must be finite.');
		}

		const localX = anchorGlobalPosition.x - this.origin.x;
		const localY = anchorGlobalPosition.y - this.origin.y;
		const localZ = anchorGlobalPosition.z - this.origin.z;
		const distance = Math.hypot(localX, localY, localZ);
		const previousOrigin = { ...this.origin };

		if (distance <= this.rebaseThresholdMeters) {
			return {
				rebased: false,
				previousOrigin,
				nextOrigin: { ...this.origin },
				localShift: new Vector3()
			};
		}

		this.origin = { ...anchorGlobalPosition };
		this.count += 1;
		return {
			rebased: true,
			previousOrigin,
			nextOrigin: { ...this.origin },
			localShift: new Vector3(
				previousOrigin.x - this.origin.x,
				previousOrigin.y - this.origin.y,
				previousOrigin.z - this.origin.z
			)
		};
	}

	restore(state: Readonly<FloatingOriginState>): void {
		if (
			!isFinitePlanetPosition(state.globalOrigin) ||
			!Number.isInteger(state.rebaseCount) ||
			state.rebaseCount < 0
		) {
			throw new RangeError('Invalid floating origin state.');
		}
		this.origin = { ...state.globalOrigin };
		this.count = state.rebaseCount;
	}
}
