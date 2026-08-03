import { useMemo, useState } from 'react';
import { useAccountStore } from '../store/accountStore';
import type { WuXing } from '../types';
import { SPIRIT_ROOT_KEYS, SPIRIT_ROOT_LABELS } from '../types/character';
import { GENDER_LABELS, type Gender } from '../types/character';
import type { SpiritRootKey } from '../types/character';

/** 灵根对应的视觉颜色（用于显示小色块） */
export const SPIRIT_ROOT_COLORS: Record<SpiritRootKey, string> = {
  qian:   '#E8E8FF', // 白/银白
  kun:    '#2C2C2C', // 黑/墨黑
  fire:   '#E57373', // 赤红
  water:  '#4FC3F7', // 碧蓝
  wood:   '#81C784', // 青绿
  metal:  '#FFD700', // 金/银
  earth:  '#D4A843', // 土黄
};

const SURNAMES = [
  '云', '风', '凌', '天', '玄', '紫', '玉', '清', '仙', '尘',
  '雪', '星', '月', '墨', '白', '青', '寒', '霜', '灵', '梦',
  '秋', '雨', '烟', '霞', '岚', '萧', '叶', '林', '江', '河',
  '沐', '涟', '澜', '渊', '泽', '浩', '涵', '淳', '修', '然',
  '子', '逸', '问', '无', '空', '寂',
];

