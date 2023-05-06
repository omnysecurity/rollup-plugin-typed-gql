import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import typedGql from "./src/lib/index.js";

export default defineConfig({
	plugins: [sveltekit(), typedGql()],
	test: {
		include: ["src/**/*.{test,spec}.{js,ts}"],
	},
});
