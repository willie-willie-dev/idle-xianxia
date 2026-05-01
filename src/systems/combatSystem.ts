import type { Stats, BattleResult, Monster } from '../types';
import { rollDrop } from './equipmentSystem';

export function simulateBattle(playerStats: Stats, _playerElement: import('../types').WuXing, _playerLevel: number, monster: Monster): BattleResult {
  let pHp = playerStats.hp;
  const pMp = playerStats.mp;
  let mHp = monster.stats.hp;
  const log: string[] = [];
  let turns = 0;
  const maxTurns = 30;

  while (pHp > 0 && mHp > 0 && turns < maxTurns) {
    turns++;
    // Player attacks (physical: ATK vs DEF)
    let pDmg = Math.max(1, playerStats.atk - monster.stats.def * 0.5) * (0.9 + Math.random() * 0.2);
    pDmg = Math.floor(pDmg);
    mHp -= pDmg;
    log.push(`你造成 ${pDmg} 伤害`);
    if (mHp <= 0) break;

    // Monster attacks
    let mDmg = Math.max(1, monster.stats.atk - playerStats.def * 0.5) * (0.9 + Math.random() * 0.2);
    mDmg = Math.floor(mDmg);
    pHp -= mDmg;
    log.push(`${monster.name}造成 ${mDmg} 伤害`);

    void pMp;
  }

  const victory = mHp <= 0;
  const drops: BattleResult['drops'] = [];
  if (victory && Math.random() < 0.35) {
    const drop = rollDrop(monster.level);
    if (drop) drops.push(drop);
  }

  return {
    victory,
    turnsUsed: turns,
    expGained: victory ? monster.expReward : Math.floor(monster.expReward / 3),
    goldGained: victory ? monster.goldReward : 0,
    drops,
    log,
    hpLeft: Math.max(0, Math.floor(pHp)),
  };
}
