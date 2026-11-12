// 원본(전문가 화면) 테스트용: 쉬운 화면이 기본이므로, 이 테스트들은 전문가 화면으로 고정합니다.
import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("examguard-easy.ui", "pro");
      } catch {
        /* 저장소 사용 불가 환경 */
      }
    });
    await use(page);
  },
});
export { expect };
