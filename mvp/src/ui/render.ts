/**
 * UI 层：最小 DOM 渲染 + 事件绑定。
 *
 * 只做两件事：把存档画成页面、把点击翻译成 `GameApp` 调用。
 * 任何规则判断（能不能突破、抽到哪条事件）都在 app / systems 里。
 */

import { canBreakthrough, createBrowserApp } from '../app.ts';
import type { GameApp } from '../app.ts';
import {
  TECHNIQUE_LIBRARY,
  TECHNIQUE_SLOT_COUNT,
  nextStageOf,
  stageLabel,
} from '../data/balance.ts';
import type {
  CharacterSummary,
  GameEvent,
  MvpCharacter,
  Roots,
  TechniqueSlot,
} from '../types.ts';

const LOG_LIMIT = 60;

/** 槽位序号：① ② ③。 */
const SLOT_MARKS: readonly string[] = ['①', '②', '③'];

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
  const techniqueSlots = el<HTMLElement>('technique-slots');
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
   * 功法三槽：一行三个按钮（当前生效高亮）+ 每槽右侧一个功法库下拉。
   * 点击按钮 = setActiveSlot；改下拉 = setSlotTechnique。
   */
  function renderTechniqueSlots(character: MvpCharacter): void {
    clear(techniqueSlots);
    for (let index = 0; index < TECHNIQUE_SLOT_COUNT; index += 1) {
      const slot = index as TechniqueSlot;
      const current = character.techniques[slot];
      const active = character.activeSlot === slot;

      const row = make('div', active ? 'technique-slot is-active' : 'technique-slot');

      const button = make(
        'button',
        active ? 'slot-button is-active' : 'slot-button',
        `${SLOT_MARKS[index] ?? String(index)}${current.name}`,
      );
      button.type = 'button';
      button.id = `slot-${index}`;
      button.title = active
        ? `当前生效：${current.name}`
        : `点击让「${current.name}」生效`;
      button.addEventListener('click', () => {
        void chooseSlot(slot);
      });

      const select = make('select', 'slot-select');
      select.id = `slot-select-${index}`;
      select.title = '更换该槽功法';
      // 老存档的槽 0 可能是库外功法：先放一条只读选项，避免下拉乱指。
      const known = TECHNIQUE_LIBRARY.some((def) => def.name === current.name);
      if (!known) {
        const legacy = make('option', undefined, `${current.name}（库外）`);
        legacy.value = '';
        legacy.selected = true;
        select.append(legacy);
      }
      for (const def of TECHNIQUE_LIBRARY) {
        const option = make(
          'option',
          undefined,
          `${def.name}（${(def.absorbRate * def.convertRate).toFixed(3)}）`,
        );
        option.value = def.id;
        if (def.name === current.name) option.selected = true;
        select.append(option);
      }
      select.addEventListener('change', () => {
        void chooseTechnique(slot, select.value);
      });

      row.append(button, select);
      techniqueSlots.append(row);
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
    el<HTMLElement>('char-realm').textContent = stageLabel(
      character.realm,
      character.stage,
    );
    el<HTMLElement>('char-stage').textContent = character.stage;
    el<HTMLElement>('char-day').textContent = String(character.time.day);
    el<HTMLElement>('char-cultivation').textContent = fmt(character.cultivation);
    el<HTMLElement>('char-cultivation-max').textContent = String(character.cultivationMax);
    el<HTMLElement>('char-threshold').textContent = String(character.nextThreshold);
    el<HTMLElement>('char-element').textContent = character.element;
    renderRoots(character);
    renderTechniqueSlots(character);
    renderProgress(character);

    const top = nextStageOf(character.realm, character.stage) === null;
    const ready = canBreakthrough(character);
    btnBreakthrough.disabled = !ready;
    btnBreakthrough.textContent = top ? '已至顶阶' : '突破';
    btnBreakthrough.title = top
      ? `${stageLabel(character.realm, character.stage)}是 MVP 的顶阶`
      : ready
        ? '修为已足，可尝试突破'
        : `还差 ${fmt(character.nextThreshold - character.cultivation)} 修为`;
  }

  /** 点击槽位按钮：切换生效功法。 */
  async function chooseSlot(slot: TechniqueSlot): Promise<void> {
    try {
      const character = await state.app.setActiveSlot(slot);
      log(`切换功法：「${character.techniques[slot].name}」生效。`, 'muted');
      renderGame(character);
    } catch (error) {
      logError(error);
    }
  }

  /** 改槽位下拉：把该槽换成功法库里的另一条。 */
  async function chooseTechnique(
    slot: TechniqueSlot,
    techniqueId: string,
  ): Promise<void> {
    if (techniqueId === '') return;
    try {
      const character = await state.app.setSlotTechnique(slot, techniqueId);
      log(`第 ${slot + 1} 槽换为「${character.techniques[slot].name}」。`, 'muted');
      renderGame(character);
    } catch (error) {
      logError(error);
    }
  }

  function renderCharList(summaries: readonly CharacterSummary[]): void {
    clear(charList);
    listEmpty.classList.toggle('hidden', summaries.length > 0);
    for (const summary of summaries) {
      const item = make('li', 'char-item');

      const info = make('div', 'char-info');
      info.append(
        make('strong', 'char-item-name', summary.name),
        make(
          'span',
          'char-item-meta',
          `${stageLabel(summary.realm, summary.stage)} · 修为 ${fmt(summary.cultivation)} · 第 ${summary.day} 天`,
        ),
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
      log(
        `进入「${character.name}」，当前境界 ${stageLabel(character.realm, character.stage)}。`,
        'muted',
      );
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
        `吸收灵气：修为 +${fmt(turn.gain)}${tail}，第 ${turn.character.time.day} 天`,
      );
      afterUpdate(turn.character);
    } catch (error) {
      logError(error);
    }
  }

  async function doBreakthrough(): Promise<void> {
    if (state.character === null) return;
    const before = stageLabel(state.character.realm, state.character.stage);
    try {
      const turn = await state.app.breakthrough();
      if (turn.result.success) {
        log(
          `突破成功：${before} → ${stageLabel(turn.character.realm, turn.character.stage)}，修为 ${fmt(turn.character.cultivation)}`,
          'good',
        );
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
        log(
          `本境界（${stageLabel(turn.character.realm, turn.character.stage)}）已历练完。`,
          'muted',
        );
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
