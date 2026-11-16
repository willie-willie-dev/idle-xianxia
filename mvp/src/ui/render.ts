/**
 * UI 层：最小 DOM 渲染 + 事件绑定。
 *
 * 只做两件事：把存档画成页面、把点击翻译成 `GameApp` 调用。
 * 任何规则判断（能不能突破、抽到哪条事件）都在 app / systems 里。
 */

import { canBreakthrough, createBrowserApp } from '../app.ts';
import type { GameApp } from '../app.ts';
import type { CharacterSummary, GameEvent, MvpCharacter, Roots } from '../types.ts';

const LOG_LIMIT = 60;

/** 灵根七通道的展示顺序与中文名（键与 `Roots` 一致）。 */
const ROOT_LABELS: readonly (readonly [keyof Roots, string])[] = [
  ['qian', '乾'],
  ['kun', '坤'],
  ['metal', '金'],
  ['wood', '木'],
  ['water', '水'],
  ['fire', '火'],
  ['earth', '土'],
];

/** 五行主属性 -> 灵根通道，用来在七通道里标出主属那一枚。 */
const ELEMENT_ROOT: Record<MvpCharacter['element'], keyof Roots> = {
  金: 'metal',
  木: 'wood',
  水: 'water',
  火: 'fire',
  土: 'earth',
};

interface ViewState {
  app: GameApp;
  storageName: string;
  character: MvpCharacter | null;
  pendingEvent: GameEvent | null;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`页面缺少节点 #${id}`);
  return node as unknown as T;
}

