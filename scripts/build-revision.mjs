import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Build input is an assertion by the build runner, not a deployment attestation.
// Never infer a revision from a branch, a short SHA, runtime bindings, or secrets.
export function buildRevision({ BUILD_REVISION, CF_PAGES_COMMIT_SHA } = {}) {
  for (const value of [BUILD_REVISION, CF_PAGES_COMMIT_SHA]) {
    if (value && !/^[a-f0-9]{40}$/.test(value)) {
      throw new Error('Build revision must be a full lowercase 40-character SHA.');
    }
  }
  if (BUILD_REVISION && CF_PAGES_COMMIT_SHA && BUILD_REVISION !== CF_PAGES_COMMIT_SHA) {
    throw new Error('Build revision inputs disagree.');
  }
  return {
    revision: BUILD_REVISION || CF_PAGES_COMMIT_SHA || null,
    source: BUILD_REVISION ? 'BUILD_REVISION' : CF_PAGES_COMMIT_SHA ? 'CF_PAGES_COMMIT_SHA' : 'unavailable',
    verification: 'build-input-only',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(new URL('../dist/build-revision.json', import.meta.url), JSON.stringify(buildRevision({
    BUILD_REVISION: process.env.BUILD_REVISION,
    CF_PAGES_COMMIT_SHA: process.env.CF_PAGES_COMMIT_SHA,
  }), null, 2) + '\n');
}
