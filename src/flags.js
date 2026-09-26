/** Feature flags. Off by default; opt-in via opts.flags or FIRSTRUN_FLAGS env. */
export function flagOn(name, opts = {}) {
  const env = (process.env.FIRSTRUN_FLAGS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const given = Array.isArray(opts.flags) ? opts.flags : (opts.flags || '').split(',').map((s) => s.trim()).filter(Boolean);
  return env.includes(name) || given.includes(name);
}
