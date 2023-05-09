import { codegen } from "@graphql-codegen/core";
import * as typedDocumentNodePlugin from "@graphql-codegen/typed-document-node";
import * as typescriptPlugin from "@graphql-codegen/typescript";
import * as typescriptOperationsPlugin from "@graphql-codegen/typescript-operations";
import { loadDocuments } from "@graphql-tools/load";
import { transform } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, extname, join, relative, resolve } from "path";
import { normalizePath } from "vite";
import { noop } from "./helpers.js";

export class GqlDeclarationWriter {
	/**
	 * @param {import("graphql").DocumentNode} schema
	 * GraphQL schema to base type declaration on.
	 * @param {Record<string, string>} scalars
	 * Custom scalars. Default: `{}`
	 * @param {string} basePath
	 * Path to base directory. Default: `process.cwd()`.
	 */
	static async initialize(schema, scalars = {}, basePath = process.cwd()) {
		const virtualDir = resolve(basePath, ".gql");
		const outDir = join(virtualDir, "types");
		// Make sure we start fresh
		await rm(virtualDir, { recursive: true }).catch(noop);
		await mkdir(outDir, { recursive: true });
		// Generate and store type declarations from schema
		const schemaDeclaration = await schemaToTypeDeclaration(schema, scalars);
		const schemaDeclarationPath = join(virtualDir, "schema.d.ts");
		await writeFile(schemaDeclarationPath, schemaDeclaration);
		// Extract schema types
		const schemaTypes = extractNamedTypeExports(schemaDeclaration);

		return new GqlDeclarationWriter(
			schema,
			schemaTypes,
			schemaDeclarationPath,
			outDir,
			scalars
		);
	}

	/**
	 * @param {string} path
	 */
	async writeQueryDeclaration(path) {
		const outputPath = this.virtualPath(path);
		const src = await this.queryToTypeDeclaration(path);

		// find all relevant schema types
		const relevantSchemaTypes = this.schemaTypes.filter((t) => src.includes(t));

		// The imports we might need from the schema declaration
		const schemaTypesImport = `import type { ${relevantSchemaTypes.join(
			", "
		)} } from "${normalizePath(
			relative(dirname(outputPath), this.schemaDeclarationPath)
		)}";`;

		// Stitch together the type declaration content
		const queryDeclaration = [
			schemaTypesImport,
			src,
			"export{};", // Prevent everything from being implicitly exported
		].join("\n");

		// Make sure the folders exist
		await mkdir(dirname(outputPath), { recursive: true });
		// Write the file
		await writeFile(outputPath, queryDeclaration);
	}

	/**
	 * @param {string} path
	 */
	async removeQueryDeclaration(path) {
		const declarationPath = this.virtualPath(path);
		await rm(declarationPath).catch(noop);
	}

	/**
	 * @param {string} src
	 */
	async queryToJs(src) {
		const [documentSource] = await loadDocuments(src, { loaders: [] });
		const code = await codegen({
			documents: [documentSource],
			schema: this.schema,
			config: {
				scalars: this.scalars,
			},
			filename: "./node_modules/.generated.ts",
			plugins: [
				{
					typedDocumentNode: {
						useTypeImports: true,
						documentVariableSuffix: "",
						fragmentVariableSuffix: "",
					},
				},
			],
			pluginMap: { typedDocumentNode: typedDocumentNodePlugin },
		});

		const transformed = await transform(code, { loader: "ts" });
		return transformed.code;
	}

	/**
	 * @private
	 * @param {import("graphql").DocumentNode} schema
	 * @param {string[]} schemaTypes
	 * @param {string} schemaDeclarationPath
	 * @param {string} outDir
	 * @param {Record<string, string>} scalars
	 */
	constructor(schema, schemaTypes, schemaDeclarationPath, outDir, scalars) {
		/** @private */
		this.schema = schema;
		/** @private */
		this.schemaTypes = schemaTypes;
		/** @private */
		this.schemaDeclarationPath = schemaDeclarationPath;
		/** @private */
		this.outDir = outDir;
		/** @private */
		this.scalars = scalars;
	}

	/**
	 * @private
	 * @param {string} path Relative path
	 */
	virtualPath(path) {
		const extension = extname(path);
		return join(
			this.outDir,
			path.slice(0, -extension.length) + `.d${extension}.ts`
		);
	}

	/**
	 * @private
	 * @param {string} path
	 */
	async queryToTypeDeclaration(path) {
		const fileContent = await readFile(path, "utf-8");
		const [documentSource] = await loadDocuments(fileContent, { loaders: [] });
		const generated = await codegen({
			documents: [documentSource],
			schema: this.schema,
			config: {
				scalars: this.scalars,
			},
			filename: "./node_modules/.generated.ts",
			plugins: [
				{
					typescriptOperations: {
						arrayInputCoercion: false,
						defaultScalarType: "unknown",
					},
				},
				{
					typedDocumentNode: {
						useTypeImports: true,
						documentVariableSuffix: "",
						fragmentVariableSuffix: "",
					},
				},
			],
			pluginMap: {
				typescriptOperations: typescriptOperationsPlugin,
				typedDocumentNode: typedDocumentNodePlugin,
			},
		});

		const src = generated.replace(
			/export const (\w+) = .* (DocumentNode<\w+, \w+>);/gm,
			"export declare const $1: $2;"
		);

		return src;
	}
}

/**
 * @param {import("graphql").DocumentNode} schema
 * @param {Record<string, string>} scalars
 */
async function schemaToTypeDeclaration(schema, scalars) {
	return codegen({
		documents: [],
		schema,
		config: {
			scalars,
		},
		filename: "./node_modules/.generated.ts",
		plugins: [
			{
				typescript: {
					arrayInputCoercion: false,
					defaultScalarType: "unknown",
				},
			},
		],
		pluginMap: { typescript: typescriptPlugin },
	});
}

/**
 * @param {string} src
 */
function extractNamedTypeExports(src) {
	/** @type {string[]} */
	const namedExports = [];
	const matches = src.matchAll(/export type (\w+)/gm);
	for (const match of matches) {
		namedExports.push(match[1]);
	}
	return namedExports;
}

// /**
//  * @param {import("graphql").DefinitionNode} definition
//  * @returns {definition is import("graphql").OperationDefinitionNode}
//  */
// function isGraphQLOperationDefinition(definition) {
// 	return definition.kind === Kind.OPERATION_DEFINITION;
// }

// /**
//  * @template T
//  * @param {T | null | undefined} value
//  * @returns {value is T}
//  */
// function isNotNullish(value) {
// 	return value !== null && value !== undefined;
// }
