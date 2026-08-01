import { Application, Container } from 'pixi.js';

import type { Ticker } from 'pixi.js';

import type { WorldPlace } from '$lib/api/contracts/world';

import { WorldCamera } from '$lib/world/camera/WorldCamera';

import { WorldScene, type WorldSceneIdentity } from '$lib/world/scenes/WorldScene';

import {
	DEFAULT_WORLD_BACKGROUND,
	DEFAULT_WORLD_CAMERA,
	type WorldCameraState,
	type WorldPoint,
	type WorldRendererEvents,
	type WorldRendererOptions,
	type WorldRendererSnapshot,
	type WorldRendererStatus,
	type WorldSceneModel,
	type WorldViewport
} from '$lib/world/types';

export interface WorldRendererConfiguration extends WorldRendererOptions {
	events?: WorldRendererEvents;
	identity?: WorldSceneIdentity;

	fitOnInitialize?: boolean;
	fitOnRegionChange?: boolean;
	fitPadding?: number;
	focusZoom?: number;

	showGrid?: boolean;
	showPlaceLabels?: boolean;
	naturalObjectDensity?: number;

	pauseWhenHidden?: boolean;

	canvasAriaLabel?: string;
}

export interface WorldRendererUpdateOptions {
	identity?: WorldSceneIdentity;

	/**
	 * Immediately move the citizen to the supplied backend position.
	 *
	 * This should be true when changing regions and false for normal movement
	 * inside the same region.
	 */
	teleportCitizen?: boolean;

	/**
	 * Fit the complete scene inside the viewport after updating.
	 */
	fitScene?: boolean;

	/**
	 * Focus the camera on the citizen after updating.
	 */
	focusCitizen?: boolean;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

const DEFAULT_FIT_PADDING = 72;
const DEFAULT_FOCUS_ZOOM = 1.25;

const MINIMUM_RENDERER_SIZE = 1;
const MAXIMUM_RESOLUTION = 2;

const DEFAULT_VIEWPORT: Readonly<WorldViewport> = Object.freeze({
	width: DEFAULT_WIDTH,
	height: DEFAULT_HEIGHT,
	devicePixelRatio: 1
});

const DEFAULT_CAMERA_STATE: Readonly<WorldCameraState> = Object.freeze({
	position: Object.freeze({
		x: 0,
		y: 0
	}),
	zoom: DEFAULT_WORLD_CAMERA.initialZoom
});

/**
 * Connects PixiJS Application, WorldScene and WorldCamera.
 *
 * One renderer instance belongs to one mounted WorldCanvas component.
 */
export class WorldRenderer {
	private readonly configuration: Required<
		Pick<
			WorldRendererConfiguration,
			| 'fitOnInitialize'
			| 'fitOnRegionChange'
			| 'fitPadding'
			| 'focusZoom'
			| 'showGrid'
			| 'showPlaceLabels'
			| 'naturalObjectDensity'
			| 'pauseWhenHidden'
			| 'canvasAriaLabel'
		>
	> &
		WorldRendererOptions;

	private callbacks: WorldRendererEvents;
	private identity: WorldSceneIdentity;

	private applicationValue: Application | null = null;

	private cameraRoot: Container | null = null;

	private cameraValue: WorldCamera | null = null;

	private sceneValue: WorldScene | null = null;

	private hostValue: HTMLElement | null = null;

	private canvasValue: HTMLCanvasElement | null = null;

	private resizeObserver: ResizeObserver | null = null;

	private resizeFrame: number | null = null;

	private rendererStatus: WorldRendererStatus = 'idle';

	private rendererError: Error | null = null;

	private applicationInitialized = false;
	private manuallyPaused = false;

	private lifecycleVersion = 0;

	private initializationPromise: Promise<void> | null = null;

