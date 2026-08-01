import { AmbientLight, DirectionalLight, Scene } from 'three';
import type { QualitySettings } from './QualitySettings';

export function addWorldLighting(scene: Scene, quality?: QualitySettings): void {
	const ambient = new AmbientLight(0xb9c6b5, 0.62);
	const sun = new DirectionalLight(0xffe5bc, 1.35);

	sun.position.set(28, 48, 18);
	sun.castShadow = quality?.shadows ?? true;
	sun.shadow.mapSize.set(
		quality?.quality === 'high' ? 1024 : 768,
		quality?.quality === 'high' ? 1024 : 768
	);
	sun.shadow.camera.left = -42;
	sun.shadow.camera.right = 42;
	sun.shadow.camera.top = 42;
	sun.shadow.camera.bottom = -42;

	scene.add(ambient, sun);
}
