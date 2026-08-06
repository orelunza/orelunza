import { Color, MeshStandardMaterial } from 'three';

export function createPlanetSurfaceMaterial(): MeshStandardMaterial {
	return new MeshStandardMaterial({
		color: new Color('#2a6f91'),
		vertexColors: true,
		roughness: 0.72,
		metalness: 0.04
	});
}
