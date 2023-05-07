# rollup-plugin-typed-gql

Simple, unobtrusive and fully type safe GraphQL plugin.

```js
import { request } from "graphql-request";
import { AllStarships } from "./query.gql";

const endpoint = "https://swapi-graphql.eskerda.vercel.app";
const result = await request(endpoint, AllStarships);
//      ^ { allStarships: { starships: { name: string }[] } }
```

```graphql
# query.graphql
query AllStarships {
  allStarships {
    starships {
      name
    }
  }
}
```

## Usage

Install using your favorite package manager:

```
npm i -D rollup-plugin-typed-gql @graphql-typed-document-node/core
```

Add plugin to your rollup or vite plugin:

```js
import typedGql from "rollup-plugin-typed-gql";

export default defineConfig({
  plugins: [typedGql()],
});
```

Enable `allowArbitraryExtensions` and add `".gql"` to `rootDirs` in your
`tsconfig.json`:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDirs": [".", ".gql"],
    "allowArbitraryExtensions": true
    // rest of your configuration
  }
}
```

If you use a framework or other tools that also take advantage of typescripts
`rootDirs` (like SvelteKit), you need to make sure you add their virtual
folders manually. For SvelteKit this will look like:
`"rootDirs": [".", ".svelte-kit/types", ".gql"]`.

### Recommendations

To get most out of your GraphQL setup, we recommend installing the
[GraphQL language server VS Code plugin](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql)
(or a similar language server integration if you're not rocking vscode).

A current limitation is that you have to have your GraphQL schema locally. If
you don't have that, it can easily be extracted by running:

```
npx get-graphql-schema https://your-schema-url > schema.graphql
```

## Configuration

All configuration options are optional. This configuration is equivalent to the
defaults you get if you don't provide any options:

```js
typedGql({
  /**
   * Path to your GraphQL schema.
   */
  schema: "schema.graphql",
  /**
   * Path to directory to search for GraphQL files.
   */
  searchDir: "src",
  /**
   * Extension used for your GraphQL files.
   */
  extensions: [".gql", ".graphql"],
  /**
   * Directory to store generated type declarations. If you want your type
   * declarations next to your GraphQL files pass `"."`.
   */
  virtualDir: ".gql",
  /**
   * Base directory to search for files.
   */
  baseDir: process.cwd(),
});
```
