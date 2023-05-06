import { request } from "graphql-request";
import { Starship } from "./query.gql";
import { error } from "@sveltejs/kit";

export async function load({ params }) {
	const result = await request(
		"https://swapi-graphql.eskerda.vercel.app",
		Starship,
		{ id: params.starshipId }
	);

	if (!result.starship)
		return error(404, "Cannot find the starship you're looking for.");

	return { starship: result.starship };
}
