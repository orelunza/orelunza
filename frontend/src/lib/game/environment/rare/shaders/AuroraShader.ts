export const AURORA_VERTEX_SHADER = /* glsl */ `
	varying vec3 vDirection;

	void main() {
		vDirection = normalize(position);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export const AURORA_FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	uniform float uIntensity;
	uniform float uPhase;
	uniform float uCloudOcclusion;
	uniform float uDetail;
	varying vec3 vDirection;

	float bands(vec3 direction) {
		float longitude = atan(direction.z, direction.x);
		float wave = sin(longitude * (4.0 + uDetail) + uPhase * 1.7);
		wave += sin(longitude * (8.0 + uDetail * 1.6) - uPhase * 0.9) * 0.45;
		return smoothstep(-0.2, 0.9, wave);
	}

	void main() {
		float height = smoothstep(0.08, 0.46, vDirection.y) * (1.0 - smoothstep(0.78, 0.98, vDirection.y));
		float north = smoothstep(-0.75, 0.45, -vDirection.z);
		float curtain = bands(vDirection) * height * north;
		float shimmer = 0.72 + 0.28 * sin(uPhase * 3.0 + vDirection.y * 28.0 + vDirection.x * 8.0);
		vec3 green = vec3(0.18, 1.0, 0.58);
		vec3 violet = vec3(0.46, 0.34, 1.0);
		vec3 color = mix(green, violet, smoothstep(0.45, 0.82, vDirection.y));
		float alpha = curtain * shimmer * uIntensity * (1.0 - uCloudOcclusion * 0.85) * 0.42;
		if (alpha < 0.002) discard;
		gl_FragColor = vec4(color, alpha);
	}
`;
