import { useGameStore } from '../store/gameStore';

export default function EventModal() {
  const currentEvent = useGameStore(s => s.currentEvent);
  const resolveEvent = useGameStore(s => s.resolveEvent);
  const dismissEvent = useGameStore(s => s.dismissEvent);

  if (!currentEvent) return null;

  return (
    <div className="event-overlay" onClick={dismissEvent}>
      <div className="event-card" onClick={e => e.stopPropagation()}>
        <div className="event-type-badge">{currentEvent.type}</div>
        <h2 className="event-title">{currentEvent.title}</h2>
        <p className="event-desc">{currentEvent.description}</p>
        <div className="event-options">
          {currentEvent.options.map((opt, i) => (
            <button key={i} className="event-option-btn" onClick={() => resolveEvent(i)}>
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
