export const RAINBOW_VERTEX_SHADER = /* glsl */ `
	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export const RAINBOW_FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	uniform float uIntensity;
	uniform float uCloudOcclusion;
	varying vec2 vUv;

	vec3 spectrum(float t) {
		vec3 p = abs(fract(t + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
		return clamp(p - 1.0, 0.0, 1.0);
	}

	void main() {
		vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y - 0.05);
		float radius = length(p);
		float ring = 1.0 - smoothstep(0.035, 0.075, abs(radius - 0.78));
		float upperArc = smoothstep(-0.02, 0.12, p.y);
		float edgeFade = 1.0 - smoothstep(0.82, 1.0, abs(p.x));
		float verticalFade = 1.0 - smoothstep(0.8, 1.05, p.y);
		float hue = clamp((radius - 0.72) / 0.12, 0.0, 1.0);
		vec3 color = spectrum(hue * 0.82 + 0.02);
		float alpha = ring * upperArc * edgeFade * verticalFade * uIntensity * (1.0 - uCloudOcclusion * 0.55);
		if (alpha < 0.002) discard;
		gl_FragColor = vec4(color, alpha * 0.48);
	}
`;
