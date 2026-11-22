const EXPRESSIONS = ['正常', '开心', '大笑', '冷淡', '愤怒', '厌恶', '害羞', '惊恐'];
const STYLES = [
  ['cel', 'cel · 国漫赛璐璐'],
  ['gongbi', 'gongbi · 工笔'],
  ['pixel', 'pixel · 像素'],
];
const ROOTS = [
  ['qian', '乾白'],
  ['kun', '坤黑'],
  ['fire', '火'],
  ['water', '水'],
  ['wood', '木'],
  ['metal', '金'],
  ['earth', '土'],
];
const REALMS = ['炼气', '筑基', '金丹', '元婴', '化神'];
const DEFAULT_ROOTS = { qian: 15, kun: 10, fire: 15, water: 15, wood: 15, metal: 15, earth: 15 };
const PAGES = [
  ['avatars', '头像生成'],
  ['characters', '角色'],
  ['events', '事件'],
  ['system', '系统'],
];

const state = {
  page: 'avatars',
  token: readToken(),
  cards: [],
  cardId: '',
  card: null,
  sets: [],
  jobs: [],
  activeJobId: '',
  activeJob: null,
  style: 'cel',
  seeds: 1,
  expressions: new Set(EXPRESSIONS),
  logOpen: false,
  characters: [],
  charMode: '',
  charDraft: null,
  events: [],
  kindFilter: '',
  realmFilter: '',
  eventId: '',
  eventDetail: null,
  system: null,
  pollTimer: 0,
  building: false,
};

function readToken() {
  try {
    return sessionStorage.getItem('dengxian-admin-token') || '';
  } catch {
    return '';
  }
}

function saveToken(token) {
  state.token = token;
  try {
    if (token) sessionStorage.setItem('dengxian-admin-token', token);
    else sessionStorage.removeItem('dengxian-admin-token');
  } catch {
    /* 隐私模式可能拒绝 sessionStorage，令牌只留在本次内存里 */
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function toast(message, isError) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.className = isError ? 'show error' : 'show';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    node.className = '';
  }, 3200);
}

async function api(pathname, options) {
  const opts = options || {};
  const headers = { ...(opts.headers || {}) };
  if (state.token) headers['x-admin-token'] = state.token;
  let body = opts.body;
  if (body != null && typeof body !== 'string') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(pathname, { method: opts.method || 'GET', headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || ('请求失败 ' + res.status));
    error.status = res.status;
    throw error;
  }
  return data;
}

function statusLabel(job) {
  const done = job.progress ? job.progress.done : 0;
  const total = job.progress ? job.progress.total : 0;
  if (job.status === 'queued') return '排队中';
  if (job.status === 'running') return '运行中 ' + done + '/' + total;
  if (job.status === 'done') return '完成 ' + done + '/' + total;
  return '失败';
}

function statusClass(status) {
  if (status === 'done') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'running') return 'run';
  return 'warn';
}

function formatBytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / 1024 / 1024).toFixed(1) + ' MB';
}

function rootsText(roots) {
  if (!roots) return '';
  return ROOTS.map(([key, label]) => label + (roots[key] ?? 0)).join(' ');
}

function splitList(value) {
  return String(value || '').split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(list) {
  return (list || []).join('、');
}

function renderShell() {
  const titles = Object.fromEntries(PAGES);
  document.querySelector('#sidebar').innerHTML =
    '<p class="brand"><strong>登仙</strong><span>ADMIN · 本地</span></p><nav>' +
    PAGES.map(([id, label]) =>
      '<button type="button" data-action="page" data-page="' + id + '"' +
      (state.page === id ? ' aria-current="page"' : '') + '>' + label + '</button>').join('') +
    '</nav><div class="side-actions"><a href="/">打开游戏</a>' +
    '<button type="button" data-action="rebuild"' + (state.building ? ' disabled' : '') + '>重建前端</button></div>';
  document.querySelector('#topbar').innerHTML =
    '<h1>' + titles[state.page] + '</h1><p class="hint">本地开发工具，不要映射到公网</p>';
}

function stopPoll() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = 0;
}

