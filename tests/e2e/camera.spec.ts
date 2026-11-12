import { test, expect } from "./pro";

test("leaving camera view releases both active and late-arriving media tracks", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Canvas captureStream test fixture is exercised in Chromium.",
  );
  await page.addInitScript(() => {
    const makeStream = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#a4cca8";
      context.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(10);
      (window as any).testTracks = stream.getTracks();
      context.fillRect(10, 10, 20, 20);
      return stream;
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => {
        const stream = makeStream();
        if ((window as any).delayCamera)
          return new Promise((resolve) => {
            (window as any).allowCamera = () => resolve(stream);
          });
        return Promise.resolve(stream);
      },
    });
  });
  await page.goto("./#optical");
  await page.locator("#camera-button").click();
  await expect(page.locator("#camera-source")).toHaveText("실시간 카메라");
  await page.locator("#freeze-button").click();
  await expect(page.locator("#freeze-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('.nav-item[data-page="guide"]').click();
  expect(
    await page.evaluate(() =>
      (window as any).testTracks.every(
        (track: MediaStreamTrack) => track.readyState === "ended",
      ),
    ),
  ).toBe(true);
  await page.evaluate(() => ((window as any).delayCamera = true));
  await page.locator('.nav-item[data-page="optical"]').click();
  await page.locator("#camera-button").click();
  await expect(page.locator("#camera-button")).toBeDisabled();
  await page.locator('.nav-item[data-page="records"]').click();
  await page.evaluate(() => (window as any).allowCamera());
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).testTracks.every(
          (track: MediaStreamTrack) => track.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
});
