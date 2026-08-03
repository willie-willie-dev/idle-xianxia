import { useState } from 'react';
import CharacterPanel from '../components/CharacterPanel';
import TechniquePanel from '../components/TechniquePanel';
import EquipmentBag from '../components/EquipmentBag';
import { useAccountStore } from '../store/accountStore';

type CharacterTabId = 'person' | 'techniques';

export default function CharacterScreen() {
  const account = useAccountStore(s => s);
  const activeGs = account.getActiveGameState();
  const [activeTab, setActiveTab] = useState<CharacterTabId>(
    account.characterSubTab === 'techniques' ? 'techniques' : 'person'
  );

  // Guard: only render when we have an active game state
  if (!activeGs) return null;

  const stats = account.getFinalStats();
  const navigateToGame = () => account.navigateToGame();
  const char = activeGs.character;

  return (
    <div className="screen-root">
      <div className="page-header">
        <button type="button" onClick={navigateToGame} className="btn-back">← 返回</button>
        <h2>人物详情</h2>
      </div>

      <div
        role="tablist"
        aria-label="人物详情分区"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {([
          { id: 'person' as const, label: '人物' },
          { id: 'techniques' as const, label: '功法' },
        ]).map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={`character-screen-tab-${t.id}`}
            id={`character-screen-tab-trigger-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              margin: 0,
              borderRadius: 6,
              border: `1px solid ${activeTab === t.id ? 'rgba(212, 168, 67, 0.55)' : 'rgba(255, 255, 255, 0.08)'}`,
              background: activeTab === t.id ? 'rgba(212, 168, 67, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === t.id ? 'var(--gold)' : 'var(--muted)',
              fontFamily: 'inherit',
              fontSize: '0.88rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              boxShadow: activeTab === t.id ? '0 0 14px rgba(212, 168, 67, 0.18)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="character-screen-tab-person"
        aria-labelledby="character-screen-tab-trigger-person"
        hidden={activeTab !== 'person'}
      >
        {activeTab === 'person' && (
          <CharacterPanel character={char} stats={stats} />
        )}
      </div>

      <div
        role="tabpanel"
        id="character-screen-tab-techniques"
        aria-labelledby="character-screen-tab-trigger-techniques"
        hidden={activeTab !== 'techniques'}
      >
        {activeTab === 'techniques' && (
          <div className="game-tab-pane game-accordion-panel">
            <TechniquePanel
              slots={char.techniqueSlots}
              spiritQi={char.spiritQi as Record<string, number>}
              knownTechniques={char.knownTechniques}
            />
          </div>
        )}
      </div>

      <EquipmentBag
        bag={activeGs.bag}
        gold={activeGs.character.gold}
        onEquip={account.equipItem}
        onEnhance={account.enhanceItem}
      />
    </div>
  );
}
