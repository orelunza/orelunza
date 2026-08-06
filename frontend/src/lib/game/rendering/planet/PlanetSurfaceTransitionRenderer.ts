export function planetTravelEase(progress: number): number {
	const value = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
	return value * value * (3 - 2 * value);
}

export function planetTravelFade(progress: number): number {
	const eased = planetTravelEase(progress);
	return Math.sin(eased * Math.PI);
}
