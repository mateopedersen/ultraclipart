import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export function validatePreview(directory) {
  for (const file of ['index.html', '404.html', 'art/sunflower-straw-hat/index.html']) {
    const target = join(directory, file);
    if (!existsSync(target) || !readFileSync(target, 'utf8').includes('</html>'))
      throw Error(`Incomplete preview: ${file}`);
  }
}

// The served path always points to a complete release. Replacing a symlink is
// atomic; a failed build never changes it. Keep old releases for in-flight reads.
export function activatePreview(directory, current) {
  validatePreview(directory);
  const parent = dirname(current);
  mkdirSync(parent, { recursive: true });
  if (existsSync(current) && !lstatSync(current).isSymbolicLink()) {
    const archive = join(parent, 'performance-releases', `previous-${Date.now()}`);
    mkdirSync(dirname(archive), { recursive: true });
    renameSync(current, archive);
  }
  const link = `${current}.next-${process.pid}`;
  symlinkSync(relative(parent, resolve(directory)), link, 'dir');
  renameSync(link, current);
  return realpathSync(current);
}
