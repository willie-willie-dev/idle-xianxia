import { usePageTransition } from './PageTransitionProvider';
import '../styles/page-transitions.css';

const CLOUDS = [
  { size: 80, opacity: 0.18, direction: 'right' as const, duration: 12, top: -15 },
  { size: 100, opacity: 0.22, direction: 'left' as const, duration: 10, top: -20 },
  { size: 60, opacity: 0.15, direction: 'right' as const, duration: 14, top: -12 },
  { size: 110, opacity: 0.25, direction: 'left' as const, duration: 9, top: -18 },
  { size: 70, opacity: 0.2, direction: 'right' as const, duration: 11, top: -22 },
  { size: 90, opacity: 0.16, direction: 'left' as const, duration: 15, top: -10 },
];

export default function PageTransitionOverlay() {
  const { isTransitioning, isReady } = usePageTransition();

  return (
    <div
      className={`page-transition-overlay${isTransitioning ? ' active' : ''}`}
      style={{ pointerEvents: isReady ? 'all' : 'none' }}
      aria-hidden={!isTransitioning}
    >
      {CLOUDS.map((cloud, index) => (
        <div
          key={index}
          className={`cloud-item cloud-item--${cloud.direction}`}
          style={{
            width: cloud.size,
            height: cloud.size * 0.65,
            opacity: cloud.opacity,
            top: `${cloud.top}%`,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${index * 0.8}s`,
          }}
        />
      ))}
      <div className="spirit-mist" />
    </div>
  );
}
