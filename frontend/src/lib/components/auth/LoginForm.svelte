<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';

	import { ApiError } from '$lib/api/ApiError';
	import { sessionState } from '$lib/state/session.svelte';

	import type { LoginRequest } from '$lib/api/contracts/identity';

	interface Props {
		onSuccess?: () => void | Promise<void>;
	}

	let { onSuccess }: Props = $props();

	let email = $state('');
	let password = $state('');

	let emailError = $state<string | null>(null);
	let passwordError = $state<string | null>(null);
	let submitError = $state<ApiError | null>(null);
	let submitting = $state(false);

	function validate(): boolean {
		emailError = null;
		passwordError = null;
		submitError = null;

		const normalizedEmail = email.trim();

		if (!normalizedEmail) {
			emailError = 'Enter your email address.';
		} else if (!normalizedEmail.includes('@')) {
			emailError = 'Enter a valid email address.';
		}

		if (!password) {
			passwordError = 'Enter your password.';
		}

		return !emailError && !passwordError;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		if (submitting || !validate()) {
			return;
		}

		submitting = true;
		submitError = null;

		const request: LoginRequest = {
			email: email.trim(),
			password
		};

		try {
			await sessionState.login(request);
			await onSuccess?.();
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (apiError.is('invalid_credentials') || apiError.isUnauthorized) {
				submitError = new ApiError('The email address or password is incorrect.', {
					status: apiError.status,
					statusText: apiError.statusText,
					code: apiError.code,
					method: apiError.method,
					url: apiError.url,
					cause: apiError
				});
			} else {
				submitError = apiError;
			}
		} finally {
			submitting = false;
		}
	}
</script>

<form class="grid gap-5" onsubmit={submit} novalidate>
	<div class="grid gap-4">
		<TextField
			label="Email address"
			type="email"
			name="email"
			autocomplete="email"
			placeholder="you@example.com"
			bind:value={email}
			error={emailError}
			disabled={submitting}
			required
		/>

		<TextField
			label="Password"
			type="password"
			name="password"
			autocomplete="current-password"
			placeholder="Enter your password"
			bind:value={password}
			error={passwordError}
			disabled={submitting}
			required
		/>
	</div>

	<ErrorNotice
		error={submitError}
		title="Unable to sign in"
		dismissible
		onDismiss={() => {
			submitError = null;
			sessionState.clearError();
		}}
	/>

	<Button type="submit" size="large" fullWidth loading={submitting} disabled={submitting}>
		{#if submitting}
			Entering Orelunza…
		{:else}
			Enter Orelunza
		{/if}
	</Button>
</form>
