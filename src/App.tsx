import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { IDLE_TICK_MS } from './data/monsters';
import CharacterPanel from './components/CharacterPanel';
import BattleLog from './components/BattleLog';
import EquipmentPanel from './components/EquipmentPanel';
import EquipmentBag from './components/EquipmentBag';
import SkillPanel from './components/SkillPanel';
import EventModal from './components/EventModal';
import { canBreakthrough } from './systems/characterSystem';

type Tab = 'stats' | 'equip' | 'skills' | 'bag';

export default function App() {
  const { isIdling, startIdle, stopIdle, tickIdle, doBattle, character, tryBreakthrough } = useGameStore();
  const [tab, setTab] = useState<Tab>('stats');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isIdling) {
      timerRef.current = setInterval(tickIdle, IDLE_TICK_MS);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isIdling, tickIdle]);

  const canBreak = canBreakthrough(character);

  return (
    <div className="app">
      <header className="app-header">
        <h1>仙途漫漫</h1>
        <p className="subtitle">挂机修仙 · idle xianxia</p>
      </header>

      <CharacterPanel />

      <div className="actions">
        <button className={`btn ${isIdling ? 'active' : ''}`} onClick={isIdling ? stopIdle : startIdle}>
          {isIdling ? '⏸ 停止修炼' : '🧘 开始修炼'}
        </button>
        <button className="btn btn-battle" onClick={doBattle} disabled={isIdling}>
          ⚔ 历练
        </button>
        {canBreak && (
          <button className="btn btn-breakthrough" onClick={tryBreakthrough}>
            🌟 突破境界
          </button>
        )}
      </div>

      <BattleLog />

      <div className="tab-bar">
        {(['stats', 'equip', 'skills', 'bag'] as Tab[]).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ stats: '属性', equip: '装备', skills: '技能', bag: '背包' }[t]}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'stats' && <CharacterPanel />}
        {tab === 'equip' && <EquipmentPanel />}
        {tab === 'skills' && <SkillPanel />}
        {tab === 'bag' && <EquipmentBag />}
      </div>

      <EventModal />
    </div>
  );
}
