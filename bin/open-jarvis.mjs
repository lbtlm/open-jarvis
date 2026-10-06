#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { TomlError } from 'smol-toml';
import { audit, install, rollback, doctor, recommend } from '../src/installer.mjs';
import { runWizard } from '../src/wizard.mjs';
import { exportAssets, importAssets } from '../src/assets.mjs';
import { listEmployees, seedEmployees, planTask } from '../src/team.mjs';
import { starterEmployees } from '../src/starters.mjs';
import { proposeExperience, showExperience, approveExperience, searchExperience, renderPlanMarkdown } from '../src/experience.mjs';
import { previewQmd, installQmd } from '../src/qmd.mjs';

const help = `Open Jarvis — supervised multi-model tasks

Usage: open-jarvis <command> [options]

Commands:
  audit      Preview installation changes without writing
  install    Install or upgrade with protected backups
  doctor     Inspect installed files (no live model requests)
  rollback   Restore one installation using its manifest
  employees  Search saved cards; --init [--yes] adds missing starter cards
  plan       Resolve employee, selected skills and installed execution profile
  experience propose|show|approve|search  Review and save scoped Markdown experience
  export     Write one portable asset bundle (--out FILE)
  import     Preview a bundle (--from FILE); --yes writes without overwriting

Options:
  --project PATH             Include/select project-scoped assets
  --query WORDS              Filter employee names, professions and keywords
  --init                     Preview missing starter employee cards
  --employee ID              Saved employee for plan
  --difficulty LEVEL         micro|light|simple|standard|complex
  --effort LEVEL             Task effort override for plan; defaults to installed effort
  --risk LEVEL               normal|critical (critical requests independent review)
  --skill ID                 Local task skill; card or temporary binding (repeatable)
  --experience SCOPE:ID[@SHA256]  Select current approved experience for plan (repeatable)
  --format markdown          Render plan as reviewable Markdown; exclusive with --json
  --id ID --title TITLE      Experience candidate identity and title (propose)
  --scope project|personal   Experience destination/filter; project requires --project
  --tag TAG --contributor NAME  Candidate metadata (repeatable)
  --ref SCOPE:ID[@SHA256]     Show a formal experience record
  --source-sha256 HEX        Apply only the candidate reviewed in approve preview
  --expected-sha256 HEX      Required current digest for an experience update
  --starter TEMPLATE         none|development|writing|office|video (install or employees --init)
  --out FILE                 New export archive; never overwritten
  --from FILE                Archive to import; preview unless --yes
  --skill-root PATH          Replace default export roots (repeatable)
  --home PATH                Codex home (CODEX_HOME or ~/.codex)
  --controller-effort LEVEL  Explicitly select the main reasoning effort
  --models FILE              JSON role-to-model mapping overrides
  --fast on|off              Main controller Fast preference
  --interactive             Run the model/effort/Fast setup wizard
  --qmd                     Opt in to installing @tobilu/qmd@2.8.3 (install only)
  --qmd-dir PATH            Separate absolute QMD directory (required with --yes --qmd)
  --qmd-manager npm|pnpm    Local package manager for QMD (default npm)
  --qmd-device auto|cpu     QMD device preference (default auto)
  --yes                     Explicit apply; experience approve also requires pinned hashes
  --previous-manifest PATH   Prior Python v1 or Jarvis manifest (repeatable)
  --manifest PATH            Required for rollback
  --json                     Machine-readable output, including errors
  --help                     Show help without changing configuration
  --version                  Show package version

On a terminal, install asks for models, effort, Fast, starter and optional QMD.
QMD defaults off. Opt-in downloads platform native dependencies and may take time.
QMD files/caches/config stay in its directory. Models, asset indexes, drivers and
the full CUDA Toolkit are separate steps; existing QMD connections are preserved.
Install defaults to no employee cards; employees --init defaults to development.
Noninteractive install requires --yes; --json never starts prompts.
Existing controller effort is preserved; a fresh installation recommends High.
Run audit before install. Restart/reopen Codex and verify actual role dispatch.
`;

