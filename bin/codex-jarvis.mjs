#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { TomlError } from 'smol-toml';
import { audit, install, rollback, doctor, recommend } from '../src/installer.mjs';
import { runWizard } from '../src/wizard.mjs';

const help = `Codex Jarvis — supervised multi-model development

Usage: codex-jarvis <command> [options]

Commands:
  audit      Preview installation changes without writing
  install    Install or upgrade with protected backups
  doctor     Inspect installed files (no live model requests)
  rollback   Restore one installation using its manifest

Options:
  --home PATH                Codex home (CODEX_HOME or ~/.codex)
  --controller-effort LEVEL  Explicitly select the main reasoning effort
  --models FILE              JSON role-to-model mapping overrides
  --fast on|off              Main controller Fast preference
  --interactive             Run the model/effort/Fast setup wizard
  --yes                     Apply defaults/options without the wizard
  --previous-manifest PATH   Prior Python v1 or Jarvis manifest (repeatable)
  --manifest PATH            Required for rollback
  --json                     Machine-readable output, including errors
  --help                     Show help without changing configuration
  --version                  Show package version

On a terminal, install asks for each role's model, effort and Fast preference.
Noninteractive install requires --yes; --json never starts prompts.
Existing controller effort is preserved; a fresh installation recommends High.
Run audit before install. Restart/reopen Codex and verify actual role dispatch.
`;

function output(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Codex Jarvis: ${result.status ?? 'checked'}`);
  // Public result objects contain only paths, settings selected by Jarvis,
  // checks and checksums; never the user's raw configuration.
  console.log(JSON.stringify(result, null, 2));
}

const argv = process.argv.slice(2);
let json = argv.includes('--json');
try {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      home: { type: 'string' },
      'controller-effort': { type: 'string' },
      models: { type: 'string' },
      fast: { type: 'string' },
      interactive: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      'previous-manifest': { type: 'string', multiple: true },
      manifest: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  json = values.json ?? false;
  if (values.help || (positionals.length === 0 && !values.version)) {
    console.log(help);
  } else if (values.version) {
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else {
    if (positionals.length !== 1 || !['audit', 'install', 'doctor', 'rollback'].includes(positionals[0])) {
      throw new Error('Choose exactly one command: audit, install, doctor or rollback.');
    }
    const command = positionals[0];
    if (command === 'rollback' && !values.manifest) throw new Error('rollback requires --manifest PATH.');
    if (command !== 'rollback' && values.manifest) throw new Error('--manifest is only valid for rollback.');
    if (['rollback', 'doctor'].includes(command) && (values.models || values.fast || values['controller-effort'] || values['previous-manifest'])) {
      throw new Error(`${command} does not accept installation options; use audit or install.`);
    }
    if (command !== 'install' && (values.interactive || values.yes)) throw new Error('--interactive and --yes are only valid for install.');
    if (values.interactive && (values.yes || values.json)) throw new Error('--interactive cannot be combined with --yes or --json.');
    if (values.fast && !['on', 'off'].includes(values.fast)) throw new Error('--fast must be on or off.');
    const options = {
      home: resolve(values.home ?? process.env.CODEX_HOME ?? join(homedir(), '.codex')),
      ...(values['controller-effort'] ? { controllerEffort: values['controller-effort'] } : {}),
      ...(values.models ? { models: JSON.parse(readFileSync(resolve(values.models), 'utf8').replace(/^\uFEFF/, '')) } : {}),
      ...(values['previous-manifest'] ? { previousManifests: values['previous-manifest'].map(p => resolve(p)) } : {}),
      ...(values.manifest ? { manifest: resolve(values.manifest) } : {}),
    };
    if (values.fast) {
      options.models ??= {};
      options.models.controller = { ...options.models.controller, fast: values.fast === 'on' };
    }
    if (command === 'install' && !values.yes) {
      if (!values.interactive && (json || !process.stdin.isTTY || !process.stdout.isTTY)) {
        throw new Error('Noninteractive install requires --yes. Run install in a terminal to choose models, efforts and Fast settings.');
      }
      const proposed = recommend(options);
      console.log(`Codex home: ${options.home}`);
      const choices = await runWizard(proposed.models);
      if (!choices.confirmed) {
        output({ status: 'cancelled', message: 'No configuration was changed.' }, false);
      } else {
        options.models = choices.models;
        // The wizard is the final choice, overriding earlier prefill flags.
        delete options.controllerEffort;
        output(install(options), false);
      }
    } else {
      if (command === 'audit' || (command === 'install' && values.yes)) {
        options.models = recommend(options).models;
        for (const role of Object.values(options.models)) role.fast ??= false;
      }
      const result = { audit, install, doctor, rollback }[command](options);
      output(result, json);
      if (command === 'doctor' && result.ok === false) process.exitCode = 1;
    }
  }
} catch (error) {
  // Parser and filesystem errors can include input fragments; suppress raw
  // parser diagnostics rather than echoing a user's configuration/JSON.
  const message = error instanceof SyntaxError || error instanceof TomlError
    ? 'Invalid configuration or models file. Check its syntax locally; no content is printed.'
    : error.message;
  if (json) console.error(JSON.stringify({ status: 'error', message }));
  else console.error(`Codex Jarvis: ${message}`);
  process.exitCode = 1;
}
