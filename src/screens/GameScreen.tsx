import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccountStore } from '../store/accountStore';
import CharacterPanel from '../components/CharacterPanel';
import TechniquePanel from '../components/TechniquePanel';
import type { Stats } from '../types';
import type { Character } from '../types/character';
import { SPIRIT_ROOT_KEYS, SPIRIT_ROOT_LABELS, getRealmProgressCap } from '../types/character';
import type { RealmStage } from '../types/character';
import type { GameState } from '../store/gameStore';
import type { EquipBase } from '../types/equipment';
import type { LogEntry, GameEvent } from '../types';
import { INITIAL_GAME_TIME, formatGameTime } from '../types/time';
import EncounterSelectModal from '../components/EncounterSelectModal';

import { ENCOUNTER_OPTIONS } from '../data/encounters';
import type { EncounterOption } from '../data/encounters';
import {
  realmDisplayLabel,
  canMajorRealmBreakthrough,
  nextMajorRealm,
} from '../systems/cultivationSystem';
import { expToNextLevel } from '../systems/characterSystem';

type AccordionId = 'stats' | 'techniques' | 'bag';

function bagFootSummary(bag: EquipBase[]): string {
  if (bag.length === 0) return '空空如也';
  return `${bag.length} 件待佩淬`;
}

function characterFootSummary(char: Character): string {
  return `${char.realm}`;
}

function techniqueFootSummary(char: Character): string {
  const total = Object.values(char.techniqueSlots).filter(Boolean).length;
  const cap = 5;
  return `周天(${total}/${cap})`;
}