	constructor(configuration: WorldRendererConfiguration = {}) {
		this.configuration = {
			width: configuration.width,
			height: configuration.height,

			resolution: configuration.resolution,

			autoDensity: configuration.autoDensity,

			antialias: configuration.antialias,

			camera: configuration.camera,

			background: {
				...DEFAULT_WORLD_BACKGROUND,
				...configuration.background
			},

			fitOnInitialize: configuration.fitOnInitialize ?? true,

			fitOnRegionChange: configuration.fitOnRegionChange ?? true,

			fitPadding: this.normalizeNonNegativeNumber(
				configuration.fitPadding ?? DEFAULT_FIT_PADDING,
				'fit padding'
			),

			focusZoom: this.normalizePositiveNumber(
				configuration.focusZoom ?? DEFAULT_FOCUS_ZOOM,
				'focus zoom'
			),

			showGrid: configuration.showGrid ?? true,

			showPlaceLabels: configuration.showPlaceLabels ?? true,

			naturalObjectDensity: this.normalizeDensity(configuration.naturalObjectDensity ?? 0.55),

			pauseWhenHidden: configuration.pauseWhenHidden ?? true,

			canvasAriaLabel: configuration.canvasAriaLabel ?? 'Orelunza interactive world'
		};

		this.callbacks = {
			...configuration.events
		};

		this.identity = {
			...configuration.identity
		};
	}

	/**
	 * Current renderer lifecycle state.
	 */
	get status(): WorldRendererStatus {
		return this.rendererStatus;
	}

	/**
	 * Last fatal renderer error.
	 */
	get error(): Error | null {
		return this.rendererError;
	}

	/**
	 * PixiJS application after successful initialization.
	 */
	get application(): Application | null {
		return this.applicationValue;
	}

	/**
	 * Canvas currently mounted inside the host element.
	 */
	get canvas(): HTMLCanvasElement | null {
		return this.canvasValue;
	}

	/**
	 * Current world scene.
	 */
	get scene(): WorldScene | null {
		return this.sceneValue;
	}

	/**
	 * Current world camera.
	 */
	get camera(): WorldCamera | null {
		return this.cameraValue;
	}

	/**
	 * Return whether initialization completed successfully.
	 */
	get isReady(): boolean {
		return this.rendererStatus === 'ready';
	}

	/**
	 * Initialize PixiJS and mount its canvas inside the supplied element.
	 */
	async initialize(
		host: HTMLElement,
		model: WorldSceneModel,
		identity: WorldSceneIdentity = this.identity
	): Promise<void> {
		if (this.rendererStatus === 'destroyed') {
			throw new Error('The world renderer has already been destroyed.');
		}

		if (this.rendererStatus === 'ready') {
			throw new Error('The world renderer is already initialized.');
		}

		if (this.rendererStatus === 'initializing' && this.initializationPromise) {
			return this.initializationPromise;
		}

		this.validateHost(host);

		this.hostValue = host;
		this.identity = {
			...identity
		};

		this.rendererStatus = 'initializing';

		this.rendererError = null;

		const lifecycleVersion = ++this.lifecycleVersion;

		const initialization = this.performInitialization(host, model, lifecycleVersion);

		this.initializationPromise = initialization;

		try {
			await initialization;
		} finally {
			if (this.initializationPromise === initialization) {
				this.initializationPromise = null;
			}
		}
	}

	/**
	 * Replace the complete scene model.
	 */
	update(model: WorldSceneModel, options: WorldRendererUpdateOptions = {}): void {
		this.assertReady();

		const scene = this.requireScene();

		const camera = this.requireCamera();

		const previousRegionId = scene.regionId;

		if (options.identity) {
			this.identity = {
				...options.identity
			};
		}

		scene.update(model, {
			identity: this.identity,

			teleportCitizen: options.teleportCitizen ?? previousRegionId !== model.region.id
		});

		camera.setBounds(scene.sceneBounds);

		const regionChanged = previousRegionId !== model.region.id;

		if (options.fitScene || (regionChanged && this.configuration.fitOnRegionChange)) {
			this.fitScene();
			return;
		}

		if (options.focusCitizen) {
			this.focusCitizen();
		}
	}

	/**
	 * Replace renderer callbacks.
	 */
	setEvents(events: WorldRendererEvents): void {
		this.assertNotDestroyed();

		this.callbacks = {
			...events
		};

		this.sceneValue?.setCallbacks(this.createSceneCallbacks());
	}

	/**
	 * Replace the displayed citizen identity.
	 */
	setIdentity(identity: WorldSceneIdentity): void {
		this.assertNotDestroyed();

		this.identity = {
			...identity
		};

		this.sceneValue?.setIdentity(this.identity);
	}

