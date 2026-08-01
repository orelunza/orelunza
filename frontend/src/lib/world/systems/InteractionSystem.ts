import type { WorldPlace } from '$lib/api/contracts/world';

import { distanceBetweenPoints, pointFromPlace, type WorldPoint } from '$lib/world/types';

export interface InteractionState {
	selectedPlace: WorldPlace | null;
	nearbyPlace: WorldPlace | null;
	currentPlace: WorldPlace | null;
	distanceToNearbyPlace: number | null;
	canInteract: boolean;
}

export interface InteractionSystemOptions {
	places: readonly WorldPlace[];
	currentPlaceId?: string | null;
	selectedPlaceId?: string | null;
	interactionRadius?: number;
}

const DEFAULT_INTERACTION_RADIUS = 72;

export class InteractionSystem {
	private places: readonly WorldPlace[];
	private currentPlaceId: string | null;
	private selectedPlaceId: string | null;
	private readonly interactionRadius: number;
	private stateValue: InteractionState;

	constructor(options: InteractionSystemOptions) {
		this.places = options.places;
		this.currentPlaceId = options.currentPlaceId ?? null;
		this.selectedPlaceId = options.selectedPlaceId ?? null;
		this.interactionRadius = this.normalizeRadius(
			options.interactionRadius ?? DEFAULT_INTERACTION_RADIUS
		);
		this.stateValue = this.createState(null, null);
	}

	get state(): InteractionState {
		return {
			...this.stateValue
		};
	}

	updatePlaces(
		places: readonly WorldPlace[],
		options: {
			currentPlaceId?: string | null;
			selectedPlaceId?: string | null;
		} = {}
	): void {
		this.places = places;

		if (options.currentPlaceId !== undefined) {
			this.currentPlaceId = options.currentPlaceId;
		}

		if (options.selectedPlaceId !== undefined) {
			this.selectedPlaceId = options.selectedPlaceId;
		}
	}

	selectPlace(placeId: string | null): InteractionState {
		this.selectedPlaceId = placeId;
		this.stateValue = this.createState(this.stateValue.nearbyPlace, this.stateValue.distanceToNearbyPlace);

		return this.state;
	}

	setCurrentPlace(placeId: string | null): InteractionState {
		this.currentPlaceId = placeId;
		this.stateValue = this.createState(this.stateValue.nearbyPlace, this.stateValue.distanceToNearbyPlace);

		return this.state;
	}

	evaluate(position: WorldPoint): InteractionState {
		let nearbyPlace: WorldPlace | null = null;
		let nearbyDistance: number | null = null;

		for (const place of this.places) {
			if (!place.enabled) {
				continue;
			}

			const distance = distanceBetweenPoints(position, pointFromPlace(place));

			if (distance > this.interactionRadius) {
				continue;
			}

			if (nearbyDistance === null || distance < nearbyDistance) {
				nearbyPlace = place;
				nearbyDistance = distance;
			}
		}

		this.stateValue = this.createState(nearbyPlace, nearbyDistance);

		return this.state;
	}

	interactablePlace(): WorldPlace | null {
		return this.stateValue.nearbyPlace ?? this.stateValue.selectedPlace;
	}

	private createState(
		nearbyPlace: WorldPlace | null,
		distanceToNearbyPlace: number | null
	): InteractionState {
		const selectedPlace =
			(this.selectedPlaceId
				? this.places.find((place) => place.id === this.selectedPlaceId)
				: null) ?? null;
		const currentPlace =
			(this.currentPlaceId
				? this.places.find((place) => place.id === this.currentPlaceId)
				: null) ?? null;

		return {
			selectedPlace,
			nearbyPlace,
			currentPlace,
			distanceToNearbyPlace,
			canInteract: nearbyPlace !== null
		};
	}

	private normalizeRadius(value: number): number {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error('The interaction radius must be a positive finite number.');
		}

		return value;
	}
}