/** 显示一位小数，避免浮点尾巴刷屏。 */
function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function clear(node: HTMLElement): void {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function bootstrap(): Promise<void> {
  const { app, storageName } = createBrowserApp(window.location.search);
  const state: ViewState = {
    app,
    storageName,
    character: null,
    pendingEvent: null,
  };

  const screenList = el<HTMLElement>('screen-list');
  const screenGame = el<HTMLElement>('screen-game');
  const charList = el<HTMLElement>('char-list');
  const listEmpty = el<HTMLElement>('list-empty');
  const listError = el<HTMLElement>('list-error');
  const nameInput = el<HTMLInputElement>('name-input');
  const btnCreate = el<HTMLButtonElement>('btn-create');
  const locationSelect = el<HTMLSelectElement>('location-select');
  const eventPanel = el<HTMLElement>('event-panel');
  const eventTitle = el<HTMLElement>('event-title');
  const eventText = el<HTMLElement>('event-text');
  const eventOptions = el<HTMLElement>('event-options');
  const logBox = el<HTMLElement>('log');
  const btnAbsorb = el<HTMLButtonElement>('btn-absorb');
  const btnBreakthrough = el<HTMLButtonElement>('btn-breakthrough');
  const btnEvent = el<HTMLButtonElement>('btn-event');
  const charRoots = el<HTMLElement>('char-roots');
  const charProgress = el<HTMLElement>('char-progress');
  const charProgressBar = el<HTMLElement>('char-progress-bar');

  el<HTMLElement>('storage-hint').textContent =
    storageName === 'indexeddb'
      ? '存档：浏览器本地 IndexedDB（刷新不丢）'
      : '存档：内存（刷新即丢，用于 file:// 或 ?storage=memory）';

  /** 往日志里追加一条，最多保留 LOG_LIMIT 条。 */
  function log(message: string, kind?: string): void {
    const row = make('div', kind === undefined ? 'log-row' : `log-row ${kind}`, message);
    logBox.prepend(row);
    while (logBox.childElementCount > LOG_LIMIT) {
      const last = logBox.lastElementChild;
      if (last === null) break;
      logBox.removeChild(last);
    }
  }

  function showScreen(name: 'list' | 'game'): void {
    screenList.classList.toggle('hidden', name !== 'list');
    screenGame.classList.toggle('hidden', name !== 'game');
  }

  /** 灵根七通道：横排小标签，五行主属性那一枚高亮。 */
  function renderRoots(character: MvpCharacter): void {
    clear(charRoots);
    const main = ELEMENT_ROOT[character.element];
    for (const [key, label] of ROOT_LABELS) {
      const raw = character.spiritRoots?.[key];
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const chip = make('span', key === main ? 'root-chip is-element' : 'root-chip');
      chip.title = `${label}灵根 ${fmt(value)}%`;
      chip.append(
        make('span', 'root-key', label),
        make('span', 'root-value', `${fmt(value)}%`),
      );
      charRoots.append(chip);
    }
  }

  /**
   * 修为进度：条宽 = cultivation / nextThreshold。
   * 突破成功时 cultivation 已被扣掉旧阈值，所以这里天然显示「余下修为 / 新阈值」。
   */
  function renderProgress(character: MvpCharacter): void {
    const threshold = character.nextThreshold;
    const ratio =
      threshold > 0 && Number.isFinite(character.cultivation)
        ? character.cultivation / threshold
        : 0;
    const percent = Math.min(100, Math.max(0, ratio * 100));
    charProgressBar.style.width = `${percent.toFixed(1)}%`;
    charProgress.textContent = `${fmt(character.cultivation)} / ${fmt(threshold)}`;

    const track = charProgressBar.parentElement;
    if (track !== null) {
      track.setAttribute('aria-valuenow', fmt(character.cultivation));
      track.setAttribute('aria-valuemax', fmt(threshold));
    }
  }

  function renderGame(character: MvpCharacter): void {
    state.character = character;
    el<HTMLElement>('char-name').textContent = character.name;
    el<HTMLElement>('char-realm').textContent = character.realm;
    el<HTMLElement>('char-day').textContent = String(character.day);
    el<HTMLElement>('char-cultivation').textContent = fmt(character.cultivation);
    el<HTMLElement>('char-cultivation-max').textContent = String(character.cultivationMax);
    el<HTMLElement>('char-threshold').textContent = String(character.nextThreshold);
    el<HTMLElement>('char-element').textContent = character.element;
    el<HTMLElement>('char-technique').textContent = character.technique.name;
    renderRoots(character);
    renderProgress(character);

    const ready = canBreakthrough(character);
    btnBreakthrough.disabled = !ready;
    btnBreakthrough.textContent = character.realm === '金丹' ? '已至金丹' : '突破';
    btnBreakthrough.title = ready
      ? '修为已足，可尝试突破'
      : character.realm === '金丹'
        ? '金丹是 MVP 的顶阶'
        : `还差 ${fmt(character.nextThreshold - character.cultivation)} 修为`;
  }

  function renderCharList(summaries: readonly CharacterSummary[]): void {
    clear(charList);
    listEmpty.classList.toggle('hidden', summaries.length > 0);
    for (const summary of summaries) {
      const item = make('li', 'char-item');

      const info = make('div', 'char-info');
      info.append(
        make('strong', 'char-item-name', summary.name),
        make('span', 'char-item-meta', `${summary.realm} · 修为 ${fmt(summary.cultivation)} · 第 ${summary.day} 天`),
      );

      const actions = make('div', 'char-item-actions');
      const enterBtn = make('button', undefined, '进入');
      enterBtn.type = 'button';
      enterBtn.addEventListener('click', () => {
        void enterGame(summary.id);
      });

      const deleteBtn = make('button', 'danger', '删除');
      deleteBtn.type = 'button';
      deleteBtn.addEventListener('click', () => {
        void removeCharacter(summary.id);
      });

      actions.append(enterBtn, deleteBtn);
      item.append(info, actions);
      charList.append(item);
    }
  }

  async function refreshList(): Promise<void> {
    renderCharList(await state.app.list());
    showScreen('list');
  }

  async function enterGame(id: string): Promise<void> {
    listError.textContent = '';
    clear(logBox);
    try {
      const character = await state.app.enter(id);
      state.pendingEvent = null;
      eventPanel.classList.add('hidden');
      log(`进入「${character.name}」，当前境界 ${character.realm}。`, 'muted');
      renderGame(character);
      showScreen('game');
    } catch (error) {
      logError(error);
    }
  }

  function showEvent(event: GameEvent): void {
    state.pendingEvent = event;
    eventTitle.textContent = `${event.title}（${event.realm}）`;
    eventText.textContent = event.text;
    clear(eventOptions);
    event.options.forEach((option, index) => {
      const button = make('button', 'event-option', option.text);
      button.type = 'button';
      button.addEventListener('click', () => {
        void resolveEvent(event, index);
      });
      eventOptions.append(button);
    });
    eventPanel.classList.remove('hidden');
  }

  function hideEvent(): void {
    state.pendingEvent = null;
    eventPanel.classList.add('hidden');
  }

  function afterUpdate(character: MvpCharacter): void {
    renderGame(character);
    if (canBreakthrough(character)) {
      log('修为已足，可以尝试突破。', 'good');
    }
  }

  async function resolveEvent(event: GameEvent, optionIndex: number): Promise<void> {
    try {
      const turn = await state.app.resolveEvent(event, optionIndex);
      const flags =
        turn.outcome.plotFlags.length > 0
          ? `（剧情标记：${turn.outcome.plotFlags.join('、')}）`
          : '';
      log(
        `历练「${turn.event.title}」：修为 +${fmt(turn.outcome.cultivationGain)}${flags}`,
        'good',
      );
      hideEvent();
      afterUpdate(turn.character);
    } catch (error) {
      logError(error);
    }
  }

  async function doAbsorb(): Promise<void> {
    if (state.character === null) return;
    try {
      const turn = await state.app.absorb(locationSelect.value);
      const tail = turn.capped ? '（已至修为上限）' : '';
      log(
        `吸收灵气：修为 +${fmt(turn.gain)}${tail}，第 ${turn.character.day} 天`,
      );
      afterUpdate(turn.character);
    } catch (error) {
      logError(error);
    }
  }

  async function doBreakthrough(): Promise<void> {
    if (state.character === null) return;
    const before = state.character.realm;
    try {
      const turn = await state.app.breakthrough();
      if (turn.result.success) {
        log(`突破成功：${before} → ${turn.character.realm}，修为 ${fmt(turn.character.cultivation)}`, 'good');
      } else if (turn.result.lost > 0) {
        log(`突破失败：损失修为 ${fmt(turn.result.lost)}，可立即重试`, 'bad');
      } else {
        log('突破未成：先攒够修为。', 'bad');
      }
      afterUpdate(turn.character);
    } catch (error) {
      logError(error);
    }
  }

  async function doEvent(): Promise<void> {
    if (state.character === null) return;
    try {
      const turn = await state.app.drawEvent();
      afterUpdate(turn.character);
      if (turn.event === null) {
        log(`本境界（${turn.character.realm}）已历练完。`, 'muted');
        hideEvent();
        return;
      }
      showEvent(turn.event);
    } catch (error) {
      logError(error);
    }
  }

  async function removeCharacter(id: string): Promise<void> {
    try {
      await state.app.remove(id);
      if (state.character !== null && state.character.id === id) {
        state.character = null;
        hideEvent();
        clear(logBox);
      }
      await refreshList();
    } catch (error) {
      logError(error);
    }
  }

  function logError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    log(`出错了：${message}`, 'bad');
    listError.textContent = message;
  }

  // ── 灵地下拉 ──────────────────────────────────────────────
  clear(locationSelect);
  for (const location of state.app.locations) {
    const option = make('option', undefined, location.name);
    option.value = location.id;
    locationSelect.append(option);
  }

  // ── 按钮绑定 ──────────────────────────────────────────────
  btnCreate.addEventListener('click', () => {
    void (async () => {
      listError.textContent = '';
      try {
        const character = await state.app.create(nameInput.value);
        nameInput.value = '';
        await enterGame(character.id);
      } catch (error) {
        logError(error);
      }
    })();
  });

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') btnCreate.click();
  });

  btnAbsorb.addEventListener('click', () => {
    void doAbsorb();
  });
  btnBreakthrough.addEventListener('click', () => {
    void doBreakthrough();
  });
  btnEvent.addEventListener('click', () => {
    void doEvent();
  });
  el<HTMLButtonElement>('btn-back').addEventListener('click', () => {
    void (async () => {
      await state.app.leave();
      state.character = null;
      hideEvent();
      await refreshList();
    })();
  });
  el<HTMLButtonElement>('btn-delete').addEventListener('click', () => {
    const current = state.character;
    if (current === null) return;
    void removeCharacter(current.id);
  });

  // ── 启动：优先恢复上次的角色 ──────────────────────────────
  try {
    const resumed = await state.app.resume();
    await refreshList();
    if (resumed !== null) {
      await enterGame(resumed.id);
    }
  } catch (error) {
    logError(error);
    await refreshList().catch(() => undefined);
  }
}
