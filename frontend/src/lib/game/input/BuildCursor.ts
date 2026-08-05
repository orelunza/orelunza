import type { MouseDelta } from './MouseInput';

export interface BuildCursorPosition {
	x: number;
	y: number;
}

export interface BuildCursorMovement {
	cameraDelta: MouseDelta;
	position: BuildCursorPosition;
}

const HORIZONTAL_LIMIT = 0.9;
const VERTICAL_LIMIT = 0.84;
const MIN_VIEWPORT_SIZE = 1;

/**
 * Virtual pointer-lock cursor used by build mode.
 *
 * Mouse movement first moves the reticle through the viewport. Only movement
 * that would push the reticle beyond its safe screen bounds is forwarded to
 * the third-person camera. This keeps precise block targeting independent
 * from camera orbit while retaining edge-pan camera control.
 */
export class BuildCursor {
	private x = 0;
	private y = 0;

	get position(): BuildCursorPosition {
		return { x: this.x, y: this.y };
	}

	reset(): void {
		this.x = 0;
		this.y = 0;
	}

	move(delta: MouseDelta, width: number, height: number): BuildCursorMovement {
		const viewportWidth = Math.max(MIN_VIEWPORT_SIZE, finiteOr(width, MIN_VIEWPORT_SIZE));
		const viewportHeight = Math.max(MIN_VIEWPORT_SIZE, finiteOr(height, MIN_VIEWPORT_SIZE));
		const deltaX = finiteOr(delta.x, 0);
		const deltaY = finiteOr(delta.y, 0);

		const requestedX = this.x + (deltaX * 2) / viewportWidth;
		const requestedY = this.y - (deltaY * 2) / viewportHeight;
		const clampedX = clamp(requestedX, -HORIZONTAL_LIMIT, HORIZONTAL_LIMIT);
		const clampedY = clamp(requestedY, -VERTICAL_LIMIT, VERTICAL_LIMIT);

		const overflowX = ((requestedX - clampedX) * viewportWidth) / 2;
		const overflowY = (-(requestedY - clampedY) * viewportHeight) / 2;

		this.x = normalizeZero(clampedX);
		this.y = normalizeZero(clampedY);

		return {
			cameraDelta: {
				x: normalizeZero(overflowX),
				y: normalizeZero(overflowY)
			},
			position: this.position
		};
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeZero(value: number): number {
	return value === 0 ? 0 : value;
}
