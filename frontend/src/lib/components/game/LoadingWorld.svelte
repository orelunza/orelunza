<script lang="ts">
	interface Props {
		message?: string;
		detail?: string;
	}

	let {
		message = 'Loading world',
		detail = 'Generating terrain and preparing the player.'
	}: Props = $props();
</script>

<div class="grid h-dvh w-screen place-items-center bg-[#131619] text-white" role="status">
	<div class="w-[min(28rem,calc(100vw-2rem))] text-center">
		<div
			class="mx-auto mb-5 size-12 animate-spin rounded-full border-2 border-white/15 border-t-[#f97316]"
		></div>
		<p class="m-0 text-lg font-semibold">{message}</p>
		<p class="mt-2 mb-0 text-sm text-white/55">{detail}</p>
	</div>
</div>
