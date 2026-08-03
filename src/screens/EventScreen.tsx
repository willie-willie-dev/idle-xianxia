import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccountStore } from '../store/accountStore';
import {
  type EncounterKind,
  rollAbsorbEncounter,
  applySpiritAbsorption,
  grantWonderLoot,
  runRandomBattleQi,
  getSpiritQiCap,
} from '../systems/cultivationSystem';
import {
  ELEMENT_KEYS,
  SPIRIT_ROOT_LABELS,
  SPIRIT_ROOT_ICONS,
  SPIRIT_ROOT_COLORS,
  type SpiritType,
} from '../types/character';
import type { SpiritReward } from '../types/event';
import '../styles/event-screen.css';

interface EventScreenProps {
  encounterKind: EncounterKind;
  onComplete: () => void;
}

/** 某系灵气的完整结算明细 */
interface SpiritLine {
  key: SpiritType;
  /** 基础灵气量（本次提供多少） */
  base: number;
  /** 五行灵根吸收量（仅匹配属性） */
  elementAbsorbed: number;
  /** 乾灵根吸收量（×1.5后） */
  qianAbsorbed: number;
  /** 坤灵根吸收量（×0.1后） */
  kunAbsorbed: number;
  /** 因超上限而散逸的量 */
  overflow: number;
  /** 最终吸收量 */
  absorbed: number;
  /** 吸收后该系灵气总量 */
  after: number;
  /** 该系灵气上限 */
  cap: number;
}

const NARRATIVE: Record<EncounterKind, { title: string; desc: string }> = {
  absorb: {
    title: '吸纳灵气',
    desc: '你寻得一处灵眼之地，灵气充沛。你盘膝而坐，吐纳天地精华，周身隐隐有光华流转...',
  },
  wonder: {
    title: '奇遇探宝',
    desc: '灵草深处似有光芒闪烁，你小心探入，竟有所获。空气中弥漫着淡淡的灵草香气...',
  },
  battle: {
    title: '争斗切磋',
    desc: '前方有修士出没，目光冷冽，似在试探你的深浅。双方灵力涌动，一场交锋在所难免...',
  },
};

type Stage = 'story' | 'result';

/** 构造单系灵气的 SpiritLine */
function buildSpiritLine(
  key: SpiritType,
  base: number,
  charBefore: import('../types/character').Character,
  charAfter: import('../types/character').Character,
  cap: number,
  qianPct: number,
  kunPct: number,
): SpiritLine {
  const elementPct = Math.max(0, Math.min(100, charBefore.spiritRoots[key] ?? 0)) / 100;
  const elementAbsorbed = base * elementPct;
  const qianAbsorbed = base * qianPct * 1.5;
  const kunAbsorbed = base * kunPct * 0.1;
  const totalAbsorbed = elementAbsorbed + qianAbsorbed + kunAbsorbed;
  const afterVal = charAfter.spiritQi[key];
  const room = Math.max(0, cap - charBefore.spiritQi[key]);
  const overflow = Math.max(0, totalAbsorbed - room);

  return {
    key,
    base,
    elementAbsorbed: Math.floor(elementAbsorbed),
    qianAbsorbed: Math.floor(qianAbsorbed),
    kunAbsorbed: Math.floor(kunAbsorbed),
    overflow: Math.floor(overflow),
    absorbed: Math.floor(Math.min(totalAbsorbed, room)),
    after: afterVal,
    cap,
  };
}