function startPoll() {
  stopPoll();
  state.pollTimer = setInterval(() => {
    if (state.page === 'avatars') pollAvatars();
  }, 2000);
}

async function showPage(page) {
  state.page = page;
  renderShell();
  const view = document.querySelector('#view');
  view.innerHTML = '<p class="empty">读取中…</p>';
  try {
    if (page === 'avatars') await renderAvatars();
    else if (page === 'characters') await renderCharacters();
    else if (page === 'events') await renderEvents();
    else await renderSystem();
    if (page === 'avatars') startPoll();
    else stopPoll();
  } catch (err) {
    stopPoll();
    view.innerHTML = '<div class="panel"><p>' + esc(err.message) + '</p>' +
      (err.status === 401 ? tokenBox() : '') + '</div>';
  }
}

function tokenBox() {
  return '<form id="token-form" class="fields"><label class="field">令牌<input name="token" type="password" autocomplete="off"></label><button class="btn" type="submit">保存令牌</button></form>';
}

async function renderAvatars() {
  const [cards, jobs, sets] = await Promise.all([
    api('/api/cards'),
    api('/api/avatars/jobs'),
    api('/api/avatars/sets'),
  ]);
  state.cards = cards.cards || [];
  state.jobs = jobs.jobs || [];
  state.sets = sets.sets || [];
  if (!state.cardId && state.cards[0]) state.cardId = state.cards[0].id;
  if (state.cardId) state.card = await api('/api/cards/' + encodeURIComponent(state.cardId));
  if (!state.activeJobId && state.jobs[0]) state.activeJobId = state.jobs[0].id;
  if (state.activeJobId) {
    try {
      state.activeJob = await api('/api/avatars/jobs/' + encodeURIComponent(state.activeJobId));
    } catch {
      state.activeJob = null;
    }
  }
  const view = document.querySelector('#view');
  view.innerHTML =
    '<section class="split"><div class="panel"><h2>角色卡</h2><ul class="card-list">' +
    (state.cards.length ? state.cards.map((card) =>
      '<li><button type="button" data-action="pick-card" data-id="' + esc(card.id) + '" aria-pressed="' +
      (card.id === state.cardId ? 'true' : 'false') + '">' + esc(card.file) + '</button></li>').join('') :
      '<li class="empty">没有角色卡</li>') +
    '</ul><div id="card-brief"></div></div><div class="stack"><form id="gen-form" class="panel fields"><h2>参数</h2>' +
    '<div class="choices">' + STYLES.map(([id, label]) =>
      '<label><input type="radio" name="style" value="' + id + '"' + (state.style === id ? ' checked' : '') + '>' + label + '</label>').join('') +
    '</div><div class="checks">' + EXPRESSIONS.map((name) =>
      '<label><input type="checkbox" name="expr" value="' + name + '"' + (state.expressions.has(name) ? ' checked' : '') + '>' + name + '</label>').join('') +
    '</div><label class="field">定妆候选数（1-3）<input name="seeds" type="number" min="1" max="3" step="1" value="' + state.seeds + '"></label>' +
    '<p class="hint">定妆候选数大于 1 时，生成器只出定妆、不派生表情。生成会消耗 xAI 额度。</p>' +
    '<div class="row"><button class="btn secondary" type="button" data-action="generate" data-mode="master">仅出定妆</button>' +
    '<button class="btn" type="button" data-action="generate" data-mode="set">生成整套</button></div></form>' +
    '<div class="panel" id="job-panel"></div><div class="panel" id="result-panel"></div></div></section>';
  paintBrief();
  paintJobs();
  paintResults();
}

function paintBrief() {
  const node = document.querySelector('#card-brief');
  if (!node) return;
  const card = state.card && state.card.card;
  if (!card) {
    node.innerHTML = '';
    return;
  }
  node.innerHTML = '<dl class="kv" style="margin-top:16px"><dt>名字</dt><dd>' + esc(card.name || state.cardId) +
    '</dd><dt>色调</dt><dd>' + esc(card.theme || '—') + '</dd><dt>气质</dt><dd>' + esc(card.persona || '—') + '</dd></dl>';
}

