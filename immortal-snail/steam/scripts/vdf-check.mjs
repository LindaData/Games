#!/usr/bin/env node
/**
 * Parses Valve KeyValues (.vdf) files and fails on a syntax error, so a broken build script is
 * caught before SteamCMD sees it. Also checks the keys SteamPipe needs.
 *   node scripts/vdf-check.mjs output/app_build_123.vdf output/depot_build_124.vdf ...
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Tokens: quoted strings (with \" escapes), { and }; // comments are skipped. */
function tokenize(text, file) {
  const tokens = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\n') line++;
    if (/\s/.test(c)) {
      i++;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '{' || c === '}') {
      tokens.push({ t: c, line });
      i++;
    } else if (c === '"') {
      let s = '';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\n') throw new Error(`${file}:${line}: newline inside a string`);
        if (text[i] === '\\' && i + 1 < text.length) {
          s += text[i + 1];
          i += 2;
        } else {
          s += text[i++];
        }
      }
      if (text[i] !== '"') throw new Error(`${file}:${line}: unterminated string`);
      i++;
      tokens.push({ t: 'str', v: s, line });
    } else {
      throw new Error(`${file}:${line}: unexpected "${c}" (every key and value must be quoted)`);
    }
  }
  return tokens;
}

function parse(text, file) {
  const tokens = tokenize(text, file);
  let p = 0;
  function block(depth) {
    const obj = {};
    while (p < tokens.length) {
      const tok = tokens[p];
      if (tok.t === '}') {
        if (depth === 0) throw new Error(`${file}:${tok.line}: unexpected }`);
        p++;
        return obj;
      }
      if (tok.t !== 'str') throw new Error(`${file}:${tok.line}: expected a key`);
      p++;
      const next = tokens[p];
      if (!next) throw new Error(`${file}:${tok.line}: key "${tok.v}" has no value`);
      if (next.t === '{') {
        p++;
        obj[tok.v] = block(depth + 1);
      } else if (next.t === 'str') {
        p++;
        obj[tok.v] = next.v;
      } else {
        throw new Error(`${file}:${next.line}: key "${tok.v}" has no value`);
      }
    }
    if (depth > 0) throw new Error(`${file}: missing }`);
    return obj;
  }
  return block(0);
}

let failures = 0;
for (const file of process.argv.slice(2)) {
  const name = path.basename(file);
  try {
    const vdf = parse(readFileSync(file, 'utf8'), name);
    const need = (cond, msg) => {
      if (!cond) throw new Error(`${name}: ${msg}`);
    };
    if (vdf.AppBuild) {
      const a = vdf.AppBuild;
      need(/^\d+$/.test(a.AppID ?? ''), 'AppID must be a number');
      need(typeof a.ContentRoot === 'string', 'ContentRoot missing');
      need(a.Depots && Object.keys(a.Depots).length > 0, 'no Depots');
      for (const [id, ref] of Object.entries(a.Depots)) {
        need(/^\d+$/.test(id), `depot id "${id}" is not a number`);
        if (typeof ref === 'string') need(ref.endsWith('.vdf'), `depot ${id} should point to a .vdf`);
      }
    } else if (vdf.DepotBuild) {
      const d = vdf.DepotBuild;
      need(/^\d+$/.test(d.DepotID ?? ''), 'DepotID must be a number');
      need(d.FileMapping && d.FileMapping.LocalPath && d.FileMapping.DepotPath, 'FileMapping needs LocalPath and DepotPath');
    } else {
      throw new Error(`${name}: neither "AppBuild" nor "DepotBuild"`);
    }
    console.log(`  ok   ${name} is valid VDF`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${e.message}`);
  }
}
process.exit(failures ? 1 : 0);
