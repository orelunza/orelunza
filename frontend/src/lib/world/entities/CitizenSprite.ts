import { Circle, Container, Graphics, Sprite, Text } from 'pixi.js';

import type { FederatedPointerEvent, Texture } from 'pixi.js';

import { getWorldAsset } from '$lib/world/assets/assetManifest';

import type { CitizenModel, WorldPoint } from '$lib/world/types';

export interface CitizenSpriteCallbacks {
	onSelect?: (citizen: CitizenModel) => void;

	onActivate?: (citizen: CitizenModel) => void;
}

export interface CitizenSpriteOptions extends CitizenSpriteCallbacks {
	texture?: Texture;

	selected?: boolean;
	active?: boolean;
	showLabel?: boolean;
	interactive?: boolean;

	movementDurationMs?: number;
}

export interface CitizenSpriteUpdateOptions {
	/**
	 * Optional replacement texture.
	 *
	 * - `undefined`: keep the current texture;
	 * - `null`: remove the texture and use the procedural fallback;
	 * - `Texture`: display the supplied texture.
	 */
	texture?: Texture | null;

	/**
	 * Skip movement animation and immediately use the new position.
	 */
	teleport?: boolean;

	/**
	 * Duration of the position transition.
	 */
	movementDurationMs?: number;
}

interface CitizenMovement {
	from: WorldPoint;
	to: WorldPoint;

	elapsedMs: number;
	durationMs: number;
}

const DEFAULT_MOVEMENT_DURATION_MS = 420;
const DOUBLE_ACTIVATION_DELAY_MS = 350;

const CHARACTER_WIDTH = 42;
const CHARACTER_HEIGHT = 56;

const HIT_AREA_RADIUS = 34;
const LABEL_OFFSET_Y = -84;
const LABEL_PADDING_X = 10;
const LABEL_PADDING_Y = 6;

const COLORS = Object.freeze({
	body: 0x8fc7a2,
	bodyHighlight: 0xb6dfc1,
	bodyShadow: 0x315f43,

	head: 0xd8efe0,
	face: 0x102018,

	border: 0xf1f6f3,
	darkBorder: 0x294236,

	selected: 0xb6dfc1,
	active: 0x8fc7a2,

	labelBackground: 0x101b16,
	labelBorder: 0x3c5949,
	labelText: 0xf1f6f3,

	shadow: 0x000000
});

/**
 * Interactive PixiJS representation of an Orelunza citizen.
 *
 * The citizen position corresponds to the character's feet in world
 * coordinates.
 */
export class CitizenSprite extends Container {
	private citizenModel: CitizenModel;
	private callbacks: CitizenSpriteCallbacks;

	private readonly shadowGraphic = new Graphics();

	private readonly selectionGraphic = new Graphics();

	private readonly activityGraphic = new Graphics();

	private readonly characterContainer = new Container();

	private readonly bodyGraphic = new Graphics();

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

	private textureSprite: Sprite | null = null;

	private selected: boolean;
	private active: boolean;
	private interactionEnabled: boolean;
	private showLabel: boolean;

	private hovered = false;
	private facingDirection: 1 | -1 = 1;

	private movement: CitizenMovement | null = null;
	private movementDurationMs: number;

	private animationElapsedMs = 0;

	private lastTapAt = 0;
	private lastPointerId: number | null = null;

	private disposed = false;

	constructor(model: CitizenModel, options: CitizenSpriteOptions = {}) {
		super();

		this.validateModel(model);

		this.citizenModel = this.copyModel(model);

		this.callbacks = {
			onSelect: options.onSelect,
			onActivate: options.onActivate
		};

		this.selected = options.selected ?? false;

		this.active = options.active ?? true;

		this.interactionEnabled = options.interactive ?? true;

		this.showLabel = options.showLabel ?? true;

		this.movementDurationMs = this.normalizeMovementDuration(
			options.movementDurationMs ?? DEFAULT_MOVEMENT_DURATION_MS
		);

		this.label = `citizen:${model.humanId}`;

		this.sortableChildren = true;

		this.characterContainer.addChild(this.bodyGraphic, this.statusGraphic);

		this.labelContainer.addChild(this.labelBackground, this.nameText);

		this.addChild(
			this.shadowGraphic,
			this.selectionGraphic,
			this.activityGraphic,
			this.characterContainer,
			this.labelContainer
		);

		this.hitArea = new Circle(0, -CHARACTER_HEIGHT / 2, HIT_AREA_RADIUS);

		this.on('pointertap', this.handlePointerTap);

		this.on('pointerover', this.handlePointerOver);

		this.on('pointerout', this.handlePointerOut);

		if (options.texture) {
			this.setTexture(options.texture);
		}

		this.updateDisplay();
	}