function paintJobs() {
  const node = document.querySelector('#job-panel');
  if (!node) return;
  const job = state.activeJob;
  const list = state.jobs.map((item) =>
    '<li><button type="button" data-action="pick-job" data-id="' + esc(item.id) + '" aria-pressed="' +
    (item.id === state.activeJobId ? 'true' : 'false') + '">#' + esc(item.id) + ' ' + esc(item.cardId) +
    ' <span class="badge ' + statusClass(item.status) + '">' + esc(statusLabel(item)) + '</span></button></li>').join('');
  let detail = '<p class="empty">还没有任务</p>';
  if (job) {
    const logs = (job.logs || []).join('\n');
    detail = '<div class="row"><strong>任务 #' + esc(job.id) + '</strong><span class="badge ' + statusClass(job.status) + '">' +
      esc(statusLabel(job)) + '</span><button class="btn secondary" type="button" data-action="toggle-log">日志</button></div>' +
      (job.error ? '<p class="hint">' + esc(job.error) + '</p>' : '') +
      '<pre class="log"' + (state.logOpen ? '' : ' hidden') + '>' + esc(logs || '（暂无输出）') + '</pre>';
  }
  node.innerHTML = '<h2>任务</h2>' + detail + (list ? '<ul class="job-list" style="margin-top:12px">' + list + '</ul>' : '');
}

function imagesForCard() {
  if (state.activeJob && state.activeJob.name === state.cardId && state.activeJob.artifacts && state.activeJob.artifacts.length) {
    return state.activeJob.artifacts;
  }
  const set = state.sets.find((item) => item.name === state.cardId);
  return set ? set.images : [];
}

function whiteText(value) {
  if (value === true) return '<span class="badge ok">白底</span>';
  if (value === false) return '<span class="badge bad">非白底</span>';
  return '<span class="badge">未检</span>';
}

function paintResults() {
  const node = document.querySelector('#result-panel');
  if (!node) return;
  const images = imagesForCard();
  node.innerHTML = '<h2>结果</h2>' + (images.length ? '<div class="grid">' + images.map((image) =>
    '<button type="button" class="thumb" data-action="zoom" data-src="' + esc(image.url) + '" data-cap="' + esc(image.file) + '">' +
    '<img src="' + esc(image.url) + '" alt="' + esc(image.file) + '"><span>' + esc(image.expression || image.file) + ' ' + whiteText(image.whiteBg) + '</span></button>').join('') +
    '</div>' : '<p class="empty">这个角色卡还没有套装</p>');
}

async function pollAvatars() {
  try {
    const list = await api('/api/avatars/jobs');
    state.jobs = list.jobs || [];
    if (state.activeJobId) {
      const prev = state.activeJob && state.activeJob.status;
      state.activeJob = await api('/api/avatars/jobs/' + encodeURIComponent(state.activeJobId));
      if ((state.activeJob.status === 'done' || state.activeJob.status === 'failed') && prev !== state.activeJob.status) {
        const sets = await api('/api/avatars/sets');
        state.sets = sets.sets || [];
      }
    }
    paintJobs();
    paintResults();
  } catch (err) {
    if (err.status === 401) toast(err.message, true);
  }
}

async function generate(mode) {
  if (!state.cardId) {
    toast('先选一张角色卡', true);
    return;
  }
  const form = document.querySelector('#gen-form');
  const style = (form.querySelector('input[name="style"]:checked') || {}).value || 'cel';
  const seeds = Number(form.seeds.value);
  const expressions = [...form.querySelectorAll('input[name="expr"]:checked')].map((node) => node.value);
  state.style = style;
  state.seeds = seeds;
  state.expressions = new Set(expressions);
  const onlyMaster = mode === 'master';
  if (!Number.isInteger(seeds) || seeds < 1 || seeds > 3) {
    toast('定妆候选数必须是 1 到 3 的整数', true);
    return;
  }
  if (!onlyMaster && seeds === 1 && expressions.length === 0) {
    toast('至少选一个表情', true);
    return;
  }
  const noun = onlyMaster ? '只出 ' + seeds + ' 张定妆' : (seeds > 1 ? '定妆候选数大于 1，生成器只会出定妆' : '生成定妆和所选表情');
  if (!window.confirm(noun + '，会消耗 xAI 额度。确定开始？')) return;
  const created = await api('/api/avatars/jobs', {
    method: 'POST',
    body: { cardId: state.cardId, style, expressions, seeds, onlyMaster },
  });
  state.activeJobId = created.jobId;
  state.logOpen = true;
  state.activeJob = await api('/api/avatars/jobs/' + encodeURIComponent(created.jobId));
  const jobs = await api('/api/avatars/jobs');
  state.jobs = jobs.jobs || [];
  paintJobs();
  paintResults();
  toast('任务 #' + created.jobId + ' 已加入队列');
}

