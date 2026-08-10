import { chromium } from 'playwright';

const url = process.env.ORELUNZA_PROFILE_URL ?? 'http://127.0.0.1:5173/world';
const browser = await chromium.launch({
	headless: true,
	executablePath: '/usr/bin/google-chrome',
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
console.log(
	JSON.stringify(
		{
			url: page.url(),
			title: await page.title(),
			body: (await page.locator('body').innerText()).slice(0, 500)
		},
		null,
		2
	)
);
console.log(
	JSON.stringify(
		await page.evaluate(() => {
			const canvas = document.querySelector('canvas');
			const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
			const debug = gl?.getExtension('WEBGL_debug_renderer_info');
			return {
				dpr: devicePixelRatio,
				canvas: canvas
					? {
							cssWidth: canvas.clientWidth,
							cssHeight: canvas.clientHeight,
							width: canvas.width,
							height: canvas.height
						}
					: null,
				webgl: gl
					? {
							vendor: debug
								? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)
								: gl.getParameter(gl.VENDOR),
							renderer: debug
								? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
								: gl.getParameter(gl.RENDERER),
							version: gl.getParameter(gl.VERSION)
						}
					: null
			};
		}),
		null,
		2
	)
);
await browser.close();