	/**
	 * Return a safe copy of the represented citizen.
	 */
	get model(): CitizenModel {
		return this.copyModel(this.citizenModel);
	}

	/**
	 * Return the human identifier.
	 */
	get humanId(): string {
		return this.citizenModel.humanId;
	}

	/**
	 * Return whether the citizen is currently moving.
	 */
	get isMoving(): boolean {
		return this.movement !== null;
	}

	/**
	 * Return the citizen's currently rendered world position.
	 */
	get renderedPosition(): WorldPoint {
		return {
			x: this.position.x,
			y: this.position.y
		};
	}

	/**
	 * Replace the citizen model.
	 */
	update(model: CitizenModel, options: CitizenSpriteUpdateOptions = {}): void {
		this.assertUsable();
		this.validateModel(model);

		const previousPosition = {
			x: this.citizenModel.position.x,
			y: this.citizenModel.position.y
		};

		const positionChanged =
			previousPosition.x !== model.position.x || previousPosition.y !== model.position.y;

		this.citizenModel = this.copyModel(model);

		this.label = `citizen:${model.humanId}`;

		if (options.texture !== undefined) {
			this.setTexture(options.texture);
		}

		if (positionChanged) {
			if (options.teleport) {
				this.teleportTo(model.position);
			} else {
				this.moveTo(model.position, options.movementDurationMs);
			}
		}

		this.updateDisplay(false);
	}

	/**
	 * Replace interaction callbacks.
	 */
	setCallbacks(callbacks: CitizenSpriteCallbacks): void {
		this.assertUsable();

		this.callbacks = {
			...callbacks
		};
	}

	/**
	 * Use a loaded citizen texture or return to the procedural fallback.
	 */
	setTexture(texture: Texture | null): void {
		this.assertUsable();

		if (!texture) {
			if (this.textureSprite) {
				this.characterContainer.removeChild(this.textureSprite);

				this.textureSprite.destroy();
				this.textureSprite = null;
			}

			this.bodyGraphic.visible = true;
			this.updateCharacterOrder();

			return;
		}

		if (this.textureSprite) {
			this.textureSprite.texture = texture;
		} else {
			const sprite = new Sprite(texture);

			sprite.label = 'citizen-texture';

			sprite.anchor.set(0.5, 1);

			this.textureSprite = sprite;

			this.characterContainer.addChild(sprite);
		}

		this.textureSprite.width = CHARACTER_WIDTH;

		this.textureSprite.height = CHARACTER_HEIGHT;

		this.textureSprite.position.set(0, 0);

		this.bodyGraphic.visible = false;

		this.updateCharacterOrder();
	}

	/**
	 * Mark the citizen as selected or unselected.
	 */
	setSelected(selected: boolean): void {
		this.assertUsable();

		if (this.selected === selected) {
			return;
		}

		this.selected = selected;
		this.updateAppearance();
	}

	/**
	 * Change the citizen's online or active state.
	 */
	setActive(active: boolean): void {
		this.assertUsable();

		if (this.active === active) {
			return;
		}

		this.active = active;
		this.updateAppearance();
	}

	/**
	 * Enable or disable pointer interaction.
	 */
	setInteractive(interactive: boolean): void {
		this.assertUsable();

		if (this.interactionEnabled === interactive) {
			return;
		}

		this.interactionEnabled = interactive;

		this.updateInteraction();
		this.updateAppearance();
	}

