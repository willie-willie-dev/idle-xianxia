import { useGameStore } from '../store/gameStore';
import { QUALITY_COLORS, QUALITY_ORDER } from '../data/equipment';
import { getEnhancedStats, enhanceCost } from '../systems/equipmentSystem';
import type { EquipBase } from '../types';

function BagItem({ item }: { item: EquipBase }) {
  const equipItem = useGameStore(s => s.equipItem);
  const enhanceItem = useGameStore(s => s.enhanceItem);
  const gold = useGameStore(s => s.character.gold);
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
        <button className="btn-sm" onClick={() => equipItem(item)}>穿戴</button>
        {gold >= cost && <button className="btn-sm" onClick={() => enhanceItem(item.id)}>强化({cost}灵石)</button>}
      </div>
    </div>
  );
}

export default function EquipmentBag() {
  const bag = useGameStore(s => s.bag);
  const sorted = [...bag].sort((a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality));

  return (
    <div className="panel">
      <h2 className="panel-title">· 背包 ({bag.length}) ·</h2>
      {sorted.length === 0 ? (
        <div className="empty-text">背包空空如也</div>
      ) : (
        <div className="bag-list">
          {sorted.map(item => <BagItem key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