async function renderCharacters() {
  const [list, sets] = await Promise.all([api('/api/characters'), api('/api/avatars/sets')]);
  state.characters = list.characters || [];
  state.sets = sets.sets || [];
  const rows = state.characters.map((character) =>
    '<tr><td>' + esc(character.id) + '</td><td>' + esc(character.name) + '</td><td>' + esc(character.realm) +
    '</td><td>' + esc(rootsText(character.roots)) + '</td><td>' + esc(character.avatarSet || '—') +
    '</td><td class="row"><button class="btn secondary" type="button" data-action="edit-character" data-id="' + esc(character.id) +
    '">编辑</button><button class="btn danger" type="button" data-action="delete-character" data-id="' + esc(character.id) +
    '" data-name="' + esc(character.name) + '">删除</button></td></tr>').join('');
  document.querySelector('#view').innerHTML =
    '<div class="stack"><div class="panel"><div class="row" style="justify-content:space-between"><h2>列表</h2>' +
    '<button class="btn" type="button" data-action="new-character">新建</button></div>' +
    (rows ? '<table><thead><tr><th>id</th><th>名字</th><th>境界</th><th>灵根</th><th>头像套装</th><th>操作</th></tr></thead><tbody>' +
      rows + '</tbody></table>' : '<p class="empty">还没有角色</p>') +
    '</div><div id="char-form"></div></div>';
  paintCharacterForm();
}

function paintCharacterForm() {
  const node = document.querySelector('#char-form');
  if (!node || !state.charMode) {
    if (node) node.innerHTML = '';
    return;
  }
  const draft = state.charDraft || {
    name: '',
    realm: '炼气',
    roots: { ...DEFAULT_ROOTS },
    tags: [],
    note: '',
    avatarSet: '',
  };
  const realms = REALMS.includes(draft.realm) ? REALMS : [draft.realm, ...REALMS];
  const setNames = [...new Set([...(state.sets || []).map((item) => item.name), draft.avatarSet].filter(Boolean))];
  node.innerHTML = '<form id="character-form" class="panel fields"><h2>' + (state.charMode === 'edit' ? '编辑' : '新建') +
    '</h2><label class="field">名字<input name="name" type="text" required value="' + esc(draft.name) + '"></label>' +
    '<label class="field">境界<select name="realm">' + realms.map((realm) =>
      '<option value="' + esc(realm) + '"' + (realm === draft.realm ? ' selected' : '') + '>' + esc(realm) + '</option>').join('') +
    '</select></label><div class="roots">' + ROOTS.map(([key, label]) =>
      '<label class="field">' + label + '<input name="root-' + key + '" type="number" min="0" max="100" step="1" value="' +
      esc(draft.roots[key] ?? 0) + '"></label>').join('') +
    '</div><p class="sum" id="root-sum"></p><label class="field">性情标签<input name="tags" type="text" value="' +
    esc(joinList(draft.tags)) + '" placeholder="用逗号分隔"></label><label class="field">备注<textarea name="note">' +
    esc(draft.note || '') + '</textarea></label><label class="field">绑定头像套装<select name="avatarSet"><option value="">不绑定</option>' +
    setNames.map((name) => '<option value="' + esc(name) + '"' + (name === draft.avatarSet ? ' selected' : '') + '>' + esc(name) + '</option>').join('') +
    '</select></label><div class="row"><button class="btn" type="submit">保存</button>' +
    '<button class="btn secondary" type="button" data-action="cancel-character">取消</button></div></form>';
  updateRootSum();
}

