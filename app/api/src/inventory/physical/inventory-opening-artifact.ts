import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, relative, sep } from 'node:path';
import { cutoverAssert } from './inventory-cutover.contract';
import {
  OpeningManifest,
  validateManifest,
} from './inventory-opening-manifest';
import { OpeningManifestStore } from './inventory-cutover-verify.service';

// Explicit operator-selected external artifact. No default path or directory creation.
export class OpeningArtifact implements OpeningManifestStore {
  constructor(
    private readonly path: string,
    repositoryRoot: string,
  ) {
    cutoverAssert(isAbsolute(path) && isAbsolute(repositoryRoot));
    const rel = relative(resolve(repositoryRoot), resolve(path));
    cutoverAssert(rel.startsWith('..' + sep) || isAbsolute(rel), 'MISMATCH');
  }
  async load(digest: string): Promise<OpeningManifest> {
    const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'));
    const m = parsed as OpeningManifest;
    validateManifest(m);
    cutoverAssert(m.manifestDigest === digest, 'MISMATCH');
    return m;
  }
  async save(m: OpeningManifest) {
    validateManifest(m);
    await writeFile(this.path, JSON.stringify(m, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
  }
}
