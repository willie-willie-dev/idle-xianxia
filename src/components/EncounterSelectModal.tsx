import type { EncounterOption } from '../data/encounters';

interface Props {
  options: EncounterOption[];
  onSelect: (opt: EncounterOption) => void;
  onClose: () => void;
}

export default function EncounterSelectModal({ options, onSelect, onClose }: Props) {
  return (
    <div className="encounter-overlay" onClick={onClose}>
      <div className="encounter-card" onClick={e => e.stopPropagation()}>
        <div className="encounter-title">选择历练方式</div>
        <div className="encounter-grid">
          {options.map((opt, i) => (
            <button
              key={i}
              className="encounter-option-btn"
              onClick={() => onSelect(opt)}
            >
              <span className="encounter-icon">{opt.icon}</span>
              <span className="encounter-name">{opt.name}</span>
              <span className="encounter-desc">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
