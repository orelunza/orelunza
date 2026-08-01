import { Circle, Container, Graphics, Text } from 'pixi.js';

import type { FederatedPointerEvent } from 'pixi.js';

import type { WorldPlace } from '$lib/api/contracts/world';

import { getWorldAsset } from '$lib/world/assets/assetManifest';

import type { PlaceMarkerModel } from '$lib/world/types';

export interface PlaceMarkerCallbacks {
	onSelect?: (place: WorldPlace) => void;

	onActivate?: (place: WorldPlace) => void;
}

export interface PlaceMarkerOptions extends PlaceMarkerCallbacks {
	showLabel?: boolean;
}

const MARKER_RADIUS = 14;
const MARKER_STEM_LENGTH = 11;
const MARKER_HIT_RADIUS = 34;

const LABEL_PADDING_X = 10;
const LABEL_PADDING_Y = 6;
const LABEL_OFFSET_Y = 34;

const DOUBLE_ACTIVATION_DELAY_MS = 350;

const COLORS = Object.freeze({
	default: 0x91a39a,
	selected: 0xb6dfc1,
	current: 0x8fc7a2,

	border: 0xf1f6f3,
	darkBorder: 0x294236,

	center: 0x102018,

	labelBackground: 0x101b16,
	labelBorder: 0x3c5949,
	labelText: 0xf1f6f3,

	shadow: 0x000000
});

/**
 * Interactive visual representation of a world place.
 */
export class PlaceMarker extends Container {
	private markerModel: PlaceMarkerModel;
	private callbacks: PlaceMarkerCallbacks;

	private readonly shadowGraphic = new Graphics();

	private readonly selectionGraphic = new Graphics();

	private readonly markerGraphic = new Graphics();

	private readonly statusGraphic = new Graphics();

	private readonly labelContainer = new Container();

	private readonly labelBackground = new Graphics();

	private readonly nameText = new Text({
		text: '',

		style: {
			fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',

			fontSize: 13,
			fontWeight: '600',
			fill: COLORS.labelText,

			align: 'center',

			dropShadow: {
				color: COLORS.shadow,
				alpha: 0.35,
				blur: 3,
				distance: 1,
				angle: Math.PI / 2
			}
		}
	});

	private hovered = false;
	private showLabel: boolean;

	private lastTapAt = 0;
	private lastPointerId: number | null = null;

	constructor(model: PlaceMarkerModel, options: PlaceMarkerOptions = {}) {
		super();

		this.markerModel = this.copyModel(model);

		this.callbacks = {
			onSelect: options.onSelect,
			onActivate: options.onActivate
		};

		this.showLabel = options.showLabel ?? true;

		this.label = `place:${model.place.id}`;

		this.sortableChildren = true;

		this.labelContainer.addChild(this.labelBackground, this.nameText);

		this.addChild(
			this.shadowGraphic,
			this.selectionGraphic,
			this.markerGraphic,
			this.statusGraphic,
			this.labelContainer
		);

		this.hitArea = new Circle(0, 4, MARKER_HIT_RADIUS);

		this.on('pointertap', this.handlePointerTap);

		this.on('pointerover', this.handlePointerOver);

		this.on('pointerout', this.handlePointerOut);

		this.updateDisplay();
	}

	/**
	 * Return the backend place represented by this marker.
	 */
	get place(): WorldPlace {
		return this.markerModel.place;
	}

	/**
	 * Return a safe copy of the current visual model.
	 */
	get model(): PlaceMarkerModel {
		return this.copyModel(this.markerModel);
	}

	/**
	 * Replace all marker data.
	 */
	update(model: PlaceMarkerModel): void {
		this.markerModel = this.copyModel(model);

		this.label = `place:${model.place.id}`;

		this.updateDisplay();
	}

	/**
	 * Replace selection callbacks.
	 */
	setCallbacks(callbacks: PlaceMarkerCallbacks): void {
		this.callbacks = {
			...callbacks
		};
	}

	/**
	 * Change the selected state without replacing the complete model.
	 */
	setSelected(selected: boolean): void {
		if (this.markerModel.selected === selected) {
			return;
		}

		this.markerModel = {
			...this.markerModel,
			selected
		};

		this.updateAppearance();
	}

	/**
	 * Change whether this is the citizen's current place.
	 */
	setCurrent(current: boolean): void {
		if (this.markerModel.current === current) {
			return;
		}

		this.markerModel = {
			...this.markerModel,
			current
		};

		this.updateAppearance();
	}

	/**
	 * Enable or disable pointer interaction.
	 */
	setInteractive(interactive: boolean): void {
		if (this.markerModel.interactive === interactive) {
			return;
		}

		this.markerModel = {
			...this.markerModel,
			interactive
		};

		this.updateInteraction();
		this.updateAppearance();
	}

	/**
	 * Show or hide the text label.
	 */
	setLabelVisible(visible: boolean): void {
		this.showLabel = visible;

		this.labelContainer.visible = visible && this.markerModel.visible;
	}

	/**
	 * Move the marker to a new world position.
	 */
	setWorldPosition(x: number, y: number): void {
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			throw new Error('The place marker position must contain finite coordinates.');
		}

		this.markerModel = {
			...this.markerModel,

			position: {
				x,
				y
			}
		};

