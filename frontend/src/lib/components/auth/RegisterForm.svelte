<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';

	import { ApiError } from '$lib/api/ApiError';
	import { sessionState } from '$lib/state/session.svelte';

	import type { RegisterRequest } from '$lib/api/contracts/identity';

	interface Props {
		onSuccess?: () => void | Promise<void>;
	}

	let { onSuccess }: Props = $props();

	let displayName = $state('');
	let email = $state('');
	let password = $state('');
	let passwordConfirmation = $state('');

	let displayNameError = $state<string | null>(null);
	let emailError = $state<string | null>(null);
	let passwordError = $state<string | null>(null);
	let passwordConfirmationError = $state<string | null>(null);

	let submitError = $state<ApiError | null>(null);
	let submitting = $state(false);

	function formString(formData: FormData, name: string): string {
		const value = formData.get(name);

		return typeof value === 'string' ? value : '';
	}

	function syncFromForm(form: HTMLFormElement): void {
		const formData = new FormData(form);

		displayName = formString(formData, 'display_name');
		email = formString(formData, 'email');
		password = formString(formData, 'password');
		passwordConfirmation = formString(formData, 'confirm_password');
	}

	function validate(): boolean {
		displayNameError = null;
		emailError = null;
		passwordError = null;
		passwordConfirmationError = null;
		submitError = null;

		const normalizedDisplayName = displayName.trim();

		const normalizedEmail = email.trim();

		if (!normalizedDisplayName) {
			displayNameError = 'Choose a name for your citizen.';
		} else if (normalizedDisplayName.length < 2) {
			displayNameError = 'Your citizen name must contain at least 2 characters.';
		}

		if (!normalizedEmail) {
			emailError = 'Enter your email address.';
		} else if (!normalizedEmail.includes('@')) {
			emailError = 'Enter a valid email address.';
		}

		if (!password) {
			passwordError = 'Create a password.';
		} else if (password.length < 8) {
			passwordError = 'Your password must contain at least 8 characters.';
		}

		if (!passwordConfirmation) {
			passwordConfirmationError = 'Confirm your password.';
		} else if (passwordConfirmation !== password) {
			passwordConfirmationError = 'The passwords do not match.';
		}

		return !displayNameError && !emailError && !passwordError && !passwordConfirmationError;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		syncFromForm(event.currentTarget as HTMLFormElement);

		if (submitting || !validate()) {
			return;
		}

		submitting = true;
		submitError = null;

		const request: RegisterRequest = {
			display_name: displayName.trim(),
			email: email.trim(),
			password
		};

		try {
			await sessionState.register(request);
			await onSuccess?.();
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (
				apiError.is('email_already_exists') ||
				apiError.is('identity_already_exists') ||
				apiError.status === 409
			) {
				submitError = new ApiError('An Orelunza identity already exists with this email address.', {
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
			label="Citizen name"
			type="text"
			name="display_name"
			autocomplete="nickname"
			placeholder="How should Orelunza call you?"
			bind:value={displayName}
			error={displayNameError}
			disabled={submitting}
			maxlength={64}
			required
		/>

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
			autocomplete="new-password"
			placeholder="At least 8 characters"
			bind:value={password}
			error={passwordError}
			help="Use a password you do not use elsewhere."
			disabled={submitting}
			minlength={8}
			required
		/>

		<TextField
			label="Confirm password"
			type="password"
			name="confirm_password"
			autocomplete="new-password"
			placeholder="Enter the password again"
			bind:value={passwordConfirmation}
			error={passwordConfirmationError}
			disabled={submitting}
			minlength={8}
			required
		/>
	</div>

	<ErrorNotice
		error={submitError}
		title="Unable to create your identity"
		dismissible
		onDismiss={() => {
			submitError = null;
			sessionState.clearError();
		}}
	/>

	<Button type="submit" size="large" fullWidth loading={submitting} disabled={submitting}>
		{#if submitting}
			Creating your identity…
		{:else}
			Become a citizen
		{/if}
	</Button>

	<p class="m-0 text-center text-xs leading-5 text-[var(--orelunza-text-muted)]">
		Orelunza has no public follower counts, likes or popularity scores.
	</p>
</form>
