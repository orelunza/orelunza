import { ApiError } from '$lib/api/ApiError';

import {
	getCurrentIdentity,
	loginIdentity,
	logoutIdentity,
	registerIdentity
} from '$lib/api/identity';

import type { CurrentIdentity, LoginRequest, RegisterRequest } from '$lib/api/contracts/identity';

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

/**
 * Reactive authentication state for the Orelunza frontend.
 */
class SessionState {
	identity = $state<CurrentIdentity | null>(null);
	status = $state<SessionStatus>('idle');
	error = $state<ApiError | null>(null);

	private requestVersion = 0;

	get isLoading(): boolean {
		return this.status === 'loading';
	}

	get isAuthenticated(): boolean {
		return this.status === 'authenticated' && this.identity !== null;
	}

	get isAnonymous(): boolean {
		return this.status === 'anonymous';
	}

	get displayName(): string {
		return this.identity?.display_name ?? '';
	}

	get humanId(): string | null {
		return this.identity?.human_id ?? null;
	}

	get personaId(): string | null {
		return this.identity?.persona_id ?? null;
	}

	get avatar(): string {
		return this.identity?.avatar ?? '';
	}

	/**
	 * Read the identity attached to the current session cookie.
	 */
	async refresh(signal?: AbortSignal): Promise<CurrentIdentity | null> {
		const version = ++this.requestVersion;

		this.status = 'loading';
		this.error = null;

		try {
			const response = await getCurrentIdentity(signal);

			if (version !== this.requestVersion) {
				return this.identity;
			}

			this.identity = response;
			this.status = 'authenticated';

			return this.identity;
		} catch (error) {
			if (version !== this.requestVersion) {
				return this.identity;
			}

			const apiError = ApiError.fromUnknown(error);

			if (apiError.isUnauthorized || apiError.is('invalid_session')) {
				this.identity = null;
				this.status = 'anonymous';
				this.error = null;

				return null;
			}

			this.identity = null;
			this.status = 'anonymous';
			this.error = apiError;

			throw apiError;
		}
	}

	/**
	 * Authenticate an existing citizen.
	 */
	async login(request: LoginRequest, signal?: AbortSignal): Promise<CurrentIdentity> {
		const version = ++this.requestVersion;

		this.status = 'loading';
		this.error = null;

		try {
			const response = await loginIdentity(request, signal);

			if (version !== this.requestVersion) {
				return response;
			}

			this.identity = response;
			this.status = 'authenticated';

			return response;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersion) {
				this.identity = null;
				this.status = 'anonymous';
				this.error = apiError;
			}

			throw apiError;
		}
	}

	/**
	 * Register and authenticate a new citizen.
	 */
	async register(request: RegisterRequest, signal?: AbortSignal): Promise<CurrentIdentity> {
		const version = ++this.requestVersion;

		this.status = 'loading';
		this.error = null;

		try {
			const response = await registerIdentity(request, signal);

			if (version !== this.requestVersion) {
				return response;
			}

			this.identity = response;
			this.status = 'authenticated';

			return response;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersion) {
				this.identity = null;
				this.status = 'anonymous';
				this.error = apiError;
			}

			throw apiError;
		}
	}

	/**
	 * Destroy the active session.
	 */
	async logout(signal?: AbortSignal): Promise<void> {
		const version = ++this.requestVersion;

		this.status = 'loading';
		this.error = null;

		try {
			await logoutIdentity(signal);
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			/*
			 * An already-expired session is equivalent to a successful
			 * logout from the frontend's perspective.
			 */
			if (!apiError.isUnauthorized && !apiError.is('invalid_session')) {
				if (version === this.requestVersion) {
					this.error = apiError;
				}

				throw apiError;
			}
		} finally {
			if (version === this.requestVersion) {
				this.identity = null;
				this.status = 'anonymous';
			}
		}
	}

	/**
	 * Remove the current displayed error.
	 */
	clearError(): void {
		this.error = null;
	}

	/**
	 * Clear all local authentication state.
	 *
	 * This does not call the backend logout endpoint.
	 */
	reset(): void {
		++this.requestVersion;

		this.identity = null;
		this.status = 'idle';
		this.error = null;
	}
}

/**
 * Shared reactive session state.
 */
export const sessionState = new SessionState();
