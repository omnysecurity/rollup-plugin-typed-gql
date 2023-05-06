<script>
	export let data;
</script>

<h1>Starships</h1>

<ul>
	{#each data.starships as starship}
		<li><a href="/{starship.id}">{starship.name}</a></li>
	{/each}
</ul>
