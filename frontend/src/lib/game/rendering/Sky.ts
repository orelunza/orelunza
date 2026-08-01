import { Color, Fog, Scene } from 'three';

export function configureSky(scene: Scene): void {
	scene.background = new Color(0x9db5bd);
	scene.fog = new Fog(0x9db5bd, 52, 148);
}
