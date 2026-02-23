import * as core from '@actions/core';

async function run(): Promise<void> {
  core.info('Event handled successfully.');
}

run().catch(err => {
  core.setFailed(err instanceof Error ? err.message : String(err))
});