function updateRootSum() {
  const form = document.querySelector('#character-form');
  const node = document.querySelector('#root-sum');
  if (!form || !node) return;
  const sum = ROOTS.reduce((total, [key]) => total + Number(form.elements['root-' + key].value || 0), 0);
  const ok = Math.abs(sum - 100) <= 0.01;
  node.className = 'sum ' + (ok ? 'ok' : 'bad');
  node.textContent = '灵根合计 ' + sum + (ok ? '，可以保存' : '，必须等于 100');
}

function characterPayload(form) {
  const roots = {};
  for (const [key] of ROOTS) roots[key] = Number(form.elements['root-' + key].value);
  return {
    name: form.name.value.trim(),
    realm: form.realm.value,
    roots,
    tags: splitList(form.tags.value),
    note: form.note.value,
    avatarSet: form.avatarSet.value,
  };
}

async function renderEvents() {
  const data = await api('/api/events');
  state.events = data.events || [];
  const realms = [...new Set(state.events.map((event) => event.realm))];
  const filtered = state.events.filter((event) =>
    (!state.kindFilter || event.kind === state.kindFilter) && (!state.realmFilter || event.realm === state.realmFilter));
  document.querySelector('#view').innerHTML =
    '<div class="stack"><div class="panel"><div class="filters"><select id="kind-filter"><option value="">全部类型</option>' +
    '<option value="story"' + (state.kindFilter === 'story' ? ' selected' : '') + '>story</option>' +
    '<option value="daily"' + (state.kindFilter === 'daily' ? ' selected' : '') + '>daily</option></select>' +
    '<select id="realm-filter"><option value="">全部境界</option>' + realms.map((realm) =>
      '<option value="' + esc(realm) + '"' + (state.realmFilter === realm ? ' selected' : '') + '>' + esc(realm) + '</option>').join('') +
    '</select><span class="hint">' + filtered.length + ' / ' + state.events.length + '</span></div>' +
    '<table><thead><tr><th>id</th><th>类型</th><th>境界</th><th>阶段</th><th>标题</th><th>选项数</th><th>覆盖</th></tr></thead><tbody>' +
    filtered.map((event) => '<tr class="' + (event.id === state.eventId ? 'selected' : '') + '" data-action="pick-event" data-id="' + esc(event.id) + '"><td>' +
      esc(event.id) + '</td><td>' + esc(event.kind) + '</td><td>' + esc(event.realm) + '</td><td>' + esc(event.stage) +
      '</td><td>' + esc(event.title) + '</td><td>' + event.optionCount + '</td><td>' +
      (event.hasOverride ? '<span class="badge warn">有覆盖</span>' : '—') + '</td></tr>').join('') +
    '</tbody></table></div><div id="event-detail"></div></div>';
  if (state.eventId) {
    try {
      await loadEvent(state.eventId);
    } catch (err) {
      state.eventId = '';
      toast(err.message, true);
    }
  }
}

function syncGenForm() {
  const form = document.querySelector('#gen-form');
  if (!form) return;
  const style = form.querySelector('input[name="style"]:checked');
  if (style) state.style = style.value;
  if (form.seeds) state.seeds = Number(form.seeds.value) || 1;
  state.expressions = new Set([...form.querySelectorAll('input[name="expr"]:checked')].map((node) => node.value));
}

async function loadEvent(id) {
  state.eventId = id;
  state.eventDetail = await api('/api/events/' + encodeURIComponent(id));
  document.querySelectorAll('#view tr[data-id]').forEach((row) => {
    row.classList.toggle('selected', row.dataset.id === id);
  });
  paintEvent();
}

