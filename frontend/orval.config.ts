import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: "./openapi.json",
    output: {
      target: "./src/api/endpoints",
      schemas: "./src/api/model",
      client: "axios",
      mode: "tags-split",
      clean: true,
      override: {
        mutator: {
          path: "./src/api/client.js",
          name: "customInstance",
        },
      },

    },
  },
});
