/**
 * 登仙统一服务：同一进程托管游戏（mvp/dist）与 Admin。
 * node admin/server.ts
 * 只使用 node:http / node:fs / node:path / node:child_process / node:crypto。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { loadEvents } from './lib/read-events.mjs';

const ADMIN_DIR = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(ADMIN_DIR, '..');
const PUBLIC_DIR = path.join(ADMIN_DIR, 'public');
const CARDS_DIR = path.join(ROOT, 'tools', 'avatar-gen', 'cards');
const GEN_SCRIPT = path.join(ROOT, 'tools', 'avatar-gen', 'gen-avatar-set.py');
const AVATARS_DIR = path.join(ROOT, 'assets', 'avatars');
const MVP_DIR = path.join(ROOT, 'mvp');
const DIST_DIR = path.join(MVP_DIR, 'dist');
const DIST_ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const DATA_DIR = path.join(ROOT, 'data');
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
const OVERRIDES_PATH = path.join(DATA_DIR, 'event-overrides.json');

const BIND = '0.0.0.0';
const PORT = resolvePort();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const LOG_LIMIT = 400;
const LOG_TAIL = 200;
const BUILD_LOG_TAIL = 40;
const JOB_LIST = 20;
const BODY_LIMIT = 1_000_000;

const GAME_MISSING_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>登仙 · 尚未构建</title>
</head>
<body>
  <h1>游戏前端还没有构建</h1>
  <p>请先构建：cd mvp &amp;&amp; npm run build</p>
  <p><a href="/admin">打开后台</a></p>
</body>
</html>
`;

const EXPRESSIONS = ['正常', '开心', '大笑', '冷淡', '愤怒', '厌恶', '害羞', '惊恐'] as const;
const STYLES = ['cel', 'gongbi', 'pixel'] as const;
const ROOT_KEYS = ['qian', 'kun', 'fire', 'water', 'wood', 'metal', 'earth'] as const;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const OPTION_KEYS = ['text', 'outcome', 'cultivationGain', 'plotFlag', 'grants', 'staminaCost', 'itemGrants'] as const;

type Expression = (typeof EXPRESSIONS)[number];
type Style = (typeof STYLES)[number];
type JobStatus = 'queued' | 'running' | 'done' | 'failed';

interface EventOption {
  text: string;
  outcome?: string;
  cultivationGain?: number;
  plotFlag?: string;
  grants?: string[];
  staminaCost?: number;
  itemGrants?: string[];
}

interface GameEvent {
  id: string;
  kind: 'story' | 'daily' | string;
  realm: string;
  stage: string;
  title: string;
  text: string;
  days?: number;
  options: EventOption[];
}

interface Character {
  id: string;
  name: string;
  realm: string;
  roots: Record<(typeof ROOT_KEYS)[number], number>;
  tags: string[];
  note: string;
  avatarSet: string;
  createdAt: string;
  updatedAt: string;
}

interface Artifact {
  file: string;
  url: string;
  whiteBg: boolean | null;
  expression: string | null;
}

interface Job {
  id: string;
  cardId: string;
  name: string;
  style: Style;
  expressions: Expression[];
  seeds: number;
  onlyMaster: boolean;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  logs: string[];
  logBuf: string;
  logsDropped: number;
}

interface Route {
  method: string;
  pattern: string;
  name: string;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

function resolvePort(): number {
  const raw = process.env.PORT;
  if (raw == null || raw.trim() === '') return 3210;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error('[admin] PORT 必须是 1 到 65535 的整数');
    process.exit(1);
  }
  return n;
}

function decodePathname(pathname: string): string | null {
  const decoded: string[] = [];
  for (const part of pathname.split('/')) {
    if (part === '') {
      decoded.push('');
      continue;
    }
    let seg: string;
    try {
      seg = decodeURIComponent(part);
    } catch {
      return null;
    }
    if (seg.includes('/') || seg.includes('\\') || seg.includes('\0') || seg === '..' || seg === '.') return null;
    decoded.push(seg);
  }
  return decoded.join('/');
}

function withinRoot(root: string, target: string): boolean {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  return resolved === base || resolved.startsWith(base + path.sep);
}

function resolveInside(root: string, ...parts: string[]): string {
  const resolved = path.resolve(root, ...parts);
  if (!withinRoot(root, resolved)) fail(400, '路径越界');
  return resolved;
}

function realInside(root: string, target: string): string | null {
  if (!withinRoot(root, target)) return null;
  let rootReal: string;
  let fileReal: string;
  try {
    rootReal = fs.realpathSync(root);
    fileReal = fs.realpathSync(target);
  } catch {
    return null;
  }
  if (fileReal !== rootReal && !fileReal.startsWith(rootReal + path.sep)) return null;
  return fileReal;
}

function timingSafeEqualStr(got: string, expected: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function authorized(req: http.IncomingMessage, url: URL): boolean {
  if (!ADMIN_TOKEN) return true;
  const header = req.headers['x-admin-token'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const got = fromHeader ?? url.searchParams.get('token') ?? '';
  return timingSafeEqualStr(got, ADMIN_TOKEN);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new HttpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const text = await readBody(req);
  if (!text.trim()) fail(400, '请求体为空');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(400, 'JSON 无法解析');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, '请求体必须是 JSON 对象');
  return parsed as Record<string, unknown>;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function mimeOf(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function serveFile(res: http.ServerResponse, file: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  if (!stat.isFile()) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  res.writeHead(200, {
    'Content-Type': mimeOf(file),
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

let eventsPromise: Promise<GameEvent[]> | null = null;

function baseEvents(): Promise<GameEvent[]> {
  if (!eventsPromise) {
    eventsPromise = loadEvents().catch((err: unknown) => {
      eventsPromise = null;
      throw err;
    });
  }
  return eventsPromise;
}

function readOverrides(): Record<string, unknown> {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  const real = realInside(DATA_DIR, OVERRIDES_PATH);
  if (!real) fail(500, 'event-overrides.json 路径无效');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(real, 'utf8'));
  } catch {
    fail(500, 'event-overrides.json 无法解析');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(500, 'event-overrides.json 必须是对象');
  }
  return parsed as Record<string, unknown>;
}

let writeChain: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => T): Promise<T> {
  const run = writeChain.then(() => fn());
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function writeJsonAtomic(file: string, root: string, data: unknown): void {
  const target = resolveInside(root, path.relative(root, file));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const st = fs.lstatSync(target);
    if (st.isSymbolicLink()) fail(400, '拒绝写入符号链接');
  }
  const tmp = target + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, target);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function sanitizeOptionPatch(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, '选项覆盖必须是对象');
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if ('text' in src) {
    if (typeof src.text !== 'string') fail(400, '选项文字必须是字符串');
    out.text = src.text;
  }
  if ('outcome' in src) {
    if (typeof src.outcome !== 'string') fail(400, '选项结果必须是字符串');
    out.outcome = src.outcome;
  }
  if ('plotFlag' in src) {
    if (typeof src.plotFlag !== 'string') fail(400, 'plotFlag 必须是字符串');
    out.plotFlag = src.plotFlag;
  }
  if ('cultivationGain' in src) {
    if (typeof src.cultivationGain !== 'number' || !Number.isFinite(src.cultivationGain) || src.cultivationGain < 0) {
      fail(400, '修为必须是大于等于 0 的数字');
    }
    out.cultivationGain = src.cultivationGain;
  }
  if ('staminaCost' in src) {
    if (typeof src.staminaCost !== 'number' || !Number.isFinite(src.staminaCost) || src.staminaCost < 0) {
      fail(400, '体力必须是大于等于 0 的数字');
    }
    out.staminaCost = src.staminaCost;
  }
  if ('grants' in src) {
    if (!isStringArray(src.grants)) fail(400, 'grants 必须是字符串数组');
    out.grants = src.grants;
  }
  if ('itemGrants' in src) {
    if (!isStringArray(src.itemGrants)) fail(400, 'itemGrants 必须是字符串数组');
    out.itemGrants = src.itemGrants;
  }
  for (const key of Object.keys(out)) {
    if (!OPTION_KEYS.includes(key as (typeof OPTION_KEYS)[number])) delete out[key];
  }
  return out;
}

function sanitizeOverride(event: GameEvent, body: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if ('title' in body) {
    if (typeof body.title !== 'string') fail(400, '标题必须是字符串');
    out.title = body.title;
  }
  if ('text' in body) {
    if (typeof body.text !== 'string') fail(400, '正文必须是字符串');
    out.text = body.text;
  }
  if ('options' in body) {
    if (!Array.isArray(body.options)) fail(400, 'options 必须是数组');
    if (body.options.length > event.options.length) fail(400, '不能增加选项，只能覆盖已有选项的数值与文案');
    const options = body.options.map((item) => sanitizeOptionPatch(item));
    if (options.some((item) => Object.keys(item).length > 0)) out.options = options;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function applyOverride(event: GameEvent, override: unknown): GameEvent {
  const out = clone(event);
  if (!override || typeof override !== 'object' || Array.isArray(override)) return out;
  const patch = override as Record<string, unknown>;
  if (typeof patch.title === 'string') out.title = patch.title;
  if (typeof patch.text === 'string') out.text = patch.text;
  if (Array.isArray(patch.options)) {
    out.options = out.options.map((option, index) => {
      const item = patch.options[index];
      if (!item || typeof item !== 'object' || Array.isArray(item)) return option;
      const next = { ...option };
      const src = item as Record<string, unknown>;
      if (typeof src.text === 'string') next.text = src.text;
      if (typeof src.outcome === 'string') next.outcome = src.outcome;
      if (typeof src.plotFlag === 'string') next.plotFlag = src.plotFlag;
      if (typeof src.cultivationGain === 'number') next.cultivationGain = src.cultivationGain;
      if (typeof src.staminaCost === 'number') next.staminaCost = src.staminaCost;
      if (isStringArray(src.grants)) next.grants = src.grants;
      if (isStringArray(src.itemGrants)) next.itemGrants = src.itemGrants;
      return next;
    });
  }
  return out;
}

function eventSummary(event: GameEvent, hasOverride: boolean) {
  return {
    id: event.id,
    kind: event.kind,
    realm: event.realm,
    stage: event.stage,
    title: event.title,
    optionCount: event.options.length,
    hasOverride,
  };
}

async function findEvent(id: string): Promise<GameEvent> {
  if (!ID_RE.test(id)) fail(400, '事件 id 无效');
  const events = await baseEvents();
  const found = events.find((event) => event.id === id);
  if (!found) fail(404, '事件不存在');
  return found;
}

function listCards(): Array<{ id: string; file: string; name: string }> {
  if (!fs.existsSync(CARDS_DIR)) return [];
  return fs
    .readdirSync(CARDS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((filename) => {
      const id = filename.slice(0, -'.json'.length);
      if (!ID_RE.test(id)) return null;
      const filePath = resolveInside(CARDS_DIR, filename);
      let name = id;
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { name?: unknown };
        if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim();
      } catch {
        return null;
      }
      return { id, file: 'cards/' + filename, name };
    })
    .filter((item) => item !== null);
}

function readCard(id: string): { id: string; file: string; card: unknown } {
  if (!ID_RE.test(id)) fail(400, '角色卡 id 无效');
  const filePath = resolveInside(CARDS_DIR, id + '.json');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) fail(404, '角色卡不存在');
  let card: unknown;
  try {
    card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(500, '角色卡无法解析');
  }
  return { id, file: 'cards/' + id + '.json', card };
}

function whiteMap(dir: string): Map<string, boolean | null> {
  const map = new Map<string, boolean | null>();
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return map;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      expressions?: Record<string, { file?: string; white_bg?: boolean | null }>;
    };
    const expressions = manifest.expressions ?? {};
    for (const info of Object.values(expressions)) {
      if (!info || typeof info.file !== 'string') continue;
      map.set(info.file, typeof info.white_bg === 'boolean' ? info.white_bg : null);
    }
  } catch {
    return map;
  }
  return map;
}

function expressionOf(file: string): string | null {
  const matched = /^\d+-(.+)\.[^.]+$/.exec(file);
  return matched ? matched[1] : null;
}

function imageRank(file: string): number {
  if (file.startsWith('定妆')) return 0;
  const matched = /^(\d+)-/.exec(file);
  return matched ? Number(matched[1]) : 100;
}

function listImages(setName: string): Artifact[] {
  if (!ID_RE.test(setName)) return [];
  const dir = resolveInside(AVATARS_DIR, setName);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const whites = whiteMap(dir);
  return fs
    .readdirSync(dir)
    .filter((file) => IMAGE_EXT.has(path.extname(file).toLowerCase()))
    .sort((a, b) => imageRank(a) - imageRank(b) || a.localeCompare(b, 'zh'))
    .map((file) => ({
      file,
      url: '/avatars/' + encodeURIComponent(setName) + '/' + encodeURIComponent(file),
      whiteBg: whites.has(file) ? whites.get(file)! : null,
      expression: file.startsWith('定妆') ? '定妆' : expressionOf(file),
    }));
}

function listSets() {
  if (!fs.existsSync(AVATARS_DIR)) return [];
  return fs
    .readdirSync(AVATARS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => ID_RE.test(name))
    .sort()
    .map((name) => ({ name, images: listImages(name) }));
}

function directoryBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  const seen = new Set<string>();
  let total = 0;
  const walk = (current: string) => {
    const real = realInside(AVATARS_DIR, current);
    if (!real || seen.has(real)) return;
    seen.add(real);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(real);
    } catch {
      return;
    }
    if (stat.isFile()) {
      total += stat.size;
      return;
    }
    if (!stat.isDirectory()) return;
    for (const name of fs.readdirSync(real)) walk(path.join(real, name));
  };
  walk(dir);
  return total;
}

function avatarGenReady(): boolean {
  if (!fs.existsSync(GEN_SCRIPT) || !fs.statSync(GEN_SCRIPT).isFile()) return false;
  const probe = spawnSync('python3', ['--version'], { encoding: 'utf8', timeout: 5000 });
  return probe.status === 0;
}

function distStatus(): { built: boolean; mtime: string | null } {
  try {
    const stat = fs.statSync(DIST_INDEX);
    if (!stat.isFile()) return { built: false, mtime: null };
    return { built: true, mtime: stat.mtime.toISOString() };
  } catch {
    return { built: false, mtime: null };
  }
}

function lastLogLines(text: string, count: number): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
  if (!normalized) return '';
  return normalized.split('\n').slice(-count).join('\n');
}

let building = false;
let buildChild: ReturnType<typeof spawn> | null = null;

function runFrontendBuild(): Promise<{ ok: boolean; exitCode: number | null; log: string }> {
  if (building) fail(409, '构建正在进行');
  building = true;
  const chunks: Buffer[] = [];
  const child = spawn('npm', ['run', 'build'], {
    cwd: MVP_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  buildChild = child;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean, exitCode: number | null, log: string) => {
      if (settled) return;
      settled = true;
      building = false;
      if (buildChild && buildChild.pid === child.pid) buildChild = null;
      resolve({ ok, exitCode, log: lastLogLines(log, BUILD_LOG_TAIL) });
    };
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', (err) => finish(false, null, err.message));
    child.on('close', (code) => {
      const log = Buffer.concat(chunks).toString('utf8');
      finish(code === 0, code, log);
    });
  });
}

function parseRoots(input: unknown): Character['roots'] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, '灵根必须是对象');
  const src = input as Record<string, unknown>;
  const roots = {} as Character['roots'];
  let sum = 0;
  for (const key of ROOT_KEYS) {
    const n = typeof src[key] === 'number' ? src[key] : Number.NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100) fail(400, '灵根 ' + key + ' 必须是 0 到 100 的数字');
    roots[key] = n;
    sum += n;
  }
  if (Math.abs(sum - 100) > 0.01) fail(400, '灵根合计必须为 100，当前为 ' + sum);
  return roots;
}

function parseTags(input: unknown): string[] {
  if (input == null || input === '') return [];
  let list: unknown[] | null = null;
  if (Array.isArray(input)) list = input;
  else if (typeof input === 'string') list = input.split(/[,，]/);
  if (!list) fail(400, '性情标签必须是字符串数组');
  return list.map((item) => String(item).trim()).filter(Boolean).slice(0, 32);
}

function parseName(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) fail(400, '名字不能为空');
  const name = input.trim();
  if (name.length > 40) fail(400, '名字过长');
  return name;
}

function parseRealm(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) fail(400, '境界不能为空');
  const realm = input.trim();
  if (realm.length > 20) fail(400, '境界过长');
  return realm;
}

function parseNote(input: unknown): string {
  if (input == null) return '';
  if (typeof input !== 'string') fail(400, '备注必须是字符串');
  if (input.length > 4000) fail(400, '备注过长');
  return input;
}

function parseAvatarSet(input: unknown): string {
  if (input == null || input === '') return '';
  if (typeof input !== 'string') fail(400, '头像套装必须是字符串');
  const value = input.trim();
  if (!value) return '';
  if (!ID_RE.test(value)) fail(400, '头像套装名无效');
  return value;
}

function characterFromBody(body: Record<string, unknown>, prev: Character | null): Omit<Character, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'name' in body || !prev ? parseName(body.name) : prev.name,
    realm: 'realm' in body || !prev ? parseRealm(body.realm) : prev.realm,
    roots: 'roots' in body || !prev ? parseRoots(body.roots) : prev.roots,
    tags: 'tags' in body || !prev ? parseTags(body.tags) : prev.tags,
    note: 'note' in body || !prev ? parseNote(body.note) : prev.note,
    avatarSet: 'avatarSet' in body || !prev ? parseAvatarSet(body.avatarSet) : prev.avatarSet,
  };
}

function characterPath(id: string): string {
  if (!ID_RE.test(id)) fail(400, '角色 id 无效');
  return resolveInside(CHARACTERS_DIR, id + '.json');
}

function readCharacter(id: string): Character {
  const file = characterPath(id);
  if (!fs.existsSync(file)) fail(404, '角色不存在');
  const real = realInside(CHARACTERS_DIR, file);
  if (!real) fail(400, '路径越界');
  let parsed: Character;
  try {
    parsed = JSON.parse(fs.readFileSync(real, 'utf8')) as Character;
  } catch {
    fail(500, '角色文件无法解析');
  }
  parsed.id = id;
  return parsed;
}

function listCharacters(): Character[] {
  if (!fs.existsSync(CHARACTERS_DIR)) return [];
  return fs
    .readdirSync(CHARACTERS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const id = name.slice(0, -'.json'.length);
      if (!ID_RE.test(id)) return null;
      try {
        return readCharacter(id);
      } catch {
        return null;
      }
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

const jobs: Job[] = [];
let jobSeq = 0;
let pumping = false;
let activeChild: ReturnType<typeof spawn> | null = null;

function expectedTotal(job: Job): number {
  if (job.onlyMaster || job.seeds > 1) return job.seeds;
  return 1 + job.expressions.length;
}

function progressOf(job: Job): { done: number; total: number } {
  const total = expectedTotal(job);
  const done = job.logs.filter((line) => line.includes('->')).length;
  return { done: Math.min(done, total), total };
}

function appendLog(job: Job, chunk: string, stream: 'out' | 'err'): void {
  job.logBuf += chunk;
  const parts = job.logBuf.split('\n');
  job.logBuf = parts.pop() ?? '';
  for (const line of parts) {
    job.logs.push(stream === 'err' ? '[err] ' + line : line);
  }
  if (job.logs.length > LOG_LIMIT) {
    const drop = job.logs.length - LOG_LIMIT;
    job.logs.splice(0, drop);
    job.logsDropped += drop;
  }
}

function flushLog(job: Job): void {
  if (!job.logBuf) return;
  job.logs.push(job.logBuf);
  job.logBuf = '';
  if (job.logs.length > LOG_LIMIT) {
    const drop = job.logs.length - LOG_LIMIT;
    job.logs.splice(0, drop);
    job.logsDropped += drop;
  }
}

function publicJob(job: Job, withDetail: boolean) {
  const progress = progressOf(job);
  const base = {
    id: job.id,
    cardId: job.cardId,
    name: job.name,
    style: job.style,
    expressions: job.expressions,
    seeds: job.seeds,
    onlyMaster: job.onlyMaster,
    status: job.status,
    progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    error: job.error,
  };
  if (!withDetail) return base;
  return {
    ...base,
    logs: job.logs.slice(-LOG_TAIL),
    logsDropped: job.logsDropped,
    artifacts: listImages(job.name),
  };
}

function pump(): void {
  if (pumping) return;
  const next = jobs.find((job) => job.status === 'queued');
  if (!next) return;
  pumping = true;
  runJob(next).finally(() => {
    pumping = false;
    pump();
  });
}

async function runJob(job: Job): Promise<void> {
  try {
    await spawnJob(job);
  } catch (err) {
    flushLog(job);
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
  }
}

async function spawnJob(job: Job): Promise<void> {
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  const script = GEN_SCRIPT;
  const cardFile = resolveInside(CARDS_DIR, job.cardId + '.json');
  const args = [
    script,
    '--name',
    job.name,
    '--card-file',
    cardFile,
    '--style',
    job.style,
    '--seeds',
    String(job.seeds),
  ];
  if (job.expressions.length > 0) args.push('--expressions', job.expressions.join(','));
  if (job.onlyMaster) args.push('--only-master');
  appendLog(job, '$ python3 ' + args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(' ') + '\n', 'out');

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (status: JobStatus, code: number | null, error: string | null) => {
      if (settled) return;
      settled = true;
      flushLog(job);
      job.status = status;
      job.exitCode = code;
      job.error = error;
      job.finishedAt = new Date().toISOString();
      if (activeChild && activeChild.pid === child.pid) activeChild = null;
      resolve();
    };
    const child = spawn('python3', args, { cwd: ROOT, env: process.env });
    activeChild = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => appendLog(job, chunk, 'out'));
    child.stderr.on('data', (chunk: string) => appendLog(job, chunk, 'err'));
    child.on('error', (err) => finish('failed', null, err.message));
    child.on('close', (code) => {
      if (code === 0) finish('done', 0, null);
      else finish('failed', code, '生成器退出码 ' + String(code));
    });
  });
}

function createJob(body: Record<string, unknown>): Job {
  const cardId = body.cardId;
  if (typeof cardId !== 'string' || !ID_RE.test(cardId)) fail(400, 'cardId 无效');
  readCard(cardId);
  const style = (body.style ?? 'cel') as string;
  if (!STYLES.includes(style as Style)) fail(400, '风格必须是 cel、gongbi 或 pixel');
  const seeds = body.seeds == null ? 1 : body.seeds;
  if (typeof seeds !== 'number' || !Number.isInteger(seeds) || seeds < 1 || seeds > 3) {
    fail(400, '定妆候选数必须是 1 到 3 的整数');
  }
  const onlyMaster = body.onlyMaster === true;
  let selected: Expression[] = [];
  if (body.expressions != null) {
    if (!Array.isArray(body.expressions) || body.expressions.some((item) => typeof item !== 'string')) {
      fail(400, 'expressions 必须是字符串数组');
    }
    const wanted = new Set(body.expressions);
    selected = EXPRESSIONS.filter((name) => wanted.has(name));
  } else if (!onlyMaster) {
    selected = [...EXPRESSIONS];
  }
  if (!onlyMaster && seeds === 1 && selected.length === 0) fail(400, '至少选一个表情');
  const job: Job = {
    id: String(++jobSeq),
    cardId,
    name: cardId,
    style: style as Style,
    expressions: selected,
    seeds,
    onlyMaster,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: null,
    logs: [],
    logBuf: '',
    logsDropped: 0,
  };
  jobs.push(job);
  pump();
  return job;
}

const startedAt = Date.now();

const routes: Route[] = [
  { method: 'GET', pattern: '/api/health', name: 'health' },
  { method: 'GET', pattern: '/api/system', name: 'system' },
  { method: 'POST', pattern: '/api/system/build', name: 'systemBuild' },
  { method: 'GET', pattern: '/api/cards', name: 'cards' },
  { method: 'GET', pattern: '/api/cards/:id', name: 'card' },
  { method: 'POST', pattern: '/api/avatars/jobs', name: 'jobCreate' },
  { method: 'GET', pattern: '/api/avatars/jobs', name: 'jobList' },
  { method: 'GET', pattern: '/api/avatars/jobs/:id', name: 'jobGet' },
  { method: 'GET', pattern: '/api/avatars/sets', name: 'sets' },
  { method: 'GET', pattern: '/api/characters', name: 'characters' },
  { method: 'POST', pattern: '/api/characters', name: 'characterCreate' },
  { method: 'PUT', pattern: '/api/characters/:id', name: 'characterUpdate' },
  { method: 'DELETE', pattern: '/api/characters/:id', name: 'characterDelete' },
  { method: 'GET', pattern: '/api/events', name: 'events' },
  { method: 'DELETE', pattern: '/api/events/:id/override', name: 'eventOverrideDelete' },
  { method: 'GET', pattern: '/api/events/:id', name: 'eventGet' },
  { method: 'PUT', pattern: '/api/events/:id', name: 'eventPut' },
];

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = actual[i];
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

async function dispatch(name: string, req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>): Promise<void> {
  switch (name) {
    case 'health': {
      sendJson(res, 200, {
        ok: true,
        port: PORT,
        bind: BIND,
        node: process.version,
        uptime: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
      });
      return;
    }
    case 'system': {
      const recent = jobs.slice(-5).reverse().map((job) => publicJob(job, false));
      const dist = distStatus();
      sendJson(res, 200, {
        port: PORT,
        bind: BIND,
        user: process.env.USER || process.env.LOGNAME || '',
        node: process.version,
        avatarGen: {
          path: 'tools/avatar-gen/gen-avatar-set.py',
          executable: avatarGenReady(),
        },
        avatarsBytes: directoryBytes(AVATARS_DIR),
        distBuilt: dist.built,
        distMtime: dist.mtime,
        recentJobs: recent,
        tokenRequired: ADMIN_TOKEN !== '',
      });
      return;
    }
    case 'systemBuild': {
      const result = await runFrontendBuild();
      sendJson(res, 200, result);
      return;
    }
    case 'cards': {
      const cards = listCards();
      sendJson(res, 200, { count: cards.length, cards });
      return;
    }
    case 'card': {
      sendJson(res, 200, readCard(params.id));
      return;
    }
    case 'jobCreate': {
      const body = await readJson(req);
      const job = createJob(body);
      sendJson(res, 200, { jobId: job.id });
      return;
    }
    case 'jobList': {
      sendJson(res, 200, { jobs: jobs.slice(-JOB_LIST).reverse().map((job) => publicJob(job, false)) });
      return;
    }
    case 'jobGet': {
      const job = jobs.find((item) => item.id === params.id);
      if (!job) fail(404, '任务不存在');
      sendJson(res, 200, publicJob(job, true));
      return;
    }
    case 'sets': {
      sendJson(res, 200, { sets: listSets() });
      return;
    }
    case 'characters': {
      const characters = listCharacters();
      sendJson(res, 200, { count: characters.length, characters });
      return;
    }
    case 'characterCreate': {
      const body = await readJson(req);
      const fields = characterFromBody(body, null);
      const created = await withWriteLock(() => {
        fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
        let id = '';
        for (let i = 0; i < 5; i++) {
          const candidate = 'ch-' + crypto.randomBytes(6).toString('hex');
          if (!fs.existsSync(characterPath(candidate))) {
            id = candidate;
            break;
          }
        }
        if (!id) fail(500, '无法分配角色 id');
        const now = new Date().toISOString();
        const character: Character = { id, ...fields, createdAt: now, updatedAt: now };
        writeJsonAtomic(characterPath(id), CHARACTERS_DIR, character);
        return character;
      });
      sendJson(res, 200, created);
      return;
    }
    case 'characterUpdate': {
      const body = await readJson(req);
      const updated = await withWriteLock(() => {
        const prev = readCharacter(params.id);
        const fields = characterFromBody(body, prev);
        const character: Character = { ...prev, ...fields, id: prev.id, updatedAt: new Date().toISOString() };
        writeJsonAtomic(characterPath(prev.id), CHARACTERS_DIR, character);
        return character;
      });
      sendJson(res, 200, updated);
      return;
    }
    case 'characterDelete': {
      await withWriteLock(() => {
        const file = characterPath(params.id);
        if (!fs.existsSync(file)) fail(404, '角色不存在');
        const st = fs.lstatSync(file);
        if (st.isSymbolicLink()) fail(400, '拒绝删除符号链接');
        if (!realInside(CHARACTERS_DIR, file)) fail(400, '路径越界');
        fs.unlinkSync(file);
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    case 'events': {
      const events = await baseEvents();
      const overrides = readOverrides();
      const view = events.map((event) => eventSummary(applyOverride(event, overrides[event.id]), Object.prototype.hasOwnProperty.call(overrides, event.id)));
      sendJson(res, 200, { count: view.length, events: view });
      return;
    }
    case 'eventGet': {
      const event = await findEvent(params.id);
      const overrides = readOverrides();
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, event.id);
      const merged = applyOverride(event, overrides[event.id]);
      sendJson(res, 200, {
        ...eventSummary(merged, hasOverride),
        text: merged.text,
        days: merged.days ?? null,
        options: merged.options,
        source: { title: event.title, text: event.text, options: event.options },
        override: hasOverride ? overrides[event.id] : null,
      });
      return;
    }
    case 'eventPut': {
      const event = await findEvent(params.id);
      const body = await readJson(req);
      const saved = await withWriteLock(() => {
        const overrides = readOverrides();
        const next = sanitizeOverride(event, body);
        if (next) overrides[event.id] = next;
        else delete overrides[event.id];
        writeJsonAtomic(OVERRIDES_PATH, DATA_DIR, overrides);
        return next;
      });
      const merged = applyOverride(event, saved);
      sendJson(res, 200, {
        ...eventSummary(merged, saved !== null),
        text: merged.text,
        days: merged.days ?? null,
        options: merged.options,
        override: saved,
      });
      return;
    }
    case 'eventOverrideDelete': {
      const event = await findEvent(params.id);
      await withWriteLock(() => {
        const overrides = readOverrides();
        delete overrides[event.id];
        if (Object.keys(overrides).length === 0) {
          if (fs.existsSync(OVERRIDES_PATH)) {
            if (fs.lstatSync(OVERRIDES_PATH).isSymbolicLink()) fail(400, '拒绝删除符号链接');
            fs.unlinkSync(OVERRIDES_PATH);
          }
          return;
        }
        writeJsonAtomic(OVERRIDES_PATH, DATA_DIR, overrides);
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    default:
      fail(404, '没有这个接口');
  }
}

function serveAvatar(res: http.ServerResponse, pathname: string): void {
  const prefix = '/avatars/';
  if (!pathname.startsWith(prefix)) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  const rel = pathname.slice(prefix.length);
  if (!rel || rel.includes('\0') || rel.endsWith('/')) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  if (!IMAGE_EXT.has(path.extname(rel).toLowerCase())) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  const abs = path.resolve(AVATARS_DIR, rel);
  if (!withinRoot(AVATARS_DIR, abs)) {
    sendJson(res, 400, { error: '路径越界' });
    return;
  }
  const real = realInside(AVATARS_DIR, abs);
  if (!real) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  serveFile(res, real);
}

function serveGameIndex(res: http.ServerResponse): void {
  let exists = false;
  try {
    exists = fs.statSync(DIST_INDEX).isFile();
  } catch {
    exists = false;
  }
  if (!exists) {
    const payload = GAME_MISSING_HTML;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(payload);
    return;
  }
  const real = realInside(DIST_DIR, DIST_INDEX);
  if (!real) {
    sendJson(res, 400, { error: '路径越界' });
    return;
  }
  serveFile(res, real);
}

function serveGameAsset(res: http.ServerResponse, pathname: string): void {
  const prefix = '/assets/';
  const rel = pathname.slice(prefix.length);
  if (!rel || rel.includes('\0') || rel.endsWith('/')) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  const abs = path.resolve(DIST_ASSETS_DIR, rel);
  if (!withinRoot(DIST_ASSETS_DIR, abs)) {
    sendJson(res, 400, { error: '路径越界' });
    return;
  }
  const real = realInside(DIST_ASSETS_DIR, abs);
  if (!real) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  serveFile(res, real);
}

function serveAdmin(res: http.ServerResponse, pathname: string): void {
  const rel = pathname === '/admin' || pathname === '/admin/' ? 'index.html' : pathname.slice('/admin/'.length);
  if (!rel || rel.includes('\0')) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  const abs = path.resolve(PUBLIC_DIR, rel);
  if (!withinRoot(PUBLIC_DIR, abs)) {
    sendJson(res, 400, { error: '路径越界' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const allowed = ext === '.html' || ext === '.css' || ext === '.js';
  if (allowed) {
    const real = realInside(PUBLIC_DIR, abs);
    if (real) {
      serveFile(res, real);
      return;
    }
  }
  const indexReal = realInside(PUBLIC_DIR, path.resolve(PUBLIC_DIR, 'index.html'));
  if (!indexReal) {
    sendJson(res, 404, { error: '文件不存在' });
    return;
  }
  serveFile(res, indexReal);
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = decodePathname(url.pathname);
    if (pathname == null) {
      sendJson(res, 400, { error: '路径无效' });
      return;
    }
    const method = req.method ?? 'GET';
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const matched = routes
      .map((route) => ({ route, params: matchPattern(route.pattern, pathname) }))
      .filter((item) => item.params);
    if (matched.length > 0) {
      if (!authorized(req, url)) {
        sendJson(res, 401, { error: '未授权' });
        return;
      }
      const hit = matched.find((item) => item.route.method === method);
      if (!hit || !hit.params) {
        sendJson(res, 405, { error: '方法不允许' });
        return;
      }
      await dispatch(hit.route.name, req, res, hit.params);
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: '没有这个接口' });
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: '方法不允许' });
      return;
    }
    if (pathname === '/avatars' || pathname.startsWith('/avatars/')) {
      serveAvatar(res, pathname);
      return;
    }
    if (pathname === '/assets' || pathname.startsWith('/assets/')) {
      serveGameAsset(res, pathname);
      return;
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      serveAdmin(res, pathname);
      return;
    }
    if (pathname === '/' || pathname === '/index.html') {
      serveGameIndex(res);
      return;
    }
    sendJson(res, 404, { error: '文件不存在' });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : '服务器错误';
    if (!(err instanceof HttpError)) console.error('[admin]', err);
    sendJson(res, status, { error: message.slice(0, 500) });
  }
}

function shutdown(signal: string): void {
  console.log('[admin] 收到 ' + signal + '，正在退出');
  if (activeChild && !activeChild.killed) activeChild.kill('SIGTERM');
  if (buildChild && !buildChild.killed) buildChild.kill('SIGTERM');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 800).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') console.error('[admin] 端口 ' + PORT + ' 已被占用');
  else console.error('[admin]', err);
  process.exit(1);
});

server.listen(PORT, BIND, () => {
  const address = server.address();
  const shown = address && typeof address === 'object' ? address.address + ':' + address.port : BIND + ':' + PORT;
  console.log('[admin] 游戏 http://' + shown + '/');
  console.log('[admin] 后台 http://' + shown + '/admin');
  if (!ADMIN_TOKEN) {
    console.warn('[admin] 警告：未设置 ADMIN_TOKEN，/api/* 不校验令牌。这是本地开发工具，生成接口会消耗 xAI 额度，建议设置 ADMIN_TOKEN。不要把本服务映射到公网。');
  }
});