	/**
	 * Mark one place as selected.
	 */
	selectPlace(placeId: string | null): void {
		this.assertReady();

		if (placeId !== null && !placeId.trim()) {
			throw new Error('The selected place identifier cannot be empty.');
		}

		this.requireScene().setSelectedPlace(placeId);
	}

	/**
	 * Mark one place as the citizen's current location.
	 */
	setCurrentPlace(placeId: string | null): void {
		this.assertReady();

		if (placeId !== null && !placeId.trim()) {
			throw new Error('The current place identifier cannot be empty.');
		}

		this.requireScene().setCurrentPlace(placeId);
	}

	/**
	 * Focus the camera on a place marker.
	 */
	focusPlace(placeId: string, zoom = this.configuration.focusZoom): boolean {
		this.assertReady();

		const normalizedPlaceId = placeId.trim();

		if (!normalizedPlaceId) {
			throw new Error('The place identifier is required.');
		}

		const position = this.requireScene().getPlacePosition(normalizedPlaceId);

		if (!position) {
			return false;
		}

		this.requireCamera().centerOn(position, zoom);

		return true;
	}

	/**
	 * Focus the camera on the authenticated citizen.
	 */
	focusCitizen(zoom = this.configuration.focusZoom): boolean {
		this.assertReady();

		const citizen = this.requireScene().citizen;

		if (!citizen) {
			return false;
		}

		this.requireCamera().centerOn(citizen.renderedPosition, zoom);

		return true;
	}

	/**
	 * Fit the complete scene inside the viewport.
	 */
	fitScene(padding = this.configuration.fitPadding): void {
		this.assertReady();

		this.requireCamera().fitBounds(
			this.requireScene().sceneBounds,

			this.normalizeNonNegativeNumber(padding, 'fit padding')
		);
	}

	/**
	 * Center the camera on an arbitrary world coordinate.
	 */
	focusPoint(point: WorldPoint, zoom?: number): void {
		this.assertReady();

		this.requireCamera().centerOn(point, zoom);
	}

	/**
	 * Restore the preferred scene focus.
	 */
	resetCamera(): void {
		this.assertReady();

		const scene = this.requireScene();

		this.requireCamera().centerOn(scene.getInitialFocusPoint(), DEFAULT_WORLD_CAMERA.initialZoom);
	}

	/**
	 * Convert a canvas coordinate into a world coordinate.
	 */
	screenToWorld(point: WorldPoint): WorldPoint {
		this.assertReady();

		return this.requireCamera().screenToWorld(point);
	}

	/**
	 * Convert a world coordinate into a canvas coordinate.
	 */
	worldToScreen(point: WorldPoint): WorldPoint {
		this.assertReady();

		return this.requireCamera().worldToScreen(point);
	}

	/**
	 * Show or hide the world grid.
	 */
	setGridVisible(visible: boolean): void {
		this.assertReady();

		this.requireScene().setGridVisible(visible);
	}

	/**
	 * Show or hide place labels.
	 */
	setPlaceLabelsVisible(visible: boolean): void {
		this.assertReady();

		this.requireScene().setPlaceLabelsVisible(visible);
	}

	/**
	 * Change procedural nature density.
	 */
	setNaturalObjectDensity(density: number): void {
		this.assertReady();

		this.requireScene().setNaturalObjectDensity(this.normalizeDensity(density));
	}

	/**
	 * Resize the PixiJS renderer.
	 *
	 * Omitting dimensions reads the current host element size.
	 */
	resize(width?: number, height?: number): void {
		this.assertReady();

		this.resizeRenderer(width, height);
	}

	/**
	 * Pause animation and rendering.
	 */
	pause(): void {
		this.assertReady();

		this.manuallyPaused = true;
		this.requireApplication().stop();
	}

	/**
	 * Resume animation and rendering.
	 */
	resume(): void {
		this.assertReady();

		this.manuallyPaused = false;

		if (this.configuration.pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
			return;
		}

		this.requireApplication().start();
	}

