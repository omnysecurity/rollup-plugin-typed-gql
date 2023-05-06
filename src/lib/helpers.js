import { codegen } from "@graphql-codegen/core";
import { EXACT_SIGNATURE } from "@graphql-codegen/typescript";
import * as typescriptOperationsPlugin from "@graphql-codegen/typescript-operations";
import * as typedDocumentNodePlugin from "@graphql-codegen/typed-document-node";
import { loadDocuments } from "@graphql-tools/load";
import { readFile } from "fs/promises";
import { Kind, parse } from "graphql";
import { transform } from "esbuild";

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
 * Converts a GraphQL file containing operations (queries, mutations etc) to a
 * declaration file with a typed document node for each operation in the
 * GraphQL file. The types for the parameters and result are also available.
 *
 * @param {string} src
 * GraphQL query file content to generate typescript declarations from.
 * @param {import("graphql").DocumentNode} schema
 * GraphQL schema to base type declaration on.
 * @returns
 * The typescript declaration with typed document nodes for each operation.
 */
export async function queryToTypeDeclaration(src, schema) {
	const [documentSource] = await loadDocuments(src, { loaders: [] });
	const code = await codegen({
		documents: [documentSource],
		schema,
		config: {},
		filename: "./node_modules/.vite/generated.ts",
		plugins: [
			{
				typescriptOperations: {
					arrayInputCoercion: false,
					defaultScalarType: "unknown",
				},
			},
		],
		pluginMap: { typescriptOperations: typescriptOperationsPlugin },
	});

	const typedDocumentNodeImport = `import type { TypedDocumentNode } from "@graphql-typed-document-node/core";`;

	const exports =
		documentSource.document?.definitions
			.filter(isGraphQLOperationDefinition)
			.map((od) => od.name?.value)
			.filter(isNotNullish)
			.map(
				(d) =>
					`export declare const ${d}: TypedDocumentNode<${d}Query, ${d}QueryVariables>;`
			)
			.join("\n") || [];

	return [
		typedDocumentNodeImport,
		EXACT_SIGNATURE,
		code,
		exports,
		"export{};", // Prevent everything from being implicitly exported
	].join("\n");
}

/**
 * Converts a GraphQL file containing operations (queries, mutations etc) to a
 * javascript file with a exported document node for each operation in the
 * GraphQL file.
 *
 * @param {string} src
 * GraphQL query file content to generate typescript declarations from.
 * @param {import("graphql").DocumentNode} schema
 * GraphQL schema to base type declaration on.
 * @returns
 * The javascript file with document nodes for each operation.
 */
export async function queryToDocumentNode(src, schema) {
	const [documentSource] = await loadDocuments(src, { loaders: [] });
	const code = await codegen({
		documents: [documentSource],
		schema,
		config: {},
		filename: "./node_modules/.vite/generated.ts",
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
 * @param {import("graphql").DefinitionNode} definition
 * @returns {definition is import("graphql").OperationDefinitionNode}
 */
function isGraphQLOperationDefinition(definition) {
	return definition.kind === Kind.OPERATION_DEFINITION;
}

/**
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isNotNullish(value) {
	return value !== null && value !== undefined;
}
