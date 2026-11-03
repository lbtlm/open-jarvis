// The installer, wizard and per-task planner share these execution defaults.
export const profiles = Object.freeze({
  controller: { label: '主控 / Controller', model: 'gpt-6-astra', effort: 'high' },
  luna: { label: '明确小任务 / Light', model: 'gpt-6-luna', effort: 'medium' },
  simple: { label: '日常执行 / Execution', model: 'gpt-6.1-terra', effort: 'high' },
  terra: { label: '调查与设计 / Investigation', model: 'gpt-6.1-sol', effort: 'medium' },
  sol: { label: '复杂任务 / Complex', model: 'gpt-6.1-sol', effort: 'high' },
  reviewer: { label: '独立复核 / Reviewer', model: 'gpt-6.1-sol', effort: 'high' },
});
export const roleKeys = Object.freeze(Object.keys(profiles).filter(key => key !== 'controller'));
export const defaultModels = Object.freeze(Object.fromEntries(Object.entries(profiles)
  .map(([key, { model, effort }]) => [key, Object.freeze({ model, effort })])));
export const recommendedModels = Object.freeze(['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra']);
export const effortNames = Object.freeze(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
export function supportedEfforts(model) {
  if (model === 'gpt-6-luna') return ['low', 'medium', 'high', 'xhigh', 'max'];
  if (['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-astra'].includes(model)) return ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  // Preserve explicit legacy/provider selections; verify availability at dispatch.
  return [...effortNames];
}
export const difficultyRoles = Object.freeze({ micro: 'luna', light: 'luna', simple: 'simple', standard: 'simple', investigation: 'terra', complex: 'sol' });
