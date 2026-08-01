import type { Container } from 'pixi.js';

import {
	clampWorldValue,
	DEFAULT_WORLD_CAMERA,
	type WorldBounds,
	type WorldCameraOptions,
	type WorldCameraState,
	type WorldPoint,
	type WorldViewport
} from '$lib/world/types';

export interface WorldCameraConfiguration extends Partial<WorldCameraOptions> {
	onChange?: (state: WorldCameraState) => void;
}

const DEFAULT_VIEWPORT: Readonly<WorldViewport> = Object.freeze({
	width: 1,
	height: 1,
	devicePixelRatio: 1
});

const MIN_VIEWPORT_SIZE = 1;
const DRAG_THRESHOLD_PX = 3;

/**
 * Controls the transform of a PixiJS world container.
 *
 * The camera position represents the world coordinate displayed at the
 * center of the viewport.
 */
export class WorldCamera {
	readonly container: Container;

	private options: WorldCameraOptions;
	private viewport: WorldViewport;
	private state: WorldCameraState;

	private surface: HTMLCanvasElement | null = null;
	private previousTouchAction = '';

	private dragging = false;
	private dragStarted = false;
	private activePointerId: number | null = null;

	private pointerStart: WorldPoint = {
		x: 0,
		y: 0
	};

	private pointerPrevious: WorldPoint = {
		x: 0,
		y: 0
	};

	private onChange?: (state: WorldCameraState) => void;

	private destroyed = false;

	constructor(container: Container, configuration: WorldCameraConfiguration = {}) {
		this.container = container;

		this.options = {
			minZoom: configuration.minZoom ?? DEFAULT_WORLD_CAMERA.minZoom,

			maxZoom: configuration.maxZoom ?? DEFAULT_WORLD_CAMERA.maxZoom,

			initialZoom: configuration.initialZoom ?? DEFAULT_WORLD_CAMERA.initialZoom,

			wheelZoomSpeed: configuration.wheelZoomSpeed ?? DEFAULT_WORLD_CAMERA.wheelZoomSpeed,

			dragSpeed: configuration.dragSpeed ?? DEFAULT_WORLD_CAMERA.dragSpeed,

			bounds: configuration.bounds
		};

		this.validateOptions(this.options);

		this.viewport = {
			...DEFAULT_VIEWPORT
		};

		this.state = {
			position: {
				x: 0,
				y: 0
			},

			zoom: clampWorldValue(this.options.initialZoom, this.options.minZoom, this.options.maxZoom)
		};

		this.onChange = configuration.onChange;

		this.applyTransform(false);
	}

	/**
	 * Attach mouse, touch and wheel controls to the PixiJS canvas.
	 */
	attach(surface: HTMLCanvasElement): void {
		this.assertUsable();

		if (this.surface === surface) {
			return;
		}

		this.detach();

		this.surface = surface;
		this.previousTouchAction = surface.style.touchAction;

		surface.style.touchAction = 'none';

		surface.addEventListener('pointerdown', this.handlePointerDown);

		surface.addEventListener('pointermove', this.handlePointerMove);

		surface.addEventListener('pointerup', this.handlePointerUp);

		surface.addEventListener('pointercancel', this.handlePointerUp);

		surface.addEventListener('lostpointercapture', this.handlePointerCaptureLost);

		surface.addEventListener('wheel', this.handleWheel, {
			passive: false
		});
	}

	/**
	 * Remove canvas controls without destroying the camera.
	 */
	detach(): void {
		if (!this.surface) {
			return;
		}

		this.endDrag();

		this.surface.removeEventListener('pointerdown', this.handlePointerDown);

		this.surface.removeEventListener('pointermove', this.handlePointerMove);

		this.surface.removeEventListener('pointerup', this.handlePointerUp);

		this.surface.removeEventListener('pointercancel', this.handlePointerUp);

		this.surface.removeEventListener('lostpointercapture', this.handlePointerCaptureLost);

		this.surface.removeEventListener('wheel', this.handleWheel);

		this.surface.style.touchAction = this.previousTouchAction;

		this.surface = null;
		this.previousTouchAction = '';
	}

