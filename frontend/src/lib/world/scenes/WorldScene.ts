import { Container, Graphics, Rectangle, Text } from 'pixi.js';

import type { FederatedPointerEvent } from 'pixi.js';

import type { WorldPlace } from '$lib/api/contracts/world';

import { getWorldAsset } from '$lib/world/assets/assetManifest';

import { CitizenSprite } from '$lib/world/entities/CitizenSprite';

import { PlaceMarker } from '$lib/world/entities/PlaceMarker';

import {
	createCitizenModel,
	createPlaceMarkerModel,
	DEFAULT_WORLD_BACKGROUND,
	distanceBetweenPoints,
	type WorldBackgroundStyle,
	type WorldBounds,
	type WorldPoint,
	type WorldRendererEvents,
	type WorldSceneModel
} from '$lib/world/types';

export interface WorldSceneIdentity {
	displayName?: string;
	avatar?: string;
}

export interface WorldSceneOptions {
	identity?: WorldSceneIdentity;
	events?: WorldRendererEvents;

	background?: Partial<WorldBackgroundStyle>;

	padding?: number;
	minimumWidth?: number;
	minimumHeight?: number;

	gridSize?: number;
	showGrid?: boolean;
	showPlaceLabels?: boolean;

	naturalObjectDensity?: number;
}

type NaturalObjectType = 'tree' | 'rock' | 'flower';

interface NaturalObjectPlacement {
	type: NaturalObjectType;
	position: WorldPoint;
	scale: number;
	rotation: number;
}

const DEFAULT_SCENE_PADDING = 220;
const DEFAULT_MINIMUM_WIDTH = 1_200;
const DEFAULT_MINIMUM_HEIGHT = 800;
const DEFAULT_GRID_SIZE = 80;
const DEFAULT_NATURAL_OBJECT_DENSITY = 0.55;

const MINIMUM_PLACE_CLEARANCE = 72;
const MINIMUM_CITIZEN_CLEARANCE = 62;
const MAX_NATURAL_OBJECTS = 72;

const COLORS = Object.freeze({
	grid: 0x294236,
	gridMajor: 0x3c5949,

	forestGround: 0x172b20,
	grassGround: 0x244332,
	mountainGround: 0x303b36,
	desertGround: 0x574d31,
	waterGround: 0x284842,

	river: 0x3d756c,
	riverHighlight: 0x73a99d,

	treeTrunk: 0x4b382a,
	treeDark: 0x1b3926,
	treeLight: 0x315f43,

	rockDark: 0x3f4d46,
	rockLight: 0x68776f,

	flowerStem: 0x315f43,
	flowerPetal: 0xe5c07b,
	flowerCenter: 0xf1f6f3,

	labelBackground: 0x101b16,
	labelBorder: 0x3c5949,
	labelText: 0xf1f6f3,

	shadow: 0x000000
});

/**
 * Complete visual representation of one Orelunza region.
 *
 * The scene owns its background, procedural nature, place markers and the
 * authenticated citizen. Camera transforms are applied to this container by
 * WorldCamera.
 */
export class WorldScene extends Container {
	private sceneModel: WorldSceneModel;
	private identity: WorldSceneIdentity;
	private callbacks: WorldRendererEvents;

	private readonly backgroundStyle: WorldBackgroundStyle;

	private readonly scenePadding: number;
	private readonly minimumWidth: number;
	private readonly minimumHeight: number;
	private readonly gridSize: number;

	private showGrid: boolean;
	private showPlaceLabels: boolean;
	private naturalObjectDensity: number;

	private worldBoundsValue: WorldBounds;

	private readonly terrainLayer = new Container();

	private readonly naturalLayer = new Container();

	private readonly placeLayer = new Container();

	private readonly citizenLayer = new Container();

	private readonly overlayLayer = new Container();

	private readonly backgroundGraphic = new Graphics();

	private readonly gridGraphic = new Graphics();

	private readonly riverGraphic = new Graphics();

	private readonly backgroundInteraction = new Graphics();

	private readonly regionLabelContainer = new Container();

	private readonly regionLabelBackground = new Graphics();

	private readonly regionLabelText = new Text({
		text: '',

		style: {
			fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',

			fontSize: 18,
			fontWeight: '600',
			fill: COLORS.labelText,

			dropShadow: {
				color: COLORS.shadow,
				alpha: 0.4,
				blur: 4,
				distance: 2,
				angle: Math.PI / 2
			}
		}
	});

	private readonly placeMarkers = new Map<string, PlaceMarker>();

