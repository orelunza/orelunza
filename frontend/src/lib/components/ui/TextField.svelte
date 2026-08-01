<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		id?: string;
		name: string;

		type?: HTMLInputAttributes['type'];
		autocomplete?: HTMLInputAttributes['autocomplete'];
		inputmode?: HTMLInputAttributes['inputmode'];

		label?: string;
		placeholder?: string;

		value?: string;

		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;

		minlength?: number;
		maxlength?: number;

		error?: string | null;
		help?: string;

		class?: string;
	}

	let {
		id,
		name,

		type = 'text',
		autocomplete,
		inputmode,

		label = '',
		placeholder = '',

		value = $bindable(''),

		required = false,
		disabled = false,
		readonly = false,

		minlength,
		maxlength,

		error = null,
		help = '',

		class: className = ''
	}: Props = $props();

	const inputId = $derived(id ?? `field-${name}`);

	const describedBy = $derived.by(() => {
		const ids: string[] = [];

		if (help) {
			ids.push(`${inputId}-help`);
		}

		if (error) {
			ids.push(`${inputId}-error`);
		}

		return ids.length > 0 ? ids.join(' ') : undefined;
	});
</script>

<label for={inputId} class={['grid gap-2', className].filter(Boolean).join(' ')}>
	{#if label}
		<span class="text-sm font-medium text-[var(--orelunza-text-soft)]">
			{label}

			{#if required}
				<span class="text-[var(--orelunza-danger)]" aria-hidden="true"> * </span>
			{/if}
		</span>
	{/if}

	<input
		id={inputId}
		{name}
		{type}
		{autocomplete}
		{inputmode}
		{placeholder}
		{required}
		{disabled}
		{readonly}
		{minlength}
		{maxlength}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		class={[
			'w-full rounded-[var(--orelunza-radius-small)] border px-4 py-3',
			'bg-[var(--orelunza-background-soft)] text-[var(--orelunza-text)]',
			'placeholder:text-[var(--orelunza-text-muted)]',
			'transition outline-none',
			'focus:border-[var(--orelunza-accent)] focus:ring-2',
			'focus:ring-[color-mix(in_srgb,var(--orelunza-accent)_18%,transparent)]',
			'disabled:cursor-not-allowed disabled:opacity-60',
			error ? 'border-[var(--orelunza-danger)]' : 'border-[var(--orelunza-border)]'
		].join(' ')}
	/>

	{#if help}
		<span id={`${inputId}-help`} class="text-xs leading-5 text-[var(--orelunza-text-muted)]">
			{help}
		</span>
	{/if}

	{#if error}
		<span id={`${inputId}-error`} class="text-xs leading-5 text-[var(--orelunza-danger)]">
			{error}
		</span>
	{/if}
</label>
