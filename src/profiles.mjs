// The installer, wizard and per-task planner share these execution defaults.
export const profiles = Object.freeze({
  controller: { label: '主控 / Controller', model: 'gpt-6-astra', effort: 'high' },
  luna: { label: '明确小任务 / Light', model: 'gpt-6-luna', effort: 'medium' },
  simple: { label: '简单任务 / Simple', model: 'gpt-6.1-sol', effort: 'low' },
  terra: { label: '常规任务 / Standard', model: 'gpt-6.1-sol', effort: 'medium' },
  sol: { label: '复杂任务 / Complex', model: 'gpt-6.1-sol', effort: 'high' },
  reviewer: { label: '独立复核 / Reviewer', model: 'gpt-6.1-sol', effort: 'high' },
});
export const roleKeys = Object.freeze(Object.keys(profiles).filter(key => key !== 'controller'));
export const defaultModels = Object.freeze(Object.fromEntries(Object.entries(profiles)
  .map(([key, { model, effort }]) => [key, Object.freeze({ model, effort })])));
export const recommendedModels = Object.freeze(['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra']);
export const effortNames = Object.freeze(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
export function supportedEfforts(model) {
  if (model === 'gpt-6-luna') return ['low', 'medium', 'high', 'xhigh', 'max'];
  if (['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-astra'].includes(model)) return ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  // Preserve explicit legacy/provider selections; verify availability at dispatch.
  return [...effortNames];
}
export const difficultyRoles = Object.freeze({ micro: 'luna', light: 'luna', simple: 'simple', standard: 'terra', complex: 'sol' });
