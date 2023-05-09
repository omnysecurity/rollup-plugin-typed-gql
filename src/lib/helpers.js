import { readFile } from "fs/promises";
import { parse } from "graphql";

/**
 * Load GraphQL schema from disk.
 *
 * @param {string} path
 * Path to GraphQL schema.
 * @returns
 * A `DocumentNode` of the provided schema.
 */
export async function loadSchema(path) {
	const schemaFile = await readFile(path, "utf8");
	const graphqlSchema = parse(schemaFile);
	return graphqlSchema;
}

/**
 * Wraps a promise in a timeout. If the timeout is reached before the promise
 * resolves, the promise rejects with the provided reason.
 *
 * @template T
 * @param {Promise<T>} promise
 * The promise to wrap in a timeout.
 * @param {number} ms
 * Number of milliseconds before the timeout kicks in.
 * @param {string} reason
 * The reason provided if rejecting due to timeout. Default: "Timeout".
 * @returns {Promise<T>}
 * A new promise that resolves as normally within the given time limit,
 * but rejects if the time limit is exceeded.
 */
export function promiseWithTimeout(promise, ms, reason = "Timeout") {
	const timeoutPromise = new Promise((_, reject) =>
		setTimeout(() => reject(reason), ms)
	);
	return Promise.race([promise, timeoutPromise]);
}

/**
 * No operation function
 */
export function noop() {}
