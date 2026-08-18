export type MapDetail = 'far' | 'medium' | 'close';

export function detailForZoom(zoom: number): MapDetail {
	if (zoom < 5) return 'far';
	if (zoom < 12) return 'medium';
	return 'close';
}

export function lodFeatures(zoom: number) {
	const detail = detailForZoom(zoom);
	return {
		detail,
		settlements: true,
		countries: true,
		water: true,
		roads: detail !== 'far',
		buildings: detail === 'close',
		maximumFeatures: detail === 'far' ? 80 : detail === 'medium' ? 220 : 480
	};
}
