import { useState } from 'react';
import { useAccountStore } from '../store/accountStore';
import type { Account } from '../types/account';

const ATTR_CONFIG: Record<string, { label: string; color: string; icon: string; bonus: string }> = {
  metal: { label: '金', color: '#d4a843', icon: '⚔', bonus: '攻击+10 防御-5' },
  wood:  { label: '木', color: '#81c784', icon: '🌿', bonus: '气血+20 攻击-3' },
  water: { label: '水', color: '#4fc3f7', icon: '💧', bonus: '灵力+15 速度+5' },
  fire:  { label: '火', color: '#e57373', icon: '🔥', bonus: '攻击+8 灵力-5' },
  earth: { label: '土', color: '#ce93d8', icon: '🪨', bonus: '防御+12 气血+10' },
};

const ELEMENT_ICONS: Record<string, string> = {
  metal: '⚔', wood: '🌿', water: '💧', fire: '🔥', earth: '🪨',
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function CharacterCard({ account, onPlay, onDelete }: { account: Account; onPlay: () => void; onDelete: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => onPlay();

  return (
    <div
      className="char-card"
      onClick={handleClick}
      style={{ '--attr-color': ATTR_CONFIG[account.attribute]?.color ?? '#d4a843' } as React.CSSProperties}
    >
      <button
        className="btn-delete-char"
        onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
        title="删除角色"
      >🗑️</button>
      <div className="char-avatar">{ELEMENT_ICONS[account.attribute] ?? '❓'}</div>
      <div className="char-name">{account.name}</div>
      <div className="char-realm">炼气境 1 层</div>
      <div className="char-attr">
        <span style={{ color: ATTR_CONFIG[account.attribute]?.color }}>{ATTR_CONFIG[account.attribute]?.label}</span>
        {' 属性'}
      </div>
      <div className="char-date">{formatDate(account.createdAt)}</div>

      {showConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="delete-confirm" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-title">确认删除</div>
            <div className="delete-confirm-msg">确定要删除角色「{account.name}」吗？<br/>所有数据将无法恢复。</div>
            <div className="delete-confirm-btns">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="btn-confirm-del" onClick={() => { onDelete(); setShowConfirm(false); }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCharCard({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className={`new-char-card ${disabled ? 'disabled' : ''}`} onClick={disabled ? undefined : onClick}>
      <div className="new-char-icon">+</div>
      <div className="new-char-label">创建角色</div>
      <div className="new-char-hint">最多 3 个角色</div>
    </div>
  );
}

export default function EntryScreen() {
  const { storage, loginAccount, deleteAccount, navigateTo } = useAccountStore();

  return (
    <div className="entry-screen">
      <div className="entry-header">
        <div className="entry-title">仙途漫漫</div>
        <div className="entry-subtitle">角色选择</div>
      </div>

      <div className="char-list">
        {storage.accounts.map(acc => (
          <CharacterCard
            key={acc.id}
            account={acc}
            onPlay={() => { loginAccount(acc.id); navigateTo('game'); }}
            onDelete={() => deleteAccount(acc.id)}
          />
        ))}
        {storage.accounts.length < 3 && (
          <NewCharCard onClick={() => navigateTo('create')} disabled={storage.accounts.length >= 3} />
        )}
      </div>

      <div className="entry-footer">
        <div className="entry-hint-text">点击角色开始游戏 · 🗑️ 删除角色</div>
      </div>
    </div>
  );
}