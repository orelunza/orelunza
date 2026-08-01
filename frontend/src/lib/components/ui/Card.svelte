<script lang="ts">
	import type { Snippet } from 'svelte';

	export type CardPadding = 'none' | 'small' | 'medium' | 'large';

	export type CardTone = 'default' | 'muted' | 'transparent';

	interface Props {
		title?: string;
		description?: string;

		children?: Snippet;
		header?: Snippet;
		actions?: Snippet;
		footer?: Snippet;

		padding?: CardPadding;
		tone?: CardTone;

		ariaLabel?: string;
		class?: string;
	}

	let {
		title = '',
		description = '',
		children,
		header,
		actions,
		footer,
		padding = 'medium',
		tone = 'default',
		ariaLabel,
		class: className = ''
	}: Props = $props();

	const paddingClasses: Record<CardPadding, string> = {
		none: '',
		small: 'p-3',
		medium: 'p-5',
		large: 'p-6 md:p-8'
	};

	const toneClasses: Record<CardTone, string> = {
		default: 'border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]',
		muted: 'border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)]',
		transparent: 'border-transparent bg-transparent'
	};

	const classes = $derived(
		['overflow-hidden rounded-[var(--orelunza-radius-medium)] border', toneClasses[tone], className]
			.filter(Boolean)
			.join(' ')
	);

	const bodyClasses = $derived(paddingClasses[padding]);

	const hasHeader = $derived(Boolean(header || title || description || actions));
</script>

<section class={classes} aria-label={ariaLabel}>
	{#if hasHeader}
		<header
			class="flex items-start justify-between gap-4 border-b border-[var(--orelunza-border)] px-5 py-4"
		>
			<div class="min-w-0 flex-1">
				{#if header}
					{@render header()}
				{:else}
					{#if title}
						<h2 class="m-0 text-base font-semibold text-[var(--orelunza-text)]">
							{title}
						</h2>
					{/if}

					{#if description}
						<p class="mt-1 mb-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
							{description}
						</p>
					{/if}
				{/if}
			</div>

			{#if actions}
				<div class="shrink-0">
					{@render actions()}
				</div>
			{/if}
		</header>
	{/if}

	<div class={bodyClasses}>
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if footer}
		<footer
			class="border-t border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)] px-5 py-4"
		>
			{@render footer()}
		</footer>
	{/if}
</section>
