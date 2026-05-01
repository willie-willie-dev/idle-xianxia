import { useGameStore } from '../store/gameStore';

export default function SkillPanel() {
  const skills = useGameStore(s => s.skills);

  const active = skills.filter(s => s.type === 'active');
  const passive = skills.filter(s => s.type === 'passive');
  const talents = skills.filter(s => s.type === 'talent');

  return (
    <div className="panel">
      <h2 className="panel-title">· 技能 ·</h2>
      {active.length > 0 && (
        <div className="skill-section">
          <div className="skill-section-title">主动技能</div>
          {active.map(s => (
            <div key={s.id} className="skill-item active-skill">
              <div className="skill-name">{s.name} Lv.{s.level}</div>
              <div className="skill-desc">{s.description}</div>
              <div className="skill-meta">灵力消耗: {s.mpCost} | CD: {s.cooldown}回合</div>
            </div>
          ))}
        </div>
      )}
      {passive.length > 0 && (
        <div className="skill-section">
          <div className="skill-section-title">被动技能</div>
          {passive.map(s => (
            <div key={s.id} className="skill-item passive-skill">
              <div className="skill-name">{s.name} Lv.{s.level}</div>
              <div className="skill-desc">{s.description}</div>
            </div>
          ))}
        </div>
      )}
      {talents.length > 0 && (
        <div className="skill-section">
          <div className="skill-section-title">天赋</div>
          {talents.map(s => (
            <div key={s.id} className="skill-item talent-skill">
              <div className="skill-name">{s.name} Lv.{s.level}</div>
              <div className="skill-desc">{s.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
