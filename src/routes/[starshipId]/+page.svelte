<script>
	export let data;
</script>

<h1>{data.starship.name}</h1>

<dl>
	<dt>Starship class</dt>
	<dd>{data.starship.starshipClass || "N/A"}</dd>

	<dt>Cargo capacity</dt>
	<dd>{data.starship.cargoCapacity || "N/A"}</dd>

	<dt>Hyperdrive rating</dt>
	<dd>{data.starship.hyperdriveRating || "N/A"}</dd>

	<dt>Max atmosphering speed</dt>
	<dd>{data.starship.maxAtmospheringSpeed || "N/A"}</dd>

	<dt>Notable pilots</dt>
	<dd>
		{data.starship.pilotConnection?.pilots?.map((p) => p.name)?.join(", ") ||
			"N/A"}
	</dd>
</dl>

<style>
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-auto-flow: row;
	}

	dt::after {
		content: ":";
	}

	dd {
		margin-inline-start: 1rem;
	}
</style>
