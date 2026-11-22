/**
 * 只读 mvp 事件源，序列化成普通 JSON 给 admin server。
 * Node 24 直接 import .ts（类型擦除）。本文件不写回 mvp。
 */

const STORY_URL = new URL('../../mvp/src/data/events.ts', import.meta.url);
const DAILY_URL = new URL('../../mvp/src/data/daily-events.ts', import.meta.url);

export async function loadEvents() {
  const eventsMod = await import(STORY_URL.href);
  const dailyMod = await import(DAILY_URL.href);
  const story = Array.isArray(eventsMod.EVENTS) ? eventsMod.EVENTS : null;
  const daily = Array.isArray(dailyMod.DAILY_EVENTS) ? dailyMod.DAILY_EVENTS : null;
  if (!story) throw new Error('mvp/src/data/events.ts 没有导出 EVENTS');
  if (!daily) throw new Error('mvp/src/data/daily-events.ts 没有导出 DAILY_EVENTS');
  const merged = [
    ...story.map((event) => ({ ...event, kind: event.kind || 'story' })),
    ...daily.map((event) => ({ ...event, kind: event.kind || 'daily' })),
  ];
  return JSON.parse(JSON.stringify(merged));
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('read-events.mjs')) {
  loadEvents()
    .then((events) => {
      process.stdout.write(JSON.stringify({ count: events.length, events }));
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
