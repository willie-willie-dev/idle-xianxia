import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ELEMENT_KEYS, SPIRIT_ROOT_LABELS } from '../types/character';
import { absorbSpiritReward } from '../systems/spiritAbsorption';
import type { SpiritReward } from '../types/event';

export default function EventModal() {
  const currentEvent = useGameStore(s => s.currentEvent);
  const dismissEvent = useGameStore(s => s.dismissEvent);
  const char = useGameStore(s => s.character);

  const [result, setResult] = useState<{
    text: string;
    spiritReward?: SpiritReward;
    timeCost: number;
  } | null>(null);

  if (!currentEvent) return null;

  if (result) {
    const { text, spiritReward, timeCost } = result;
    const spiritAbsorptionLines: string[] = [];

    if (spiritReward) {
      const absorbResult = absorbSpiritReward(spiritReward, char);
      const absorbed = absorbResult.absorbed;
      const qian = char.spiritRoots['qian'] ?? 0;
      const kun = char.spiritRoots['kun'] ?? 0;

      for (const k of ELEMENT_KEYS) {
        const raw = spiritReward[k] ?? 0;
        const stored = Math.floor(absorbed[k] ?? 0);
        const wasted = raw - Math.floor(raw * (1 - kun / 100) * (1 + qian / 100));

        if (raw > 0) {
          spiritAbsorptionLines.push(
            `  ${SPIRIT_ROOT_LABELS[k]}：+${stored} (原本${raw}，乾+${qian}%，坤-${kun}%，散逸${Math.max(0, wasted)})`
          );
        }
      }

      if (spiritAbsorptionLines.length === 0 && (spiritReward.fire ?? 0) === 0) {
        spiritAbsorptionLines.push('  无五行灵气');
      }
    }

    return (
      <div className="event-overlay">
        <div className="event-card" onClick={e => e.stopPropagation()}>
          <div className="event-result">
            <h2 className="event-title">结算</h2>
            <p className="event-result-text">📜 {text}</p>

            {spiritAbsorptionLines.length > 0 && (
              <div className="event-spirit-detail">
                <h3>灵气吸收：</h3>
                {spiritAbsorptionLines.map((line, i) => (
                  <div key={i} className="spirit-detail-line">{line}</div>
                ))}
              </div>
            )}

            <div className="event-time-cost">
              ⏱ 消耗 {timeCost} 天
            </div>

            <button
              type="button"
              className="event-option-btn"
              onClick={() => { setResult(null); dismissEvent(); }}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-overlay" onClick={dismissEvent}>
      <div className="event-card" onClick={e => e.stopPropagation()}>
        <div className="event-type-badge">{currentEvent.type}</div>
        <h2 className="event-title">{currentEvent.title}</h2>
        <p className="event-desc">{currentEvent.description}</p>
        <div className="event-options">
          {currentEvent.options.map((opt, i) => (
            <button
              key={i}
              className="event-option-btn"
              onClick={() => {
                setResult({
                  text: opt.resultText,
                  spiritReward: opt.reward.spiritReward,
                  timeCost: opt.timeCost ?? 1,
                });
                dismissEvent();
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}