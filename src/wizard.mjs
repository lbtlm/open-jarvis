import { createInterface } from 'node:readline';

const roles = [
  ['controller', '主控 / Controller', 'gpt-6-astra', 'high'],
  ['luna', '轻量执行者 / Small tasks', 'gpt-5.6-luna', 'medium'],
  ['terra', '常规执行者 / General tasks', 'gpt-5.6-terra', 'medium'],
  ['sol', '复杂任务执行者 / Complex tasks', 'gpt-5.6-sol', 'high'],
  ['reviewer', '独立复核者 / Reviewer', 'gpt-5.6-sol', 'high'],
];
const modelOptions = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'];
const efforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

export async function collectChoices({ initial, ask, write }) {
  write('Jarvis 安装向导 / Setup\n模型与档位仅为推荐；可输入其他模型 ID。可用性由账户及 Codex 决定。\nFast 独立于思考强度，可能增加额度消耗；首次安装推荐关闭。\n');
  const models = {};
  for (const [key, label, recommendedModel, recommendedEffort] of roles) {
    const current = initial[key] ?? {};
    write(`\n${label} — 推荐 ${recommendedModel} / ${recommendedEffort}\n`);
    write(modelOptions.map((model, index) => `  ${index + 1}. ${model}`).join('\n') + '\n');
    let model;
    while (!model) {
      const answer = (await ask(`模型 / Model [${current.model ?? recommendedModel}]: `)).trim();
      const candidate = modelOptions[Number(answer) - 1] ?? (answer || current.model || recommendedModel);
      if (/^[^\s\u0000-\u001f\u007f]+$/.test(candidate) && !/^\d+$/.test(candidate)) model = candidate;
      else write('请选择 1–4 或输入完整模型 ID。 / Choose 1–4 or enter a model ID.\n');
    }
    let effort;
    while (!effort) {
      const answer = (await ask(`思考强度 / Effort (${efforts.join(', ')}) [${current.effort ?? recommendedEffort}]: `)).trim().toLowerCase();
      const candidate = answer || current.effort || recommendedEffort;
      if (efforts.includes(candidate)) effort = candidate;
      else write('请输入列表中的档位。 / Enter a listed effort.\n');
    }
    let fast;
    while (fast === undefined) {
      const defaultFast = current.fast ?? false;
      const answer = (await ask(`Fast 模式 / Fast mode? ${defaultFast ? '[Y/n]' : '[y/N]'}: `)).trim().toLowerCase();
      if (!answer) fast = defaultFast;
      else if (['y', 'yes', 'on', 'true', '1', '是', '开'].includes(answer)) fast = true;
      else if (['n', 'no', 'off', 'false', '0', '否', '关'].includes(answer)) fast = false;
      else write('请输入 y 或 n。 / Enter y or n.\n');
    }
    models[key] = { model, effort, fast };
  }
  write('\n安装预览 / Installation summary\n');
  for (const [key, label] of roles) {
    const value = models[key];
    write(`${label}: ${value.model} / ${value.effort} / Fast ${value.fast ? 'ON' : 'OFF'}\n`);
  }
  const confirmed = ['y', 'yes', '是'].includes((await ask('\n确认写入所选 Codex 配置？ / Apply these choices? [y/N]: ')).trim().toLowerCase());
  return { models, confirmed };
}

export async function runWizard(initial, { input = process.stdin, output = process.stdout } = {}) {
  const reader = createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY), crlfDelay: Infinity });
  const lines = reader[Symbol.asyncIterator]();
  const cancelled = new Error('Setup cancelled. No configuration was changed.');
  cancelled.code = 'JARVIS_CANCELLED';
  try {
    return await collectChoices({ initial,
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
