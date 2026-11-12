// 쉬운 화면: 시연 4단계, 실제 기기 기록과 자동 저장, 엑셀용 파일, 전문가 화면 전환
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("시연: 블루투스 없이 4단계를 끝까지 진행하고 흔적 없이 끝낸다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator("body")).toHaveClass(/ui-easy/);
  await expect(page.locator("#page-title")).toHaveText(
    "먼저 3가지를 확인하세요",
  );
  await page.locator("#easy-demo-start").click();
  await expect(page.locator("#easy-demo-bar")).toBeVisible();
  await expect(page.locator("#easy-coach")).toHaveText(
    "아래 3가지를 하나씩 눌러 보세요",
  );
  await expect(page.locator(".coach-target")).toHaveCount(3);
  await expect(page.locator("#easy-next")).toBeDisabled();
  for (const i of [0, 1, 2])
    await page.locator(`[data-preflight="${i}"]`).click();
  await page.locator("#easy-next").click();
  await expect(page.locator("#page-title")).toHaveText(
    "켜져 있는 기기를 찾아요",
  );
  await page.locator("#easy-scan-glasses").click();
  await page.locator("#easy-scan-all").click();
  await expect(page.locator(".easy-card")).toHaveCount(5);
  await expect(page.locator(".easy-card.red")).toHaveCount(3); // 이름 2 + 제조사 번호 1
  await expect(page.locator(".easy-card").first()).toHaveClass(/red/);
  await page
    .locator(".easy-card.red [data-easy-disposition='checked']")
    .first()
    .click();
  await expect(page.locator(".easy-card.green")).toHaveCount(1);
  await page.locator("#easy-next").click();
  await expect(page.locator("#page-optical")).toBeVisible();
  await page.locator("#easy-tabs [data-page='guide']").click();
  await expect(page.locator(".guide-card")).toHaveCount(7);
  await expect(page.locator(".behavior-tips li")).toHaveCount(4);
  await page.locator('[data-guide="rokid"]').click();
  await expect(page.locator("dialog")).toContainText("초록색 단색 화면");
  await page.locator(".dialog-close").click();
  await page.locator("#easy-next").click();
  await expect(page.locator("#all-records li")).toHaveCount(5);
  // 휴대폰 폭에서도 가로로 넘치지 않아야 합니다
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator("#easy-next").click(); // 시연 끝내기
  await expect(page.locator("#easy-demo-bar")).toBeHidden();
  await expect(page.locator("#page-title")).toHaveText(
    "먼저 3가지를 확인하세요",
  );
  await page.reload();
  await page.locator("[data-easy-step='4']").click();
  await expect(page.locator("#all-records li")).toHaveCount(0); // 시연 기록은 저장되지 않음
  expect(errors).toEqual([]);
});

test("현장: 고른 기기가 카드로 기록되고, 새로고침해도 남으며, 엑셀용 파일로 받는다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "bluetooth", {
      value: {
        requestDevice: async () => ({ id: "abc", name: "Ray-Ban Meta 01" }),
      },
    }),
  );
  await page.goto("./");
  for (const i of [0, 1, 2])
    await page.locator(`[data-preflight="${i}"]`).click();
  await page.locator("#easy-next").click();
  await page.locator("#easy-scan-glasses").click();
  await expect(page.locator(".easy-card.red h3")).toHaveText("Ray-Ban Meta 01");
  await page.locator("[data-easy-disposition='followup']").click();
  await page.reload();
  await expect(page.locator("#toast")).toContainText("이전에 하던 점검 기록");
  await expect(page.locator(".easy-card.red h3")).toHaveText("Ray-Ban Meta 01");
  await expect(
    page.locator("[data-easy-disposition='followup']"),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-easy-step='4']").click();
  await page.locator("#meta-exam").fill("기사 실기");
  const download = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^examguard-record-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("Ray-Ban Meta 01");
  expect(csv).toContain("추가 확인 필요");
  expect(csv).toContain("기사 실기");
  // 전문가 화면으로 바꾸면 원본 메뉴가 그대로 보입니다
  await page.locator("#ui-toggle").click();
  await expect(page.locator("body")).toHaveClass(/ui-pro/);
  await expect(page.locator(".primary-nav .nav-item")).toHaveCount(3);
  await expect(page.locator("#page-title")).toHaveText("점검 기록");
});

test("이름을 바꾼 기기: 제조사 번호로 목록에 뜬 기기는 빨강 카드로 기록된다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "bluetooth", {
      value: {
        requestDevice: async (options: unknown) => {
          (window as unknown as { lastOptions: unknown }).lastOptions = options;
          return { id: "renamed-1", name: "민수의 기기" };
        },
      },
    }),
  );
  await page.goto("./");
  for (const i of [0, 1, 2])
    await page.locator(`[data-preflight="${i}"]`).click();
  await page.locator("#easy-next").click();
  await page.locator("#easy-scan-glasses").click();
  await expect(page.locator(".easy-card.red .light")).toHaveText(
    "안경 제조사 신호와 같아요",
  );
  await expect(page.locator(".easy-card.red h3")).toHaveText("민수의 기기");
  const filters = await page.evaluate(
    () =>
      (
        window as unknown as {
          lastOptions: { filters: Record<string, unknown>[] };
        }
      ).lastOptions.filters,
  );
  expect(JSON.stringify(filters)).toContain('"companyIdentifier":427'); // 0x01AB Meta
  expect(JSON.stringify(filters)).toContain('"companyIdentifier":3411'); // 0x0D53 Luxottica
  expect(JSON.stringify(filters)).toContain('"services":[64863]'); // 0xFD5F
  expect(JSON.stringify(filters)).toContain('"namePrefix":"Ray-Ban"');
  // ‘모든 기기 보기’에서 같은 기기를 고르면 번호 단서 표시는 유지된다
  await page.locator("#easy-scan-all").click();
  await expect(page.locator(".easy-card.red")).toHaveCount(1);
});
