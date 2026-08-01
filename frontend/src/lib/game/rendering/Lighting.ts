import { AmbientLight, DirectionalLight, Scene } from 'three';

export function addWorldLighting(scene: Scene): void {
	const ambient = new AmbientLight(0xb9c6b5, 0.62);
	const sun = new DirectionalLight(0xffe5bc, 1.35);

	sun.position.set(28, 48, 18);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.left = -48;
	sun.shadow.camera.right = 48;
	sun.shadow.camera.top = 48;
	sun.shadow.camera.bottom = -48;

	scene.add(ambient, sun);
}