	private citizenSprite: CitizenSprite | null = null;

	private disposed = false;

	constructor(model: WorldSceneModel, options: WorldSceneOptions = {}) {
		super();

		this.validateModel(model);

		this.sceneModel = this.copyModel(model);

		this.identity = {
			displayName: options.identity?.displayName,
			avatar: options.identity?.avatar
		};

		this.callbacks = {
			...options.events
		};

		this.backgroundStyle = {
			...DEFAULT_WORLD_BACKGROUND,
			...options.background
		};

		this.scenePadding = this.normalizePositiveNumber(
			options.padding ?? DEFAULT_SCENE_PADDING,
			'scene padding',
			true
		);

		this.minimumWidth = this.normalizePositiveNumber(
			options.minimumWidth ?? DEFAULT_MINIMUM_WIDTH,
			'minimum scene width'
		);

		this.minimumHeight = this.normalizePositiveNumber(
			options.minimumHeight ?? DEFAULT_MINIMUM_HEIGHT,
			'minimum scene height'
		);

		this.gridSize = this.normalizePositiveNumber(
			options.gridSize ?? DEFAULT_GRID_SIZE,
			'grid size'
		);

		this.showGrid = options.showGrid ?? true;

		this.showPlaceLabels = options.showPlaceLabels ?? true;

		this.naturalObjectDensity = this.normalizeDensity(
			options.naturalObjectDensity ?? DEFAULT_NATURAL_OBJECT_DENSITY
		);

		this.worldBoundsValue = this.calculateWorldBounds(this.sceneModel);

		this.label = `world-scene:${model.region.id}`;

		this.sortableChildren = true;

		this.configureLayers();
		this.configureBackgroundInteraction();

		this.regionLabelContainer.addChild(this.regionLabelBackground, this.regionLabelText);

		this.overlayLayer.addChild(this.regionLabelContainer);

		this.addChild(
			this.terrainLayer,
			this.naturalLayer,
			this.placeLayer,
			this.citizenLayer,
			this.overlayLayer
		);

		this.rebuild();
	}

	/**
	 * Return an immutable copy of the current world data.
	 */
	get model(): WorldSceneModel {
		return this.copyModel(this.sceneModel);
	}

	/**
	 * Return the current region identifier.
	 */
	get regionId(): string {
		return this.sceneModel.region.id;
	}

	/**
	 * Return a copy of the calculated world limits.
	 */
	get sceneBounds(): WorldBounds {
		return {
			...this.worldBoundsValue
		};
	}

	/**
	 * Return the authenticated citizen visual, when a position exists.
	 */
	get citizen(): CitizenSprite | null {
		return this.citizenSprite;
	}

	/**
	 * Return one place marker.
	 */
	getPlaceMarker(placeId: string): PlaceMarker | null {
		return this.placeMarkers.get(placeId) ?? null;
	}

	/**
	 * Return all current place markers.
	 */
	getPlaceMarkers(): readonly PlaceMarker[] {
		return [...this.placeMarkers.values()];
	}

	/**
	 * Replace the complete backend scene model.
	 */
	update(
		model: WorldSceneModel,
		options: {
			identity?: WorldSceneIdentity;
			teleportCitizen?: boolean;
		} = {}
	): void {
		this.assertUsable();
		this.validateModel(model);

		const previousRegionId = this.sceneModel.region.id;

		this.sceneModel = this.copyModel(model);

		if (options.identity) {
			this.identity = {
				...options.identity
			};
		}

		this.label = `world-scene:${model.region.id}`;

		this.worldBoundsValue = this.calculateWorldBounds(this.sceneModel);

		this.drawTerrain();
		this.drawNaturalEnvironment();
		this.updateRegionLabel();
		this.syncPlaceMarkers();

		this.syncCitizen({
			teleport: options.teleportCitizen ?? previousRegionId !== model.region.id
		});

		this.sortChildren();
	}

	/**
	 * Replace renderer event callbacks.
	 */
	setCallbacks(callbacks: WorldRendererEvents): void {
		this.assertUsable();

		this.callbacks = {
			...callbacks
		};

		for (const marker of this.placeMarkers.values()) {
			this.configureMarkerCallbacks(marker);
		}
	}

	/**
	 * Replace the citizen's displayed identity.
	 */
	setIdentity(identity: WorldSceneIdentity): void {
		this.assertUsable();

		this.identity = {
			...identity
		};

		this.syncCitizen({
			teleport: true
		});
	}

