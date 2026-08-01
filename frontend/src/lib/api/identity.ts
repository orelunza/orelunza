import { apiClient, apiRoutes, type ApiClient } from '$lib/api/client';

import type {
	CurrentIdentityResponse,
	LoginRequest,
	LoginResponse,
	LogoutResponse,
	RegisterRequest,
	RegisterResponse
} from '$lib/api/contracts/identity';

/**
 * Client for the Orelunza identity module.
 */
export class IdentityApi {
	constructor(private readonly client: ApiClient = apiClient) {}

	/**
	 * Register a new Orelunza identity.
	 */
	register(request: RegisterRequest, signal?: AbortSignal): Promise<RegisterResponse> {
		const displayName = request.display_name ?? request.displayName ?? '';

		const payload = {
			email: request.email.trim(),
			password: request.password,
			display_name: displayName.trim(),

			...(request.avatar?.trim()
				? {
						avatar: request.avatar.trim()
					}
				: {})
		} satisfies RegisterRequest;

		return this.client.post<RegisterResponse, RegisterRequest>(
			`${apiRoutes.identity}/register`,
			payload,
			{
				signal
			}
		);
	}

	/**
	 * Authenticate an existing identity.
	 */
	login(request: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
		const payload: LoginRequest = {
			email: request.email.trim(),
			password: request.password
		};

		return this.client.post<LoginResponse, LoginRequest>(`${apiRoutes.identity}/login`, payload, {
			signal
		});
	}

	/**
	 * Return the identity attached to the current session cookie.
	 */
	me(signal?: AbortSignal): Promise<CurrentIdentityResponse> {
		return this.client.get<CurrentIdentityResponse>(`${apiRoutes.identity}/me`, {
			signal
		});
	}

	/**
	 * Destroy the current authentication session.
	 */
	logout(signal?: AbortSignal): Promise<LogoutResponse> {
		return this.client.post<LogoutResponse, Record<string, never>>(
			`${apiRoutes.identity}/logout`,
			{},
			{
				signal
			}
		);
	}
}

/**
 * Shared identity API client.
 */
export const identityApi = new IdentityApi();

/**
 * Register a new identity using the shared API client.
 */
export function registerIdentity(
	request: RegisterRequest,
	signal?: AbortSignal
): Promise<RegisterResponse> {
	return identityApi.register(request, signal);
}

/**
 * Authenticate an identity using the shared API client.
 */
export function loginIdentity(request: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
	return identityApi.login(request, signal);
}

/**
 * Return the currently authenticated identity.
 */
export function getCurrentIdentity(signal?: AbortSignal): Promise<CurrentIdentityResponse> {
	return identityApi.me(signal);
}

/**
 * End the current authentication session.
 */
export function logoutIdentity(signal?: AbortSignal): Promise<LogoutResponse> {
	return identityApi.logout(signal);
}
