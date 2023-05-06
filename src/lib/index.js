import glob from "fast-glob";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, relative } from "path";
import { normalizePath } from "vite";
import {
	queryToTypeDeclaration,
	loadSchema,
	queryToDocumentNode,
} from "./helpers.js";

export * from "./helpers.js";

// TODO: Add best practices options
// TODO: Use chokidar to watch .gql files (https://github.com/paulmillr/chokidar)

/**
 * Vite Plugin for type safe use of imported GraphQL queries.
 *
 * @returns {import("vite").Plugin}
 */
export default async function vitePluginTypedGql() {
	const virtualDir = ".gql";
	const extension = ".gql";
	const schemaPath = normalizePath("./schema.graphql");
	let schema = await loadSchema(schemaPath);
	const cwd = process.cwd();

	/** @type {(path: string) => Promise<void>} */
	const generateTypeDeclaration = async (path) => {
		const fileContent = await readFile(path, "utf-8");
		const declaration = await queryToTypeDeclaration(fileContent, schema);
		//TODO: Is it safe to always assume relative paths here?
		const pathWithoutExtension = path.slice(0, -extension.length);
		const outputFilePath =
			join(virtualDir, pathWithoutExtension) + `.d${extension}.ts`;
		await mkdir(dirname(outputFilePath), { recursive: true });
		return writeFile(outputFilePath, declaration);
	};

	return {
		name: "vite-plugin-typed-gql",
		async buildStart() {
			const gqlFiles = await glob(`src/**/*${extension}`);
			// TODO: Rewrite to allSettled to improve error handling
			await Promise.all(
				gqlFiles
					.map(normalizePath)
					.filter((path) => path !== schemaPath)
					.map(generateTypeDeclaration)
			);
		},

		async transform(code, id) {
			if (!id.endsWith(extension)) return null;
			const documentNodeFile = await queryToDocumentNode(code, schema);
			return { code: documentNodeFile, map: { mappings: "" } };
		},

		async handleHotUpdate(ctx) {
			if (!ctx.file.endsWith(extension)) return null;
			const path = normalizePath(relative(cwd, ctx.file));
			// TODO: Handle schema changes
			if (path.endsWith(schemaPath)) return;
			await generateTypeDeclaration(path);
		},
	};
}
