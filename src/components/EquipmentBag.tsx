import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { QUALITY_COLORS, QUALITY_ORDER } from '../data/equipment';
import { getEnhancedStats, enhanceCost } from '../systems/equipmentSystem';
import type { EquipBase } from '../types';
import type { Character } from '../types/character';
import type { LearnedTechnique } from '../types/technique';
import { instanceIdFromTechniqueInventoryKey } from '../types/technique';

export type EquipmentBagProps = {
  /** When passed with `onEquip` / `onEnhance`, uses these instead of `useGameStore` (multi-account flow). */
  bag?: EquipBase[];
  /** 行囊道具计数（含 📖 秘笈） */
  inventory?: Character['inventory'];
  /** 行囊秘笈实例（与 Character.techniqueStash 对齐） */
  techniqueStash?: Character['techniqueStash'];
  gold?: number;
  onEquip?: (item: EquipBase) => void;
  onEnhance?: (itemId: string) => void;
  onLearnTechnique?: (tech: LearnedTechnique) => void;
};

function BagItem({
  item,
  gold,
  onEquip,
  onEnhance,
}: {
  item: EquipBase;
  gold: number;
  onEquip: (item: EquipBase) => void;
  onEnhance: (itemId: string) => void;
}) {
  const cost = enhanceCost(item);
  const stats = getEnhancedStats(item);

  return (
    <div className="bag-item" style={{ borderLeftColor: QUALITY_COLORS[item.quality] }}>
      <div className="bag-item-name" style={{ color: QUALITY_COLORS[item.quality] }}>
        {item.name} +{item.enhanceLevel}
      </div>
      <div className="bag-item-stats">
        {Object.entries(stats).map(([k, v]) => (
          <span key={k} className="stat-tag">{k.toUpperCase()}+{Math.floor(v as number)}</span>
        ))}
      </div>
      <div className="bag-item-actions">
        <button className="btn-sm" type="button" onClick={() => onEquip(item)}>穿戴</button>
        {gold >= cost && (
          <button className="btn-sm" type="button" onClick={() => onEnhance(item.id)}>强化({cost}灵石)</button>
        )}
      </div>
    </div>
  );
}

function LearnTechniqueModal({
  tech,
  open,
  onClose,
  onConfirm,
}: {
  tech: LearnedTechnique;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="technique-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="technique-modal"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="learn-tech-title"
          >
            <div className="technique-modal-header">
              <div id="learn-tech-title" className="technique-modal-name">研习秘笈</div>
              <div className="technique-modal-sub">{tech.name}</div>
            </div>
            <p style={{ padding: '0 16px 12px', color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
              是否学习此功法？学成后将记入已学功法。
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
              <button type="button" className="technique-modal-close" onClick={onClose}>取消</button>
              <button type="button" className="btn-sm" style={{ background: 'var(--purple, #7b68ee)', color: '#fff' }} onClick={onConfirm}>
                确认学习
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TechniqueScrollRow({
  tech,
  count,
  onLearn,
}: {
  tech: LearnedTechnique;
  count: number;
  onLearn: (t: LearnedTechnique) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="bag-item technique-scroll-item"
        style={{ borderLeftColor: '#9b7ed9', cursor: 'pointer' }}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="bag-item-name" style={{ color: '#c4a9ff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="technique-inv-tag" style={{
            fontSize: '0.62rem',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(155, 126, 217, 0.25)',
            color: '#e8dfff',
            letterSpacing: '0.06em',
          }}>秘笈</span>
          <span>{tech.name}</span>
          {count > 1 ? <span className="muted-label">×{count}</span> : null}
        </div>
        <div className="bag-item-stats">
          <span className="stat-tag">五行属 {tech.element}</span>
          <span className="stat-tag">基础比例 +{(tech.baseRatio * 100).toFixed(1)}%</span>
        </div>
        <div className="bag-item-actions">
          <span className="muted-label" style={{ fontSize: '0.76rem' }}>点击研习</span>
        </div>
      </div>
      <LearnTechniqueModal
        tech={tech}
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          onLearn(tech);
          setOpen(false);
        }}
      />
    </>
  );
}

export default function EquipmentBag({
  bag: bagProp,
  inventory: inventoryProp,
  techniqueStash: stashProp,
  gold: goldProp,
  onEquip: onEquipProp,
  onEnhance: onEnhanceProp,
  onLearnTechnique: onLearnTechniqueProp,
}: EquipmentBagProps) {
  const bagFromStore = useGameStore(s => s.bag);
  const equipFromStore = useGameStore(s => s.equipItem);
  const enhanceFromStore = useGameStore(s => s.enhanceItem);
  const goldFromStore = useGameStore(s => s.character.gold);

  const multiAccountControlled =
    bagProp !== undefined && onEquipProp !== undefined && onEnhanceProp !== undefined;
  const bag = multiAccountControlled ? bagProp : bagFromStore;
  const inventory = inventoryProp ?? (multiAccountControlled ? {} : undefined);
  const techniqueStash = stashProp ?? (multiAccountControlled ? {} : undefined);
  const onEquip = multiAccountControlled ? onEquipProp : equipFromStore;
  const onEnhance = multiAccountControlled ? onEnhanceProp : enhanceFromStore;
  const gold = multiAccountControlled ? (goldProp ?? 0) : goldFromStore;
  const onLearnTechnique = onLearnTechniqueProp;

  const sorted = [...bag].sort((a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality));

  const techniqueEntries =
    inventory && techniqueStash
      ? Object.entries(inventory).filter(([key]) => key.startsWith('📖'))
      : [];

  const totalItems = sorted.length + techniqueEntries.reduce((s, [, n]) => s + (n > 0 ? 1 : 0), 0);

  const learnHandler = onLearnTechnique ?? (() => { /* noop */ });

  return (
    <div className="panel">
      <h2 className="panel-title">· 行囊 ({totalItems}) ·</h2>
      {sorted.length === 0 && techniqueEntries.length === 0 ? (
        <div className="empty-text">背包空空如也</div>
      ) : (
        <div className="bag-list">
          {techniqueEntries.map(([invKey, count]) => {
            const iid = instanceIdFromTechniqueInventoryKey(invKey);
            const tech = iid ? (techniqueStash?.[iid] ?? ({} as LearnedTechnique)) : undefined;
            if (!tech || count <= 0) return null;
            return (
              <TechniqueScrollRow key={invKey} tech={tech} count={count} onLearn={learnHandler} />
            );
          })}
          {sorted.map(item => (
            <BagItem key={item.id} item={item} gold={gold} onEquip={onEquip} onEnhance={onEnhance} />
          ))}
        </div>
      )}
    </div>
  );
}