function paintEvent() {
  const node = document.querySelector('#event-detail');
  const event = state.eventDetail;
  if (!node || !event) return;
  const options = (event.options || []).map((option, index) =>
    '<fieldset class="option-block"><legend>选项 ' + (index + 1) + '</legend>' +
    '<label class="field">文字<textarea name="opt-' + index + '-text">' + esc(option.text || '') + '</textarea></label>' +
    '<label class="field">结果<textarea name="opt-' + index + '-outcome">' + esc(option.outcome || '') + '</textarea></label>' +
    '<div class="roots"><label class="field">修为<input name="opt-' + index + '-cultivationGain" type="number" min="0" step="1" value="' +
    esc(option.cultivationGain ?? '') + '"></label><label class="field">体力<input name="opt-' + index + '-staminaCost" type="number" min="0" step="1" value="' +
    esc(option.staminaCost ?? '') + '"></label><label class="field">plotFlag<input name="opt-' + index + '-plotFlag" type="text" value="' +
    esc(option.plotFlag || '') + '"></label></div><label class="field">grants<input name="opt-' + index + '-grants" type="text" value="' +
    esc(joinList(option.grants)) + '"></label><label class="field">消耗品 itemGrants<input name="opt-' + index + '-itemGrants" type="text" value="' +
    esc(joinList(option.itemGrants)) + '"></label></fieldset>').join('');
  node.innerHTML = '<form id="event-form" class="panel fields"><div class="row" style="justify-content:space-between"><h2>' +
    esc(event.id) + ' · ' + esc(event.kind) + ' · ' + esc(event.realm) + ' ' + esc(event.stage) + '</h2>' +
    (event.hasOverride ? '<span class="badge warn">有覆盖</span>' : '') + '</div>' +
    '<label class="field">标题<input name="title" type="text" value="' + esc(event.title) + '"></label>' +
    '<label class="field">正文<textarea name="text">' + esc(event.text || '') + '</textarea></label>' + options +
    '<div class="row"><button class="btn" type="submit">保存覆盖</button>' +
    '<button class="btn secondary" type="button" data-action="clear-override" data-id="' + esc(event.id) + '"' +
    (event.hasOverride ? '' : ' disabled') + '>撤销覆盖</button></div>' +
    '<p class="hint">只写 data/event-overrides.json，不改 mvp 源码。数值与文案按选项下标覆盖。</p></form>';
}

function buildOverride(event, form) {
  const source = event.source;
  const override = {};
  if (form.title.value !== source.title) override.title = form.title.value;
  if (form.text.value !== source.text) override.text = form.text.value;
  const options = [];
  let changed = false;
  source.options.forEach((option, index) => {
    const patch = {};
    const text = form.elements['opt-' + index + '-text'].value;
    const outcome = form.elements['opt-' + index + '-outcome'].value;
    const plotFlag = form.elements['opt-' + index + '-plotFlag'].value;
    const cultRaw = form.elements['opt-' + index + '-cultivationGain'].value;
    const staminaRaw = form.elements['opt-' + index + '-staminaCost'].value;
    const grants = splitList(form.elements['opt-' + index + '-grants'].value);
    const itemGrants = splitList(form.elements['opt-' + index + '-itemGrants'].value);
    if (text !== (option.text || '')) patch.text = text;
    if (outcome !== (option.outcome || '')) patch.outcome = outcome;
    if (plotFlag !== (option.plotFlag || '')) patch.plotFlag = plotFlag;
    const cult = cultRaw === '' ? null : Number(cultRaw);
    const cultSrc = option.cultivationGain == null ? null : Number(option.cultivationGain);
    if (cult !== cultSrc) {
      if (cult == null || !Number.isFinite(cult) || cult < 0) throw new Error('修为必须是大于等于 0 的数字');
      patch.cultivationGain = cult;
    }
    const stamina = staminaRaw === '' ? null : Number(staminaRaw);
    const staminaSrc = option.staminaCost == null ? null : Number(option.staminaCost);
    if (stamina !== staminaSrc) {
      if (stamina == null || !Number.isFinite(stamina) || stamina < 0) throw new Error('体力必须是大于等于 0 的数字');
      patch.staminaCost = stamina;
    }
    if (grants.join('\n') !== (option.grants || []).join('\n')) patch.grants = grants;
    if (itemGrants.join('\n') !== (option.itemGrants || []).join('\n')) patch.itemGrants = itemGrants;
    options.push(patch);
    if (Object.keys(patch).length) changed = true;
  });
  if (changed) override.options = options;
  return override;
}

