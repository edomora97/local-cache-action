import * as core from "@actions/core";
import * as glob from "@actions/glob";
import * as exec from "@actions/exec";
import path from "path";
import { constants } from "fs";
import { access, stat } from "fs/promises";
import { getInputAsArray, sanitizeKey, saveEffectiveKey } from "./utils";

function getCachePath(key: string, cacheDir: string): string {
  return path.join(cacheDir, key, "cache.tar.zst");
}

async function cacheExists(key: string, cacheDir: string): Promise<boolean> {
  const cacheFilePath = getCachePath(key, cacheDir);
  try {
    await access(cacheFilePath, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function findCacheKey(
  prefix: string,
  cacheDir: string
): Promise<string | null> {
  const paths = await glob.create(
    path.join(cacheDir, prefix + "*/cache.tar.zst")
  );
  const foundPaths = [];
  for await (const cacheFilePath of paths.globGenerator()) {
    core.debug(`Found cache path: ${cacheFilePath} matching prefix ${prefix}`);
    try {
      const info = await stat(cacheFilePath);
      const key = path.basename(path.dirname(cacheFilePath));
      const mtime = info.mtime.toISOString();
      core.debug(
        `Found cache key: ${key} with mtime: ${mtime} for prefix ${prefix}`
      );
      foundPaths.push([mtime, key]);
    } catch (error) {
      core.warning(`Failed to stat ${cacheFilePath}: ${error}`);
    }
  }

  // No cache found for this prefix.
  if (foundPaths.length === 0) return null;

  foundPaths.sort((a, b) => a[0].localeCompare(b[0]));
  const key = foundPaths[foundPaths.length - 1][1];
  core.debug(`Selecting cache key: ${key}`);
  return key;
}

async function extractPackage(cachePath: string): Promise<void> {
  const args = ["-I", "zstd -T0", "-xf", cachePath];
  try {
    core.debug(`Extracting the archive with 'tar ${args.join(" ")}'...`);
    const status = await exec.exec("tar", args);
    if (status !== 0) {
      throw new Error(`'tar ${args.join(" ")}' exited with code ${status}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to extract the archive with 'tar ${args.join(" ")}': ${error}`
    );
  }
}

async function restore(): Promise<void> {
  try {
    const cacheDir = core.getInput("cache-dir", { required: true });
    const key = sanitizeKey(core.getInput("key", { required: true }));
    core.info(`Restoring cache with key: ${key}`);
    const restoreKeys = getInputAsArray("restore-keys");
    core.info(`Restore keys: ${restoreKeys.join(", ")}`);

    let cacheHit = false;
    let cachePath = null;
    if (await cacheExists(key, cacheDir)) {
      // A cache key exactly matching the input key was found.
      cacheHit = true;
      cachePath = getCachePath(key, cacheDir);
      saveEffectiveKey(key);
    } else {
      // Try the restore keys in the input order.
      for (const restoreKey of restoreKeys) {
        const key = await findCacheKey(restoreKey, cacheDir);
        if (key !== null) {
          cachePath = getCachePath(key, cacheDir);
          saveEffectiveKey(key);
          break;
        }
      }
    }

    core.setOutput("cache-hit", cacheHit.toString());

    if (cachePath === null) {
      core.info("Cache not found.");
      return;
    }

    core.info(`Cache found: ${cachePath}`);
    await extractPackage(cachePath);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

restore();
