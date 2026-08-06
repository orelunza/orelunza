import { Color, MeshStandardMaterial } from 'three';

export function createPlanetTerrainMaterial(): MeshStandardMaterial {
	return new MeshStandardMaterial({
		color: new Color('#ffffff'),
		vertexColors: true,
		roughness: 0.88,
		metalness: 0.01
	});
}
