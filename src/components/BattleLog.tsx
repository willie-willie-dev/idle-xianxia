import { useGameStore } from '../store/gameStore';

export default function BattleLog() {
  const logs = useGameStore(s => s.logs);

  return (
    <div className="panel log-panel">
      <h2 className="panel-title">· 战斗记录 ·</h2>
      <div className="log-scroll">
        {logs.slice(-30).map(l => (
          <div key={l.id} className={`log-entry ${l.type}`}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}