async function renderSystem() {
  state.system = await api('/api/system');
  const info = state.system;
  const jobs = (info.recentJobs || []).map((job) =>
    '<tr><td>#' + esc(job.id) + '</td><td>' + esc(job.cardId) + '</td><td><span class="badge ' + statusClass(job.status) + '">' +
    esc(statusLabel(job)) + '</span></td><td>' + esc(job.createdAt) + '</td></tr>').join('');
  document.querySelector('#view').innerHTML =
    '<div class="stack"><div class="panel"><dl class="kv">' +
    '<dt>端口</dt><dd>' + esc(info.port) + '</dd><dt>绑定地址</dt><dd>' + esc(info.bind) + '</dd>' +
    '<dt>当前用户</dt><dd>' + esc(info.user || '—') + '</dd><dt>Node</dt><dd>' + esc(info.node) + '</dd>' +
    '<dt>tools/avatar-gen</dt><dd>' + (info.avatarGen && info.avatarGen.executable ? '<span class="badge ok">可调用</span> ' : '<span class="badge bad">不可调用</span> ') +
    esc(info.avatarGen && info.avatarGen.path) + '</dd><dt>assets/avatars</dt><dd>' + formatBytes(info.avatarsBytes) + '</dd>' +
    '<dt>令牌</dt><dd>' + (info.tokenRequired ? '已要求' : '未设置，接口不校验') + '</dd>' +
    '<dt>游戏 dist</dt><dd>' + (info.distBuilt ? '<span class="badge ok">已构建</span>' : '<span class="badge bad">未构建</span>') +
    ' ' + esc(info.distMtime || '—') + '</dd></dl>' +
    '<form id="token-form" class="fields" style="margin-top:16px"><label class="field">ADMIN_TOKEN<input name="token" type="password" autocomplete="off" placeholder="只存在本次会话"></label>' +
    '<div class="row"><button class="btn secondary" type="submit">在本页保存令牌</button></div></form></div>' +
    '<div class="panel"><h2>最近任务</h2>' + (jobs ? '<table><thead><tr><th>任务</th><th>卡</th><th>状态</th><th>创建</th></tr></thead><tbody>' +
      jobs + '</tbody></table>' : '<p class="empty">还没有任务</p>') +
    '<div class="row" style="margin-top:12px"><button class="btn secondary" type="button" data-action="reload-system">刷新</button></div></div></div>';
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) {
    const row = event.target.closest('[data-action="pick-event"], tr[data-id]');
    if (row && row.dataset.action === 'pick-event') {
      loadEvent(row.dataset.id).catch((err) => toast(err.message, true));
    }
    return;
  }
  const action = target.dataset.action;
  if (action === 'page') {
    showPage(target.dataset.page);
    return;
  }
  if (action === 'pick-event') {
    loadEvent(target.dataset.id).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'pick-card') {
    syncGenForm();
    state.cardId = target.dataset.id;
    api('/api/cards/' + encodeURIComponent(state.cardId)).then((card) => {
      state.card = card;
      renderAvatars().catch((err) => toast(err.message, true));
    }).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'pick-job') {
    state.activeJobId = target.dataset.id;
    api('/api/avatars/jobs/' + encodeURIComponent(state.activeJobId)).then((job) => {
      state.activeJob = job;
      paintJobs();
      paintResults();
    }).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'toggle-log') {
    state.logOpen = !state.logOpen;
    paintJobs();
    return;
  }
  if (action === 'generate') {
    generate(target.dataset.mode).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'zoom') {
    const box = document.querySelector('#lightbox');
    document.querySelector('#lightbox-img').src = target.dataset.src;
    document.querySelector('#lightbox-img').alt = target.dataset.cap || '';
    document.querySelector('#lightbox-cap').textContent = target.dataset.cap || '';
    box.showModal();
    return;
  }
  if (action === 'new-character') {
    state.charMode = 'new';
    state.charDraft = null;
    paintCharacterForm();
    return;
  }
  if (action === 'cancel-character') {
    state.charMode = '';
    state.charDraft = null;
    paintCharacterForm();
    return;
  }
  if (action === 'edit-character') {
    const found = state.characters.find((item) => item.id === target.dataset.id);
    if (!found) return;
    state.charMode = 'edit';
    state.charDraft = found;
    paintCharacterForm();
    return;
  }
  if (action === 'delete-character') {
    if (!window.confirm('确定删除角色「' + (target.dataset.name || target.dataset.id) + '」？此操作不可恢复。')) return;
    api('/api/characters/' + encodeURIComponent(target.dataset.id), { method: 'DELETE' }).then(() => {
      state.charMode = '';
      toast('已删除');
      return renderCharacters();
    }).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'clear-override') {
    api('/api/events/' + encodeURIComponent(target.dataset.id) + '/override', { method: 'DELETE' }).then(() => {
      toast('已撤销覆盖');
      return renderEvents();
    }).catch((err) => toast(err.message, true));
    return;
  }
  if (action === 'reload-system') renderSystem().catch((err) => toast(err.message, true));
  if (action === 'rebuild') rebuildFrontend();
});

