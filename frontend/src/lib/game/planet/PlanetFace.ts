export const PLANET_FACES = [
	'positive-x',
	'negative-x',
	'positive-y',
	'negative-y',
	'positive-z',
	'negative-z'
] as const;

export type PlanetFace = (typeof PLANET_FACES)[number];

export function isPlanetFace(value: string): value is PlanetFace {
	return (PLANET_FACES as readonly string[]).includes(value);
}