		this.position.set(x, y);
	}

	/**
	 * Update the displayed place name.
	 */
	setLabel(label: string): void {
		this.markerModel = {
			...this.markerModel,
			label: label.trim() || this.markerModel.place.name
		};

		this.updateLabel();
	}

	/**
	 * Release event listeners and PixiJS children.
	 */
	dispose(): void {
		this.off('pointertap', this.handlePointerTap);

		this.off('pointerover', this.handlePointerOver);

		this.off('pointerout', this.handlePointerOut);

		this.removeAllListeners();

		this.destroy({
			children: true
		});
	}

	private updateDisplay(): void {
		this.position.set(this.markerModel.position.x, this.markerModel.position.y);

		this.visible = this.markerModel.visible;

		this.renderable = this.markerModel.visible;

		this.labelContainer.visible = this.showLabel && this.markerModel.visible;

		this.updateInteraction();
		this.updateLabel();
		this.updateAppearance();
	}

	private updateInteraction(): void {
		const interactive = this.markerModel.interactive && this.markerModel.visible;

		this.eventMode = interactive ? 'static' : 'none';

		this.cursor = interactive ? 'pointer' : 'default';
	}

	private updateLabel(): void {
		this.nameText.text = this.markerModel.label || this.markerModel.place.name;

		this.nameText.anchor.set(0.5, 0);

		this.nameText.position.set(0, LABEL_PADDING_Y);

		const width = Math.max(42, this.nameText.width + LABEL_PADDING_X * 2);

		const height = this.nameText.height + LABEL_PADDING_Y * 2;

		this.labelBackground.clear();

		this.labelBackground
			.roundRect(-width / 2, 0, width, height, 10)
			.fill({
				color: COLORS.labelBackground,

				alpha: 0.92
			})
			.stroke({
				color: this.markerModel.current
					? COLORS.current
					: this.markerModel.selected
						? COLORS.selected
						: COLORS.labelBorder,

				width: this.markerModel.current || this.markerModel.selected ? 1.5 : 1,

				alpha: 0.9
			});

		this.labelContainer.position.set(0, LABEL_OFFSET_Y);
	}

	private updateAppearance(): void {
		const current = this.markerModel.current;

		const selected = this.markerModel.selected;

		const interactive = this.markerModel.interactive;

		const markerColor = current ? COLORS.current : selected ? COLORS.selected : COLORS.default;

		const fallback = current
			? getWorldAsset('place.marker.current').fallback
			: selected
				? getWorldAsset('place.marker.selected').fallback
				: getWorldAsset('place.marker').fallback;

		const resolvedColor = fallback.color ?? markerColor;

		this.drawShadow();
		this.drawSelection();
		this.drawMarker(resolvedColor);

		this.drawStatus();
		this.updateLabel();

		const baseScale = current ? 1.08 : selected ? 1.04 : 1;

		const hoverScale = this.hovered && interactive ? 1.07 : 1;

		this.scale.set(baseScale * hoverScale);

		this.alpha = interactive ? 1 : 0.58;

		this.zIndex = current ? 30 : selected ? 20 : this.hovered ? 15 : 10;
	}

	private drawShadow(): void {
		this.shadowGraphic.clear();

		this.shadowGraphic.ellipse(0, MARKER_STEM_LENGTH + 12, 18, 6).fill({
			color: COLORS.shadow,
			alpha: 0.28
		});
	}

	private drawSelection(): void {
		this.selectionGraphic.clear();

		if (!this.markerModel.selected && !this.markerModel.current && !this.hovered) {
			return;
		}

		const color = this.markerModel.current
			? COLORS.current
			: this.markerModel.selected
				? COLORS.selected
				: COLORS.default;

		this.selectionGraphic
			.circle(0, 0, MARKER_RADIUS + 8)
			.fill({
				color,
				alpha: this.markerModel.current ? 0.12 : 0.08
			})
			.stroke({
				color,
				width: this.markerModel.current ? 2 : 1.5,

				alpha: 0.8
			});
	}

	private drawMarker(color: number): void {
		this.markerGraphic.clear();

		this.markerGraphic
			.moveTo(0, MARKER_RADIUS - 2)
			.lineTo(0, MARKER_RADIUS + MARKER_STEM_LENGTH)
			.stroke({
				color: this.markerModel.current ? COLORS.current : COLORS.darkBorder,

				width: 5,
				cap: 'round'
			});

		this.markerGraphic
			.circle(0, 0, MARKER_RADIUS)
			.fill({
				color
			})
			.stroke({
				color: COLORS.border,
				width: this.markerModel.current ? 3 : 2
			});

		this.markerGraphic.circle(0, 0, 4).fill({
			color: COLORS.center
		});
	}

	private drawStatus(): void {
		this.statusGraphic.clear();

		if (!this.markerModel.current) {
			return;
		}

		this.statusGraphic
			.circle(MARKER_RADIUS - 1, -MARKER_RADIUS + 1, 5)
			.fill({
				color: COLORS.current
			})
			.stroke({
				color: COLORS.border,
				width: 2
			});
	}

	private readonly handlePointerTap = (event: FederatedPointerEvent): void => {
		if (!this.markerModel.interactive || !this.markerModel.visible) {
			return;
		}

		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		event.stopPropagation();

		this.callbacks.onSelect?.(this.markerModel.place);

		const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

		const repeatedPointer = this.lastPointerId === event.pointerId;

		if (repeatedPointer && now - this.lastTapAt <= DOUBLE_ACTIVATION_DELAY_MS) {
			this.callbacks.onActivate?.(this.markerModel.place);

			this.lastTapAt = 0;
			this.lastPointerId = null;

			return;
		}

		this.lastTapAt = now;
		this.lastPointerId = event.pointerId;
	};

	private readonly handlePointerOver = (): void => {
		if (!this.markerModel.interactive) {
			return;
		}

		this.hovered = true;
		this.updateAppearance();
	};

	private readonly handlePointerOut = (): void => {
		if (!this.hovered) {
			return;
		}

		this.hovered = false;
		this.updateAppearance();
	};

	private copyModel(model: PlaceMarkerModel): PlaceMarkerModel {
		return {
			...model,

			position: {
				...model.position
			},

			place: {
				...model.place
			}
		};
	}
}
