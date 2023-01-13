import * as core from "@actions/core";

async function restore(): Promise<void> {
  try {
    core.setOutput("ok", "yay");
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

restore();
