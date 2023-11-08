import { FSWatcher } from "chokidar";
import { GraphQLError } from "graphql";
import { join } from "path";
import { GqlDeclarationWriter } from "./gql-parser.js";
import { loadSchema, noop, promiseWithTimeout } from "./helpers.js";

/**
 * @typedef {Object} PluginOptions
 * @property {string} [schema]
 * Path to your GraphQL schema. Default "schema.graphql".
 * @property {Record<string, string>} [scalars]
 * Custom scalars. Default {}.
 * @property {string} [searchDir]
 * Path to directory to search for GraphQL files. Default "src".
 * @property {`${string}.${string}`[]} [extensions]
 * Extension used for your GraphQL files. Default [".gql", ".graphql"].
 * @property {string} [baseDir]
 * Base directory to search for files. Defaults to the current working
 * directory (`process.cwd()`).
 * @property {number} [startupTimeout]
 * Time to complete initial generation. Default 2000 (ms)
 */

/**
 * Rollup Plugin for type safe use of imported GraphQL queries.
 *
 * @param {PluginOptions} [options]
 * @returns {import("rollup").Plugin}
 */
export default function typedGql(options) {
	const schemaPath = options?.schema ?? "schema.graphql";
	const scalars = options?.scalars ?? {};
	const searchDir = options?.searchDir ?? "src";
	const extensions = options?.extensions ?? [".gql", ".graphql"];
	const cwd = options?.baseDir ?? process.cwd();

	/** @type {GqlDeclarationWriter} */
	let writer;
	const searchGlobs = extensions.map((ext) => join("**", `*${ext}`));
	const watcher = new FSWatcher({
		cwd: join(cwd, searchDir),
		ignored: schemaPath,
	});
	const initialGeneration = new Promise((resolve, reject) => {
		watcher.on("ready", resolve);
		watcher.on("error", reject);
	});

	return {
		name: "rollup-plugin-typed-gql",

		async buildStart() {
			const schema = await loadSchema(schemaPath);
			writer = await GqlDeclarationWriter.initialize(schema, scalars, cwd);
			let outDirPath = (watcherPath) => join(searchDir, watcherPath);
			watcher
				.add(searchGlobs)
				.on("add", (path) =>
					writer
						.writeQueryDeclaration(outDirPath(path))
						.catch(() => this.warn(`Failed to parse GQL file: ${path}`))
				)
				.on("change", (path) =>
					writer
						.writeQueryDeclaration(outDirPath(path))
						.catch(() => this.warn(`Failed to parse GQL file: ${path}`))
				)
				.on("unlink", (path) =>
					writer.removeQueryDeclaration(outDirPath(path)).catch(noop)
				);
		},

		async transform(code, id) {
			if (!extensions.some((ext) => id.endsWith(ext))) return null;
			const js = await writer.queryToJs(code).catch((err) => {
				let reason = "Unknown error";
				if (err instanceof GraphQLError) {
					reason = err.message;
				}
				this.warn(`Failed to parse "${id}": ${reason}`);
				return `throw new Error("Failed to parse GQL file.")`;
			});
			// TODO: sourcemaps?
			return { code: js, map: { mappings: "" } };
		},

		async buildEnd() {
			try {
				await promiseWithTimeout(
					initialGeneration,
					options.startupTimeout ?? 2000,
					"Timed out while generating type declarations for GraphQL queries."
				);
			} catch (err) {
				console.error(err);
			} finally {
				await watcher.close();
			}
		},
	};
}

export * from "./helpers.js";
