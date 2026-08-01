<script lang="ts">
	import { onMount } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import type { IdentitySession } from '$lib/api/contracts/identity';

	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import PositionPanel from '$lib/components/world/PositionPanel.svelte';

	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	let loading = $state(true);
	let refreshing = $state(false);
	let pageError = $state<ApiError | null>(null);

	let controller: AbortController | null = null;

	const identity = $derived(sessionState.identity);

	const session = $derived.by(() => {
		if (identity && 'session_id' in identity) {
			return identity as IdentitySession;
		}

		return null;
	});

	const currentRegion = $derived.by(() => {
		const regionId = worldState.position?.region_id;

		if (!regionId) {
			return null;
		}

		return worldState.regions.find((region) => region.id === regionId) ?? null;
	});

	const currentPlace = $derived.by(() => {
		const placeId = worldState.position?.place_id;

		if (!placeId) {
			return null;
		}

		return worldState.places.find((place) => place.id === placeId) ?? null;
	});

	const avatarLetter = $derived(identity?.display_name?.slice(0, 1).toUpperCase() ?? 'C');

	function formatTimestamp(value: number | undefined): string {
		if (!value) {
			return 'Unknown';
		}

		const timestamp = value < 10_000_000_000 ? value * 1000 : value;

		const date = new Date(timestamp);

		if (Number.isNaN(date.getTime())) {
			return 'Unknown';
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	async function loadPositionContext(signal?: AbortSignal): Promise<void> {
		const position = await worldState.loadPosition(signal);

		if (!position) {
			return;
		}

		if (worldState.regions.length === 0) {
			await worldState.loadRegions(signal);
		}

		const region =
			worldState.regions.find((candidate) => candidate.id === position.region_id) ?? null;

		if (region) {
			worldState.selectedRegion = region;
		} else {
			await worldState.selectRegion(position.region_id, signal);
		}

		await worldState.loadRegionPlaces(position.region_id, signal);

		if (position.place_id) {
			const place =
				worldState.places.find((candidate) => candidate.id === position.place_id) ?? null;

			if (place) {
				worldState.selectedPlace = place;
			} else {
				await worldState.selectPlace(position.place_id, signal);
			}
		}
	}

	async function initialize(signal?: AbortSignal): Promise<void> {
		loading = true;
		pageError = null;

		try {
			if (!sessionState.identity) {
				await sessionState.refresh(signal);
			}

			await loadPositionContext(signal);
		} catch (error) {
			if (signal?.aborted) {
				return;
			}

			pageError = ApiError.fromUnknown(error);
		} finally {
			if (!signal?.aborted) {
				loading = false;
			}
		}
	}

	async function refreshProfile(): Promise<void> {
		if (refreshing) {
			return;
		}

		refreshing = true;
		pageError = null;

		try {
			await sessionState.refresh();
			await loadPositionContext();
		} catch (error) {
			pageError = ApiError.fromUnknown(error);
		} finally {
			refreshing = false;
		}
	}

	onMount(() => {
		controller = new AbortController();

		void initialize(controller.signal);

		return () => {
			controller?.abort();
		};
	});
</script>

<svelte:head>
	<title>Profile — Orelunza</title>

	<meta name="description" content="View your Orelunza identity and current position." />
</svelte:head>

<div class="grid gap-6">
	<section
		class="relative overflow-hidden rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-5 py-7 sm:px-7"
	>
		<div
			class="pointer-events-none absolute top-[-8rem] right-[-5rem] size-72 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_13%,transparent)] blur-3xl"
			aria-hidden="true"
		></div>

		<div class="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
			<div>
				<p
					class="mb-2 text-xs font-semibold tracking-[0.18em] text-[var(--orelunza-accent)] uppercase"
				>
					Citizen profile
				</p>

				<h1
					class="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--orelunza-text)] sm:text-4xl"
				>
					Your identity
				</h1>

				<p class="mt-3 mb-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
					This is the identity attached to your current Orelunza session.
				</p>
			</div>

			<Button
				variant="secondary"
				loading={refreshing}
				disabled={refreshing}
				onclick={refreshProfile}
			>
				Refresh profile
			</Button>
		</div>
	</section>

	<ErrorNotice
		error={pageError}
		title="The profile could not be updated"
		dismissible
		onDismiss={() => {
			pageError = null;
			sessionState.clearError();
			worldState.clearError();
		}}
	/>

	{#if loading}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
		>
			<LoadingScreen
				message="Loading your profile…"
				detail="Reading your identity and current position."
			/>
		</section>
	{:else if identity}
		<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
			<div class="grid gap-6">
				<Card padding="large" class="app-surface" ariaLabel="Citizen identity">
					<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
						<div
							class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] text-3xl font-semibold text-[var(--orelunza-accent)]"
						>
							{#if identity.avatar}
								<img src={identity.avatar} alt="" class="size-full object-cover" />
							{:else}
								{avatarLetter}
							{/if}
						</div>

						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h2
									class="m-0 truncate text-3xl font-semibold tracking-[-0.04em] text-[var(--orelunza-text)]"
								>
									{identity.display_name}
								</h2>

								{#if identity.active}
									<span
										class="rounded-full border border-[color-mix(in_srgb,var(--orelunza-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--orelunza-success)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--orelunza-success)]"
									>
										Active citizen
									</span>
								{/if}
							</div>

							<p class="mt-2 mb-0 truncate text-sm text-[var(--orelunza-text-muted)]">
								{identity.email}
							</p>
						</div>
					</div>
				</Card>

				<Card
					title="Identity details"
					description="Stable identifiers assigned by the identity module."
					padding="medium"
				>
					<dl class="grid gap-3 sm:grid-cols-2">
						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Account ID</dt>

							<dd class="mt-2 mb-0 font-mono text-sm break-all text-[var(--orelunza-text)]">
								{identity.account_id}
							</dd>
						</div>

						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Human ID</dt>

							<dd class="mt-2 mb-0 font-mono text-sm break-all text-[var(--orelunza-text)]">
								{identity.human_id}
							</dd>
						</div>

						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Persona ID</dt>

							<dd class="mt-2 mb-0 font-mono text-sm break-all text-[var(--orelunza-text)]">
								{identity.persona_id}
							</dd>
						</div>

						<div
							class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
						>
							<dt class="text-xs text-[var(--orelunza-text-muted)]">Email verification</dt>

							<dd class="mt-2 mb-0 text-sm font-semibold text-[var(--orelunza-text)]">
								{identity.email_verified ? 'Verified' : 'Not verified'}
							</dd>
						</div>
					</dl>
				</Card>

				<Card
					title="Current session"
					description="Information about the browser session currently in use."
					padding="medium"
				>
					{#if session}
						<dl class="grid gap-3 sm:grid-cols-2">
							<div
								class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
							>
								<dt class="text-xs text-[var(--orelunza-text-muted)]">Session ID</dt>

								<dd class="mt-2 mb-0 font-mono text-sm break-all text-[var(--orelunza-text)]">
									{session.session_id}
								</dd>
							</div>

							<div
								class="rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-4"
							>
								<dt class="text-xs text-[var(--orelunza-text-muted)]">Expires</dt>

								<dd class="mt-2 mb-0 text-sm font-semibold text-[var(--orelunza-text)]">
									{formatTimestamp(session.session_expires_at)}
								</dd>
							</div>
						</dl>
					{:else}
						<p class="m-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
							The current identity endpoint did not return session metadata.
						</p>
					{/if}
				</Card>

				<section
					class="rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] p-5"
				>
					<h2 class="m-0 text-base font-semibold text-[var(--orelunza-text)]">
						A private identity
					</h2>

					<p class="mt-2 mb-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
						Orelunza does not display public follower counts, likes or popularity scores on your
						profile.
					</p>
				</section>
			</div>

			<aside class="grid gap-5 xl:sticky xl:top-24">
				<PositionPanel
					position={worldState.position}
					region={currentRegion}
					place={currentPlace}
					refreshing={worldState.loading === 'position'}
					onRefresh={() => loadPositionContext()}
				/>

				<a
					href="/city"
					class="flex items-center justify-between rounded-[var(--orelunza-radius-medium)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-5 py-4 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-raised)] hover:text-[var(--orelunza-text)]"
				>
					<span>Return to the city</span>

					<span aria-hidden="true">→</span>
				</a>
			</aside>
		</div>
	{:else}
		<section
			class="rounded-[var(--orelunza-radius-large)] border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] px-6 py-14 text-center"
		>
			<h1 class="m-0 text-2xl font-semibold text-[var(--orelunza-text)]">Identity unavailable</h1>

			<p class="mx-auto mt-3 mb-0 max-w-lg text-sm leading-6 text-[var(--orelunza-text-muted)]">
				Your identity could not be read from the current session.
			</p>

			<a
				href="/login"
				class="mt-6 inline-flex rounded-xl bg-[var(--orelunza-accent)] px-5 py-3 text-sm font-semibold text-[var(--orelunza-accent-contrast)]"
			>
				Return to sign in
			</a>
		</section>
	{/if}
</div>
