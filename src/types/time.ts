/**
 * 时间系统
 *
 * 设计来源：docs/06-time-system.md
 *
 * 核心设计：
 * - 纪元1年 = 2016年，每年推进
 * - 闰年规则：四年一闰，百年不闰，四百年又闰
 * - 周天运转每次消耗 7天
 * - idle tick 每次推进 1天
 */

// ========================
// 常量
// ========================

/** 纪元元年 = 2016年 */
export const EPOCH_START_YEAR = 2016;

/** 周天运转消耗天数 */
export const ZHOU_TIAN_DAYS = 7;

/** 挂机每次 tick 推进天数 */
export const IDLE_TICK_DAYS = 1;

// ========================
// 核心类型
// ========================

/** 游戏内时间 */
export interface GameTime {
  /** 纪元年（2016年 = 纪元1年） */
  epochYear: number;
  /** 月份（1-12） */
  month: number;
  /** 日期（1-31，看月份而定） */
  day: number;
}

// ========================
// 闰年判断
// ========================

/**
 * 判断是否为闰年
 * 规则：(年份 % 4 == 0 && 年份 % 100 != 0) || (年份 % 400 == 0)
 */
export function isLeapYear(epochYear: number): boolean {
  const actualYear = epochYear + EPOCH_START_YEAR - 1;
  return (actualYear % 4 === 0 && actualYear % 100 !== 0) || (actualYear % 400 === 0);
}

// ========================
// 月份天数
// ========================

/** 平年每月天数 */
const DAYS_PER_MONTH: Record<number, number> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

/**
 * 获取指定年月的天数
 */
export function getDaysInMonth(epochYear: number, month: number): number {
  if (month === 2) {
    return isLeapYear(epochYear) ? 29 : 28;
  }
  return DAYS_PER_MONTH[month] ?? 30;
}

/**
 * 获取全年天数
 */
export function getDaysInYear(epochYear: number): number {
  return isLeapYear(epochYear) ? 366 : 365;
}

// ========================
// 时间推进
// ========================

/**
 * 将游戏时间推进指定天数
 * @param time 当前游戏时间
 * @param days 推进的天数
 * @returns 推进后的游戏时间
 */
export function advanceDays(time: GameTime, days: number): GameTime {
  let { epochYear, month, day } = time;
  day += days;

  while (day > getDaysInMonth(epochYear, month)) {
    day -= getDaysInMonth(epochYear, month);
    month++;
    if (month > 12) {
      month = 1;
      epochYear++;
    }
  }

  return { epochYear, month, day };
}

// ========================
// 格式化
// ========================

/**
 * 格式化游戏时间显示
 * @example 纪元1年1月1日、纪元9年3月15日
 */
export function formatGameTime(time: GameTime): string {
  const actualYear = time.epochYear + EPOCH_START_YEAR - 1;
  return `纪元${actualYear}年${time.month}月${time.day}日`;
}

// ========================
// 初始值
// ========================

/** 游戏开始时的初始时间 */
export const INITIAL_GAME_TIME: GameTime = {
  epochYear: 1,
  month: 1,
  day: 1,
};