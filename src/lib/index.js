import { FSWatcher } from "chokidar";
import { mkdir, readFile, rm, unlink, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import {
	loadSchema,
	noop,
	promiseWithTimeout,
	queryToDocumentNode,
	queryToTypeDeclaration,
	virtualDeclarationPath,
} from "./helpers.js";
import { GraphQLError } from "graphql";
import { normalizePath } from "vite";

// TODO: Add best practices options

/**
 * Vite Plugin for type safe use of imported GraphQL queries.
 *
 * @returns {import("vite").Plugin}
 */
export default async function vitePluginTypedGql() {
	const virtualBase = ".gql";
	const extension = ".gql";
	const cwd = process.cwd();
	const schemaPath = "./schema.graphql";

	/** @type {import("graphql").DocumentNode} */
	let schema;
	const watcher = new FSWatcher({ cwd });
	const initialGeneration = new Promise((resolve, reject) => {
		watcher.on("ready", resolve);
		watcher.on("error", reject);
	});

	/** @type {(path: string) => Promise<void>} */
	const generateTypeDeclaration = async (path) => {
		const fileContent = await readFile(path, "utf-8");
		const declaration = await queryToTypeDeclaration(fileContent, schema);
		const outputPath = virtualDeclarationPath(path, virtualBase);
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, declaration);
	};

	return {
		name: "rollup-plugin-typed-gql",

		async buildStart() {
			schema = await loadSchema(schemaPath);
			await rm(resolve(cwd, virtualBase), { recursive: true }).catch(noop);
			watcher
				.add(`src/**/*${extension}`)
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
			if (!id.endsWith(extension)) return null;
			const documentNodeFile = await queryToDocumentNode(code, schema).catch(
				(err) => {
					let reason = "Unknown error";
					if (err instanceof GraphQLError) {
						reason = err.message;
					}
					this.warn(`Failed to parse "${normalizePath(id)}": ${reason}`);
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
