import { createInterface } from 'node:readline';
import { supportedEfforts, profiles, recommendedModels } from './profiles.mjs';
import { starters, starterEmployees } from './starters.mjs';
import { previewQmd, QMD_PACKAGE } from './qmd.mjs';
import { platformAdapter } from './platforms/index.mjs';

const roles = Object.entries(profiles).map(([key, p]) => [key, p.label, p.model, p.effort]);
const modelOptions = recommendedModels;

export async function collectChoices({ initial, platform = 'codex', initialStarter = 'none', initialQmd, home, ask, write }) {
  const adapter = platformAdapter(platform);
  const native = adapter.id !== 'codex';
  const choices = native ? ['inherit'] : modelOptions;
  starterEmployees(initialStarter);
  write(`Jarvis 安装向导 / Setup (${adapter.id})\n模型可用性与运行权限由客户端版本、模型和账户决定。 / Client versions, model access and account policy must be checked separately.\n`);
  const models = {};
  for (const [key, label, recommendedModel, recommendedEffort] of roles) {
    if (native && key === 'controller') { models.controller = { model: 'inherit' }; continue; }
    const current = initial[key] ?? {};
    write(`\n${label} — ${native ? 'inherit' : `${recommendedModel} / ${recommendedEffort}`}\n`);
    write(choices.map((model, index) => `  ${index + 1}. ${model}`).join('\n') + '\n');
    let model;
    while (!model) {
      const answer = (await ask(`模型 / Model [${current.model ?? (native ? 'inherit' : recommendedModel)}]: `)).trim();
      const candidate = choices[Number(answer) - 1] ?? (answer || current.model || (native ? 'inherit' : recommendedModel));
      if (/^[^\s\u0000-\u001f\u007f]+$/.test(candidate) && !/^\d+$/.test(candidate)) model = candidate;
      else write(`请选择 1–${modelOptions.length} 或输入完整模型 ID。 / Choose 1–${modelOptions.length} or enter a model ID.\n`);
    }
    if (native && model === 'inherit') { models[key] = { model }; continue; }
    const efforts = native ? adapter.efforts : supportedEfforts(model);
    const defaultEffort = efforts.includes(current.effort) ? current.effort : recommendedEffort;
    if (current.effort && !efforts.includes(current.effort)) {
      write(`所选模型不支持原档位 ${current.effort}，请重新选择。 / Select a supported effort for ${model}.\n`);
    }
    let effort;
    while (!effort) {
      const answer = (await ask(`思考强度 / Effort (${efforts.join(', ')}) [${defaultEffort}]: `)).trim().toLowerCase();
      const candidate = answer || defaultEffort;
      if (efforts.includes(candidate)) effort = candidate;
      else write('请输入列表中的档位。 / Enter a listed effort.\n');
    }
    let fast = native && !adapter.fast ? null : undefined;
    while (fast === undefined) {
      const defaultFast = current.fast ?? false;
      const answer = (await ask(`Fast 模式 / Fast mode? ${defaultFast ? '[Y/n]' : '[y/N]'}: `)).trim().toLowerCase();
      if (!answer) fast = defaultFast;
      else if (['y', 'yes', 'on', 'true', '1', '是', '开'].includes(answer)) fast = true;
      else if (['n', 'no', 'off', 'false', '0', '否', '关'].includes(answer)) fast = false;
      else write('请输入 y 或 n。 / Enter y or n.\n');
    }
    models[key] = { model, effort, ...(fast === null ? {} : { fast }) };
  }
  let starter;
  while (starter === undefined) {
    const answer = (await ask(`初始员工模板 / Starter (${Object.keys(starters).join(', ')}) [${initialStarter}]: `)).trim().toLowerCase();
    const candidate = answer || initialStarter;
    if (Object.hasOwn(starters, candidate)) starter = candidate;
    else write('请选择列出的模板。 / Choose a listed starter.\n');
  }
  let qmd;
  while (qmd === undefined) {
    const answer = (await ask('可选安装 QMD 引擎 / Install optional QMD engine? [y/N]: ')).trim().toLowerCase();
    if (!answer || ['n', 'no', '否'].includes(answer)) qmd = null;
    else if (['y', 'yes', '是'].includes(answer)) {
      let manager;
      while (!manager) {
        const value = (await ask(`包管理器 / Package manager (npm, pnpm) [${initialQmd?.manager ?? 'npm'}]: `)).trim().toLowerCase() || initialQmd?.manager || 'npm';
        if (['npm', 'pnpm'].includes(value)) manager = value;
        else write('请输入 npm 或 pnpm。 / Enter npm or pnpm.\n');
      }
      let device;
      while (!device) {
        const value = (await ask(`设备 / Device (auto recommended, cpu) [${initialQmd?.device ?? 'auto'}]: `)).trim().toLowerCase() || initialQmd?.device || 'auto';
        if (['auto', 'cpu'].includes(value)) device = value;
        else write('请输入 auto 或 cpu。 / Enter auto or cpu.\n');
      }
      let dir;
      while (!dir) {
        const value = (await ask(`QMD 独立绝对目录 / Absolute QMD directory${initialQmd?.dir ? ` [${initialQmd.dir}]` : ''}: `)).trim() || initialQmd?.dir;
        try { dir = previewQmd({ dir: value, manager, device, home }).dir; }
        catch (error) { write(`${error.message}\n`); }
      }
      try { qmd = previewQmd({ dir, manager, device, home }); }
      catch (error) { write(`${error.message}\n`); }
    } else write('请输入 y 或 n。 / Enter y or n.\n');
  }
  write('\n安装预览 / Installation summary\n');
  write(`初始员工模板 / Starter: ${starter}\n`);
  for (const [key, label] of roles) {
    const value = models[key];
    write(`${label}: ${value.model} / ${value.effort} / Fast ${value.fast ? 'ON' : 'OFF'}\n`);
  }
  if (qmd) {
    write(`QMD: ${QMD_PACKAGE} / ${qmd.manager} / ${qmd.device}\n程序、包缓存、QMD 缓存和配置 / Engine, package cache, QMD cache and config: ${qmd.dir}\n`);
    write('将下载平台原生依赖，安装和原生构建可能耗时；缺少系统依赖时需另行处理。 / Downloads platform native dependencies; installation/native builds may take time and require separately installed system dependencies.\n不自动下载模型、建立资产索引或安装系统驱动、完整 CUDA Toolkit。 / No automatic models, asset indexing, system drivers or full CUDA Toolkit.\n');
  } else write('QMD: 不安装；保留已有环境和连接。 / Not selected; existing QMD environments and connections are preserved.\n');
  const confirmed = ['y', 'yes', '是'].includes((await ask(`\n确认写入所选 ${adapter.id} 配置？ / Apply these choices? [y/N]: `)).trim().toLowerCase());
  return { models, starter, qmd, confirmed };
}

export async function runWizard(initial, { input = process.stdin, output = process.stdout, platform = 'codex', initialStarter = 'none', initialQmd, home } = {}) {
  const reader = createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY), crlfDelay: Infinity });
  const lines = reader[Symbol.asyncIterator]();
  const cancelled = new Error('Setup cancelled. No configuration was changed.');
  cancelled.code = 'JARVIS_CANCELLED';
  try {
    return await collectChoices({ initial, platform, initialStarter, initialQmd, home,
      write: value => output.write(value),
      ask: async question => {
        output.write(question);
        const answer = await lines.next();
        if (answer.done) throw cancelled;
        return answer.value;
      },
    });
  } finally {
    reader.close();
  }
}
