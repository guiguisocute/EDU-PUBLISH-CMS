import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONTENT_DIR = path.join(ROOT, 'content');
const CARD_COVERS_DIR = path.join(CONTENT_DIR, 'card', 'covers');
const CONTENT_IMG_DIR = path.join(CONTENT_DIR, 'img');
const GENERATED_CONTENT_PATH = path.join(PUBLIC_DIR, 'generated', 'content-data.json');

const isRasterCoverUrl = (value) => {
  const url = String(value || '').trim();
  if (!url.startsWith('/')) return false;
  if (!(/^\/(img\/init-|covers\/)/).test(url)) return false;
  return /\.(jpg|jpeg|png)$/i.test(url);
};

let sharp;
const loadSharp = async () => {
  if (sharp) return true;
  try {
    sharp = (await import('sharp')).default;
    return true;
  } catch {
    return false;
  }
};

const pathExists = async (value) => {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
};

const resolveInputPath = (urlPath) => {
  const relative = urlPath.replace(/^\//, '');
  const publicPath = path.join(PUBLIC_DIR, relative);
  if (urlPath.startsWith('/covers/')) {
    return {
      sourcePath: path.join(CARD_COVERS_DIR, urlPath.slice('/covers/'.length)),
      outputBase: publicPath,
    };
  }
  if (urlPath.startsWith('/img/')) {
    return {
      sourcePath: path.join(CONTENT_IMG_DIR, urlPath.slice('/img/'.length)),
      outputBase: publicPath,
    };
  }
  return {
    sourcePath: publicPath,
    outputBase: publicPath,
  };
};

const assertWithinDir = (filePath, allowedDir, label) => {
  const normalized = path.normalize(filePath);
  const normalizedDir = path.normalize(allowedDir) + path.sep;
  if (!normalized.startsWith(normalizedDir) && normalized !== path.normalize(allowedDir)) {
    throw new Error(`${label} path escapes allowed directory: ${normalized}`);
  }
};

const optimizeOne = async (urlPath) => {
  const { sourcePath, outputBase } = resolveInputPath(urlPath);
  const absInput = (await pathExists(sourcePath)) ? sourcePath : outputBase;
  if (!(await pathExists(absInput))) {
    return { skipped: true, reason: 'missing' };
  }

  assertWithinDir(absInput, absInput === sourcePath ? CONTENT_DIR : PUBLIC_DIR, 'Input');
  assertWithinDir(outputBase, PUBLIC_DIR, 'Output');

  await fs.mkdir(path.dirname(outputBase), { recursive: true });

  if (absInput === sourcePath) {
    const shouldCopySource = !(await pathExists(outputBase))
      || (await fs.stat(outputBase)).mtimeMs < (await fs.stat(sourcePath)).mtimeMs;
    if (shouldCopySource) {
      await fs.copyFile(sourcePath, outputBase);
    }
  }

  const inputStat = await fs.stat(absInput);

  const ext = path.extname(outputBase);
  const base = outputBase.slice(0, -ext.length);

  const outputs = [
    { suffix: '.webp', width: null, quality: 72 },
    { suffix: '@sm.webp', width: 480, quality: 68 },
    { suffix: '@md.webp', width: 768, quality: 70 },
    { suffix: '@lg.webp', width: 1200, quality: 72 },
  ];

  let hasStaleOutput = false;
  for (const output of outputs) {
    const outPath = `${base}${output.suffix}`;
    if (!(await pathExists(outPath))) {
      hasStaleOutput = true;
      break;
    }
    const outStat = await fs.stat(outPath);
    if (outStat.mtimeMs < inputStat.mtimeMs) {
      hasStaleOutput = true;
      break;
    }
  }

  if (!hasStaleOutput) {
    return { skipped: true, reason: 'fresh' };
  }

  const generated = [];
  try {
    for (const output of outputs) {
      const outPath = `${base}${output.suffix}`;
      assertWithinDir(outPath, PUBLIC_DIR, 'Output');

      let pipeline = sharp(absInput);
      if (output.width) {
        pipeline = pipeline.resize({ width: output.width, withoutEnlargement: true });
      }
      pipeline = pipeline.webp({ quality: output.quality, effort: 6 });

      await pipeline.toFile(outPath);
      generated.push(outPath);
    }
  } catch (err) {
    for (const outPath of generated) {
      await fs.unlink(outPath).catch(() => {});
    }
    throw err;
  }

  return { skipped: false };
};

const main = async () => {
  if (!(await loadSharp())) {
    console.warn('[optimize-images] sharp is unavailable, skip image optimization.');
    return;
  }

  const raw = await fs.readFile(GENERATED_CONTENT_PATH, 'utf8');
  const data = JSON.parse(raw);
  const notices = Array.isArray(data.notices) ? data.notices : [];

  const coverUrls = Array.from(
    new Set(
      notices
        .map((item) => String(item.cover || item.thumbnail || '').trim())
        .filter(isRasterCoverUrl)
    )
  );

  let optimized = 0;
  let skipped = 0;

  for (const coverUrl of coverUrls) {
    try {
      const result = await optimizeOne(coverUrl);
      if (result.skipped) skipped += 1;
      else optimized += 1;
    } catch (error) {
      console.warn(`[optimize-images] skip ${coverUrl}: ${error instanceof Error ? error.message : String(error)}`);
      skipped += 1;
    }
  }

  console.log(`Optimized cover images: ${optimized}, skipped: ${skipped}.`);
};

main().catch((error) => {
  console.error('[optimize-images] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
