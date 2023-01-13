import * as core from "@actions/core";
import * as glob from "@actions/glob";
import * as path from "path";

export const CACHE_FILE_NAME = "cache.tar.zst";

export function getInputAsArray(
  name: string,
  options?: core.InputOptions
): string[] {
  return core
    .getInput(name, options)
    .split("\n")
    .map((s) => s.replace(/^!\s+/, "!").trim())
    .filter((x) => x !== "");
}

export function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getStoredKey(): string {
  return core.getState("SAVED_KEY");
}

export function saveEffectiveKey(key: string): void {
  core.saveState("SAVED_KEY", key);
}

export async function resolvePaths(patterns: string[]): Promise<string[]> {
  const paths: string[] = [];
  const cwd = process.cwd();
  const globber = await glob.create(patterns.join("\n"), {
    implicitDescendants: false,
  });

  for await (const file of globber.globGenerator()) {
    if (path.isAbsolute(file)) {
      paths.push(file);
    } else {
      paths.push(path.join(cwd, file));
    }
  }

  return paths;
}
