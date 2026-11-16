/**
 * 浏览器入口：把启动失败的错误落到页首 #fatal，而不是只进 console。
 * 这里只做装配，不含任何规则（规则在 systems/）。
 */
import { bootstrap } from './ui/render.ts';

bootstrap().catch((error: unknown) => {
  const box = document.getElementById('fatal');
  if (box !== null) {
    box.classList.remove('hidden');
    box.textContent = `启动失败：${error instanceof Error ? error.message : String(error)}`;
  }
  console.error(error);
});
