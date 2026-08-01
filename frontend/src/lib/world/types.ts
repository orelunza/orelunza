import type { Biome, EnvironmentState, NaturalArea } from '$lib/api/contracts/nature';

import type { HumanPosition, WorldPlace, WorldRegion } from '$lib/api/contracts/world';

/**
 * Coordinate used by the Orelunza world.
 */
export type WorldCoordinate = number;

/**
 * Identifier of an entity rendered inside the world.
 */
export type WorldEntityId = string;

/**
 * Two-dimensional point in world coordinates.
 */
export interface WorldPoint {
	x: WorldCoordinate;
	y: WorldCoordinate;
}

/**
 * Width and height expressed in world or screen units.
 */
export interface WorldSize {
	width: number;
	height: number;
}

/**
 * Rectangular area inside the world.
 */
export interface WorldBounds extends WorldPoint, WorldSize {}

/**
 * Current viewport dimensions.
 */
export interface WorldViewport {
	width: number;
	height: number;
	devicePixelRatio: number;
}

/**
 * Types of entities that can be rendered by the world scene.
 */
export type WorldEntityKind = 'citizen' | 'place' | 'natural-object' | 'decoration';

/**
 * Shared information for renderable world entities.
 */
export interface WorldEntity {
	id: WorldEntityId;
	kind: WorldEntityKind;
	position: WorldPoint;
	visible: boolean;
}

/**
 * Visual model used to render a place marker.
 */
export interface PlaceMarkerModel extends WorldEntity {
	kind: 'place';

	place: WorldPlace;

	label: string;
	selected: boolean;
	current: boolean;
	nearby: boolean;
	interactive: boolean;
}

/**
 * Visual model used to render the current citizen.
 */
export interface CitizenModel extends WorldEntity {
	kind: 'citizen';

	humanId: string;
	displayName: string;
	avatar: string;

	regionId: string;
	placeId: string | null;
}

/**
 * Natural object rendered in a scene.
 */
export interface NaturalObjectModel extends WorldEntity {
	kind: 'natural-object';

	objectType: 'tree' | 'rock' | 'grass' | 'water' | 'flower' | 'unknown';

	variant: string;
	scale: number;
	rotation: number;
}

/**
 * Complete data required to render the current world scene.
 */
export interface WorldSceneModel {
	region: WorldRegion;
	places: readonly WorldPlace[];

	position: HumanPosition | null;

	selectedPlaceId: string | null;
	currentPlaceId: string | null;

	naturalArea: NaturalArea | null;
	biome: Biome | null;
	environment: EnvironmentState | null;
}

/**
 * State of the camera inside the world.
 */
export interface WorldCameraState {
	position: WorldPoint;
	zoom: number;
}

/**
 * Camera configuration.
 */
export interface WorldCameraOptions {
	minZoom: number;
	maxZoom: number;
	initialZoom: number;

	wheelZoomSpeed: number;
	dragSpeed: number;

	bounds?: WorldBounds;
}

/**
 * Background style used when the scene has no loaded texture.
 */
export interface WorldBackgroundStyle {
	background: number;
	ground: number;
	grid: number;
	water: number;
	accent: number;
}

/**
 * Options used to initialize the world renderer.
 */
export interface WorldRendererOptions {
	width?: number;
	height?: number;

	resolution?: number;
	autoDensity?: boolean;
	antialias?: boolean;

	camera?: Partial<WorldCameraOptions>;
	background?: Partial<WorldBackgroundStyle>;
}

/**
 * Current lifecycle status of the renderer.
 */
export type WorldRendererStatus = 'idle' | 'initializing' | 'ready' | 'destroyed' | 'error';

/**
 * Pointer information translated into world coordinates.
 */
export interface WorldPointerEvent {
	screen: WorldPoint;
	world: WorldPoint;

	originalEvent?: PointerEvent;
}

/**
 * Events emitted by the world renderer.
 */
export interface WorldRendererEvents {
	onPlaceSelect?: (place: WorldPlace) => void;

	onPlaceActivate?: (place: WorldPlace) => void;

