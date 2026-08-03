import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const index = trimmed.indexOf("=");
        if (index === -1) continue;

        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();

        // Remove surrounding quotes if any
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Only set if not already set in environment
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.warn("[Env Loader] Failed to load .env file:", error);
  }
}

loadEnv();
