#!/usr/bin/env node
/**
 * Makes the Steam trailer from real gameplay:
 *
 *   npm run trailer                          # from immortal-snail/steam: builds the game, records, assembles
 *   node trailer/make-trailer.mjs --dist <dir>   # use an existing build (any folder with index.html)
 *   node trailer/make-trailer.mjs --url <url>    # use a game that is already being served
 *   ... --ffmpeg <path>   (or FFMPEG_PATH)   which ffmpeg to use (default: ffmpeg-static if
 *                                            installed, else "ffmpeg" on the PATH)
 *   ... --keep                               keep the recorded frames in steam/.trailer-work
 *   ... --reuse                              re-cut from the frames kept by --keep (no recording),
 *                                            e.g. after changing a card or a duration
 *
 * Output: steam/store/trailer.mp4 (1920x1080, H.264 High, 30 fps, yuv420p, silent AAC track,
 * 30-45 s, under 50 MB) and steam/store/trailer-thumbnail.jpg (1920x1080, the opening card).
 *
 * The cut: title card -> "Your snail hunts their king." -> Ghost, Hungry and Sacrifice clips
 * (each with its mode's name and rule beside the board) -> "Wishlist now". The clips are the real
 * game in Chromium (playwright-core, /opt/pw-browsers/chromium or $CHROMIUM_PATH), played with a
 * visible mouse pointer and recorded at the frame rate the page draws (see clips.mjs).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { launchChromium } from '../art/browser.mjs';
import { buildGame, serve, steamDir } from '../art/game.mjs';
import { fitTitles } from '../art/scenes.mjs';
import { H, W, captionCard, endCard, huntCard, openingCard } from './cards.mjs';
import { CLIPS, recordClip } from './clips.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const storeDir = path.join(steamDir, 'store');
const outFile = path.join(storeDir, 'trailer.mp4');
const thumbFile = path.join(storeDir, 'trailer-thumbnail.jpg');
const work = path.join(steamDir, '.trailer-work');

const FPS = 30;
const FADE = 0.5; // cross-fade between segments
const CARD = { opening: 3.4, hunt: 3.2, end: 4.0 };
const CLIP_MAX = 11; // seconds; a longer recording is cut at the end (so the whole stays under 45 s)
const MIN_LENGTH = 32; // seconds; the end card stretches (up to 6 s) to reach it
const MAX_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------- ffmpeg

const require = createRequire(import.meta.url);

function works(bin) {
  try {
    return spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

function findFfmpeg() {
  const candidates = [opt('--ffmpeg'), process.env.FFMPEG_PATH];
  try {
    candidates.push(require('ffmpeg-static'));
  } catch {
    // not installed
  }
  candidates.push('ffmpeg');
  const bin = candidates.filter(Boolean).find(works);
  if (!bin) {
    throw new Error('ffmpeg not found. Install it (it must have libx264), set FFMPEG_PATH, or run "npm i --no-save ffmpeg-static" here.');
  }
  return bin;
}

function run(bin, argv, what) {
  const r = spawnSync(bin, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`${what} failed:\n${(r.stderr || '').split('\n').slice(-25).join('\n')}`);
  }
  return r;
}

/** Stream facts from ffprobe when there is one, else from `ffmpeg -i`'s description. */
function probe(ffmpeg, file) {
  const ffprobe = [process.env.FFPROBE_PATH, path.join(path.dirname(ffmpeg), 'ffprobe'), 'ffprobe'].filter(Boolean).find(works);
  if (ffprobe) {
    const r = run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], 'ffprobe');
    const info = JSON.parse(r.stdout);
    const v = info.streams.find((s) => s.codec_type === 'video');
    const a = info.streams.find((s) => s.codec_type === 'audio');
    const [num, den] = v.r_frame_rate.split('/').map(Number);
    return {
      tool: 'ffprobe',
      codec: v.codec_name,
      profile: v.profile,
      width: v.width,
      height: v.height,
      fps: num / den,
      pixFmt: v.pix_fmt,
      duration: Number(info.format.duration),
      audio: a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch` : 'none',
    };
  }
  const text = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  const video = text.match(/Video: (\w+)(?: \(([^)]*)\))?.*?, (\w+)\(.*?(\d{3,5})x(\d{3,5}).*?, ([\d.]+) fps/);
  const dur = text.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const audio = text.match(/Audio: (\w+).*?, (\d+) Hz, (\w+)/);
  if (!video || !dur) throw new Error(`could not read ${file}`);
  return {
    tool: 'ffmpeg -i',
    codec: video[1],
    profile: video[2],
    pixFmt: video[3],
    width: Number(video[4]),
    height: Number(video[5]),
    fps: Number(video[6]),
    duration: Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]),
    audio: audio ? `${audio[1]} ${audio[2]} Hz ${audio[3]}` : 'none',
  };
}

// ---------------------------------------------------------------------------- cards

async function renderCards(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const render = async (file, html, transparent = false) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(fitTitles);
    writeFileSync(file, await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: W, height: H } }));
    return file;
  };
  const cards = {
    opening: await render(path.join(work, 'card-opening.png'), openingCard()),
    hunt: await render(path.join(work, 'card-hunt.png'), huntCard()),
    end: await render(path.join(work, 'card-end.png'), endCard()),
  };
  return { cards, renderCaption: (clip, box) => render(path.join(work, `caption-${clip.name}.png`), captionCard({ ...clip.caption, box }), true), close: () => page.close() };
}

// ---------------------------------------------------------------------------- clips

/** Writes a clip's frames as JPEGs plus an ffconcat list that shows each for as long as it was on screen. */
function writeClip(name, rec, length) {
  const dir = path.join(work, name);
  mkdirSync(dir, { recursive: true });
  const frames = rec.frames.filter((f) => f.t < length);
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const file = `${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
    const from = i === 0 ? 0 : f.t;
    const to = i + 1 < frames.length ? frames[i + 1].t : length;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, to - from).toFixed(4)}`);
  });
  lines.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`); // the concat demuxer needs the last one twice
  const list = path.join(dir, 'frames.ffconcat');
  writeFileSync(list, `${lines.join('\n')}\n`);
  return list;
}

