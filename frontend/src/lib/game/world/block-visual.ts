import { BlockRegistry } from './BlockRegistry';
import type { BlockType } from './voxel-types';

/**
 * Métadonnées visuelles partagées d'un bloc.
 *
 * Source de vérité unique pour les trois faces du cube isométrique. Les
 * couleurs sont dérivées de `BlockRegistry.get(type).color` (l'unique endroit
 * où une couleur de bloc est définie) : on n'introduit aucune seconde table de
 * couleurs. `BlockMeshFactory` et `BlockIcon.svelte` consomment ce helper.
 */
export interface BlockVisual {
	/** Face supérieure, en `#rrggbb`. */
	top: string;
	/** Face gauche, plus sombre. */
	left: string;
	/** Face droite, teinte intermédiaire. */
	right: string;
	/** Opacité recommandée pour l'icône (blocs transparents plus légers). */
	opacity: number;
}

const cache = new Map<BlockType, BlockVisual>();

function clampChannel(value: number): number {
	if (value < 0) {
		return 0;
	}

	if (value > 255) {
		return 255;
	}

	return Math.round(value);
}

function toRgb(color: number): { r: number; g: number; b: number } {
	return {
		r: (color >> 16) & 0xff,
		g: (color >> 8) & 0xff,
		b: color & 0xff
	};
}

function toHex(r: number, g: number, b: number): string {
	const value = (clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b);

	return `#${value.toString(16).padStart(6, '0')}`;
}

function scale(color: number, factor: number): string {
	const { r, g, b } = toRgb(color);

	return toHex(r * factor, g * factor, b * factor);
}

/**
 * Retourne les métadonnées visuelles d'un bloc, mémorisées par type.
 *
 * Le résultat est stable : appeler la fonction plusieurs fois pour le même type
 * renvoie le même objet, ce qui évite toute recréation à chaque rendu Svelte.
 */
export function blockVisual(type: BlockType): BlockVisual {
	const cached = cache.get(type);

	if (cached) {
		return cached;
	}

	const definition = BlockRegistry.get(type);
	const visual: BlockVisual = {
		top: scale(definition.color, 1),
		right: scale(definition.color, 0.82),
		left: scale(definition.color, 0.62),
		opacity:
			type === 'water'
				? 0.72
				: type === 'glass' ||
					  type === 'glass_panel' ||
					  type === 'glass_door' ||
					  type === 'elevator_door' ||
					  type === 'bus_shelter'
					? 0.78
					: 1
	};

	cache.set(type, visual);

	return visual;
}
