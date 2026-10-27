import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { checkAncestors } from './asset-paths.mjs';

// The root contains employees/, knowledge/, resources/ and preferences.md.
// home/jarvis remains the compatibility default for existing library callers.
export function assetRoot({ home, assetsHome } = {}) {
  let value = assetsHome;
  if (value === undefined && home) {
    const binding = join(home, 'jarvis-platform.json');
    checkAncestors(binding);
    if (existsSync(binding)) {
      try { value = JSON.parse(readFileSync(binding, 'utf8')).assetsHome; }
      catch { throw new Error('Invalid Jarvis platform binding.'); }
      if (value === undefined) throw new Error('Jarvis platform binding has no asset home.');
    } else value = join(home, 'jarvis');
  }
  if (typeof value !== 'string' || !isAbsolute(value)) throw new Error('Asset home must be an absolute path.');
  const root = resolve(value);
  checkAncestors(root);
  if (existsSync(root) && !lstatSync(root).isDirectory()) throw new Error('Asset home must be a directory.');
  return root;
}

export function resolveAssetsHome({ home, platform = 'codex', assetsHome, userHome = homedir(), env = process.env } = {}) {
  const explicit = assetsHome ?? env.JARVIS_HOME;
  if (explicit) return assetRoot({ assetsHome: explicit });
  const binding = join(home, 'jarvis-platform.json');
  checkAncestors(binding);
  if (existsSync(binding)) {
    let saved;
    try { saved = JSON.parse(readFileSync(binding, 'utf8')); } catch { throw new Error('Invalid Jarvis platform binding.'); }
    if (saved.platform !== platform) throw new Error('Jarvis platform binding belongs to another platform.');
    return assetRoot({ assetsHome: saved.assetsHome });
  }
  const known = new Set();
  const installations = [['.codex', 'codex'], ['.claude', 'claude-code'], ['.codebuddy', 'workbuddy'], ['.cursor', 'cursor']]
    .map(([directory, id]) => [join(userHome, directory), id]);
  if (env.CODEX_HOME) {
    if (!isAbsolute(env.CODEX_HOME)) throw new Error('CODEX_HOME must be absolute for shared asset discovery.');
    installations.push([env.CODEX_HOME, 'codex']);
  }
  for (const [installation, id] of installations) {
    const path = join(installation, 'jarvis-platform.json');
    checkAncestors(path);
    if (!existsSync(path)) continue;
    let saved;
    try { saved = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('Invalid existing Jarvis platform binding; select --assets-home explicitly.'); }
    if (saved.platform !== id) throw new Error('Existing Jarvis binding belongs to another platform; select --assets-home explicitly.');
    known.add(assetRoot({ assetsHome: saved.assetsHome }));
  }
  if (known.size > 1) throw new Error('Installed platforms reference different asset homes. Select --assets-home or JARVIS_HOME; no assets were moved.');
  const legacy = platform === 'codex' ? join(home, 'jarvis') : join(env.CODEX_HOME ?? join(userHome, '.codex'), 'jarvis');
  const neutral = join(userHome, '.jarvis');
  if (existsSync(legacy) && existsSync(neutral) && resolve(legacy) !== resolve(neutral)) {
    throw new Error('Both legacy Codex and shared Jarvis asset homes exist. Select --assets-home or JARVIS_HOME; no assets were moved.');
  }
  if (known.size) {
    const shared = [...known][0];
    if ([legacy, neutral].some(root => existsSync(root) && resolve(root) !== shared)) throw new Error('Existing asset homes conflict with the installed shared root. Select --assets-home explicitly.');
    return shared;
  }
  // An explicit nonstandard home also isolates its assets, as before.
  const customCodex = platform === 'codex' && resolve(home) !== resolve(join(userHome, '.codex'));
  return assetRoot({ assetsHome: existsSync(legacy) || customCodex ? legacy : neutral });
}
