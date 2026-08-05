/**
 * GLSL for the atmospheric sky dome, kept in its own module so the renderer
 * stays focused on Three.js wiring. The approach is a performant analytic
 * approximation of Rayleigh + Mie scattering rather than a full simulation:
 * it is cheap enough for WebGL2 on a laptop, deterministic, and driven entirely
 * by uniforms so a single ShaderMaterial serves every time of day and weather.
 */

export const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
	varying vec3 vDirection;

	void main() {
		// The dome is centred on the camera; the vertex direction (normalized
		// object-space position) is the view ray we shade in the fragment stage.
		vDirection = normalize(position);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	uniform vec3 uZenithColor;
	uniform vec3 uHorizonColor;
	uniform vec3 uSunTint;
	uniform vec3 uSunDirection;
	uniform vec3 uMoonDirection;
	uniform float uSunIntensity;
	uniform float uMoonIntensity;
	uniform float uHazadit;      // horizon haze thickness
	uniform float uRich;         // 1.0 for rich scattering branch, else 0.0
	uniform float uOvercast;     // 0..1 flat grey blend

	varying vec3 vDirection;

	// Henyey-Greenstein style forward-scattering lobe, cheap approximation of
	// Mie scattering that makes the sky glow brighter toward the sun.
	float sunGlow(float cosAngle, float sharpness) {
		float d = 1.0 - cosAngle;
		return exp(-d * d * sharpness);
	}

	void main() {
		vec3 dir = normalize(vDirection);

		// Height in [0,1] from horizon to zenith. abs() keeps the lower
		// hemisphere shaded too so there is no hard seam at the horizon line.
		float height = clamp(dir.y, -1.0, 1.0);
		float up = clamp(height, 0.0, 1.0);

		// Base gradient: horizon colour blends up into zenith colour. A power
		// curve compresses the gradient toward the horizon like the real sky.
		float gradient = pow(up, mix(0.55, 0.42, uRich));
		vec3 sky = mix(uHorizonColor, uZenithColor, gradient);

		// Thicker haze band hugging the horizon.
		float haze = (1.0 - smoothstep(0.0, 0.35, up)) * uHazadit;
		sky = mix(sky, uHorizonColor, haze * 0.6);

		// Sun scattering: a broad warm halo plus a tighter core, faded out when
		// the sun is below the horizon via uSunIntensity.
		float cosSun = dot(dir, normalize(uSunDirection));
		float halo = sunGlow(cosSun, mix(6.0, 12.0, uRich));
		float core = sunGlow(cosSun, 220.0);
		sky += uSunTint * (halo * 0.55 + core * 1.4) * uSunIntensity;

		// Moon scattering: a faint cool halo so the night sky is not flat.
		float cosMoon = dot(dir, normalize(uMoonDirection));
		float moonHalo = sunGlow(cosMoon, 40.0);
		sky += vec3(0.55, 0.62, 0.85) * moonHalo * uMoonIntensity;

		// Overcast collapses everything toward a flat grey lid.
		if (uOvercast > 0.001) {
			float grey = mix(0.32, 0.6, up);
			sky = mix(sky, vec3(grey), uOvercast);
		}

		gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
	}
`;