	/**
	 * Show or hide the citizen name.
	 */
	setLabelVisible(visible: boolean): void {
		this.assertUsable();

		this.showLabel = visible;

		this.labelContainer.visible = this.showLabel && this.citizenModel.visible;
	}

	/**
	 * Change the visible citizen name.
	 */
	setDisplayName(displayName: string): void {
		this.assertUsable();

		const normalized = displayName.trim() || 'Citizen';

		this.citizenModel = {
			...this.citizenModel,
			displayName: normalized
		};

		this.updateLabel();
	}

	/**
	 * Immediately place the citizen at a world coordinate.
	 */
	teleportTo(position: WorldPoint): void {
		this.assertUsable();
		this.validatePoint(position);

		this.movement = null;

		this.citizenModel = {
			...this.citizenModel,

			position: {
				...position
			}
		};

		this.position.set(position.x, position.y);

		this.updateCharacterScale();
	}

	/**
	 * Animate the citizen toward a new world coordinate.
	 */
	moveTo(position: WorldPoint, durationMs = this.movementDurationMs): void {
		this.assertUsable();
		this.validatePoint(position);

		const normalizedDuration = this.normalizeMovementDuration(durationMs);

		const from = {
			x: this.position.x,
			y: this.position.y
		};

		this.citizenModel = {
			...this.citizenModel,

			position: {
				...position
			}
		};

		const distance = Math.hypot(position.x - from.x, position.y - from.y);

		if (normalizedDuration === 0 || distance < 0.001) {
			this.teleportTo(position);
			return;
		}

		this.setFacingFromMovement(position.x - from.x);

		this.movement = {
			from,
			to: {
				...position
			},

			elapsedMs: 0,
			durationMs: normalizedDuration
		};
	}

	/**
	 * Cancel movement at the current rendered position.
	 */
	cancelMovement(): void {
		this.assertUsable();

		if (!this.movement) {
			return;
		}

		this.citizenModel = {
			...this.citizenModel,

			position: {
				x: this.position.x,
				y: this.position.y
			}
		};

		this.movement = null;
		this.updateCharacterScale();
	}

	/**
	 * Advance movement and subtle visual animation.
	 *
	 * Call this once per renderer frame using PixiJS ticker `deltaMS`.
	 */
	advance(deltaMs: number): boolean {
		this.assertUsable();

		if (!Number.isFinite(deltaMs) || deltaMs < 0) {
			throw new Error('The citizen animation delta must be a non-negative finite number.');
		}

		this.animationElapsedMs += deltaMs;

		this.updateActivityAnimation();
		this.updateWalkingAnimation();

		const movement = this.movement;

		if (!movement) {
			return false;
		}

		movement.elapsedMs = Math.min(movement.durationMs, movement.elapsedMs + deltaMs);

		const progress = movement.durationMs === 0 ? 1 : movement.elapsedMs / movement.durationMs;

		const easedProgress = this.easeInOutCubic(progress);

		this.position.set(
			this.interpolate(movement.from.x, movement.to.x, easedProgress),

			this.interpolate(movement.from.y, movement.to.y, easedProgress)
		);

		if (progress >= 1) {
			this.position.set(movement.to.x, movement.to.y);

			this.movement = null;
			this.updateCharacterScale();

			return false;
		}

		return true;
	}

	/**
	 * Permanently release PixiJS resources and event listeners.
	 */
	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.off('pointertap', this.handlePointerTap);

		this.off('pointerover', this.handlePointerOver);

		this.off('pointerout', this.handlePointerOut);

		this.removeAllListeners();

		this.movement = null;
		this.callbacks = {};

		this.disposed = true;