	/**
	 * Return a serializable snapshot of the renderer.
	 */
	getSnapshot(): WorldRendererSnapshot {
		const scene = this.sceneValue;

		const camera = this.cameraValue;

		const model = scene?.model;

		return {
			status: this.rendererStatus,

			camera: camera?.getState() ?? {
				position: {
					...DEFAULT_CAMERA_STATE.position
				},

				zoom: DEFAULT_CAMERA_STATE.zoom
			},

			viewport: camera?.getViewport() ?? {
				...DEFAULT_VIEWPORT
			},

			regionId: model?.region.id ?? null,

			selectedPlaceId: model?.selectedPlaceId ?? null,

			currentPlaceId: model?.currentPlaceId ?? model?.position?.place_id ?? null
		};
	}

	/**
	 * Permanently release the renderer and its GPU resources.
	 */
	destroy(): void {
		if (this.rendererStatus === 'destroyed') {
			return;
		}

		++this.lifecycleVersion;

		this.rendererStatus = 'destroyed';

		this.rendererError = null;
		this.initializationPromise = null;

		this.cancelScheduledResize();
		this.disconnectResizeHandling();
		this.disconnectVisibilityHandling();

		if (this.applicationInitialized) {
			this.releaseApplication();
		} else {
			/*
			 * Application.init() may still be pending. performInitialization()
			 * will detect the changed lifecycle version and destroy it once
			 * asynchronous initialization finishes.
			 */
			this.hostValue?.replaceChildren();
		}

		this.hostValue = null;
	}

	private async performInitialization(
		host: HTMLElement,
		model: WorldSceneModel,
		lifecycleVersion: number
	): Promise<void> {
		const application = new Application();

		this.applicationValue = application;

		try {
			const initialSize = this.resolveRendererSize(host);

			const resolution = this.resolveResolution();

			await application.init({
				width: initialSize.width,
				height: initialSize.height,

				backgroundColor:
					this.configuration.background?.background ?? DEFAULT_WORLD_BACKGROUND.background,

				backgroundAlpha: 1,

				antialias: this.configuration.antialias ?? true,

				autoDensity: this.configuration.autoDensity ?? true,

				resolution,

				autoStart: true,
				sharedTicker: false
			});

			this.applicationInitialized = true;

			if (lifecycleVersion !== this.lifecycleVersion || this.rendererStatus === 'destroyed') {
				application.destroy(
					{
						removeView: true
					},
					{
						children: true
					}
				);

				this.applicationInitialized = false;

				if (this.applicationValue === application) {
					this.applicationValue = null;
				}

				return;
			}

			const canvas = this.resolveCanvas(application);

			this.canvasValue = canvas;

			this.configureCanvas(canvas);

			host.replaceChildren(canvas);

			const cameraRoot = new Container();

			cameraRoot.label = 'world-camera-root';

			cameraRoot.sortableChildren = true;

			this.cameraRoot = cameraRoot;

			application.stage.label = 'orelunza-stage';

			application.stage.sortableChildren = true;

			application.stage.addChild(cameraRoot);

			const scene = new WorldScene(model, {
				identity: this.identity,

				events: this.createSceneCallbacks(),

				background: this.configuration.background,

				showGrid: this.configuration.showGrid,

				showPlaceLabels: this.configuration.showPlaceLabels,

				naturalObjectDensity: this.configuration.naturalObjectDensity
			});

			this.sceneValue = scene;

			cameraRoot.addChild(scene);

			const camera = new WorldCamera(cameraRoot, {
				...this.configuration.camera,

				bounds: scene.sceneBounds
			});

			this.cameraValue = camera;

			camera.attach(canvas);

			this.resizeRenderer(initialSize.width, initialSize.height);

			application.ticker.add(this.handleTick);

			this.connectResizeHandling();
			this.connectVisibilityHandling();

			if (this.configuration.fitOnInitialize) {
				camera.fitBounds(scene.sceneBounds, this.configuration.fitPadding);
			} else {
				camera.centerOn(scene.getInitialFocusPoint(), this.configuration.focusZoom);
			}

			this.rendererStatus = 'ready';
			this.rendererError = null;

			this.callbacks.onReady?.();
		} catch (error) {
			const normalizedError = this.normalizeError(error);

			if (lifecycleVersion !== this.lifecycleVersion || this.rendererStatus === 'destroyed') {
				if (this.applicationInitialized) {
					try {
						application.destroy(
							{
								removeView: true
							},
							{
								children: true
							}
						);
					} catch {
						/*
						 * The renderer is already being discarded.
						 */
					}
				}

				return;
			}

			this.rendererStatus = 'error';
			this.rendererError = normalizedError;

			this.cancelScheduledResize();
			this.disconnectResizeHandling();
			this.disconnectVisibilityHandling();

			if (this.applicationInitialized) {
				this.releaseApplication();
			} else {
				this.applicationValue = null;

				this.hostValue?.replaceChildren();
			}

			this.callbacks.onError?.(normalizedError);

			throw normalizedError;
		}
	}