export default function EventScreen({ encounterKind, onComplete }: EventScreenProps) {
  const [stage, setStage] = useState<Stage>('story');
  const [spiritLines, setSpiritLines] = useState<SpiritLine[]>([]);
  const [wonderLoot, setWonderLoot] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<string | null>(null);
  const [battleLoss, setBattleLoss] = useState<number>(0);
  const [timeCost, setTimeCost] = useState<number>(0);

  const executeEncounter = useAccountStore(s => s.executeEncounter);

  const handleComplete = useCallback(() => {
    // 直接通过 store navigate，避免 props 引用问题
    useAccountStore.getState().navigateToGame();
  }, []);

  const handleContinue = useCallback(() => {
    executeEncounter(encounterKind);

    const id = useAccountStore.getState().storage.activeAccountId;
    if (!id) return;
    const raw = useAccountStore.getState().storage.gameStates[id];
    if (!raw) return;
    const char = raw.character;

    const qianPct = Math.max(0, Math.min(100, char.spiritRoots['qian'] ?? 0)) / 100;
    const kunPct = Math.max(0, Math.min(100, char.spiritRoots['kun'] ?? 0)) / 100;
    const cap = getSpiritQiCap(char.realm, char.realmStage);

    if (encounterKind === 'absorb') {
      const { element, raw: rawBase } = rollAbsorbEncounter();
      const spiritReward: SpiritReward = { [element]: rawBase };
      const result = applySpiritAbsorption(char, spiritReward);

      const lines: SpiritLine[] = ELEMENT_KEYS.map(k =>
        buildSpiritLine(k, spiritReward[k] ?? 0, char, result.char, cap, qianPct, kunPct),
      );

      setSpiritLines(lines);
      setWonderLoot(null);
      setBattleResult(null);
      setBattleLoss(0);
      setTimeCost(7);
    } else if (encounterKind === 'wonder') {
      const { char: charAfter, drops, spiritReward } = grantWonderLoot(char);

      setWonderLoot(drops.join('、'));
      setBattleResult(null);
      setBattleLoss(0);

      const lines: SpiritLine[] = ELEMENT_KEYS.map(k =>
        buildSpiritLine(k, spiritReward?.[k] ?? 0, char, charAfter, cap, qianPct, kunPct),
      );

      setSpiritLines(lines);
      setTimeCost(10);
    } else if (encounterKind === 'battle') {
      const { victory, foe, lossFrac } = runRandomBattleQi(char);
      if (victory) {
        setBattleResult(`击退 ${foe}（灵机未损）`);
      } else {
        setBattleResult(`败于 ${foe}`);
        setBattleLoss(Math.round(lossFrac * 100));
      }
      setSpiritLines([]);
      setWonderLoot(null);
      setTimeCost(7);
    }

    setStage('result');
  }, [encounterKind, executeEncounter]);

  const { title, desc } = NARRATIVE[encounterKind];

  const totalAbsorbed = spiritLines.reduce((s, l) => s + l.absorbed, 0);
  const totalOverflow = spiritLines.reduce((s, l) => s + l.overflow, 0);
  const totalQian = spiritLines.reduce((s, l) => s + l.qianAbsorbed, 0);
  const totalKun = spiritLines.reduce((s, l) => s + l.kunAbsorbed, 0);

  const hasSpiritData = spiritLines.length > 0;
  const hasActiveSpirit = spiritLines.some(l => l.base > 0);

  return (
    <motion.div
      className="event-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="event-screen-inner">
        <div className="event-screen-panel">
          <div className="event-screen-badge-row">
            <span className="event-screen-badge event-screen-badge--机缘">机缘</span>
          </div>

          {stage === 'story' && (
            <>
              <div className="event-screen-title">{title}</div>
              <div className="event-screen-narrative">{desc}</div>
              <div className="event-screen-divider" />
              <button type="button" className="event-screen-option" onClick={handleContinue}>
                继续
              </button>
            </>
          )}

          {stage === 'result' && (
            <div className="result-card">
              <div className="result-card-body">
              <div className="result-title">✦ 历练结算 ✦</div>

              {wonderLoot && (
                <div className="result-wonder-loot">
                  🎁 获得：{wonderLoot}
                </div>
              )}

              {battleResult && (
                <div
                  className="result-battle-msg"
                  style={{ color: battleLoss > 0 ? 'var(--red)' : 'var(--green)' }}
                >
                  ⚔ {battleResult}
                  {battleLoss > 0 && <span className="result-battle-loss"> · 灵气损耗 {battleLoss}%</span>}
                </div>
              )}

              {/* ── 灵气吸纳明细 ─────────────────────────────── */}
              {hasSpiritData && (
                <>
                  {/* 全局信息栏：乾/坤系数 + 时间消耗 */}
                  <div className="spirit-result-legend">
                    <span className="spirit-legend-item spirit-legend-item--time">
                      ⏱ 消耗 {timeCost} 天
                    </span>
                  </div>

                  {/* 灵气来源（本次提供哪些灵气） */}
                  {hasActiveSpirit && (
                    <div className="spirit-source-row">
                      <span className="spirit-source-label">本次灵气来源：</span>
                      {spiritLines.filter(l => l.base > 0).map(l => (
                        <span
                          key={l.key}
                          className="spirit-source-item"
                          style={{ color: SPIRIT_ROOT_COLORS[l.key] }}
                        >
                          {SPIRIT_ROOT_ICONS[l.key]} {l.base.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 乾/坤吸收明细 */}
                  {(totalQian > 0 || totalKun > 0) && (
                    <div className="spirit-qian-kun-row">
                      {totalQian > 0 && (
                        <span className="spirit-qian-label" style={{ color: SPIRIT_ROOT_COLORS['qian'] }}>
                          ⚪ 乾吸收：+{totalQian.toLocaleString()}（×1.5）
                        </span>
                      )}
                      {totalKun > 0 && (
                        <span className="spirit-kun-label" style={{ color: SPIRIT_ROOT_COLORS['kun'] }}>
                          🖤 坤吸收：+{totalKun.toLocaleString()}（×0.1）
                        </span>
                      )}
                    </div>
                  )}

                  {/* 顶部总计 */}
                  {totalAbsorbed > 0 && (
                    <motion.div
                      className="spirit-result-total"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    >
                      <span className="spirit-result-total-label">本次灵气吸收</span>
                      <span className="spirit-result-total-value">+{totalAbsorbed.toLocaleString()}</span>
                    </motion.div>
                  )}

                  {/* 各系灵气行 */}
                  <div className="spirit-result-rows">
                    {spiritLines.map(line => {
                      const icon = SPIRIT_ROOT_ICONS[line.key];
                      const label = SPIRIT_ROOT_LABELS[line.key];
                      const color = SPIRIT_ROOT_COLORS[line.key];
                      const isActive = line.base > 0;
                      const pct = line.cap > 0 ? Math.min(100, (line.after / line.cap) * 100) : 0;

                      return (
                        <div
                          key={line.key}
                          className={`spirit-result-row ${isActive ? 'active' : ''} ${line.overflow > 0 ? 'overflow' : ''}`}
                        >
                          {/* 主行：图标 + 名称 + 进度条 + 吸收量 */}
                          <div className="spirit-result-main">
                            <span className="spirit-result-icon">{icon}</span>
                            <span className="spirit-result-name" style={{ color }}>
                              {label}
                            </span>
                            <span className="spirit-result-bar-wrap">
                              <span
                                className="spirit-result-bar-fill"
                                style={{
                                  width: `${pct}%`,
                                  background: isActive
                                    ? `linear-gradient(90deg, ${color}88, ${color})`
                                    : 'rgba(255,255,255,0.1)',
                                }}
                              />
                            </span>
                            <span className="spirit-result-absorbed" style={{ color }}>
                              {isActive ? `+${line.absorbed.toLocaleString()}` : '—'}
                            </span>
                          </div>

                          {/* 明细行：基础 / 五行灵根吸收 / 乾增幅 / 坤缩减 / 溢出 */}
                          {isActive && (
                            <div className="spirit-result-detail">
                              <span>基础 {line.base.toLocaleString()}</span>
                              {line.elementAbsorbed > 0 && (
                                <span style={{ color: SPIRIT_ROOT_COLORS[line.key] }}>
                                  {' '}+{label}灵根 → +{line.elementAbsorbed.toLocaleString()}
                                </span>
                              )}
                              {line.qianAbsorbed > 0 && (
                                <span style={{ color: '#b39ddb' }}>
                                  {' '}+乾×1.5 → +{line.qianAbsorbed.toLocaleString()}
                                </span>
                              )}
                              {line.kunAbsorbed > 0 && (
                                <span style={{ color: '#9e9e9e' }}>
                                  {' '}+坤×0.1 → +{line.kunAbsorbed.toLocaleString()}
                                </span>
                              )}
                              {line.overflow > 0 && (
                                <span style={{ color: '#e57373' }}>
                                  → 溢出散逸 −{line.overflow.toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 吸收后容量提示 */}
                          {isActive && line.cap > 0 && (
                            <div className="spirit-result-capacity">
                              {line.after.toLocaleString()} / {line.cap.toLocaleString()}
                              {line.overflow > 0 && (
                                <span style={{ color: '#e57373' }}> · 溢出 −{line.overflow.toLocaleString()}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 汇总行：乾/坤额外吸收 + 溢出总计 */}
                  {(totalQian > 0 || totalKun > 0 || totalOverflow > 0) && (
                    <div className="spirit-result-summary">
                      {totalQian > 0 && <span>乾增幅额外 +{totalQian.toLocaleString()}</span>}
                      {totalKun > 0 && <span>坤权重额外 +{totalKun.toLocaleString()}</span>}
                      {totalOverflow > 0 && <span>溢出散逸 −{totalOverflow.toLocaleString()}</span>}
                    </div>
                  )}
                </>
              )}
              </div>

              <button type="button" className="result-complete-btn" onClick={handleComplete}>
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}