	/**
	 * Update the visible screen size.
	 */
	setViewport(
		width: number,
		height: number,
		devicePixelRatio = globalThis.devicePixelRatio || 1
	): void {
		this.assertUsable();

		this.viewport = {
			width: Math.max(MIN_VIEWPORT_SIZE, width),

			height: Math.max(MIN_VIEWPORT_SIZE, height),

			devicePixelRatio: Math.max(1, devicePixelRatio)
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Replace the optional world movement limits.
	 */
	setBounds(bounds?: WorldBounds): void {
		this.assertUsable();

		if (bounds) {
			this.validateBounds(bounds);

			this.options.bounds = {
				...bounds
			};
		} else {
			this.options.bounds = undefined;
		}

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Return a copy of the configured world limits.
	 */
	getBounds(): WorldBounds | undefined {
		const bounds = this.options.bounds;

		return bounds
			? {
					...bounds
				}
			: undefined;
	}

	/**
	 * Set the world coordinate displayed at the viewport center.
	 */
	setPosition(position: WorldPoint, emit = true): void {
		this.assertUsable();
		this.validatePoint(position);

		this.state.position = {
			...position
		};

		this.clampPosition();
		this.applyTransform(emit);
	}

	/**
	 * Move the camera by a distance expressed in world coordinates.
	 */
	panByWorld(offset: WorldPoint): void {
		this.assertUsable();
		this.validatePoint(offset);

		this.state.position = {
			x: this.state.position.x + offset.x,

			y: this.state.position.y + offset.y
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Move the camera using a screen-space pointer delta.
	 */
	panByScreen(offset: WorldPoint): void {
		this.assertUsable();
		this.validatePoint(offset);

		const dragSpeed = this.options.dragSpeed;

		this.state.position = {
			x: this.state.position.x - (offset.x / this.state.zoom) * dragSpeed,

			y: this.state.position.y - (offset.y / this.state.zoom) * dragSpeed
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Change zoom while keeping the supplied screen point fixed.
	 */
	setZoom(zoom: number, anchor?: WorldPoint): void {
		this.assertUsable();

		if (!Number.isFinite(zoom)) {
			throw new Error('The camera zoom must be finite.');
		}

		const nextZoom = clampWorldValue(zoom, this.options.minZoom, this.options.maxZoom);

		if (nextZoom === this.state.zoom) {
			return;
		}

		const screenAnchor = anchor ?? this.viewportCenter();

		this.validatePoint(screenAnchor);

		const anchoredWorldPoint = this.screenToWorld(screenAnchor);

		this.state.zoom = nextZoom;

		this.state.position = {
			x: anchoredWorldPoint.x - (screenAnchor.x - this.viewport.width / 2) / nextZoom,

			y: anchoredWorldPoint.y - (screenAnchor.y - this.viewport.height / 2) / nextZoom
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Multiply the current zoom level.
	 */
	zoomBy(factor: number, anchor?: WorldPoint): void {
		if (!Number.isFinite(factor) || factor <= 0) {
			throw new Error('The camera zoom factor must be greater than zero.');
		}

		this.setZoom(this.state.zoom * factor, anchor);
	}

	/**
	 * Center the camera on a world point.
	 */
	centerOn(position: WorldPoint, zoom?: number): void {
		this.assertUsable();
		this.validatePoint(position);

		if (zoom !== undefined) {
			this.state.zoom = clampWorldValue(zoom, this.options.minZoom, this.options.maxZoom);
		}

		this.state.position = {
			...position
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Fit a rectangular world area inside the current viewport.
	 */
	fitBounds(bounds: WorldBounds, padding = 48): void {
		this.assertUsable();
		this.validateBounds(bounds);

		const safePadding = Math.max(0, padding);

		const availableWidth = Math.max(MIN_VIEWPORT_SIZE, this.viewport.width - safePadding * 2);

		const availableHeight = Math.max(MIN_VIEWPORT_SIZE, this.viewport.height - safePadding * 2);

		const widthZoom = availableWidth / bounds.width;

		const heightZoom = availableHeight / bounds.height;

		this.state.zoom = clampWorldValue(
			Math.min(widthZoom, heightZoom),
			this.options.minZoom,
			this.options.maxZoom
		);

		this.state.position = {
			x: bounds.x + bounds.width / 2,

			y: bounds.y + bounds.height / 2
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Restore the initial zoom and center.
	 */
	reset(
		position: WorldPoint = {
			x: 0,
			y: 0
		}
	): void {
		this.assertUsable();
		this.validatePoint(position);

		this.state = {
			position: {
				...position
			},

			zoom: clampWorldValue(this.options.initialZoom, this.options.minZoom, this.options.maxZoom)
		};

		this.clampPosition();
		this.applyTransform();
	}

	/**
	 * Convert a viewport coordinate to a world coordinate.
	 */
	screenToWorld(screen: WorldPoint): WorldPoint {
		this.validatePoint(screen);

		return {
			x: this.state.position.x + (screen.x - this.viewport.width / 2) / this.state.zoom,

			y: this.state.position.y + (screen.y - this.viewport.height / 2) / this.state.zoom
		};
	}

	/**
	 * Convert a world coordinate to a viewport coordinate.
	 */
	worldToScreen(world: WorldPoint): WorldPoint {
		this.validatePoint(world);

		return {
			x: this.viewport.width / 2 + (world.x - this.state.position.x) * this.state.zoom,

			y: this.viewport.height / 2 + (world.y - this.state.position.y) * this.state.zoom
		};
	}

	/**
	 * Return an immutable copy of the camera state.
	 */
	getState(): WorldCameraState {
		return {
			position: {
				...this.state.position
			},

			zoom: this.state.zoom
		};
	}

	/**
	 * Return an immutable copy of the viewport.
	 */
	getViewport(): WorldViewport {
		return {
			...this.viewport
		};
	}

	/**
	 * Replace the state-change listener.
	 */
	setChangeListener(listener?: (state: WorldCameraState) => void): void {
		this.onChange = listener;
	}

	/**
	 * Return whether a pointer drag is currently active.
	 */
	get isDragging(): boolean {
		return this.dragging && this.dragStarted;
	}

	/**
	 * Permanently release camera resources.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}

		this.detach();

		this.onChange = undefined;
		this.destroyed = true;
	}

	private viewportCenter(): WorldPoint {
		return {
			x: this.viewport.width / 2,
			y: this.viewport.height / 2
		};
	}

	private clampPosition(): void {
		const bounds = this.options.bounds;

		if (!bounds) {
			return;
		}

		const visibleWidth = this.viewport.width / this.state.zoom;

		const visibleHeight = this.viewport.height / this.state.zoom;

		this.state.position = {
			x: this.clampAxis(this.state.position.x, bounds.x, bounds.width, visibleWidth),

			y: this.clampAxis(this.state.position.y, bounds.y, bounds.height, visibleHeight)
		};
	}

	private clampAxis(
		center: number,
		boundsStart: number,
		boundsSize: number,
		visibleSize: number
	): number {
		if (visibleSize >= boundsSize) {
			return boundsStart + boundsSize / 2;
		}

		const minimum = boundsStart + visibleSize / 2;

		const maximum = boundsStart + boundsSize - visibleSize / 2;

		return clampWorldValue(center, minimum, maximum);
	}

	private applyTransform(emit = true): void {
		const zoom = this.state.zoom;

		this.container.scale.set(zoom);

		this.container.position.set(
			this.viewport.width / 2 - this.state.position.x * zoom,

			this.viewport.height / 2 - this.state.position.y * zoom
		);

		if (emit) {
			this.emitChange();
		}
	}

	private emitChange(): void {
		this.onChange?.(this.getState());
	}

	private canvasPointFromEvent(event: { clientX: number; clientY: number }): WorldPoint {
		if (!this.surface) {
			return {
				x: 0,
				y: 0
			};
		}

		const bounds = this.surface.getBoundingClientRect();

		const scaleX = bounds.width > 0 ? this.viewport.width / bounds.width : 1;

		const scaleY = bounds.height > 0 ? this.viewport.height / bounds.height : 1;

		return {
			x: (event.clientX - bounds.left) * scaleX,

			y: (event.clientY - bounds.top) * scaleY
		};
	}

	private beginDrag(event: PointerEvent): void {
		if (!this.surface || this.activePointerId !== null) {
			return;
		}

		const point = this.canvasPointFromEvent(event);

		this.dragging = true;
		this.dragStarted = false;
		this.activePointerId = event.pointerId;

		this.pointerStart = point;
		this.pointerPrevious = point;

		try {
			this.surface.setPointerCapture(event.pointerId);
		} catch {
			/*
			 * Pointer capture may fail when the browser has already ended
			 * the pointer sequence.
			 */
		}
	}

	private updateDrag(event: PointerEvent): void {
		if (!this.dragging || event.pointerId !== this.activePointerId) {
			return;
		}

		const point = this.canvasPointFromEvent(event);

		if (!this.dragStarted) {
			const distance = Math.hypot(
				point.x - this.pointerStart.x,

				point.y - this.pointerStart.y
			);

			if (distance < DRAG_THRESHOLD_PX) {
				this.pointerPrevious = point;

				return;
			}

			this.dragStarted = true;
		}

		const offset = {
			x: point.x - this.pointerPrevious.x,

			y: point.y - this.pointerPrevious.y
		};

		this.pointerPrevious = point;

		this.panByScreen(offset);
	}

	private endDrag(): void {
		const surface = this.surface;
		const pointerId = this.activePointerId;

		if (surface && pointerId !== null && surface.hasPointerCapture(pointerId)) {
			try {
				surface.releasePointerCapture(pointerId);
			} catch {
				/*
				 * The browser may release pointer capture before this method
				 * is reached.
				 */
			}
		}

		this.dragging = false;
		this.dragStarted = false;
		this.activePointerId = null;
	}

	private readonly handlePointerDown = (event: PointerEvent): void => {
		if (this.destroyed || event.button !== 0) {
			return;
		}

		this.beginDrag(event);
	};

	private readonly handlePointerMove = (event: PointerEvent): void => {
		if (this.destroyed) {
			return;
		}

		this.updateDrag(event);
	};

	private readonly handlePointerUp = (event: PointerEvent): void => {
		if (event.pointerId !== this.activePointerId) {
			return;
		}

		this.endDrag();
	};

	private readonly handlePointerCaptureLost = (event: PointerEvent): void => {
		if (event.pointerId !== this.activePointerId) {
			return;
		}

		this.dragging = false;
		this.dragStarted = false;
		this.activePointerId = null;
	};

	private readonly handleWheel = (event: WheelEvent): void => {
		if (this.destroyed) {
			return;
		}

		event.preventDefault();

		const anchor = this.canvasPointFromEvent(event);

		const factor = Math.exp(-event.deltaY * this.options.wheelZoomSpeed);

		this.zoomBy(factor, anchor);
	};

	private validateOptions(options: WorldCameraOptions): void {
		if (
			!Number.isFinite(options.minZoom) ||
			!Number.isFinite(options.maxZoom) ||
			options.minZoom <= 0 ||
			options.maxZoom < options.minZoom
		) {
			throw new Error('The camera zoom range is invalid.');
		}

		if (!Number.isFinite(options.initialZoom) || options.initialZoom <= 0) {
			throw new Error('The initial camera zoom must be greater than zero.');
		}

		if (!Number.isFinite(options.wheelZoomSpeed) || options.wheelZoomSpeed <= 0) {
			throw new Error('The wheel zoom speed must be greater than zero.');
		}

		if (!Number.isFinite(options.dragSpeed) || options.dragSpeed <= 0) {
			throw new Error('The camera drag speed must be greater than zero.');
		}

		if (options.bounds) {
			this.validateBounds(options.bounds);
		}
	}

	private validateBounds(bounds: WorldBounds): void {
		if (
			!Number.isFinite(bounds.x) ||
			!Number.isFinite(bounds.y) ||
			!Number.isFinite(bounds.width) ||
			!Number.isFinite(bounds.height) ||
			bounds.width <= 0 ||
			bounds.height <= 0
		) {
			throw new Error('The camera bounds must contain finite coordinates and positive dimensions.');
		}
	}

	private validatePoint(point: WorldPoint): void {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			throw new Error('The world point must contain finite coordinates.');
		}
	}

	private assertUsable(): void {
		if (this.destroyed) {
			throw new Error('The world camera has already been destroyed.');
		}
	}
}