	/**
	 * Change the selected place without rebuilding the entire scene.
	 */
	setSelectedPlace(placeId: string | null): void {
		this.assertUsable();

		this.sceneModel = {
			...this.sceneModel,
			selectedPlaceId: placeId
		};

		this.updatePlaceMarkerStates();
	}

	/**
	 * Change the citizen's current place without rebuilding terrain.
	 */
	setCurrentPlace(placeId: string | null): void {
		this.assertUsable();

		this.sceneModel = {
			...this.sceneModel,
			currentPlaceId: placeId
		};

		this.updatePlaceMarkerStates();
	}

	/**
	 * Show or hide all place labels.
	 */
	setPlaceLabelsVisible(visible: boolean): void {
		this.assertUsable();

		this.showPlaceLabels = visible;

		for (const marker of this.placeMarkers.values()) {
			marker.setLabelVisible(visible);
		}
	}

	/**
	 * Show or hide the world grid.
	 */
	setGridVisible(visible: boolean): void {
		this.assertUsable();

		if (this.showGrid === visible) {
			return;
		}

		this.showGrid = visible;
		this.drawGrid();
	}

	/**
	 * Change the amount of generated natural decoration.
	 */
	setNaturalObjectDensity(density: number): void {
		this.assertUsable();

		const normalized = this.normalizeDensity(density);

		if (this.naturalObjectDensity === normalized) {
			return;
		}

		this.naturalObjectDensity = normalized;

		this.drawNaturalEnvironment();
	}

	/**
	 * Return the position of one place.
	 */
	getPlacePosition(placeId: string): WorldPoint | null {
		const place = this.sceneModel.places.find((candidate) => candidate.id === placeId);

		if (!place) {
			return null;
		}

		return {
			x: place.position_x,
			y: place.position_y
		};
	}

	/**
	 * Return the preferred initial focus point.
	 */
	getInitialFocusPoint(): WorldPoint {
		const position = this.sceneModel.position;

		if (position) {
			return {
				x: position.position_x,
				y: position.position_y
			};
		}

		const selectedPlace = this.sceneModel.places.find(
			(place) => place.id === this.sceneModel.selectedPlaceId
		);

		if (selectedPlace) {
			return {
				x: selectedPlace.position_x,

				y: selectedPlace.position_y
			};
		}

		const firstPlace = this.sceneModel.places[0];

		if (firstPlace) {
			return {
				x: firstPlace.position_x,
				y: firstPlace.position_y
			};
		}

		return {
			x: this.worldBoundsValue.x + this.worldBoundsValue.width / 2,

			y: this.worldBoundsValue.y + this.worldBoundsValue.height / 2
		};
	}

	/**
	 * Advance animated citizens.
	 *
	 * Call this from the application ticker with `ticker.deltaMS`.
	 */
	advance(deltaMs: number): void {
		this.assertUsable();

		if (!Number.isFinite(deltaMs) || deltaMs < 0) {
			throw new Error('The world scene delta must be a non-negative finite number.');
		}

		this.citizenSprite?.advance(deltaMs);
	}

	/**
	 * Release all PixiJS resources owned by this scene.
	 */
	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.backgroundInteraction.off('pointertap', this.handleBackgroundPointer);

		this.backgroundInteraction.removeAllListeners();

		for (const marker of this.placeMarkers.values()) {
			this.placeLayer.removeChild(marker);

			marker.dispose();
		}

		this.placeMarkers.clear();

		if (this.citizenSprite) {
			this.citizenLayer.removeChild(this.citizenSprite);

			this.citizenSprite.dispose();
			this.citizenSprite = null;
		}

		this.callbacks = {};
		this.disposed = true;

