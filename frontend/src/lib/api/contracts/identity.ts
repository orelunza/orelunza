import type { ApiSuccessResponse } from '$lib/api/contracts/common';

/**
 * Public identity information returned by the backend.
 */
export interface IdentityProfile {
	account_id: string;
	human_id: string;
	persona_id: string;

	email: string;
	display_name: string;
	avatar: string;

	active: boolean;
	email_verified: boolean;
}

/**
 * Active authentication session.
 */
export interface IdentitySession extends IdentityProfile {
	session_id: string;
	session_expires_at: number;
}

/**
 * Payload sent to the registration endpoint.
 */
export interface RegisterRequest {
	email: string;
	password: string;
	display_name?: string;
	displayName?: string;
	avatar?: string;
}

/**
 * Response returned after successful registration.
 */
export interface RegisterResponse extends ApiSuccessResponse, IdentitySession {
	ok: true;
}

/**
 * Payload sent to the login endpoint.
 */
export interface LoginRequest {
	email: string;
	password: string;
}

/**
 * Response returned after successful authentication.
 */
export interface LoginResponse extends ApiSuccessResponse, IdentitySession {
	ok: true;
}

/**
 * Response returned by `/api/identity/me`.
 *
 * Session metadata is optional because the current identity is the primary
 * contract of this endpoint.
 */
export interface CurrentIdentityResponse extends ApiSuccessResponse, IdentityProfile {
	ok: true;
	session_id?: string;
	session_expires_at?: number;
}

/**
 * Response returned after logout.
 */
export interface LogoutResponse extends ApiSuccessResponse {
	ok: true;
}

/**
 * Identity currently stored by the frontend.
 */
export type CurrentIdentity = IdentitySession | IdentityProfile;