// ---------------------------------------------------------------------------- assemble

const quiet = ['-y', '-hide_banner', '-loglevel', 'error'];
/** RGB to BT.709 limited-range YUV, the colours players expect from HD video. */
const toVideoColor = (pixFmt) => `scale=out_color_matrix=bt709:out_range=tv,format=${pixFmt}`;
const colorTags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/**
 * Step 1, one segment at a time: 1920x1080, 30 fps, exactly `duration` seconds (the last frame held
 * if the source is shorter), the caption faded in over a clip, stored losslessly (x264 qp 0, 4:4:4).
 */
function renderSegment(ffmpeg, s, i) {
  const out = path.join(work, `segment-${i}-${s.name}.mkv`);
  const d = s.duration.toFixed(3);
  const fit = `fps=${FPS},scale=${W}:${H}:flags=lanczos,setsar=1,format=gbrp,tpad=stop_mode=clone:stop_duration=2,trim=duration=${d}`;
  const inputs = s.image ? ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', s.image] : ['-f', 'concat', '-safe', '0', '-i', s.list];
  let graph = `[0:v]${fit}`;
  if (s.caption) {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', d, '-i', s.caption.image);
    graph +=
      `[base];[1:v]format=rgba,fade=t=in:st=${s.caption.at.toFixed(3)}:d=0.4:alpha=1[cap];` +
      `[base][cap]overlay=0:0:format=rgb:eof_action=pass`;
  }
  graph += `,${toVideoColor('yuv444p')}[v]`;
  run(
    ffmpeg,
    [...quiet, ...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-r', String(FPS), ...colorTags, out],
    `ffmpeg (segment ${s.name})`,
  );
  return out;
}

/**
 * Step 2: the segments cross-fade into each other, the whole fades in from and out to black, then
 * it is encoded once for Steam (H.264 High, yuv420p, BT.709, +faststart) with a silent AAC track.
 */
function assemble(ffmpeg, segments) {
  const files = segments.map((s, i) => renderSegment(ffmpeg, s, i));
  const filters = [];
  let last = '0:v';
  let offset = 0;
  for (let i = 1; i < segments.length; i++) {
    offset += segments[i - 1].duration - FADE;
    filters.push(`[${last}][${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  const total = segments.reduce((a, s) => a + s.duration, 0) - FADE * (segments.length - 1);
  filters.push(`[${last}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`);
  run(
    ffmpeg,
    [
      ...quiet,
      ...files.flatMap((f) => ['-i', f]),
      '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', filters.join(';'),
      '-map', '[v]', '-map', `${files.length}:a`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level:v', '4.1',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), ...colorTags,
      '-c:a', 'aac', '-b:a', '128k',
      '-t', total.toFixed(3), '-movflags', '+faststart',
      outFile,
    ],
    'ffmpeg (assembling the trailer)',
  );
  return total;
}

// ---------------------------------------------------------------------------- main

const ffmpeg = findFfmpeg();
console.log(`ffmpeg: ${ffmpeg}`);
const reuse = args.includes('--reuse');
const clipsFile = path.join(work, 'clips.json');
if (reuse && !existsSync(clipsFile)) throw new Error('--reuse needs the frames of an earlier run with --keep');
if (!reuse) rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(storeDir, { recursive: true });

let server = null;
let url = opt('--url');
if (!url && !reuse) {
  const distDir = opt('--dist') ? path.resolve(opt('--dist')) : buildGame();
  if (!existsSync(path.join(distDir, 'index.html'))) throw new Error(`no index.html in ${distDir}`);
  server = await serve(distDir);
  url = `http://127.0.0.1:${server.address().port}/index.html`;
}

const browser = await launchChromium();
const segments = [];
try {
  const cardMaker = await renderCards(browser);
  const { cards } = cardMaker;
  segments.push({ name: 'title', image: cards.opening, duration: CARD.opening });
  segments.push({ name: 'hunt', image: cards.hunt, duration: CARD.hunt });

  // Record each clip (or, with --reuse, take the frames recorded last time).
  const recorded = reuse ? JSON.parse(readFileSync(clipsFile, 'utf8')) : [];
  if (!reuse) {
    for (const clip of CLIPS) {
      // The computer plays differently every game; give each clip three tries.
      let rec = null;
      for (let attempt = 1; attempt <= 3 && !rec; attempt++) {
        try {
          rec = await recordClip({ browser, url, clip });
        } catch (e) {
          console.log(`  ${clip.name} (try ${attempt}): ${e.message.split('\n')[0]}`);
        }
      }
      if (!rec) throw new Error(`could not record the ${clip.name} clip`);
      const duration = Math.min(rec.length, CLIP_MAX);
      console.log(`  ${clip.name}: ${duration.toFixed(1)} s, ${rec.frames.length} frames (${(rec.frames.length / rec.length).toFixed(0)} per second on average)`);
      recorded.push({
        name: clip.name,
        list: writeClip(clip.name, rec, duration),
        duration,
        captionBox: rec.captionBox,
        captionAt: (rec.marks.caption ?? 0) + 0.15,
      });
    }
    writeFileSync(clipsFile, JSON.stringify(recorded, null, 2));
  }
  for (const r of recorded) {
    const clip = CLIPS.find((c) => c.name === r.name);
    const caption = clip && r.captionBox && { image: await cardMaker.renderCaption(clip, r.captionBox), at: r.captionAt };
    segments.push({ name: r.name, list: r.list, duration: r.duration, caption });
  }
  await cardMaker.close();
} finally {
  await browser.close();
  server?.close();
}

// The end card absorbs the difference so the trailer lands in the target length.
const body = segments.reduce((a, s) => a + s.duration, 0) - FADE * segments.length; // + end card - fades
const endDuration = Math.min(6, Math.max(CARD.end, MIN_LENGTH - body));
segments.push({ name: 'end', image: path.join(work, 'card-end.png'), duration: endDuration });

console.log('Assembling ...');
const total = assemble(ffmpeg, segments);

// The thumbnail: the opening card, taken from the finished video.
run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', (CARD.opening / 2).toFixed(2), '-i', outFile, '-frames:v', '1', '-q:v', '2', thumbFile], 'ffmpeg (thumbnail)');

// ---------------------------------------------------------------------------- check

const info = probe(ffmpeg, outFile);
const bytes = statSync(outFile).size;
const problems = [];
if (info.width !== W || info.height !== H) problems.push(`size ${info.width}x${info.height}`);
if (info.codec !== 'h264') problems.push(`codec ${info.codec}`);
if (Math.abs(info.fps - FPS) > 0.01) problems.push(`${info.fps} fps`);
if (info.pixFmt !== 'yuv420p') problems.push(`pixel format ${info.pixFmt}`);
if (info.duration < 30 || info.duration > 45) problems.push(`length ${info.duration.toFixed(1)} s`);
if (bytes >= MAX_BYTES) problems.push(`${(bytes / 1048576).toFixed(1)} MB`);

const rel = (f) => path.relative(process.cwd(), f) || f;
console.log(`\n${rel(outFile)}: ${info.width}x${info.height} ${info.codec} (${info.profile ?? '?'}) ${info.pixFmt}, ${info.fps} fps, ` +
  `${info.duration.toFixed(1)} s (planned ${total.toFixed(1)} s), audio ${info.audio}, ${(bytes / 1048576).toFixed(1)} MB  [${info.tool}]`);
console.log(`${rel(thumbFile)}: 1920x1080 thumbnail`);
console.log(`Cut: ${segments.map((s) => `${s.name} ${s.duration.toFixed(1)}s`).join(' | ')} (${FADE}s cross-fades)`);

if (!args.includes('--keep')) rmSync(work, { recursive: true, force: true });
else console.log(`Frames and cards kept in ${rel(work)}`);

if (problems.length) {
  console.error(`\nThe trailer is not right for Steam: ${problems.join(', ')}`);
  process.exit(1);
}
