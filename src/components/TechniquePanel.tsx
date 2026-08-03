import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TECHNIQUE_POSITIONS, type TechniquePosition } from '../types/character';
import { ZHOU_TIAN_TECHNIQUE, type ZhouTianTechnique } from '../data/techniques';
import type { LearnedTechnique } from '../types/technique';
import { SPIRIT_ROOT_LABELS, SPIRIT_ROOT_ICONS, SPIRIT_ROOT_COLORS } from '../types/character';
import '../styles/technique-panel.css';

interface Props {
  /** 功法槽位数据 */
  slots: Record<TechniquePosition, string | null>;
  /** 当前灵气数据（用于判断固定开销是否满足） */
  spiritQi: Record<string, number>;
  /** 已学会的功法列表（来自 Character.knownTechniques） */
  knownTechniques: LearnedTechnique[];
}

/** 方位 → 显示名称 + 五行 + 是否预留 */
const POSITION_META: Record<TechniquePosition, { label: string; sub: string; element: string; reserved: boolean }> = {
  jiao:   { label: '角亢', sub: '东', element: '木', reserved: true },
  jing:   { label: '井鬼', sub: '南', element: '火', reserved: true },
  ziwei:  { label: '紫薇', sub: '中', element: '土', reserved: false },
  kui:    { label: '奎娄', sub: '西', element: '金', reserved: true },
  dou:    { label: '斗牛', sub: '北', element: '水', reserved: true },
};

function getTechniqueById(id: string | null): ZhouTianTechnique | null {
  if (!id) return null;
  if (id === ZHOU_TIAN_TECHNIQUE.id) return ZHOU_TIAN_TECHNIQUE;
  return null;
}

