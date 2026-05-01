import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { expToNextLevel } from '../systems/characterSystem';

const WUXING_LABELS: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};

export default function CharacterPanel() {
  const char = useGameStore(s => s.character);
  const getFinalStats = useGameStore(s => s.getFinalStats);
  const stats = getFinalStats();
  const expNeeded = expToNextLevel(char.level);
  const expPct = (char.exp / expNeeded) * 100;
  const hpPct = (stats.hp > 0) ? Math.min(100, (stats.hp / stats.hp) * 100) : 0;

  return (
    <div className="panel">
      <h2 className="panel-title">· {char.name} ·</h2>
      <div className="realm-badge">{char.realm}境 · {char.level}层 · {WUXING_LABELS[char.element] ?? char.element}属性</div>
      <div className="attr-grid">
        <span>气血</span>
        <span className="val">
          <span className="bar-track"><motion.span className="bar-fill hp" animate={{ width: `${hpPct}%` }} />{Math.floor(stats.hp)}/{Math.floor(stats.hp)}</span>
        </span>
        <span>灵力</span><span className="val">{Math.floor(stats.mp)}</span>
        <span>修为</span>
        <span className="val">
          <span className="bar-track"><motion.span className="bar-fill exp" animate={{ width: `${expPct}%` }} />{char.exp}/{expNeeded}</span>
        </span>
        <span>攻击</span><span className="val atk-val">{Math.floor(stats.atk)}</span>
        <span>防御</span><span className="val def-val">{Math.floor(stats.def)}</span>
        <span>速度</span><span className="val">{Math.floor(stats.spd)}</span>
        <span>神识</span><span className="val">{Math.floor(stats.wil)}</span>
        <span>灵石</span><span className="val gold">{char.gold}</span>
      </div>
    </div>
  );
}
