import { execFileSync } from 'node:child_process';

export function releaseRevision(
  env = process.env,
  readHead = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
) {
  if (env.CF_PAGES !== '1') return 'local';
  const revision = env.CF_PAGES_COMMIT_SHA ?? readHead();
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error('Production requires a full Git commit revision');
  return revision;
}