	private createSceneCallbacks(): WorldRendererEvents {
		return {
			onPlaceSelect: this.handlePlaceSelect,

			onPlaceActivate: this.handlePlaceActivate,

			onBackgroundPointer: (event) => {
				this.callbacks.onBackgroundPointer?.(event);
			}
		};
	}

	private readonly handlePlaceSelect = (place: WorldPlace): void => {
		this.callbacks.onPlaceSelect?.(place);
	};

	private readonly handlePlaceActivate = (place: WorldPlace): void => {
		this.callbacks.onPlaceActivate?.(place);
	};

	private readonly handleTick = (ticker: Ticker): void => {
		if (this.rendererStatus !== 'ready') {
			return;
		}

		try {
			this.sceneValue?.advance(ticker.deltaMS);
		} catch (error) {
			const normalizedError = this.normalizeError(error);

			this.rendererError = normalizedError;

			this.applicationValue?.stop();

			this.callbacks.onError?.(normalizedError);
		}
	};

	private connectResizeHandling(): void {
		const host = this.hostValue;

		if (!host) {
			return;
		}

		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => {
				this.scheduleResize();
			});

			this.resizeObserver.observe(host);

			return;
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', this.handleWindowResize);
		}
	}

	private disconnectResizeHandling(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;

		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', this.handleWindowResize);
		}
	}

	private connectVisibilityHandling(): void {
		if (!this.configuration.pauseWhenHidden || typeof document === 'undefined') {
			return;
		}

		document.addEventListener('visibilitychange', this.handleVisibilityChange);

		this.handleVisibilityChange();
	}

	private disconnectVisibilityHandling(): void {
		if (typeof document === 'undefined') {
			return;
		}

		document.removeEventListener('visibilitychange', this.handleVisibilityChange);
	}

	private readonly handleWindowResize = (): void => {
		this.scheduleResize();
	};

	private readonly handleVisibilityChange = (): void => {
		const application = this.applicationValue;

		if (!application || !this.applicationInitialized) {
			return;
		}

		if (document.hidden) {
			application.stop();
			return;
		}

		if (!this.manuallyPaused) {
			application.start();
		}
	};

	private scheduleResize(): void {
		if (this.resizeFrame !== null || this.rendererStatus !== 'ready') {
			return;
		}

		if (typeof requestAnimationFrame === 'undefined') {
			this.resizeRenderer();
			return;
		}

		this.resizeFrame = requestAnimationFrame(() => {
			this.resizeFrame = null;

			if (this.rendererStatus === 'ready') {
				this.resizeRenderer();
			}
		});
	}

	private cancelScheduledResize(): void {
		if (this.resizeFrame === null) {
			return;
		}

		if (typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.resizeFrame);
		}

		this.resizeFrame = null;
	}

	private resizeRenderer(requestedWidth?: number, requestedHeight?: number): void {
		const application = this.requireApplication();

		const camera = this.requireCamera();

		const host = this.requireHost();

		const hostSize = this.resolveRendererSize(host);

		const width =
			requestedWidth === undefined
				? hostSize.width
				: this.normalizeRendererSize(requestedWidth, 'width');

		const height =
			requestedHeight === undefined
				? hostSize.height
				: this.normalizeRendererSize(requestedHeight, 'height');

		application.renderer.resize(width, height);

		camera.setViewport(width, height, this.resolveResolution());
	}

	private resolveRendererSize(host: HTMLElement): {
		width: number;
		height: number;
	} {
		const bounds = host.getBoundingClientRect();

		const measuredWidth = bounds.width || host.clientWidth;

		const measuredHeight = bounds.height || host.clientHeight;

		const width = this.configuration.width ?? (measuredWidth > 0 ? measuredWidth : DEFAULT_WIDTH);

		const height =
			this.configuration.height ?? (measuredHeight > 0 ? measuredHeight : DEFAULT_HEIGHT);

		return {
			width: this.normalizeRendererSize(width, 'width'),

			height: this.normalizeRendererSize(height, 'height')
		};
	}

	private resolveResolution(): number {
		const configured = this.configuration.resolution;

		if (configured !== undefined) {
			return this.normalizePositiveNumber(configured, 'resolution');
		}

		const deviceResolution = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

		return Math.min(MAXIMUM_RESOLUTION, Math.max(1, deviceResolution || 1));
	}

	private resolveCanvas(application: Application): HTMLCanvasElement {
		const canvas = application.canvas;

		if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) {
			throw new Error('PixiJS did not create a browser HTML canvas.');
		}

		return canvas;
	}

	private configureCanvas(canvas: HTMLCanvasElement): void {
		canvas.style.display = 'block';
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		canvas.style.touchAction = 'none';

		canvas.tabIndex = 0;

		canvas.setAttribute('role', 'application');

		canvas.setAttribute('aria-label', this.configuration.canvasAriaLabel);
	}

	private releaseApplication(): void {
		const application = this.applicationValue;

		if (!application) {
			return;
		}

		this.cancelScheduledResize();

		application.ticker.remove(this.handleTick);

		this.cameraValue?.destroy();

		this.cameraValue = null;

		if (this.sceneValue) {
			if (this.sceneValue.parent) {
				this.sceneValue.parent.removeChild(this.sceneValue);
			}

			this.sceneValue.dispose();
			this.sceneValue = null;
		}

		if (this.cameraRoot) {
			if (this.cameraRoot.parent) {
				this.cameraRoot.parent.removeChild(this.cameraRoot);
			}

			this.cameraRoot.destroy({
				children: true
			});

			this.cameraRoot = null;
		}

		try {
			application.destroy(
				{
					removeView: true
				},
				{
					children: true
				}
			);
		} finally {
			this.canvasValue = null;
			this.applicationValue = null;
			this.applicationInitialized = false;

			this.hostValue?.replaceChildren();
		}
	}

	private requireApplication(): Application {
		const application = this.applicationValue;

		if (!application || !this.applicationInitialized) {
			throw new Error('The PixiJS application is not initialized.');
		}

		return application;
	}

	private requireScene(): WorldScene {
		const scene = this.sceneValue;

		if (!scene) {
			throw new Error('The world scene is not initialized.');
		}

		return scene;
	}

	private requireCamera(): WorldCamera {
		const camera = this.cameraValue;

		if (!camera) {
			throw new Error('The world camera is not initialized.');
		}

		return camera;
	}

	private requireHost(): HTMLElement {
		const host = this.hostValue;

		if (!host) {
			throw new Error('The world renderer host is unavailable.');
		}

		return host;
	}

	private normalizeRendererSize(value: number, name: string): number {
		const normalized = this.normalizePositiveNumber(value, `renderer ${name}`);

		return Math.max(MINIMUM_RENDERER_SIZE, Math.round(normalized));
	}

	private normalizePositiveNumber(value: number, name: string): number {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`The ${name} must be a positive finite number.`);
		}

		return value;
	}

	private normalizeNonNegativeNumber(value: number, name: string): number {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`The ${name} must be a non-negative finite number.`);
		}

		return value;
	}

	private normalizeDensity(value: number): number {
		if (!Number.isFinite(value)) {
			throw new Error('The natural object density must be finite.');
		}

		return Math.min(1, Math.max(0, value));
	}

	private normalizeError(error: unknown): Error {
		if (error instanceof Error) {
			return error;
		}

		return new Error('An unknown world renderer error occurred.', {
			cause: error
		});
	}

	private validateHost(host: HTMLElement): void {
		if (typeof HTMLElement === 'undefined' || !(host instanceof HTMLElement)) {
			throw new Error('WorldRenderer requires an HTML element as its host.');
		}
	}

	private assertReady(): void {
		if (this.rendererStatus !== 'ready') {
			throw new Error(`The world renderer is not ready. Current status: ${this.rendererStatus}.`);
		}
	}

	private assertNotDestroyed(): void {
		if (this.rendererStatus === 'destroyed') {
			throw new Error('The world renderer has already been destroyed.');
		}
	}
}