const GIVEN_NAMES = [
  '一尘', '一凡', '天明', '凌云', '清风', '子墨', '星澜', '月华',
  '紫霄', '玄清', '玉璇', '冰心', '雪晴', '寒烟', '秋水', '春烟',
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateXianxiaName(): string {
  return getRandomElement(SURNAMES) + getRandomElement(GIVEN_NAMES);
}

/**
 * 7种灵根全部可手动分配。
 * 坤 = 传入的 kunValue，不再自动计算。
 * 其他六项强制 5% 颗粒度，超100自动压缩。
 */
export function mergeSpiritRootPercents(
  input: Partial<Record<SpiritRootKey, number>>,
  kunValue: number,
): Record<SpiritRootKey, number> {
  const out = {} as Record<SpiritRootKey, number>;

  const CONFIGURABLE = SPIRIT_ROOT_KEYS.filter(k => k !== 'kun');

  // 处理其他六项（强制 5% 颗粒度）
  let sum = 0;
  for (const k of CONFIGURABLE) {
    const raw = input[k] ?? 0;
    const v = Math.round(raw / 5) * 5;
    out[k] = Math.max(0, Math.min(100, v));
    sum += out[k];
  }

  if (sum > 100) {
    const totalSum = sum;
    for (const k of CONFIGURABLE) {
      out[k] = Math.round((out[k] / totalSum) * 100);
    }
    sum = 0;
    for (const k of CONFIGURABLE) {
      sum += out[k];
    }
  }

  // 坤直接使用传入值
  out['kun'] = Math.max(0, Math.min(100, Math.round(kunValue / 5) * 5));

  return out;
}

function randomRootsFull(): Record<SpiritRootKey, number> {
  const rnd = {} as Partial<Record<SpiritRootKey, number>>;
  const unitTotal = 20; // 100% / 5%
  let remainder = unitTotal;
  const configurable = SPIRIT_ROOT_KEYS.filter(k => k !== 'kun');
  configurable.forEach((k, idx) => {
    if (idx === configurable.length - 1) {
      rnd[k] = remainder * 5;
    } else {
      const u = Math.floor(Math.random() * (remainder + 1));
      rnd[k] = u * 5;
      remainder -= u;
    }
  });
  // 坤 = 100 - sum(其他六项)，确保总和=100%
  const sum = configurable.reduce((s, k) => s + (rnd[k] ?? 0), 0);
  rnd['kun'] = Math.max(0, 100 - sum);
  return mergeSpiritRootPercents(rnd, rnd['kun'] ?? 0);
}

function initialFromFull(full: Record<SpiritRootKey, number>): Partial<Record<SpiritRootKey, number>> {
  const o: Partial<Record<SpiritRootKey, number>> = {};
  for (const k of SPIRIT_ROOT_KEYS) o[k] = full[k];
  return o;
}

/**
 * 从 clicked 之后顺时针找第一个还有 ≥5% 的灵根作为扣减来源。
 * 所有7个灵根都可能成为 donor（包括坤）。
 */
function findCircularDeductDonor(
  clicked: SpiritRootKey,
  percents: Record<SpiritRootKey, number>,
): SpiritRootKey | null {
  const clickedIdx = SPIRIT_ROOT_KEYS.indexOf(clicked);
  if (clickedIdx < 0) return null;

  for (let step = 1; step <= SPIRIT_ROOT_KEYS.length; step++) {
    const k = SPIRIT_ROOT_KEYS[(clickedIdx + step) % SPIRIT_ROOT_KEYS.length];
    if (k === clicked) continue;
    if ((percents[k] ?? 0) >= 5) return k;
  }

  return null;
}

function isValidName(name: string): string | null {
  if (!name || !name.trim()) return '请输入角色名';
  const trimmed = name.trim();
  if (trimmed.length < 2) return '角色名至少2个字符';
  if (trimmed.length > 8) return '角色名最多8个字符';
  if (!/^[\u4e00-\u9fa5]+$/.test(trimmed)) return '角色名必须为中文';
  return null;
}

export default function CharacterCreate() {
  const { createAccount, isNameTaken, navigateTo, getActiveGameState } = useAccountStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // 初始：乾=100%，其他=0%
  const [rootsInput, setRootsInput] = useState<Partial<Record<SpiritRootKey, number>>>(() => ({ qian: 100 }));
  const [gender, setGender] = useState<Gender>('male');

  // rootsInput 中的 kun 直接存储坤的百分比（不是自动计算的）
  const merged = useMemo(
    () => mergeSpiritRootPercents(rootsInput, rootsInput['kun'] ?? 0),
    [rootsInput],
  );

  // 点击某个灵根 +5%，从"顺时针第一个还有≥5%的灵根"扣除5%
  const handleRootClick = (key: SpiritRootKey) => {
    setRootsInput(prev => {
      const percents = mergeSpiritRootPercents(prev, prev['kun'] ?? 0);
      const currentVal = percents[key];
      if (currentVal >= 100) return prev; // 已达上限

      const deductKey = findCircularDeductDonor(key, percents);
      if (!deductKey) return prev; // 没有可扣除的
      const donorBase = percents[deductKey];
      if (donorBase < 5) return prev;

      const next = { ...prev };
      next[key] = currentVal + 5;
      next[deductKey] = donorBase - 5;
      return next;
    });
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    const nameError = isValidName(trimmed);
    if (nameError) { setError(nameError); return; }
    if (isNameTaken(trimmed)) { setError('角色名已被占用'); return; }

    // 提交前确保总和=100%（修正取整误差）
    const syncedMerged = mergeSpiritRootPercents(rootsInput, rootsInput['kun'] ?? 0);
    const defaultElement: WuXing = 'metal';
    const result = createAccount(trimmed, defaultElement, {
      realm: '炼气',
      realmStage: 'early',
      spiritRoots: syncedMerged,
      gender,
    });
    if (!result.ok) { setError(result.error ?? '创建失败'); return; }

    // 验证存档
    const gs = getActiveGameState();
    const stored = gs?.character.spiritRoots;
    if (!stored) {
      console.warn('CharacterCreate: spiritRoots missing on new account');
    } else {
      const storedTotal = SPIRIT_ROOT_KEYS.reduce((s, k) => s + (stored[k] ?? 0), 0);
      if (storedTotal !== 100) {
        console.error('CharacterCreate: spiritRoots total !== 100', storedTotal, stored);
      }
      for (const k of SPIRIT_ROOT_KEYS) {
        if ((stored[k] ?? 0) !== syncedMerged[k]) {
          console.error('CharacterCreate: spiritRoots mismatch for', k, 'expected', syncedMerged[k], 'got', stored[k]);
        }
      }
    }
  };

  const total = SPIRIT_ROOT_KEYS.reduce((sum, k) => sum + merged[k], 0);

  return (
    <div className="create-screen">
      <div className="create-header">
        <button type="button" className="back-btn" onClick={() => navigateTo('entry')}>← 返回</button>
        <div className="create-title">创建角色</div>
      </div>

      <div className="create-form">
        <div className="form-group">
          <label className="form-label">角色名称</label>
          <div className="name-input-row">
            <input
              className="form-input"
              type="text"
              placeholder="请输入 2-8 个中文字符"
              value={name}
              maxLength={8}
              onChange={e => { setName(e.target.value); setError(null); }}
            />
            <button type="button" className="btn-random-name" onClick={() => setName(generateXianxiaName())}>🎲 随机</button>
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">灵根（点击分配 +5%）</label>
          <div className="spirit-root-buttons" role="group" aria-label="灵根配比">
            {SPIRIT_ROOT_KEYS.map(key => {
              const pct = merged[key];
              return (
                <button
                  key={key}
                  type="button"
                  className="spirit-root-btn"
                  onClick={() => handleRootClick(key)}
                  title={`${SPIRIT_ROOT_LABELS[key]} +5%`}
                >
                  {`${SPIRIT_ROOT_LABELS[key]} ${pct}%`}
                </button>
              );
            })}
          </div>
          <div className="spirit-root-hint">总和：{total}%</div>
          <button
            type="button"
            className="btn-random-spirit"
            onClick={() => setRootsInput(initialFromFull(randomRootsFull()))}
          >
            🔀 随机分配灵根
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">性别</label>
          <div className="gender-selector">
            {(['male', 'female'] as Gender[]).map(g => (
              <button
                key={g}
                type="button"
                className={`gender-btn ${gender === g ? 'selected' : ''}`}
                onClick={() => setGender(g)}
              >
                {g === 'male' ? '♂' : '♀'} {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn-create" onClick={handleSubmit}>踏入仙途</button>
      </div>
    </div>
  );
}