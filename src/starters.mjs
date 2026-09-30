export const starters = Object.freeze({
  none: Object.freeze([]),
  development: Object.freeze(['iris-frontend', 'atlas-backend', 'quinn-qa', 'sentry-review']),
  writing: Object.freeze(['nova-writer']),
  office: Object.freeze(['clara-office']),
  video: Object.freeze(['frame-video']),
});

export function starterEmployees(starter) {
  if (!Object.hasOwn(starters, starter)) throw new Error('Choose starter: none, development, writing, office or video.');
  return starters[starter];
}
