import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Character, Stats, RealmStage } from '../types';
import { ELEMENT_KEYS, SPIRIT_ROOT_KEYS, SPIRIT_ROOT_LABELS, SPIRIT_ROOT_COLORS, SPIRIT_ROOT_ICONS, getRealmProgressCap } from '../types/character';
import { getSpiritQiCapForRoot, realmDisplayLabel, REALM_PROGRESS_NAMES } from '../systems/cultivationSystem';

type Props = { character: Character; stats: Stats };

export default function CharacterPanel({ character, stats }: Props) {
  const char = character;
  const spiritRows = useMemo(() => ELEMENT_KEYS.map(k => {
    const cap = Math.floor(getSpiritQiCapForRoot(char, k));
    const cur = Math.floor(char.spiritQi[k] ?? 0);
    const rootPct = Math.max(0, Math.min(100, char.spiritRoots[k] ?? 0));
    return { key: k, label: SPIRIT_ROOT_LABELS[k], color: SPIRIT_ROOT_COLORS[k], cur, cap, pct: cap > 0 ? Math.min(100, (cur / cap) * 100) : 0, rootPct };
  }).filter(r => r.rootPct > 0 && (r.cur > 0 || r.cap > 0)), [char]);

  const spiritRootRatioRows = useMemo(() => SPIRIT_ROOT_KEYS.map(k => {
    const ratio = Math.max(0, Math.min(100, char.spiritRoots[k] ?? 0));
    return { key: k, label: SPIRIT_ROOT_LABELS[k], color: SPIRIT_ROOT_COLORS[k], ratioPct: ratio };
  }).filter(r => r.ratioPct > 0), [char]);

  const spiritPieConicGradient = useMemo(() => {
    const rows = spiritRootRatioRows;
    const sum = rows.reduce((s, r) => s + r.ratioPct, 0);
    if (sum <= 0) return null;
    let acc = 0;
    const stops: string[] = [];
    rows.forEach((r, i) => {
      const slice = (r.ratioPct / sum) * 100;
      const start = acc;
      const end = i === rows.length - 1 ? 100 : acc + slice;
      acc += slice;
      stops.push(`${r.color} ${start}% ${end}%`);
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [spiritRootRatioRows]);

  const hpPct = (stats.hp > 0) ? Math.min(100, (stats.hp / stats.hp) * 100) : 0;

  const realmLine = realmDisplayLabel(char.realm, char.realmStage);
  const invPairs = Object.entries(char.inventory ?? {}).filter(([, n]) => n > 0);

  const spiritRootTypeLabel = useMemo(() => {
    const roots = SPIRIT_ROOT_KEYS
      .map(k => ({ key: k, pct: char.spiritRoots[k] ?? 0 }))
      .filter(r => r.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    if (roots.length === 0) return '杂灵根';
    const top = roots[0];
    if (top.pct > 70) {
      return `${SPIRIT_ROOT_LABELS[top.key]}灵根`;
    }
    const double = roots.filter(r => r.pct > 35);
    if (double.length >= 2) return '双灵根';
    const triple = roots.filter(r => r.pct > 30);
    if (triple.length >= 3) return '三灵根';
    return '杂灵根';
  }, [char.spiritRoots]);

  const progressCap = useMemo(() => getRealmProgressCap(char.realm as any, char.realmStage as RealmStage), [char.realm, char.realmStage]);
  const progressPct = useMemo(() =>
    progressCap > 0 ? Math.min(100, (char.realmProgress / progressCap) * 100) : 0,
  [char.realmProgress, progressCap]);

  return (
    <div className="panel">
      <h2 className="panel-title">· {char.name} ·</h2>
      <div className="realm-badge">{realmLine} · {spiritRootTypeLabel}</div>
      <div className="character-panel-spirit-split">
        <div className="character-panel-spirit-roots-col">
          <div className="spirit-roots-ratio-head">灵根配比</div>
          <div className="character-panel-roots-stack">
            <div
              className={spiritPieConicGradient ? 'spirit-pie-chart' : 'spirit-pie-chart spirit-pie-chart-empty'}
              style={spiritPieConicGradient ? ({ background: spiritPieConicGradient } as CSSProperties) : undefined}
              role={spiritPieConicGradient ? 'img' : undefined}
              aria-label={spiritPieConicGradient ? '灵根配比饼图' : undefined}
            />
            <ul className="spirit-pie-legend character-panel-spirit-legend">
              {spiritRootRatioRows.map(r => (
                <li key={r.key} className="spirit-pie-legend-item">
                  <span className="spirit-icon" aria-hidden>{SPIRIT_ROOT_ICONS[r.key]}</span>
                  <span className="spirit-pie-legend-name">{r.label}</span>
                  <span className="spirit-pie-legend-pct">{Math.round(r.ratioPct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="character-panel-spirit-qi-col">
          <div className="spirit-qi-head character-panel-spirit-qi-head">灵气储存（各系上限随灵根配比浮动）</div>
          <div className="spirit-qi-rows spirit-qi-rows-character character-panel-spirit-qi-rows">
            {spiritRows.map(r => (
              <div key={r.key} className="spirit-row">
                <span className="spirit-row-label">
                  <span className="spirit-icon" aria-hidden>{SPIRIT_ROOT_ICONS[r.key]}</span>
                  <span className="spirit-row-name">{r.label}</span>
                </span>
                <span
                  className="bar-track spirit-bar"
                  style={{
                    borderColor: `color-mix(in srgb, ${r.color} 52%, transparent)`,
                    background: `linear-gradient(180deg, color-mix(in srgb, ${r.color} 34%, transparent) 0%, rgba(8, 10, 18, 0.72) 100%)`,
                  }}
                >
                  <motion.span
                    className="spirit-fill"
                    style={
                      {
                        background: `linear-gradient(180deg, color-mix(in srgb, ${r.color}, #fff 18%) 0%, ${r.color} 48%, color-mix(in srgb, ${r.color}, #0a0c14 38%) 100%)`,
                        '--fill-glow': r.color,
                      } as CSSProperties
                    }
                    animate={{ width: `${r.pct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </span>
                <span className="spirit-storage-val">{r.cur} / {r.cap} (灵根比例: {r.rootPct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="inventory-block">
        <div className="inventory-title">行囊</div>
        {invPairs.length === 0 ? (
          <div className="empty-text-muted">空无长物…</div>
        ) : (
          <div className="inventory-list">
            {invPairs.map(([name, n]) => (
              <div key={name} className="inventory-chip">{name} ×{n}</div>
            ))}
          </div>
        )}
      </div>

      <div className="realm-progress-block" style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(212,168,67,0.22)', background: 'rgba(212,168,67,0.05)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: 6 }}>
          {REALM_PROGRESS_NAMES[char.realm]} <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>周天提炼</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>累计</span>
          <span style={{ fontSize: '1.1rem', color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{char.realmProgress}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>点 / {progressCap}</span>
        </div>
        <div className="realm-progress-bar" style={{ marginTop: 8 }}>
          <span className="bar-track">
            <motion.span
              className="bar-fill dao-progress"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </span>
        </div>
      </div>

      <div className="attr-grid">
        <span>气血</span>
        <span className="val">
          <span className="bar-track"><motion.span className="bar-fill hp" animate={{ width: `${hpPct}%` }} />{Math.floor(stats.hp)}/{Math.floor(stats.hp)}</span>
        </span>
        <span>灵力</span><span className="val">{Math.floor(stats.mp)}</span>
        <span>攻击</span><span className="val atk-val">{Math.floor(stats.atk)}</span>
        <span>防御</span><span className="val def-val">{Math.floor(stats.def)}</span>
        <span>速度</span><span className="val">{Math.floor(stats.spd)}</span>
        <span>神识</span><span className="val">{Math.floor(stats.wil)}</span>
      </div>
    </div>
  );
}