export default function TechniquePanel({ slots, spiritQi, knownTechniques }: Props) {
  const [modalTech, setModalTech] = useState<ZhouTianTechnique | null>(null);

  const hasAnyTechnique = Object.values(slots).some(v => v !== null);

  const equippedIds = new Set(Object.values(slots).filter(Boolean) as string[]);
  const unslottedKnown = knownTechniques.filter(t => !equippedIds.has(t.instanceId));

  return (
    <div className="technique-panel">
      <div className="technique-panel-title">功法栏</div>

      <div className="technique-slots">
        {TECHNIQUE_POSITIONS.map(pos => {
          const meta = POSITION_META[pos];
          const techId = slots[pos];
          const tech = getTechniqueById(techId);
          const isEmpty = techId === null;

          return (
            <div
              key={pos}
              className={`technique-slot ${tech ? 'filled' : isEmpty ? 'empty' : ''} ${meta.reserved ? 'reserved' : ''} ${tech ? 'clickable' : ''}`}
              onClick={() => {
                if (!meta.reserved && tech) setModalTech(tech);
              }}
              role={tech && !meta.reserved ? 'button' : undefined}
              tabIndex={tech && !meta.reserved ? 0 : undefined}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (tech) setModalTech(tech); } }}
            >
              <div className="technique-slot-header">
                <span className="technique-slot-name">{meta.label}</span>
                <span className="technique-slot-sub">{meta.sub}</span>
              </div>
              <div className="technique-slot-element">
                <span className="technique-element-icon" aria-hidden>
                  {meta.element === '木' ? '🌿' : meta.element === '火' ? '🔥' : meta.element === '金' ? '⚔' : meta.element === '水' ? '💧' : '🪨'}
                </span>
                <span className="technique-element-label">{meta.element}</span>
              </div>
              {tech ? (
                <div className="technique-slot-tech">
                  <span className="technique-name-tag">{tech.name}</span>
                </div>
              ) : (
                <div className="technique-slot-empty">
                  <span className="technique-reserved-label">{meta.reserved ? '预留' : '空'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 已掌握功法列表 */}
      {hasAnyTechnique && (
        <div className="technique-known-section">
          <div className="technique-known-title">── 已掌握功法 ──</div>
          {TECHNIQUE_POSITIONS.map(pos => {
            const techId = slots[pos];
            const tech = getTechniqueById(techId);
            if (!tech) return null;
            return (
              <div
                key={pos}
                className="technique-known-item"
                onClick={() => setModalTech(tech)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalTech(tech); } }}
              >
                <span className="technique-known-icon">{SPIRIT_ROOT_ICONS[tech.element]}</span>
                <span className="technique-known-name">{tech.name}</span>
                <span className="technique-known-pos">[{POSITION_META[pos].label}]</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 未装备的已学功法（奇遇掉落等） */}
      {unslottedKnown.length > 0 && (
        <div className="technique-known-section">
          <div className="technique-known-title">── 已习功法 ──</div>
          {unslottedKnown.map(tech => (
            <div key={tech.instanceId} className="technique-known-item">
              <span className="technique-known-icon">{SPIRIT_ROOT_ICONS[tech.element]}</span>
              <span className="technique-known-name">{tech.name}</span>
              <span className="technique-known-pos">[{tech.element}]</span>
            </div>
          ))}
        </div>
      )}

      {/* 功法详情弹窗 */}
      <AnimatePresence>
        {modalTech && (
          <TechniqueDetailModal
            tech={modalTech}
            spiritQi={spiritQi}
            onClose={() => setModalTech(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Detail Modal ────────────────────────────────────────────── */

interface DetailModalProps {
  tech: ZhouTianTechnique;
  spiritQi: Record<string, number>;
  onClose: () => void;
}

function TechniqueDetailModal({ tech, spiritQi, onClose }: DetailModalProps) {
  const canActivate = (spiritQi[tech.costSpiritType] ?? 0) >= tech.costSpiritValue;
  const costSpiritColor = SPIRIT_ROOT_COLORS[tech.costSpiritType] ?? '#fff';

  return (
    <motion.div
      className="technique-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="technique-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="technique-modal-header">
          <div className="technique-modal-name">{tech.name}</div>
          <div className="technique-modal-sub">
            {POSITION_META[tech.position]?.label ?? tech.position}位 ·{' '}
            {SPIRIT_ROOT_LABELS[tech.element]}行
          </div>
        </div>

        <div className="technique-modal-body">
          <div className="technique-modal-ratio-row">
            <div className="technique-modal-stat">
              <span className="technique-modal-stat-label">基础比例</span>
              <span className="technique-modal-stat-value">+{(tech.baseRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="technique-modal-stat">
              <span className="technique-modal-stat-label">Bonus比例</span>
              <span className="technique-modal-stat-value">+{(tech.bonusRatio * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="technique-modal-ratio-row">
            <div className="technique-modal-stat">
              <span className="technique-modal-stat-label">基础固定值</span>
              <span className="technique-modal-stat-value">+{tech.baseFixed}</span>
            </div>
            <div className="technique-modal-stat">
              <span className="technique-modal-stat-label">Bonus固定值</span>
              <span className="technique-modal-stat-value">+{tech.bonusFixed}</span>
            </div>
          </div>

          <div className="technique-modal-divider" />

          <div className="technique-modal-cost">
            <div className="technique-modal-cost-label">固定开销（每次激活）</div>
            <div className="technique-modal-cost-row">
              <span className="technique-cost-icon" aria-hidden>
                {SPIRIT_ROOT_ICONS[tech.costSpiritType]}
              </span>
              <span className="technique-cost-element" style={{ color: costSpiritColor }}>
                {SPIRIT_ROOT_LABELS[tech.costSpiritType]}
              </span>
              <span className="technique-cost-value" style={{ color: costSpiritColor }}>
                {tech.costSpiritValue}点/次
              </span>
            </div>
            <div className={`technique-cost-status ${canActivate ? 'ok' : 'warn'}`}>
              {canActivate
                ? `当前可用（${spiritQi[tech.costSpiritType] ?? 0}点充足）`
                : `灵气不足（需${tech.costSpiritValue}点，当前${spiritQi[tech.costSpiritType] ?? 0}点）`}
            </div>
          </div>

          <div className="technique-modal-backlash">
            <div className="technique-modal-backlash-label">反噬效果</div>
            <div className="technique-modal-backlash-val">【预留】</div>
          </div>
        </div>

        <button type="button" className="technique-modal-close" onClick={onClose}>
          关闭
        </button>
      </motion.div>
    </motion.div>
  );
}