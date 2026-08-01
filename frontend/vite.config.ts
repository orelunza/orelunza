import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	const backendUrl = env.VIX_API_PROXY_TARGET?.trim() || DEFAULT_BACKEND_URL;

	return {
		plugins: [tailwindcss(), sveltekit()],

		server: {
			host: '127.0.0.1',
			port: 5173,
			strictPort: true,

			proxy: {
				'/api': {
					target: backendUrl,
					changeOrigin: true,
					secure: false
				}
			}
		},

		preview: {
			host: '127.0.0.1',
			port: 4173,
			strictPort: true
		}
	};
});
