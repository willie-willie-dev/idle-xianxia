import type { Character, GameEvent, Realm } from '../types';
import { REALM_ORDER } from '../data/realms';
import { EVENTS_DATA } from '../data/events';

export function checkEventTrigger(char: Character, triggeredIds: Set<string>): GameEvent | null {
  const realmIdx = REALM_ORDER.indexOf(char.realm);
  const eligible = EVENTS_DATA.filter(e => {
    const startIdx = REALM_ORDER.indexOf(e.realmRange[0] as Realm);
    const endIdx = REALM_ORDER.indexOf(e.realmRange[1] as Realm);
    if (realmIdx < startIdx || realmIdx > endIdx) return false;
    if (e.oneTime && triggeredIds.has(e.id)) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  // Roll for each eligible event
  for (const e of eligible) {
    if (Math.random() < e.triggerChance) return e;
  }
  return null;
}
