import { FSWatcher } from "chokidar";
import { mkdir, readFile, rm, unlink, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import {
	loadSchema,
	noop,
	promiseWithTimeout,
	queryToDocumentNode,
	queryToTypeDeclaration,
	virtualDeclarationPath,
} from "./helpers.js";
import { GraphQLError } from "graphql";

/**
 * @typedef {Object} PluginOptions
 * @property {string} [schema]
 * Path to your GraphQL schema. Default "schema.graphql".
 * @property {string} [searchDir]
 * Path to directory to search for GraphQL files. Default "src".
 * @property {`.${string}`[]} [extensions]
 * Extension used for your GraphQL files. Default [".gql", ".graphql"].
 * @property {string} [virtualDir]
 * Directory to store generated type declarations. If you want your type
 * declarations next to your GraphQL files pass ".". Default ".gql".
 * @property {string} [baseDir]
 * Base directory to search for files. Defaults to the current working
 * directory (`process.cwd()`).
 */

/**
 * Rollup Plugin for type safe use of imported GraphQL queries.
 *
 * @param {PluginOptions} [options]
 * @returns {import("rollup").Plugin}
 */
export default function typedGql(options) {
	const schemaPath = options?.schema ?? "schema.graphql";
	const searchDir = options?.searchDir ?? "src";
	const virtualDir = options?.virtualDir ?? ".gql";
	const extensions = options?.extensions ?? [".gql", ".graphql"];
	const cwd = options?.baseDir ?? process.cwd();

	/** @type {import("graphql").DocumentNode} */
	let schema;
	const searchGlobs = extensions.map((ext) => join(searchDir, "**", `*${ext}`));
	const watcher = new FSWatcher({ cwd, ignored: schemaPath });
	const initialGeneration = new Promise((resolve, reject) => {
		watcher.on("ready", resolve);
		watcher.on("error", reject);
	});

	/** @type {(path: string) => Promise<void>} */
	const generateTypeDeclaration = async (path) => {
		const fileContent = await readFile(path, "utf-8");
		const declaration = await queryToTypeDeclaration(fileContent, schema);
		const outputPath = virtualDeclarationPath(path, virtualDir);
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, declaration);
	};

	return {
		name: "rollup-plugin-typed-gql",

		async buildStart() {
			schema = await loadSchema(schemaPath);
			await rm(resolve(cwd, virtualDir), { recursive: true }).catch(noop);
			watcher
				.add(searchGlobs)
				.on("add", (path) =>
					generateTypeDeclaration(path).catch(() =>
						this.warn(`Failed to parse GQL file: ${path}`)
					)
				);
			if (this.meta.watchMode)
				watcher
					.on("change", (path) =>
						generateTypeDeclaration(path).catch(() =>
							this.warn(`Failed to parse GQL file: ${path}`)
						)
					)
					.on("unlink", (path) =>
						unlink(virtualDeclarationPath(path)).catch(noop)
					);
		},

		async transform(code, id) {
			if (!extensions.some((ext) => id.endsWith(ext))) return null;
			const documentNodeFile = await queryToDocumentNode(code, schema).catch(
				(err) => {
					let reason = "Unknown error";
					if (err instanceof GraphQLError) {
						reason = err.message;
					}
					this.warn(`Failed to parse "${id}": ${reason}`);
					return `throw new Error("Failed to parse GQL file.")`;
				}
			);
			// TODO: sourcemaps?
			return { code: documentNodeFile, map: { mappings: "" } };
		},

		async buildEnd() {
			try {
				await promiseWithTimeout(
					initialGeneration,
					2000,
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
