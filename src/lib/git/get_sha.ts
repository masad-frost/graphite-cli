import { q } from '../utils/escape_for_shell';
import { gpExecSync } from '../utils/exec_sync';

export function getShaOrThrow(ref: string): string {
  return gpExecSync(
    { command: `git rev-parse ${q(ref)} 2>/dev/null` },
    (err) => {
      throw err;
    }
  );
}

export function getRemoteSha(ref: string, remote: string): string | undefined {
  const output = gpExecSync({
    command: `git ls-remote ${q(remote)} ${q(ref)}`,
  });
  return output.slice(0, output.search(/\s/)) || undefined;
}