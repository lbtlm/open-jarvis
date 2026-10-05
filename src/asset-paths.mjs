import { lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// A regular-looking leaf can sit inside a symbolic link or Windows junction.
export function checkAncestors(path) {
  const chain = [];
  for (let current = resolve(path); ; current = dirname(current)) {
    chain.push(current);
    if (dirname(current) === current) break;
  }
  for (const current of chain.reverse()) {
    let info;
    try { info = lstatSync(current); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue; throw error; }
    if (info.isSymbolicLink()) throw new Error(`Symbolic link or junction blocks asset operation: ${current}`);
  }
}
