import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { rename, writeFile, mkdir } from "fs/promises";
import {
  getInputAsArray,
  getStoredKey,
  resolvePaths,
  sanitizeKey,
} from "./utils";

async function makePackage(
  globPatterns: string[],
  key: string,
  cacheDir: string
): Promise<string> {
  // Resolve the glob patterns.
  const paths = await resolvePaths(globPatterns);
  if (paths.length === 0) {
    throw new Error("No files were found with the provided path.");
  }

  const cachePath = path.join(cacheDir, key);
  core.info(`Cache path: ${cachePath}`);
  await mkdir(cachePath, { recursive: true });

  // Write to a temporary file to be able to atomically move it to the cache.
  const tempUuid = uuidv4();

  // Write the list of files to a manifest file.
  const manifestPath = path.join(cachePath, `temp-${tempUuid}.manifest.txt`);
  core.debug(`Writing manifest to ${manifestPath}...`);
  await writeFile(manifestPath, paths.join("\n"));

  // Create the archive.
  const tempPath = path.join(cachePath, `temp-${tempUuid}.tar.zst`);
  const args = [
    "-I",
    "zstd -T0",
    "-cf",
    tempPath,
    "--files-from",
    manifestPath,
  ];
  try {
    core.debug(`Creating the archive with 'tar ${args.join(" ")}'...`);
    const status = await exec.exec("tar", args);
    if (status !== 0) {
      throw new Error(`'tar ${args.join(" ")}' exited with code ${status}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to create the archive with 'tar ${args.join(" ")}': ${error}`
    );
  }

  // Move to the final location.
  const targetPath = path.join(cachePath, "cache.tar.zst");
  core.debug(`Moving ${tempPath} to ${targetPath}...`);
  await rename(tempPath, targetPath);

  return targetPath;
}

async function save(): Promise<void> {
  try {
    const path = getInputAsArray("path", { required: true });
    const cacheDir = core.getInput("cache-dir", { required: true });
    const key = sanitizeKey(core.getInput("key", { required: true }));
    // Override the key with a key proveded by the restore action.
    const storedKey = getStoredKey();

    // The key stored by the restore step is the same as the key provided by the
    // user: do not save.
    if (storedKey === key) {
      return;
    }

    // Save the cache.
    core.info(`Saving cache with key: ${key}`);
    const targetPath = await makePackage(path, key, cacheDir);
    core.info(`Cache saved at ${targetPath}`);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

save();