		this.destroy({
			children: true
		});
	}

	private configureLayers(): void {
		this.terrainLayer.label = 'terrain-layer';

		this.naturalLayer.label = 'natural-layer';

		this.placeLayer.label = 'place-layer';

		this.citizenLayer.label = 'citizen-layer';

		this.overlayLayer.label = 'overlay-layer';

		this.terrainLayer.zIndex = 0;
		this.naturalLayer.zIndex = 10;
		this.placeLayer.zIndex = 20;
		this.citizenLayer.zIndex = 30;
		this.overlayLayer.zIndex = 40;

		this.terrainLayer.sortableChildren = true;

		this.naturalLayer.sortableChildren = true;

		this.placeLayer.sortableChildren = true;

		this.citizenLayer.sortableChildren = true;

		this.overlayLayer.sortableChildren = true;

		this.naturalLayer.eventMode = 'none';

		this.overlayLayer.eventMode = 'none';

		this.terrainLayer.addChild(
			this.backgroundGraphic,
			this.gridGraphic,
			this.riverGraphic,
			this.backgroundInteraction
		);

		this.backgroundGraphic.zIndex = 0;
		this.gridGraphic.zIndex = 1;
		this.riverGraphic.zIndex = 2;
		this.backgroundInteraction.zIndex = 3;
	}

	private configureBackgroundInteraction(): void {
		this.backgroundInteraction.label = 'background-interaction';

		this.backgroundInteraction.eventMode = 'static';

		this.backgroundInteraction.cursor = 'grab';

		this.backgroundInteraction.on('pointertap', this.handleBackgroundPointer);
	}

	private rebuild(): void {
		this.drawTerrain();
		this.drawNaturalEnvironment();
		this.updateRegionLabel();
		this.syncPlaceMarkers();

		this.syncCitizen({
			teleport: true
		});

		this.sortChildren();
	}

	private drawTerrain(): void {
		const bounds = this.worldBoundsValue;

		const terrainColor = this.resolveTerrainColor();

		this.backgroundGraphic.clear();

		this.backgroundGraphic.rect(bounds.x, bounds.y, bounds.width, bounds.height).fill({
			color: this.backgroundStyle.background
		});

		this.backgroundGraphic
			.roundRect(
				bounds.x + 18,
				bounds.y + 18,
				Math.max(1, bounds.width - 36),
				Math.max(1, bounds.height - 36),
				44
			)
			.fill({
				color: terrainColor
			})
			.stroke({
				color: this.backgroundStyle.grid,

				width: 2,
				alpha: 0.7
			});

		this.drawGrid();
		this.drawRiver();
		this.drawInteractionSurface();
	}

	private drawGrid(): void {
		this.gridGraphic.clear();

		if (!this.showGrid) {
			return;
		}

		const bounds = this.worldBoundsValue;

		const startX = Math.floor(bounds.x / this.gridSize) * this.gridSize;

		const endX = bounds.x + bounds.width;

		const startY = Math.floor(bounds.y / this.gridSize) * this.gridSize;

		const endY = bounds.y + bounds.height;

		let lineIndex = 0;

		for (let x = startX; x <= endX; x += this.gridSize) {
			const major = lineIndex % 5 === 0;

			this.gridGraphic
				.moveTo(x, bounds.y)
				.lineTo(x, bounds.y + bounds.height)
				.stroke({
					color: major ? COLORS.gridMajor : COLORS.grid,

					width: major ? 1.25 : 1,
					alpha: major ? 0.22 : 0.1
				});

			lineIndex++;
		}

		lineIndex = 0;

		for (let y = startY; y <= endY; y += this.gridSize) {
			const major = lineIndex % 5 === 0;

			this.gridGraphic
				.moveTo(bounds.x, y)
				.lineTo(bounds.x + bounds.width, y)
				.stroke({
					color: major ? COLORS.gridMajor : COLORS.grid,

					width: major ? 1.25 : 1,
					alpha: major ? 0.22 : 0.1
				});

			lineIndex++;
		}
	}

	private drawRiver(): void {
		this.riverGraphic.clear();

		if (!this.shouldDrawWater()) {
			return;
		}

		const bounds = this.worldBoundsValue;

		const seed = this.hashString(`${this.sceneModel.region.id}:river`);

		const random = this.createRandom(seed);

		const startX = bounds.x - 40;

		const endX = bounds.x + bounds.width + 40;

		const centerY = bounds.y + bounds.height * (0.38 + random() * 0.25);

		const firstControlY = centerY + (random() - 0.5) * bounds.height * 0.32;

		const secondControlY = centerY + (random() - 0.5) * bounds.height * 0.32;

		const endY = centerY + (random() - 0.5) * bounds.height * 0.18;

		const waterLevel = this.normalizeEnvironmentalValue(
			this.sceneModel.environment?.water_level ?? 0.45
		);

		const riverWidth = Math.max(56, 72 + waterLevel * 85);

		this.riverGraphic
			.moveTo(startX, centerY)
			.bezierCurveTo(
				bounds.x + bounds.width * 0.28,
				firstControlY,

				bounds.x + bounds.width * 0.67,
				secondControlY,

				endX,
				endY
			)
			.stroke({
				color: this.backgroundStyle.water || COLORS.river,

				width: riverWidth,
				alpha: 0.72,
				cap: 'round',
				join: 'round'
			});

		this.riverGraphic
			.moveTo(startX, centerY - 5)
			.bezierCurveTo(
				bounds.x + bounds.width * 0.28,
				firstControlY - 5,

				bounds.x + bounds.width * 0.67,
				secondControlY - 5,

				endX,
				endY - 5
			)
			.stroke({
				color: COLORS.riverHighlight,
				width: Math.max(5, riverWidth * 0.08),

				alpha: 0.25,
				cap: 'round'
			});
	}

	private drawInteractionSurface(): void {
		const bounds = this.worldBoundsValue;

		this.backgroundInteraction.clear();

		this.backgroundInteraction.rect(bounds.x, bounds.y, bounds.width, bounds.height).fill({
			color: 0xffffff,
			alpha: 0.001
		});

		this.backgroundInteraction.hitArea = new Rectangle(
			bounds.x,
			bounds.y,
			bounds.width,
			bounds.height
		);
	}

	private drawNaturalEnvironment(): void {
		this.clearContainer(this.naturalLayer);

		if (this.naturalObjectDensity <= 0) {
			return;
		}

		const placements = this.createNaturalObjectPlacements();

		for (const placement of placements) {
			const naturalObject = this.createNaturalObject(placement);

			naturalObject.position.set(placement.position.x, placement.position.y);

			naturalObject.rotation = placement.rotation;

			naturalObject.scale.set(placement.scale);

			naturalObject.zIndex = Math.round(placement.position.y);

			this.naturalLayer.addChild(naturalObject);
		}

		this.naturalLayer.sortChildren();
	}

	private createNaturalObjectPlacements(): NaturalObjectPlacement[] {
		const bounds = this.worldBoundsValue;

		const approximateArea = bounds.width * bounds.height;

		const calculatedCount = Math.round(12 + (approximateArea / 90_000) * this.naturalObjectDensity);

		const count = Math.min(MAX_NATURAL_OBJECTS, Math.max(4, calculatedCount));

		const seed = this.hashString(
			[
				this.sceneModel.region.id,
				this.sceneModel.biome?.id ?? 'no-biome',
				this.sceneModel.naturalArea?.id ?? 'no-area'
			].join(':')
		);

		const random = this.createRandom(seed);

		const placements: NaturalObjectPlacement[] = [];

		for (let index = 0; index < count; index++) {
			const placement = this.findNaturalObjectPlacement(random);

			if (placement) {
				placements.push(placement);
			}
		}

		return placements;
	}

	private findNaturalObjectPlacement(random: () => number): NaturalObjectPlacement | null {
		const bounds = this.worldBoundsValue;

		for (let attempt = 0; attempt < 10; attempt++) {
			const position = {
				x: bounds.x + 48 + random() * Math.max(1, bounds.width - 96),

				y: bounds.y + 64 + random() * Math.max(1, bounds.height - 128)
			};

			if (this.isNaturalPositionBlocked(position)) {
				continue;
			}

			const type = this.chooseNaturalObjectType(random());

			return {
				type,
				position,

				scale: 0.72 + random() * 0.58,

				rotation: (random() - 0.5) * (type === 'tree' ? 0.08 : 0.24)
			};
		}

		return null;
	}

	private chooseNaturalObjectType(value: number): NaturalObjectType {
		const vegetation = this.sceneModel.biome?.vegetation_type.toLowerCase() ?? '';

		if (vegetation.includes('forest') || vegetation.includes('tree')) {
			if (value < 0.72) {
				return 'tree';
			}

			if (value < 0.9) {
				return 'rock';
			}

			return 'flower';
		}

		if (vegetation.includes('grass') || vegetation.includes('meadow')) {
			if (value < 0.38) {
				return 'tree';
			}

			if (value < 0.63) {
				return 'rock';
			}

			return 'flower';
		}

		if (value < 0.42) {
			return 'tree';
		}

		if (value < 0.78) {
			return 'rock';
		}

		return 'flower';
	}

	private isNaturalPositionBlocked(position: WorldPoint): boolean {
		for (const place of this.sceneModel.places) {
			const placePosition = {
				x: place.position_x,
				y: place.position_y
			};

			if (distanceBetweenPoints(position, placePosition) < MINIMUM_PLACE_CLEARANCE) {
				return true;
			}
		}

		const citizen = this.sceneModel.position;

		if (citizen) {
			const citizenPosition = {
				x: citizen.position_x,
				y: citizen.position_y
			};

			if (distanceBetweenPoints(position, citizenPosition) < MINIMUM_CITIZEN_CLEARANCE) {
				return true;
			}
		}

		return false;
	}

	private createNaturalObject(placement: NaturalObjectPlacement): Container {
		switch (placement.type) {
			case 'tree':
				return this.createTree();

			case 'rock':
				return this.createRock();

			case 'flower':
				return this.createFlower();
		}
	}

	private createTree(): Container {
		const tree = new Container();

		tree.label = 'natural:tree';
		tree.eventMode = 'none';

		const fallback = getWorldAsset('object.tree').fallback;

		const shadow = new Graphics();

		shadow.ellipse(0, 1, 24, 8).fill({
			color: COLORS.shadow,
			alpha: 0.22
		});

		const trunk = new Graphics();

		trunk
			.roundRect(-7, -42, 14, 43, 5)
			.fill({
				color: COLORS.treeTrunk
			})
			.stroke({
				color: 0x2c2119,
				width: 1.5
			});

		const crown = new Graphics();

		crown.circle(-14, -54, 21).fill({
			color: COLORS.treeDark
		});

		crown.circle(13, -57, 23).fill({
			color: fallback.color ?? COLORS.treeLight
		});

		crown.circle(0, -78, 24).fill({
			color: COLORS.treeLight
		});

		crown
			.circle(-2, -66, 29)
			.fill({
				color: fallback.color ?? COLORS.treeLight,

				alpha: 0.92
			})
			.stroke({
				color: fallback.borderColor ?? COLORS.treeDark,

				width: fallback.borderWidth ?? 1.5,

				alpha: 0.8
			});

		tree.addChild(shadow, trunk, crown);

		return tree;
	}

	private createRock(): Container {
		const rock = new Container();

		rock.label = 'natural:rock';
		rock.eventMode = 'none';

		const fallback = getWorldAsset('object.rock').fallback;

		const shadow = new Graphics();

		shadow.ellipse(0, 1, 21, 7).fill({
			color: COLORS.shadow,
			alpha: 0.2
		});

		const body = new Graphics();

		body
			.moveTo(-22, 0)
			.lineTo(-16, -17)
			.lineTo(-5, -27)
			.lineTo(14, -23)
			.lineTo(23, -7)
			.lineTo(17, 0)
			.closePath()
			.fill({
				color: fallback.color ?? COLORS.rockLight
			})
			.stroke({
				color: fallback.borderColor ?? COLORS.rockDark,

				width: fallback.borderWidth ?? 2
			});

		body.moveTo(-5, -24).lineTo(9, -19).lineTo(15, -9).stroke({
			color: 0x89958f,
			width: 2,
			alpha: 0.35
		});

		rock.addChild(shadow, body);

		return rock;
	}

	private createFlower(): Container {
		const flower = new Container();

		flower.label = 'natural:flower';
		flower.eventMode = 'none';

		const fallback = getWorldAsset('object.flower').fallback;

		const graphic = new Graphics();

		graphic.moveTo(0, 0).lineTo(0, -21).stroke({
			color: COLORS.flowerStem,
			width: 2,
			cap: 'round'
		});

		graphic.ellipse(-4, -10, 5, 2.5).fill({
			color: COLORS.treeLight
		});

		graphic.circle(0, -27, 5).fill({
			color: fallback.color ?? COLORS.flowerPetal
		});

		graphic.circle(-6, -24, 5).fill({
			color: fallback.color ?? COLORS.flowerPetal,

			alpha: 0.9
		});

		graphic.circle(6, -24, 5).fill({
			color: fallback.color ?? COLORS.flowerPetal,

			alpha: 0.9
		});

		graphic.circle(0, -21, 5).fill({
			color: fallback.color ?? COLORS.flowerPetal,

			alpha: 0.82
		});

		graphic.circle(0, -24, 2.6).fill({
			color: COLORS.flowerCenter
		});

		flower.addChild(graphic);

		return flower;
	}

	private syncPlaceMarkers(): void {
		const expectedPlaceIds = new Set<string>();

		for (const place of this.sceneModel.places) {
			expectedPlaceIds.add(place.id);

			const model = createPlaceMarkerModel(place, {
				selectedPlaceId: this.sceneModel.selectedPlaceId,

				currentPlaceId: this.resolveCurrentPlaceId()
			});

			const existing = this.placeMarkers.get(place.id);

			if (existing) {
				existing.update(model);

				existing.setLabelVisible(this.showPlaceLabels);

				this.configureMarkerCallbacks(existing);

				continue;
			}

			const marker = new PlaceMarker(model, {
				showLabel: this.showPlaceLabels
			});

			this.configureMarkerCallbacks(marker);

			this.placeMarkers.set(place.id, marker);

			this.placeLayer.addChild(marker);
		}

		for (const [placeId, marker] of this.placeMarkers) {
			if (expectedPlaceIds.has(placeId)) {
				continue;
			}

			this.placeLayer.removeChild(marker);

			marker.dispose();

			this.placeMarkers.delete(placeId);
		}

		this.placeLayer.sortChildren();
	}

	private configureMarkerCallbacks(marker: PlaceMarker): void {
		marker.setCallbacks({
			onSelect: this.handlePlaceSelect,

			onActivate: this.handlePlaceActivate
		});
	}

	private updatePlaceMarkerStates(): void {
		const currentPlaceId = this.resolveCurrentPlaceId();

		for (const [placeId, marker] of this.placeMarkers) {
			marker.setSelected(placeId === this.sceneModel.selectedPlaceId);

			marker.setCurrent(placeId === currentPlaceId);
		}

		this.placeLayer.sortChildren();
	}

	private syncCitizen(options: { teleport: boolean }): void {
		const position = this.sceneModel.position;

		if (!position) {
			if (this.citizenSprite) {
				this.citizenLayer.removeChild(this.citizenSprite);

				this.citizenSprite.dispose();
				this.citizenSprite = null;
			}

			return;
		}

		const model = createCitizenModel(position, {
			displayName: this.identity.displayName,

			avatar: this.identity.avatar
		});

		if (this.citizenSprite && this.citizenSprite.humanId === model.humanId) {
			this.citizenSprite.update(model, {
				teleport: options.teleport
			});

			return;
		}

		if (this.citizenSprite) {
			this.citizenLayer.removeChild(this.citizenSprite);

			this.citizenSprite.dispose();
		}

		this.citizenSprite = new CitizenSprite(model, {
			active: true,
			interactive: false,
			showLabel: true
		});

		this.citizenLayer.addChild(this.citizenSprite);
	}

	private updateRegionLabel(): void {
		const bounds = this.worldBoundsValue;

		this.regionLabelText.text = this.sceneModel.region.name;

		this.regionLabelText.anchor.set(0, 0);

		this.regionLabelText.position.set(16, 11);

		const width = this.regionLabelText.width + 32;

		const height = this.regionLabelText.height + 22;

		this.regionLabelBackground.clear();

		this.regionLabelBackground
			.roundRect(0, 0, width, height, 14)
			.fill({
				color: COLORS.labelBackground,

				alpha: 0.84
			})
			.stroke({
				color: COLORS.labelBorder,

				width: 1,
				alpha: 0.85
			});

		this.regionLabelContainer.position.set(bounds.x + 42, bounds.y + 42);

		this.regionLabelContainer.zIndex = 100;
	}

	private calculateWorldBounds(model: WorldSceneModel): WorldBounds {
		const points: WorldPoint[] = [];

		for (const place of model.places) {
			if (Number.isFinite(place.position_x) && Number.isFinite(place.position_y)) {
				points.push({
					x: place.position_x,
					y: place.position_y
				});
			}
		}

		if (
			model.position &&
			Number.isFinite(model.position.position_x) &&
			Number.isFinite(model.position.position_y)
		) {
			points.push({
				x: model.position.position_x,

				y: model.position.position_y
			});
		}

		if (points.length === 0) {
			return {
				x: -this.minimumWidth / 2,
				y: -this.minimumHeight / 2,
				width: this.minimumWidth,
				height: this.minimumHeight
			};
		}

		let minimumX = points[0].x;
		let maximumX = points[0].x;
		let minimumY = points[0].y;
		let maximumY = points[0].y;

		for (const point of points) {
			minimumX = Math.min(minimumX, point.x);

			maximumX = Math.max(maximumX, point.x);

			minimumY = Math.min(minimumY, point.y);

			maximumY = Math.max(maximumY, point.y);
		}

		const centerX = (minimumX + maximumX) / 2;

		const centerY = (minimumY + maximumY) / 2;

		const contentWidth = maximumX - minimumX + this.scenePadding * 2;

		const contentHeight = maximumY - minimumY + this.scenePadding * 2;

		const width = Math.max(this.minimumWidth, contentWidth);

		const height = Math.max(this.minimumHeight, contentHeight);

		return {
			x: centerX - width / 2,
			y: centerY - height / 2,
			width,
			height
		};
	}

	private resolveTerrainColor(): number {
		const terrain = this.sceneModel.biome?.terrain_type.toLowerCase() ?? '';

		if (terrain.includes('forest') || terrain.includes('wood')) {
			return COLORS.forestGround;
		}

		if (terrain.includes('grass') || terrain.includes('meadow') || terrain.includes('plain')) {
			return COLORS.grassGround;
		}

		if (terrain.includes('mountain') || terrain.includes('rock')) {
			return COLORS.mountainGround;
		}

		if (terrain.includes('desert') || terrain.includes('sand')) {
			return COLORS.desertGround;
		}

		if (terrain.includes('water') || terrain.includes('river') || terrain.includes('lake')) {
			return COLORS.waterGround;
		}

		return this.backgroundStyle.ground || COLORS.forestGround;
	}

	private shouldDrawWater(): boolean {
		const terrain = this.sceneModel.biome?.terrain_type.toLowerCase() ?? '';

		if (
			terrain.includes('water') ||
			terrain.includes('river') ||
			terrain.includes('lake') ||
			terrain.includes('wetland')
		) {
			return true;
		}

		const waterLevel = this.normalizeEnvironmentalValue(
			this.sceneModel.environment?.water_level ?? 0
		);

		return waterLevel >= 0.2;
	}

	private resolveCurrentPlaceId(): string | null {
		return this.sceneModel.currentPlaceId ?? this.sceneModel.position?.place_id ?? null;
	}

	private normalizeEnvironmentalValue(value: number): number {
		if (!Number.isFinite(value)) {
			return 0;
		}

		const normalized = value > 1 ? value / 100 : value;

		return Math.min(1, Math.max(0, normalized));
	}

	private normalizeDensity(value: number): number {
		if (!Number.isFinite(value)) {
			throw new Error('The natural object density must be finite.');
		}

		return Math.min(1, Math.max(0, value));
	}

	private normalizePositiveNumber(value: number, name: string, allowZero = false): number {
		const minimum = allowZero ? 0 : Number.EPSILON;

		if (!Number.isFinite(value) || value < minimum) {
			throw new Error(`The ${name} must be ${allowZero ? 'non-negative' : 'greater than zero'}.`);
		}

		return value;
	}

	private hashString(value: string): number {
		let hash = 2166136261;

		for (let index = 0; index < value.length; index++) {
			hash ^= value.charCodeAt(index);

			hash = Math.imul(hash, 16777619);
		}

		return hash >>> 0;
	}

	private createRandom(seed: number): () => number {
		let state = seed >>> 0;

		return () => {
			state += 0x6d2b79f5;

			let value = state;

			value = Math.imul(value ^ (value >>> 15), value | 1);

			value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

			return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
		};
	}

	private clearContainer(container: Container): void {
		const children = container.removeChildren();

		for (const child of children) {
			child.destroy({
				children: true
			});
		}
	}

	private readonly handlePlaceSelect = (place: WorldPlace): void => {
		this.setSelectedPlace(place.id);

		this.callbacks.onPlaceSelect?.(place);
	};

	private readonly handlePlaceActivate = (place: WorldPlace): void => {
		this.setSelectedPlace(place.id);

		this.callbacks.onPlaceActivate?.(place);
	};

	private readonly handleBackgroundPointer = (event: FederatedPointerEvent): void => {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		const local = event.getLocalPosition(this);

		this.callbacks.onBackgroundPointer?.({
			screen: {
				x: event.global.x,
				y: event.global.y
			},

			world: {
				x: local.x,
				y: local.y
			}
		});
	};

	private validateModel(model: WorldSceneModel): void {
		if (!model.region.id.trim()) {
			throw new Error('The world scene region identifier is required.');
		}

		for (const place of model.places) {
			if (!place.id.trim()) {
				throw new Error('Every world place must contain an identifier.');
			}

			if (!Number.isFinite(place.position_x) || !Number.isFinite(place.position_y)) {
				throw new Error(`The place "${place.id}" contains invalid world coordinates.`);
			}
		}

		if (
			model.position &&
			(!Number.isFinite(model.position.position_x) || !Number.isFinite(model.position.position_y))
		) {
			throw new Error('The citizen position contains invalid world coordinates.');
		}
	}

	private copyModel(model: WorldSceneModel): WorldSceneModel {
		return {
			region: {
				...model.region
			},

			places: model.places.map((place) => ({
				...place
			})),

			position: model.position
				? {
						...model.position
					}
				: null,

			selectedPlaceId: model.selectedPlaceId,

			currentPlaceId: model.currentPlaceId,

			naturalArea: model.naturalArea
				? {
						...model.naturalArea
					}
				: null,

			biome: model.biome
				? {
						...model.biome
					}
				: null,

			environment: model.environment
				? {
						...model.environment
					}
				: null
		};
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('The world scene has already been disposed.');
		}
	}
}
