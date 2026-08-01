import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { Buffer } from 'node:buffer';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080';

const HOP_BY_HOP_HEADERS = new Set([
	'connection',
	'content-length',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade'
]);

function apiDevProxy(backendUrl: string): Plugin {
	return {
		name: 'orelunza-api-dev-proxy',

		configureServer(server) {
			server.middlewares.use('/api', (request, response) => {
				const chunks: Buffer[] = [];

				request.on('data', (chunk: Buffer | string) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});

				request.on('error', () => {
					response.statusCode = 502;
					response.setHeader('Content-Type', 'application/json; charset=utf-8');
					response.end(
						JSON.stringify({
							ok: false,
							error: 'api_proxy_error',
							message: 'Unable to read the proxied API request.'
						})
					);
				});

				request.on('end', async () => {
					const requestPath = request.url?.startsWith('/api')
						? request.url
						: `/api${request.url ?? ''}`;
					const targetUrl = new URL(requestPath, backendUrl);
					const body = Buffer.concat(chunks);
					const headers: Record<string, string | string[]> = {};

					for (const [name, value] of Object.entries(request.headers)) {
						const lowerName = name.toLowerCase();

						if (HOP_BY_HOP_HEADERS.has(lowerName) || value === undefined) {
							continue;
						}

						if (lowerName === 'accept') {
							headers.Accept = value;
						} else if (lowerName === 'content-type') {
							headers['Content-Type'] = value;
						} else {
							headers[name] = value;
						}
					}

					if (request.method !== 'GET' && request.method !== 'HEAD') {
						headers['Content-Length'] = String(body.length);
					}

					const forward = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest;

					const proxyRequest = forward(
						targetUrl,
						{
							method: request.method,
							headers
						},
						(proxyResponse) => {
							response.statusCode = proxyResponse.statusCode ?? 502;
							response.statusMessage = proxyResponse.statusMessage ?? '';

							for (const [name, value] of Object.entries(proxyResponse.headers)) {
								if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
									response.setHeader(name, value);
								}
							}

							proxyResponse.pipe(response);
						}
					);

					proxyRequest.on('error', () => {
						response.statusCode = 502;
						response.setHeader('Content-Type', 'application/json; charset=utf-8');
						response.end(
							JSON.stringify({
								ok: false,
								error: 'api_proxy_unavailable',
								message: 'Unable to reach the Orelunza API server.'
							})
						);
					});

					proxyRequest.end(
						request.method === 'GET' || request.method === 'HEAD' ? undefined : body
					);
				});
			});
		}
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	const backendUrl = env.VIX_API_PROXY_TARGET?.trim() || DEFAULT_BACKEND_URL;

	return {
		plugins: [apiDevProxy(backendUrl), tailwindcss(), sveltekit()],

		server: {
			host: '127.0.0.1',
			port: 5173,
			strictPort: true
		},

		preview: {
			host: '127.0.0.1',
			port: 4173,
			strictPort: true
		},

		test: {
			include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/unit/**/*.test.ts'],
			exclude: [
				'node_modules/**',
				'.svelte-kit/**',
				'tests/e2e/**',
				'src/lib/vitest-examples/Welcome.svelte.spec.ts'
			]
		}
	};
});