		this.destroy({
			children: true
		});
	}

	private updateDisplay(updatePosition = true): void {
		if (updatePosition) {
			this.position.set(this.citizenModel.position.x, this.citizenModel.position.y);
		}

		this.visible = this.citizenModel.visible;

		this.renderable = this.citizenModel.visible;

		this.labelContainer.visible = this.showLabel && this.citizenModel.visible;

		this.updateInteraction();
		this.updateBody();
		this.updateLabel();
		this.updateAppearance();
	}

	private updateInteraction(): void {
		const interactive = this.interactionEnabled && this.citizenModel.visible;

		this.eventMode = interactive ? 'static' : 'none';

		this.cursor = interactive ? 'pointer' : 'default';
	}

	private updateBody(): void {
		const fallback = getWorldAsset('citizen.default').fallback;

		const bodyColor = fallback.color ?? COLORS.body;

		this.bodyGraphic.clear();

		/*
		 * Legs.
		 */
		this.bodyGraphic
			.roundRect(-12, -22, 9, 22, 4)
			.fill({
				color: COLORS.bodyShadow
			})
			.stroke({
				color: COLORS.darkBorder,
				width: 1.5
			});

		this.bodyGraphic
			.roundRect(3, -22, 9, 22, 4)
			.fill({
				color: COLORS.bodyShadow
			})
			.stroke({
				color: COLORS.darkBorder,
				width: 1.5
			});

		/*
		 * Torso.
		 */
		this.bodyGraphic
			.roundRect(-17, -45, 34, 29, 11)
			.fill({
				color: bodyColor
			})
			.stroke({
				color: COLORS.border,
				width: 2
			});

		/*
		 * Arms.
		 */
		this.bodyGraphic
			.roundRect(-22, -41, 8, 23, 4)
			.fill({
				color: bodyColor
			})
			.stroke({
				color: COLORS.darkBorder,
				width: 1.25
			});

		this.bodyGraphic
			.roundRect(14, -41, 8, 23, 4)
			.fill({
				color: bodyColor
			})
			.stroke({
				color: COLORS.darkBorder,
				width: 1.25
			});

		/*
		 * Head.
		 */
		this.bodyGraphic
			.circle(0, -54, 11)
			.fill({
				color: COLORS.head
			})
			.stroke({
				color: COLORS.border,
				width: 2
			});

		/*
		 * Minimal face.
		 */
		this.bodyGraphic.circle(-3.5, -56, 1.25).fill({
			color: COLORS.face
		});

		this.bodyGraphic.circle(3.5, -56, 1.25).fill({
			color: COLORS.face
		});

		this.bodyGraphic.moveTo(-3, -50).lineTo(3, -50).stroke({
			color: COLORS.face,
			width: 1.25,
			alpha: 0.75
		});
	}

	private updateLabel(): void {
		this.nameText.text = this.citizenModel.displayName || 'Citizen';

		this.nameText.anchor.set(0.5, 0);

		this.nameText.position.set(0, LABEL_PADDING_Y);

		const width = Math.max(52, this.nameText.width + LABEL_PADDING_X * 2);

		const height = this.nameText.height + LABEL_PADDING_Y * 2;

		this.labelBackground.clear();

		this.labelBackground
			.roundRect(-width / 2, 0, width, height, 10)
			.fill({
				color: COLORS.labelBackground,

				alpha: 0.92
			})
			.stroke({
				color: this.selected ? COLORS.selected : this.active ? COLORS.active : COLORS.labelBorder,

				width: this.selected ? 1.5 : 1,

				alpha: 0.9
			});

		this.labelContainer.position.set(0, LABEL_OFFSET_Y);
	}

	private updateAppearance(): void {
		this.drawShadow();
		this.drawSelection();
		this.drawActivity();
		this.drawStatus();

		this.updateLabel();
		this.updateCharacterScale();

		this.alpha = this.active ? 1 : 0.62;

		this.zIndex = this.selected ? 50 : this.hovered ? 45 : 40;
	}

	private drawShadow(): void {
		this.shadowGraphic.clear();

		this.shadowGraphic.ellipse(0, 2, 20, 7).fill({
			color: COLORS.shadow,
			alpha: this.isMoving ? 0.2 : 0.27
		});
	}

	private drawSelection(): void {
		this.selectionGraphic.clear();

		if (!this.selected && !this.hovered) {
			return;
		}

		const color = this.selected ? COLORS.selected : COLORS.active;

		this.selectionGraphic
			.ellipse(0, -27, 30, 39)
			.fill({
				color,
				alpha: this.selected ? 0.08 : 0.045
			})
			.stroke({
				color,
				width: this.selected ? 2 : 1.25,

				alpha: 0.8
			});
	}

	private drawActivity(): void {
		this.activityGraphic.clear();

		if (!this.active) {
			return;
		}

		this.activityGraphic.ellipse(0, 1, 25, 10).stroke({
			color: COLORS.active,
			width: 1.5,
			alpha: 0.45
		});
	}

	private drawStatus(): void {
		this.statusGraphic.clear();

		this.statusGraphic
			.circle(16, -51, 5)
			.fill({
				color: this.active ? COLORS.active : COLORS.labelBorder
			})
			.stroke({
				color: COLORS.border,
				width: 2
			});
	}

	private updateActivityAnimation(): void {
		if (!this.active) {
			this.activityGraphic.alpha = 0;
			return;
		}

		const pulse = (Math.sin(this.animationElapsedMs / 420) + 1) / 2;

		this.activityGraphic.alpha = 0.35 + pulse * 0.35;

		this.activityGraphic.scale.set(0.96 + pulse * 0.08);
	}

	private updateWalkingAnimation(): void {
		if (!this.movement) {
			this.characterContainer.position.y = 0;

			this.updateCharacterScale();
			return;
		}

		const bob = Math.abs(Math.sin(this.animationElapsedMs / 75)) * 2;

		this.characterContainer.position.y = -bob;

		this.updateCharacterScale();
	}

	private updateCharacterScale(): void {
		const interactionScale =
			this.hovered && this.interactionEnabled ? 1.06 : this.selected ? 1.035 : 1;

		this.characterContainer.scale.set(
			interactionScale * this.facingDirection,

			interactionScale
		);
	}

	private updateCharacterOrder(): void {
		if (this.textureSprite) {
			this.characterContainer.setChildIndex(
				this.textureSprite,
				Math.max(0, this.characterContainer.children.length - 2)
			);
		}

		this.characterContainer.setChildIndex(
			this.statusGraphic,
			this.characterContainer.children.length - 1
		);
	}

	private setFacingFromMovement(deltaX: number): void {
		if (Math.abs(deltaX) < 0.001) {
			return;
		}

		this.facingDirection = deltaX < 0 ? -1 : 1;

		this.updateCharacterScale();
	}

	private interpolate(start: number, end: number, progress: number): number {
		return start + (end - start) * progress;
	}

	private easeInOutCubic(progress: number): number {
		return progress < 0.5
			? 4 * progress * progress * progress
			: 1 - Math.pow(-2 * progress + 2, 3) / 2;
	}

	private normalizeMovementDuration(durationMs: number): number {
		if (!Number.isFinite(durationMs) || durationMs < 0) {
			throw new Error('The citizen movement duration must be a non-negative finite number.');
		}

		return durationMs;
	}

	private readonly handlePointerTap = (event: FederatedPointerEvent): void => {
		if (!this.interactionEnabled || !this.citizenModel.visible) {
			return;
		}

		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		event.stopPropagation();

		this.callbacks.onSelect?.(this.copyModel(this.citizenModel));

		const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

		const repeatedPointer = this.lastPointerId === event.pointerId;

		if (repeatedPointer && now - this.lastTapAt <= DOUBLE_ACTIVATION_DELAY_MS) {
			this.callbacks.onActivate?.(this.copyModel(this.citizenModel));

			this.lastTapAt = 0;
			this.lastPointerId = null;

			return;
		}

		this.lastTapAt = now;
		this.lastPointerId = event.pointerId;
	};

	private readonly handlePointerOver = (): void => {
		if (!this.interactionEnabled) {
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

	private validateModel(model: CitizenModel): void {
		if (!model.humanId.trim()) {
			throw new Error('The citizen human identifier is required.');
		}

		this.validatePoint(model.position);
	}

	private validatePoint(point: WorldPoint): void {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			throw new Error('The citizen world position must contain finite coordinates.');
		}
	}

	private copyModel(model: CitizenModel): CitizenModel {
		return {
			...model,

			position: {
				...model.position
			}
		};
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('The citizen sprite has already been disposed.');
		}
	}
}