async function rebuildFrontend() {
  if (state.building) return;
  state.building = true;
  renderShell();
  const panel = document.querySelector('#build-panel');
  panel.hidden = false;
  panel.innerHTML = '<h2>重建前端</h2><p>正在执行 npm run build …</p>';
  try {
    const result = await api('/api/system/build', { method: 'POST' });
    const code = result.exitCode == null ? '无' : String(result.exitCode);
    panel.innerHTML = '<h2>重建前端</h2><p>exitCode ' + esc(code) + '</p><pre class="log">' + esc(result.log || '') + '</pre>';
    toast(result.ok ? '前端已重建，exitCode ' + code : '构建失败，exitCode ' + code, !result.ok);
    if (state.page === 'system') renderSystem().catch((err) => toast(err.message, true));
  } catch (err) {
    panel.innerHTML = '<h2>重建前端</h2><p>' + esc(err.message) + '</p>';
    toast(err.message, true);
  } finally {
    state.building = false;
    renderShell();
  }
}

document.addEventListener('change', (event) => {
  if (event.target.id === 'kind-filter') {
    state.kindFilter = event.target.value;
    state.eventDetail = null;
    renderEvents().catch((err) => toast(err.message, true));
  }
  if (event.target.id === 'realm-filter') {
    state.realmFilter = event.target.value;
    state.eventDetail = null;
    renderEvents().catch((err) => toast(err.message, true));
  }
  if (event.target.name && String(event.target.name).startsWith('root-')) updateRootSum();
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.id === 'token-form') {
    event.preventDefault();
    saveToken(form.token.value.trim());
    toast(state.token ? '令牌已保存在本次会话' : '已清除令牌');
    showPage(state.page);
    return;
  }
  if (form.id === 'character-form') {
    event.preventDefault();
    const payload = characterPayload(form);
    const sum = ROOTS.reduce((total, [key]) => total + payload.roots[key], 0);
    if (Math.abs(sum - 100) > 0.01) {
      toast('灵根合计必须为 100', true);
      return;
    }
    const editing = state.charMode === 'edit' && state.charDraft;
    const request = editing
      ? api('/api/characters/' + encodeURIComponent(state.charDraft.id), { method: 'PUT', body: payload })
      : api('/api/characters', { method: 'POST', body: payload });
    request.then(() => {
      state.charMode = '';
      state.charDraft = null;
      toast('已保存');
      return renderCharacters();
    }).catch((err) => toast(err.message, true));
    return;
  }
  if (form.id === 'event-form') {
    event.preventDefault();
    let override;
    try {
      override = buildOverride(state.eventDetail, form);
    } catch (err) {
      toast(err.message, true);
      return;
    }
    const id = state.eventDetail.id;
    const request = Object.keys(override).length
      ? api('/api/events/' + encodeURIComponent(id), { method: 'PUT', body: override })
      : api('/api/events/' + encodeURIComponent(id) + '/override', { method: 'DELETE' });
    request.then(() => {
      toast('已保存');
      return renderEvents();
    }).catch((err) => toast(err.message, true));
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.querySelector('#lightbox').open) {
    document.querySelector('#lightbox').close();
  }
});

const params = new URLSearchParams(location.search);
if (params.get('token')) {
  saveToken(params.get('token'));
  params.delete('token');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
}

showPage('avatars');
