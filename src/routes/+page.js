import { request } from "graphql-request";
import { AllStarships } from "./query.gql";

/** @type {<T>(v: T | null | undefined) => v is T} */
const nullFilter = (v) => v !== null || v !== undefined;

export async function load() {
	const result = await request(
		"https://swapi-graphql.eskerda.vercel.app",
		AllStarships
	);

	return { starships: result.allStarships?.starships.filter(nullFilter) || [] };
}
