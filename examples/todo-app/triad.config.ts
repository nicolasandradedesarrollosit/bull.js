import { defineConfig } from "@triad/cli";

export default defineConfig({
  dev: {
    // "blocking" keeps the app unusable until MVVM is respected.
    overlay: "dismissible",
  },
  rules: {
    // Configurable rules can be tightened or relaxed. Core rules cannot.
    MVVM203: "error",
  },
});