function CharacterResourcesStrip({ char, stats }: { char: Character; stats: Stats }) {
  const expToNext = expToNextLevel(char.level);
  const expPct = Math.min(100, (char.exp / expToNext) * 100);
  return (
    <div className="panel panel-xianxia character-resources-strip" style={{ marginBottom: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 12px' }}>
        <div className="game-hero-stat">
          <span className="muted-label">灵石</span>
          <span className="val gold">{char.gold}</span>
        </div>
        <div className="game-hero-stat" style={{ flex: '1 1 140px', minWidth: 120 }}>
          <span className="muted-label">修为</span>
          <span className="bar-track game-exp-bar">
            <motion.span className="spirit-fill exp-shade" animate={{ width: `${expPct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
            <span className="spirit-bar-text">{char.exp} / {expToNext}</span>
          </span>
        </div>
        <div className="game-hero-stat">
          <span className="muted-label">气血</span>
          <span className="val atk-val">{Math.floor(stats.hp)}</span>
        </div>
        <div className="game-hero-stat">
          <span className="muted-label">灵力</span>
          <span className="val" style={{ color: 'var(--cyan)' }}>{Math.floor(stats.mp)}</span>
        </div>
      </div>
    </div>
  );
}

function HeroSummary({ char }: { char: GameState['character'] }) {
  if (!char) return null;
  const realmLine = realmDisplayLabel(char.realm, char.realmStage);
  const spiritRootTypeLabel = (() => {
    const roots = SPIRIT_ROOT_KEYS
      .map(k => ({ key: k, pct: char.spiritRoots[k] ?? 0 }))
      .filter(r => r.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    if (roots.length === 0) return '杂灵根';
    const top = roots[0];
    if (top.pct > 70) return `${SPIRIT_ROOT_LABELS[top.key]}灵根`;
    const double = roots.filter(r => r.pct > 35);
    if (double.length >= 2) return '双灵根';
    const triple = roots.filter(r => r.pct > 30);
    if (triple.length >= 3) return '三灵根';
    return '杂灵根';
  })();

  return (
    <div className="panel panel-xianxia game-hero-card">
      <div className="panel-xianxia-ornament panel-xianjia-tl" aria-hidden />
      <div className="panel-xianxia-ornament panel-xianjia-tr" aria-hidden />
      <div className="panel-xianxia-ornament panel-xianjia-bl" aria-hidden />
      <div className="panel-xianxia-ornament panel-xianjia-br" aria-hidden />

      <h2 className="game-hero-name">· {char.name} ·</h2>
      <div className="realm-badge game-hero-realm">
        {spiritRootTypeLabel}
      </div>

      <div
        className="game-hero-foot"
        style={{ justifyContent: 'center', gap: 14, flexWrap: 'nowrap' }}
      >
        <span style={{ fontSize: '0.88rem', color: 'var(--cyan)', letterSpacing: '0.06em' }}>{realmLine}</span>
      </div>
      {(() => {
        const progressCap = getRealmProgressCap(char.realm as any, char.realmStage as any);
        const progressPct = progressCap > 0 ? Math.min(100, (char.realmProgress / progressCap) * 100) : 0;
        return (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>{char.realm}道种</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{char.realmProgress} / {progressCap}</span>
            </div>
            <div className="bar-track" style={{ height: 8, borderRadius: 4 }}>
              <motion.div
                className="bar-fill dao-progress"
                initial={{ width: '0%' }}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                style={{ height: '100%', borderRadius: 4 }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function BattleLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="panel panel-xianxia log-panel">
      <div className="panel-title">仙途札记</div>
      <div className="log-scroll">
        {logs.map(l => (
          <div key={l.id} className={`log-entry ${l.type}`}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

function EquipmentBag({ bag, onEquip, onEnhance }: {
  bag: EquipBase[];
  onEquip: (item: EquipBase) => void;
  onEnhance: (itemId: string) => void;
}) {
  if (bag.length === 0) return <div className="panel panel-xianxia"><div className="empty-text">行囊空空</div></div>;
  return (
    <div className="panel panel-xianxia">
      <div className="panel-title">行囊</div>
      <div className="bag-list">
        {bag.map(item => (
          <div key={item.id} className="bag-item">
            <div className="bag-item-name">{item.name} +{item.enhanceLevel}</div>
            <div className="bag-item-stats">
              {Object.entries(item.baseStats).map(([k, v]) => (
                <span key={k} className="stat-tag">{k} +{v}</span>
              ))}
            </div>
            <div className="bag-item-actions">
              <button type="button" className="btn-sm" onClick={() => onEquip(item)}>佩戴</button>
              <button type="button" className="btn-sm" onClick={() => onEnhance(item.id)}>淬炼</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventModal({ event, onResolve, onDismiss }: {
  event: GameEvent;
  onResolve: (i: number) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="event-overlay" onClick={onDismiss}>
      <div className="event-card" onClick={e => e.stopPropagation()}>
        <div className="event-type-badge">{event.type}</div>
        <div className="event-title">{event.title}</div>
        <div className="event-desc">{event.description}</div>
        <div className="event-options">
          {event.options.map((opt, i) => (
            <button key={i} type="button" className="event-option-btn" onClick={() => onResolve(i)}>{opt.text}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GameScreen ──────────────────────────────────────────────────────────────

export default function GameScreen() {
  const {
    storage, screen, logout,
    equipItem, enhanceItem,
    resolveEvent, tryBreakthrough, dismissEvent, getFinalStats, navigateToEvent, navigateToCharacter,
  } = useAccountStore();

  const [openPanel, setOpenPanel] = useState<AccordionId | null>(null);
  const [showEncounterSelect, setShowEncounterSelect] = useState(false);

  const toggleAccordion = (id: AccordionId) => {
    setOpenPanel(prev => (prev === id ? null : id));
  };

  const activeId = storage.activeAccountId;
  const gs = activeId ? storage.gameStates[activeId] : null;

  if (screen !== 'game' || !gs) {
    return <div className="panel panel-xianxia"><div className="empty-text">造化加载中…</div></div>;
  }

  const stats = getFinalStats();
  const char = gs.character;
  const canMajorBreak = canMajorRealmBreakthrough(char);
  const nextRealm = nextMajorRealm(char.realm);
  const breakthroughBtnLabel = canMajorBreak
    ? (nextRealm ? `🌟 踏入${nextRealm}` : '🌟 突破')
    : '🔒 突破';

  return (
    <div className="app game-screen-root">
      <header className="app-header game-header-xian">
        <div className="game-header-inner">
          <div className="game-header-title-block">
            <h1>登仙</h1>
            <div
              className="game-header-realm-line"
              style={{
                marginTop: 6,
                marginBottom: 2,
                fontSize: '0.88rem',
                letterSpacing: '0.06em',
                color: 'var(--cyan)',
                lineHeight: 1.35,
              }}
            >
              <strong style={{ fontWeight: 700, color: 'var(--gold)' }}>{char.realm}</strong>{' '}
              <motion.span
                key={char.realmProgress}
                initial={{ scale: 1.2, color: 'var(--gold)' }}
                animate={{ scale: 1, color: 'var(--gold)' }}
                transition={{ duration: 0.3 }}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {char.realmProgress}
              </motion.span>{' '}/ {getRealmProgressCap(char.realm as any, char.realmStage as RealmStage)}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: '0.72rem',
                color: 'var(--muted)',
                letterSpacing: '0.04em',
              }}
            >
              {formatGameTime(gs.gameTime ?? INITIAL_GAME_TIME)}
            </div>
          </div>
          <div className="game-header-actions">
            <div className="game-element-sigil" title={char.realm}>
              {char.realm[0]}
            </div>
            {/* <button
              type="button"
              className="btn-sm"
              style={{ background: '#333', color: '#0ff', border: '1px solid #0ff', fontSize: '0.7rem' }}
              onClick={() => {
                const id = useAccountStore.getState().storage.activeAccountId;
                if (!id) return;
                const gs = toGameState(useAccountStore.getState().storage.gameStates[id]);
                gs.pendingEncounterKind = null;
                gs.currentEvent = null;
                gs.triggeredEvents = new Set();
                useAccountStore.getState().addLog('🔧 Debug: 历练状态已清理', 'event');
                setStorageGameState(id, gs);
              }}
            >
              🔧 Debug
            </button> */}
            <button type="button" className="btn-sm btn-logout-ink" onClick={logout}>辞行</button>
          </div>
        </div>
      </header>

      <HeroSummary char={gs.character} />

      <div className="actions game-actions-row">
        <button type="button" className="btn btn-battle" onClick={() => setShowEncounterSelect(true)}>⚔ 历练</button>
        {/* 旧周天按钮已移除，等新功法系统设计后填充 */}
        {/* <button type="button" className="btn btn-refine" onClick={() => setShowRefineModal(true)}>🌀 周天</button> */}
        <button
          type="button"
          className="btn btn-breakthrough"
          disabled={!canMajorBreak}
          onClick={tryBreakthrough}
        >
          {breakthroughBtnLabel}
        </button>
      </div>

      {canMajorBreak && (
        <div style={{
          textAlign: 'center',
          padding: '6px 16px',
          background: 'linear-gradient(90deg, transparent, rgba(255,200,50,0.15), transparent)',
          color: 'var(--gold)',
          fontSize: '0.82rem',
          letterSpacing: '0.1em',
          fontWeight: 700,
          borderTop: '1px solid rgba(255,200,50,0.2)',
          borderBottom: '1px solid rgba(255,200,50,0.2)',
        }}>
          ✨ 境界突破！ ✨
        </div>
      )}

      <div className="game-accordion">
        {([
          { id: 'stats' as const, title: '人物', summary: characterFootSummary(gs.character), onClick: navigateToCharacter },
          { id: 'techniques' as const, title: '功法', summary: techniqueFootSummary(gs.character) },
          { id: 'bag' as const, title: '行囊', summary: bagFootSummary(gs.bag) },
        ]).map(row => {
          const expanded = openPanel === row.id;
          return (
            <div key={row.id} className="game-accordion-item">
              <button
                type="button"
                className={`game-accordion-trigger ${expanded ? 'is-expanded' : ''}`}
                onClick={() => row.onClick ? row.onClick() : toggleAccordion(row.id)}
                aria-expanded={expanded}
              >
                <span className="game-accordion-title">{row.title}</span>
                <span className="game-accordion-summary" title={row.summary}>
                  {row.summary}
                </span>
              </button>
              <div className={`game-accordion-panel-shell ${expanded ? 'is-expanded' : ''}`}>
                <div className="game-accordion-panel game-tab-pane">
                  {expanded && row.id === 'stats' && (
                    <>
                      <CharacterResourcesStrip char={gs.character} stats={stats} />
                      <CharacterPanel character={gs.character} stats={stats} />
                    </>
                  )}
                  {expanded && row.id === 'techniques' && (
                    <TechniquePanel
                      slots={gs.character.techniqueSlots}
                      spiritQi={char.spiritQi as Record<string, number>}
                      knownTechniques={gs.character.knownTechniques}
                    />
                  )}
                  {expanded && row.id === 'bag' && <EquipmentBag bag={gs.bag} onEquip={equipItem} onEnhance={enhanceItem} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BattleLog logs={gs.logs} />

      {gs.currentEvent && (
        <EventModal event={gs.currentEvent} onResolve={resolveEvent} onDismiss={dismissEvent} />
      )}

      {showEncounterSelect && (
        <EncounterSelectModal
          options={ENCOUNTER_OPTIONS}
          onSelect={(opt: EncounterOption) => {
            navigateToEvent(opt.kind);
            setShowEncounterSelect(false);
          }}
          onClose={() => setShowEncounterSelect(false)}
        />
      )}

      {/* <RefineModal ... /> - 等新功法系统设计后填充 */}
    </div>
  );
}
