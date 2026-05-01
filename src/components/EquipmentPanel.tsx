import { useGameStore } from '../store/gameStore';
import { QUALITY_COLORS } from '../data/equipment';
import type { EquippedSlots, EquipBase } from '../types';

const SLOT_LABELS: Record<keyof EquippedSlots, string> = {
  weapon: '🗡 武器', armor: '🛡 护甲', accessory1: '💍 饰品', accessory2: '💍 饰品', artifact: '✨ 法宝',
};
const SLOTS: (keyof EquippedSlots)[] = ['weapon', 'armor', 'accessory1', 'accessory2', 'artifact'];

function EquipSlot({ slot, item, onUnequip }: { slot: keyof EquippedSlots; item: EquipBase | null; onUnequip: () => void }) {
  return (
    <div className="equip-slot" onClick={onUnequip}>
      <div className="slot-label">{SLOT_LABELS[slot]}</div>
      {item ? (
        <div className="slot-item" style={{ color: QUALITY_COLORS[item.quality] }}>
          {item.name} +{item.enhanceLevel}
        </div>
      ) : (
        <div className="slot-empty">空</div>
      )}
    </div>
  );
}

export default function EquipmentPanel() {
  const equipped = useGameStore(s => s.equipped);
  const unequipSlot = useGameStore(s => s.unequipSlot);

  return (
    <div className="panel">
      <h2 className="panel-title">· 装备栏 ·</h2>
      <div className="equip-slots">
        {SLOTS.map(slot => (
          <EquipSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={() => unequipSlot(slot)} />
        ))}
      </div>
    </div>
  );
}
