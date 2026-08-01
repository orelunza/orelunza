import {
	clampWorldValue,
	distanceBetweenPoints,
	type WorldBounds,
	type WorldPoint
} from '$lib/world/types';

export interface MovementSystemOptions {
	initialPosition: WorldPoint;
	bounds: WorldBounds;
	speed?: number;
	destinationTolerance?: number;
	onPositionChange?: (position: WorldPoint) => void;
	onMovementStart?: (position: WorldPoint) => void;
	onMovementStop?: (position: WorldPoint) => void;
}

export interface MovementStepInput {
	direction: WorldPoint;
	deltaMS: number;
}

const DEFAULT_SPEED = 180;
const DEFAULT_DESTINATION_TOLERANCE = 6;

export class MovementSystem {
	private positionValue: WorldPoint;
	private bounds: WorldBounds;
	private readonly speed: number;
	private readonly destinationTolerance: number;
	private readonly onPositionChange?: (position: WorldPoint) => void;
	private readonly onMovementStart?: (position: WorldPoint) => void;
	private readonly onMovementStop?: (position: WorldPoint) => void;

	private destinationValue: WorldPoint | null = null;
	private moving = false;

	constructor(options: MovementSystemOptions) {
		this.positionValue = { ...options.initialPosition };
		this.bounds = { ...options.bounds };
		this.speed = this.normalizePositive(options.speed ?? DEFAULT_SPEED, 'movement speed');
		this.destinationTolerance = this.normalizePositive(
			options.destinationTolerance ?? DEFAULT_DESTINATION_TOLERANCE,
			'destination tolerance'
		);
		this.onPositionChange = options.onPositionChange;
		this.onMovementStart = options.onMovementStart;
		this.onMovementStop = options.onMovementStop;
		this.positionValue = this.clampPoint(this.positionValue);
	}

	get position(): WorldPoint {
		return { ...this.positionValue };
	}

	get destination(): WorldPoint | null {
		return this.destinationValue ? { ...this.destinationValue } : null;
	}

	get isMoving(): boolean {
		return this.moving;
	}

	setBounds(bounds: WorldBounds): void {
		this.bounds = { ...bounds };
		this.setPosition(this.positionValue);
	}

	setPosition(position: WorldPoint, emit = true): void {
		const nextPosition = this.clampPoint(position);
		const changed = this.hasChanged(nextPosition);

		this.positionValue = nextPosition;

		if (emit && changed) {
			this.onPositionChange?.(this.position);
		}
	}

	setDestination(destination: WorldPoint | null): void {
		this.destinationValue = destination ? this.clampPoint(destination) : null;
	}

	clearDestination(): void {
		this.destinationValue = null;
	}

	step(input: MovementStepInput): WorldPoint {
		const previousMoving = this.moving;
		const direction = this.resolveDirection(input.direction);
		const deltaSeconds = Math.max(0, input.deltaMS) / 1000;
		let nextPosition = this.positionValue;

		if (direction.x !== 0 || direction.y !== 0) {
			this.destinationValue = null;
			nextPosition = this.clampPoint({
				x: this.positionValue.x + direction.x * this.speed * deltaSeconds,
				y: this.positionValue.y + direction.y * this.speed * deltaSeconds
			});
		} else if (this.destinationValue) {
			nextPosition = this.stepTowardDestination(deltaSeconds);
		}

		const changed = this.hasChanged(nextPosition);

		this.positionValue = nextPosition;
		this.moving =
			direction.x !== 0 ||
			direction.y !== 0 ||
			(this.destinationValue !== null &&
				distanceBetweenPoints(this.positionValue, this.destinationValue) >
					this.destinationTolerance);

		if (changed) {
			this.onPositionChange?.(this.position);
		}

		if (!previousMoving && this.moving) {
			this.onMovementStart?.(this.position);
		}

		if (previousMoving && !this.moving) {
			this.onMovementStop?.(this.position);
		}

		return this.position;
	}

	private stepTowardDestination(deltaSeconds: number): WorldPoint {
		const destination = this.destinationValue;

		if (!destination) {
			return this.positionValue;
		}

		const distance = distanceBetweenPoints(this.positionValue, destination);

		if (distance <= this.destinationTolerance) {
			this.destinationValue = null;
			return this.clampPoint(destination);
		}

		const travel = this.speed * deltaSeconds;

		if (travel >= distance) {
			this.destinationValue = null;
			return this.clampPoint(destination);
		}

		return this.clampPoint({
			x: this.positionValue.x + ((destination.x - this.positionValue.x) / distance) * travel,
			y: this.positionValue.y + ((destination.y - this.positionValue.y) / distance) * travel
		});
	}

	private resolveDirection(direction: WorldPoint): WorldPoint {
		const magnitude = Math.hypot(direction.x, direction.y);

		if (magnitude <= 0) {
			return { x: 0, y: 0 };
		}

		return {
			x: direction.x / magnitude,
			y: direction.y / magnitude
		};
	}

	private clampPoint(point: WorldPoint): WorldPoint {
		return {
			x: clampWorldValue(point.x, this.bounds.x, this.bounds.x + this.bounds.width),
			y: clampWorldValue(point.y, this.bounds.y, this.bounds.y + this.bounds.height)
		};
	}

	private hasChanged(nextPosition: WorldPoint): boolean {
		return (
			Math.abs(nextPosition.x - this.positionValue.x) > 0.001 ||
			Math.abs(nextPosition.y - this.positionValue.y) > 0.001
		);
	}

	private normalizePositive(value: number, label: string): number {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`The ${label} must be a positive finite number.`);
		}

		return value;
	}
}
