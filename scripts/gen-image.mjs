// fal.ai image generation — the launch-pipeline image step (gate 2).
// Usage: node scripts/gen-image.mjs "<prompt>" <out.webp> [size] [model]
//   size:  landscape_16_9 (default) | landscape_4_3 | square_hd | portrait_4_3 | portrait_16_9
//   model: fal-ai/flux/dev (default, quality) | fal-ai/flux/schnell (fast/cheap) | fal-ai/flux-pro/v1.1
// Reads FAL_KEY from .env.local (gitignored) or the environment. Downloads the result and
// optimizes to webp via sharp. Honest-subjects rule lives in docs/CONTENT-LAUNCH-SOP.md.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

function falKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim();
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*FAL_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('FAL_KEY not found in env or .env.local');
}

const [, , prompt, outPath, size = 'landscape_16_9', model = 'fal-ai/flux/dev'] = process.argv;
if (!prompt || !outPath) {
  console.error('usage: node scripts/gen-image.mjs "<prompt>" <out.webp> [size] [model]');
  process.exit(1);
}

const STYLE = 'professional photorealistic, clean natural lighting, neutral color palette, no text, no watermark, no logos';
const fullPrompt = `${prompt}. ${STYLE}`;

const KEY = falKey();
console.log(`generating (${model}, ${size})…`);
const res = await fetch(`https://fal.run/${model}`, {
  method: 'POST',
  headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: fullPrompt, image_size: size, num_images: 1, enable_safety_checker: true }),
});
if (!res.ok) {
  console.error('fal error', res.status, (await res.text().catch(() => '')).slice(0, 300));
  process.exit(1);
}
const data = await res.json();
const url = data?.images?.[0]?.url;
if (!url) {
  console.error('no image url in response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}
const srcBuf = Buffer.from(await (await fetch(url)).arrayBuffer());
mkdirSync(dirname(outPath), { recursive: true });
await sharp(srcBuf).webp({ quality: 82 }).toFile(outPath);
const meta = await sharp(outPath).metadata();
console.log(`saved ${outPath}  ${meta.width}x${meta.height}  (${Math.round(srcBuf.length / 1024)}KB source)`);