function output(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Open Jarvis: ${result.status ?? 'checked'}`);
  // Public result objects contain only paths, settings selected by Jarvis,
  // checks and checksums; never the user's raw configuration.
  console.log(JSON.stringify(result, null, 2));
}

function installWithStarter(options, starter) {
  // Check local template sources and destination paths before changing configuration.
  seedEmployees({ home: options.home, starter });
  const installation = install(options);
  try {
    return { ...installation, employees: seedEmployees({ home: options.home, starter, apply: true }) };
  } catch (error) {
    process.exitCode = 1;
    return { status: 'partial', installation, manifest: installation.manifest ?? null,
      employees: { status: 'error', starter, message: error.message },
      message: installation.status === 'already-installed'
        ? 'Jarvis was already installed; no new installation backup was created this run. Employee initialization failed. Cards are user-owned and outside installer rollback.'
        : 'Jarvis installation succeeded, but employee initialization failed. Configuration was changed; employee cards are user-owned and outside installer rollback.' };
  }
}

function installWithOptionalQmd(options, starter, qmd) {
  if (qmd) previewQmd({ ...qmd, home: options.home });
  const installation = installWithStarter(options, starter);
  if (!qmd || installation.status === 'partial') return installation;
  let engine;
  try { engine = installQmd({ ...qmd, home: options.home }); }
  catch (error) { engine = { status: 'error', dir: qmd.dir, message: error.message, semantic: 'pending' }; }
  if (engine.status !== 'error') return { ...installation, qmd: engine };
  process.exitCode = 1;
  return { status: 'partial', installation, manifest: installation.manifest ?? null, qmd: engine,
    message: 'Jarvis installation succeeded or was already installed, but optional QMD installation failed. Preserve QMD diagnostic files; existing QMD connections were not changed.' };
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
      project: { type: 'string' }, query: { type: 'string' }, init: { type: 'boolean' },
      starter: { type: 'string' },
      employee: { type: 'string' }, difficulty: { type: 'string' }, effort: { type: 'string' }, risk: { type: 'string' },
      skill: { type: 'string', multiple: true }, out: { type: 'string' }, from: { type: 'string' },
      experience: { type: 'string', multiple: true }, format: { type: 'string' },
      id: { type: 'string' }, title: { type: 'string' }, scope: { type: 'string' }, ref: { type: 'string' },
      tag: { type: 'string', multiple: true }, contributor: { type: 'string', multiple: true },
      'source-sha256': { type: 'string' }, 'expected-sha256': { type: 'string' },
      'skill-root': { type: 'string', multiple: true },
      'controller-effort': { type: 'string' },
      models: { type: 'string' },
      fast: { type: 'string' },
      interactive: { type: 'boolean' },
      qmd: { type: 'boolean' }, 'qmd-dir': { type: 'string' }, 'qmd-manager': { type: 'string' }, 'qmd-device': { type: 'string' },
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
    const experienceCommand = positionals[0] === 'experience';
    if (experienceCommand ? positionals.length !== 2 || !['propose', 'show', 'approve', 'search'].includes(positionals[1])
      : positionals.length !== 1 || !['audit', 'install', 'doctor', 'rollback', 'employees', 'plan', 'export', 'import'].includes(positionals[0])) {
      throw new Error('Choose audit, install, doctor, rollback, employees, plan, export, import or experience propose|show|approve|search.');
    }
    const command = positionals[0];
    const qmdFlags = ['qmd-dir', 'qmd-manager', 'qmd-device'];
    if (command !== 'install' && (values.qmd !== undefined || qmdFlags.some(flag => values[flag] !== undefined))) throw new Error('QMD options are only valid for install.');
    if (!values.qmd && qmdFlags.some(flag => values[flag] !== undefined)) throw new Error('--qmd-dir, --qmd-manager and --qmd-device require --qmd.');
    if (values.qmd && values.yes && !values['qmd-dir']) throw new Error('Noninteractive --qmd requires --qmd-dir PATH.');
    if (values['qmd-manager'] !== undefined && !['npm', 'pnpm'].includes(values['qmd-manager'])) throw new Error('--qmd-manager must be npm or pnpm.');
    if (values['qmd-device'] !== undefined && !['auto', 'cpu'].includes(values['qmd-device'])) throw new Error('--qmd-device must be auto or cpu.');
    if (values.starter !== undefined) {
      if (command !== 'install' && !(command === 'employees' && values.init)) throw new Error('--starter is only valid for install or employees --init.');
      starterEmployees(values.starter);
    }
    if (command === 'rollback' && !values.manifest) throw new Error('rollback requires --manifest PATH.');
    if (command !== 'rollback' && values.manifest) throw new Error('--manifest is only valid for rollback.');
    if (!['audit', 'install'].includes(command) && (values.models || values.fast || values['controller-effort'] || values['previous-manifest'])) {
      throw new Error(`${command} does not accept installation options; use audit or install.`);
    }
    if (command !== 'install' && values.interactive) throw new Error('--interactive is only valid for install.');
    if (values.yes && !['install', 'import', 'employees'].includes(command) && !(experienceCommand && positionals[1] === 'approve')) throw new Error('--yes is only valid for install, import, employees --init or experience approve.');
    const allowed = {project:['employees','plan','export','import','experience'],query:['employees','experience'],init:['employees'],employee:['plan'],difficulty:['plan'],effort:['plan'],risk:['plan'],skill:['plan'],experience:['plan'],format:['plan'],out:['export','experience'],from:['import','experience'],'skill-root':['export'],id:['experience'],title:['experience'],scope:['experience'],ref:['experience'],tag:['experience'],contributor:['experience'],'source-sha256':['experience'],'expected-sha256':['experience']};
    for (const [flag, commands] of Object.entries(allowed)) if (values[flag] !== undefined && !commands.includes(command)) throw new Error(`--${flag} is not valid for ${command}.`);
    if (values.format !== undefined && (values.format !== 'markdown' || json)) throw new Error('--format must be markdown and cannot be combined with --json.');
    if (experienceCommand) {
      const subcommand = positionals[1];
      const subflags = { propose: ['id','title','scope','out','tag','contributor'], show: ['from','ref'], approve: ['from','scope','source-sha256','expected-sha256'], search: ['query','scope'] };
      for (const flag of ['id','title','scope','out','tag','contributor','from','ref','query','source-sha256','expected-sha256'])
        if (values[flag] !== undefined && !subflags[subcommand].includes(flag)) throw new Error(`--${flag} is not valid for experience ${subcommand}.`);
      if (values.scope !== undefined && !['project', 'personal'].includes(values.scope)) throw new Error('--scope must be project or personal.');
      if (subcommand === 'propose' && (!values.id || !values.title || !values.scope || !values.out)) throw new Error('experience propose requires --id, --title, --scope and --out.');
      if (subcommand === 'approve' && (!values.from || !values.scope)) throw new Error('experience approve requires --from and --scope.');
      if (subcommand === 'show' && Boolean(values.from) === Boolean(values.ref)) throw new Error('experience show requires exactly one of --from or --ref.');
      if (subcommand === 'approve' && !values.yes && (values['source-sha256'] || values['expected-sha256'])) throw new Error('Approval hashes require --yes; first preview without apply flags.');
    }
    if (command === 'employees' && values.yes && !values.init) throw new Error('--yes requires employees --init.');
    if (values.init && (values.query || values.project)) throw new Error('employees --init creates personal starter cards; do not combine with --query or --project.');
    if (command === 'export' && !values.out) throw new Error('export requires --out FILE.');
    if (command === 'import' && !values.from) throw new Error('import requires --from FILE.');
    if (command === 'plan' && (!values.employee || !values.difficulty)) throw new Error('plan requires --employee ID and --difficulty LEVEL.');
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
    const qmdOptions = values.qmd ? { dir: values['qmd-dir'], manager: values['qmd-manager'] ?? 'npm', device: values['qmd-device'] ?? 'auto' } : null;
    if (qmdOptions?.dir) previewQmd({ ...qmdOptions, home: options.home });
    if (['employees', 'plan', 'export', 'import', 'experience'].includes(command)) {
      const scoped = { home: options.home, ...(values.project ? { project: resolve(values.project) } : {}) };
      let result;
      if (command === 'employees') result = values.init ? seedEmployees({ ...scoped, starter: values.starter ?? 'development', apply: !!values.yes }) : { status: 'listed', employees: listEmployees({ ...scoped, query: values.query }) };
      if (command === 'plan') result = planTask({ ...scoped, employee: values.employee, difficulty: values.difficulty, effort: values.effort, risk: values.risk, skills: values.skill, experiences: values.experience });
      if (command === 'experience') {
        const experienceOptions = { ...scoped, id: values.id, title: values.title, scope: values.scope, tags: values.tag, contributors: values.contributor,
          out: values.out ? resolve(values.out) : undefined, from: values.from ? resolve(values.from) : undefined, ref: values.ref, query: values.query,
          apply: !!values.yes, sourceSha256: values['source-sha256'], expectedSha256: values['expected-sha256'] };
        result = { propose: proposeExperience, show: showExperience, approve: approveExperience, search: searchExperience }[positionals[1]](experienceOptions);
      }
      if (command === 'export') result = exportAssets({ ...scoped, out: resolve(values.out), skillRoots: values['skill-root']?.map(p => resolve(p)), models: existsSync(join(options.home, 'config.toml')) ? recommend(options).models : undefined });
      if (command === 'import') {
        result = importAssets({ ...scoped, from: resolve(values.from), apply: !!values.yes });
        result.next = 'Assets only. Install Jarvis on the destination; optionally apply jarvis/models.json using install --models FILE --yes. Sign in to Codex separately and verify runtime settings and skill prerequisites.';
      }
      if (values.format === 'markdown') console.log(renderPlanMarkdown(result));
      else output(result, json);
      if (['blocked', 'conflicts'].includes(result.status)) process.exitCode = 1;
    } else if (command === 'install' && !values.yes) {
      if (!values.interactive && (json || !process.stdin.isTTY || !process.stdout.isTTY)) {
        throw new Error('Noninteractive install requires --yes. Run install in a terminal to choose models, efforts and Fast settings.');
      }
      const proposed = recommend(options);
      console.log(`Codex home: ${options.home}`);
      const choices = await runWizard(proposed.models, { initialStarter: values.starter ?? 'none', initialQmd: qmdOptions, home: options.home });
      if (!choices.confirmed) {
        output({ status: 'cancelled', message: 'No configuration was changed.' }, false);
      } else {
        options.models = choices.models;
        // The wizard is the final choice, overriding earlier prefill flags.
        delete options.controllerEffort;
        output(installWithOptionalQmd(options, choices.starter, choices.qmd), false);
      }
    } else {
      if (command === 'audit' || (command === 'install' && values.yes)) {
        options.models = recommend(options).models;
      }
      const result = command === 'install' ? installWithOptionalQmd(options, values.starter ?? 'none', qmdOptions) : { audit, doctor, rollback }[command](options);
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
  else console.error(`Open Jarvis: ${message}`);
  process.exitCode = 1;
}
