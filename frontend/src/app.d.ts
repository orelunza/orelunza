declare global {
	namespace App {
		/**
		 * Error exposed to SvelteKit error pages.
		 */
		interface Error {
			message: string;
			code?: string;
			status?: number;
		}

		/**
		 * Server-side request context.
		 *
		 * Authentication is currently managed by the backend session cookie
		 * and the client-side session state, so no custom locals are required.
		 */
		interface Locals {}

		/**
		 * Data returned by route load functions.
		 */
		interface PageData {}

		/**
		 * Client-side state attached to navigation history entries.
		 */
		interface PageState {}

		/**
		 * Deployment-platform specific bindings.
		 */
		interface Platform {}
	}
}

export {};
