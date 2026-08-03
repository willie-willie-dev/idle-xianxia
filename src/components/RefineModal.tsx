import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Character } from '../types/character';
import { ELEMENT_KEYS, SPIRIT_ROOT_LABELS, SPIRIT_ROOT_ICONS, SPIRIT_ROOT_COLORS, type SpiritType } from '../types/character';
import { getSpiritQiCapForRoot, REALM_PROGRESS_NAMES } from '../systems/cultivationSystem';

const RATIO_OPTIONS = [100, 50, 25, 10] as const;
export type RefineRatioPct = (typeof RATIO_OPTIONS)[number];

export interface RefineModalProps {
  character: Character;
  onClose: () => void;
  /** 消耗五行灵气并获得修为。spiritType 只能是五行之一。 */
  onRefine: (spiritType: SpiritType, spiritQiToConsume: number) => { refined: number };
}

interface RefineLogEntry {
  id: number;
  spiritLabel: string;
  consumed: number;
  progressName: string;
  refined: number;
}

export default function RefineModal({ character, onClose, onRefine }: RefineModalProps) {
  const [ratio, setRatio] = useState<RefineRatioPct>(100);
  const [log, setLog] = useState<RefineLogEntry[]>([]);
  const logSeq = useRef(0);

  const realmProgressName = REALM_PROGRESS_NAMES[character.realm];

  const rows = useMemo(
    () =>
      ELEMENT_KEYS.map(key => {
        const cap = Math.floor(getSpiritQiCapForRoot(character, key));
        const cur = Math.floor(character.spiritQi[key] ?? 0);
        const toConsume = Math.floor((cur * ratio) / 100);
        const pct = cap > 0 ? Math.min(100, (cur / cap) * 100) : 0;
        return {
          key,
          label: SPIRIT_ROOT_LABELS[key],
          icon: SPIRIT_ROOT_ICONS[key],
          color: SPIRIT_ROOT_COLORS[key],
          cur,
          cap,
          pct,
          canRefine: toConsume > 0,
        };
      }),
    [character, ratio],
  );

  const appendLog = useCallback((entry: Omit<RefineLogEntry, 'id'>) => {
    logSeq.current += 1;
    const id = logSeq.current;
    setLog(prev => [{ ...entry, id }, ...prev].slice(0, 48));
  }, []);

  const handleRefineRow = useCallback(
    (key: SpiritType) => {
      const cur = Math.floor(character.spiritQi[key] ?? 0);
      const toConsume = Math.floor((cur * ratio) / 100);
      if (toConsume <= 0) return;

      const { refined } = onRefine(key, toConsume);
      appendLog({
        spiritLabel: SPIRIT_ROOT_LABELS[key],
        consumed: toConsume,
        progressName: realmProgressName,
        refined,
      });
    },
    [appendLog, character.spiritQi, onRefine, ratio, realmProgressName],
  );

  const buttonStyle = (disabled: boolean): CSSProperties => ({
    flexShrink: 0,
    padding: '6px 11px',
    border: '1px solid rgba(212, 168, 67, 0.38)',
    borderRadius: 6,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(212, 168, 67, 0.1)',
    color: 'var(--gold)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.74rem',
    letterSpacing: '0.06em',
    opacity: disabled ? 0.42 : 1,
    transition: 'border-color 0.15s, background 0.15s',
  });

  const selectStyle: CSSProperties = {
    marginLeft: 'auto',
    padding: '6px 28px 6px 10px',
    borderRadius: 6,
    border: '1px solid rgba(79, 195, 247, 0.35)',
    background: 'rgba(11, 14, 26, 0.95)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `linear-gradient(45deg, transparent 50%, var(--cyan) 50%), linear-gradient(135deg, var(--cyan) 50%, transparent 50%)`,
    backgroundPosition: 'calc(100% - 14px) calc(50% - 3px), calc(100% - 9px) calc(50% - 3px)',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <motion.div
      className="refine-overlay encounter-overlay"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className="refine-card panel-xianxia"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refine-modal-title"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          position: 'relative',
          maxWidth: 440,
          width: '100%',
          padding: '18px 16px 16px',
          borderRadius: 12,
          zIndex: 1,
        }}
        onClick={e => e.stopPropagation()}
      >
        <span className="panel-xianxia-ornament panel-xianjia-tl" aria-hidden />
        <span className="panel-xianxia-ornament panel-xianjia-tr" aria-hidden />
        <span className="panel-xianxia-ornament panel-xianjia-bl" aria-hidden />
        <span className="panel-xianxia-ornament panel-xianjia-br" aria-hidden />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <h2
              id="refine-modal-title"
              className="refine-modal-title"
              style={{
                margin: 0,
                fontSize: '1.05rem',
                color: 'var(--gold)',
                letterSpacing: '0.14em',
                fontWeight: 600,
              }}
            >
              周天 · 提炼
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '0.72rem',
                color: 'var(--muted)',
                lineHeight: 1.45,
                letterSpacing: '0.04em',
              }}
            >
              将储存灵气按灵根契合度转为修为（{realmProgressName}）。
            </p>
          </div>
          <button
            type="button"
            className="refine-close-btn"
            aria-label="关闭"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        <div
          className="refine-ratio-row"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(79, 195, 247, 0.18)',
            background: 'rgba(79, 195, 247, 0.05)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--cyan)', letterSpacing: '0.1em' }}>
            提炼比例
          </span>
          <select
            aria-label="提炼消耗当前储量的比例"
            value={ratio}
            style={selectStyle}
            onChange={e => setRatio(Number(e.target.value) as RefineRatioPct)}
          >
            {RATIO_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}%</option>
            ))}
          </select>
        </div>

        <div className="spirit-qi-rows refine-spirit-rows" style={{ position: 'relative', zIndex: 2 }}>
          {rows.map(r => (
            <div key={r.key} className="spirit-row refine-spirit-row">
              <span className="spirit-name">
                <span className="spirit-icon" aria-hidden>{r.icon}</span>
                {r.label}
              </span>
              <span
                className="bar-track spirit-bar"
                style={{
                  borderColor: `${r.color}44`,
                  background: `linear-gradient(180deg, ${r.color}14 0%, rgba(0,0,0,0.12) 100%)`,
                }}
              >
                <motion.span
                  className="spirit-fill"
                  style={{ background: r.color, '--fill-glow': r.color } as CSSProperties}
                  animate={{ width: `${r.pct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                />
                <span className="spirit-bar-text">{r.cur} / {r.cap}</span>
              </span>
              <motion.button
                type="button"
                className="refine-submit-btn"
                disabled={!r.canRefine}
                style={buttonStyle(!r.canRefine)}
                whileHover={r.canRefine ? { scale: 1.02 } : undefined}
                whileTap={r.canRefine ? { scale: 0.98 } : undefined}
                onClick={() => handleRefineRow(r.key)}
              >
                提炼
              </motion.button>
            </div>
          ))}
        </div>

        <div
          className="refine-log-block"
          style={{
            position: 'relative',
            zIndex: 2,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
            提炼记录（本会话）
          </div>
          {log.length === 0 ? (
            <div style={{ fontSize: '0.74rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              尚无记录。
            </div>
          ) : (
            <ul
              className="refine-log-list"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                maxHeight: 168,
                overflowY: 'auto',
                fontSize: '0.72rem',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <AnimatePresence initial={false}>
                {log.map(entry => (
                  <motion.li
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'var(--text)',
                      lineHeight: 1.45,
                    }}
                  >
                    {entry.spiritLabel}灵气 ×{entry.consumed} → {entry.progressName} +{entry.refined}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}