	onBackgroundPointer?: (event: WorldPointerEvent) => void;

	onLocalPositionChange?: (position: WorldPoint) => void;

	onMovementChange?: (moving: boolean, position: WorldPoint) => void;

	onNearbyPlaceChange?: (place: WorldPlace | null, distance: number | null) => void;

	onDestinationChange?: (destination: WorldPoint | null) => void;

	onReady?: () => void;

	onError?: (error: Error) => void;
}

/**
 * Public state exposed by the renderer.
 */
export interface WorldRendererSnapshot {
	status: WorldRendererStatus;
	camera: WorldCameraState;
	viewport: WorldViewport;

	regionId: string | null;
	selectedPlaceId: string | null;
	currentPlaceId: string | null;
}

/**
 * Default renderer colors.
 *
 * PixiJS expects hexadecimal colors represented as numbers.
 */
export const DEFAULT_WORLD_BACKGROUND: Readonly<WorldBackgroundStyle> = Object.freeze({
	background: 0x0b1310,
	ground: 0x182b21,
	grid: 0x294236,
	water: 0x3d756c,
	accent: 0x8fc7a2
});

/**
 * Default camera behavior.
 */
export const DEFAULT_WORLD_CAMERA: Readonly<WorldCameraOptions> = Object.freeze({
	minZoom: 0.5,
	maxZoom: 2.5,
	initialZoom: 1,
	wheelZoomSpeed: 0.0015,
	dragSpeed: 1
});

/**
 * Convert a backend place into a world point.
 */
export function pointFromPlace(place: Pick<WorldPlace, 'position_x' | 'position_y'>): WorldPoint {
	return {
		x: place.position_x,
		y: place.position_y
	};
}

/**
 * Convert a persisted human position into a world point.
 */
export function pointFromHumanPosition(
	position: Pick<HumanPosition, 'position_x' | 'position_y'>
): WorldPoint {
	return {
		x: position.position_x,
		y: position.position_y
	};
}

/**
 * Build the visual model of one place marker.
 */
export function createPlaceMarkerModel(
	place: WorldPlace,
	options: {
		selectedPlaceId?: string | null;
		currentPlaceId?: string | null;
	}
): PlaceMarkerModel {
	return {
		id: place.id,
		kind: 'place',
		position: pointFromPlace(place),
		visible: place.enabled,
		place,
		label: place.name,
		selected: options.selectedPlaceId === place.id,
		current: options.currentPlaceId === place.id,
		nearby: false,
		interactive: place.enabled
	};
}

/**
 * Build the visual model of the authenticated citizen.
 */
export function createCitizenModel(
	position: HumanPosition,
	identity: {
		displayName?: string;
		avatar?: string;
	}
): CitizenModel {
	return {
		id: position.human_id,
		kind: 'citizen',
		position: pointFromHumanPosition(position),
		visible: true,
		humanId: position.human_id,
		displayName: identity.displayName?.trim() || 'Citizen',
		avatar: identity.avatar?.trim() || '',
		regionId: position.region_id,
		placeId: position.place_id
	};
}

/**
 * Return a new point translated by the supplied offset.
 */
export function translatePoint(point: WorldPoint, offset: WorldPoint): WorldPoint {
	return {
		x: point.x + offset.x,
		y: point.y + offset.y
	};
}

/**
 * Return the Euclidean distance between two world points.
 */
export function distanceBetweenPoints(first: WorldPoint, second: WorldPoint): number {
	return Math.hypot(second.x - first.x, second.y - first.y);
}

/**
 * Limit a numeric value to an inclusive range.
 */
export function clampWorldValue(value: number, minimum: number, maximum: number): number {
	if (minimum > maximum) {
		throw new Error('The minimum world value cannot be greater than the maximum.');
	}

	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Validate that a point contains finite coordinates.
 */
export function isWorldPoint(value: unknown): value is WorldPoint {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as Partial<WorldPoint>;

	return (
		typeof candidate.x === 'number' &&
		Number.isFinite(candidate.x) &&
		typeof candidate.y === 'number' &&
		Number.isFinite(candidate.y)
	);
}
