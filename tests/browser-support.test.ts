import test from "node:test";
import assert from "node:assert/strict";
import { getBrowserSupport } from "../src/lib/browser-support.ts";

const environment = {
  userAgent:
    "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36",
  maxTouchPoints: 5,
  secureContext: true,
  hasBluetoothChooser: false,
};

test("iPhone Safari, iOS Chrome and desktop-style iPad all get the iOS limitation", () => {
  for (const userAgent of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15",
  ]) {
    const support = getBrowserSupport({ ...environment, userAgent });
    assert.equal(support.platform, "ios", userAgent);
    assert.equal(support.supported, false);
    assert.match(support.title, /현재 iPhone·iPad 브라우저/);
    assert.match(support.steps.join(" "), /Bluefy.*설치/);
    assert.match(support.steps.join(" "), /실기기 호환성.*아직 검증하지/);
    assert.match(support.description, /Chrome.*지원하지 않습니다/);
    assert.match(support.description, /홈 화면.*해결되지 않습니다/);
  }
  assert.equal(
    getBrowserSupport({
      ...environment,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      maxTouchPoints: 0,
    }).platform,
    "mac",
  );
});

test("API availability and secure context control access, never the browser name", () => {
  assert.equal(getBrowserSupport(environment).supported, false);
  assert.equal(
    getBrowserSupport({ ...environment, hasBluetoothChooser: true }).supported,
    true,
  );
  assert.match(
    getBrowserSupport({
      ...environment,
      userAgent: "iPhone Bluefy",
      hasBluetoothChooser: true,
    }).description,
    /실기기 호환성.*아직 검증하지/,
  );
  const insecure = getBrowserSupport({
    ...environment,
    hasBluetoothChooser: true,
    secureContext: false,
  });
  assert.equal(insecure.supported, false);
  assert.match(insecure.title, /HTTPS/);
  // Feature presence wins over UA guidance, including future browser changes.
  assert.equal(
    getBrowserSupport({
      ...environment,
      userAgent: "iPhone Bluefy",
      hasBluetoothChooser: true,
    }).supported,
    true,
  );
});

test("Android in-app and unsupported desktop environments get actionable alternatives", () => {
  const android = getBrowserSupport({
    ...environment,
    userAgent: `${environment.userAgent} KAKAOTALK`,
  });
  assert.match(android.title, /Chrome 앱/);
  assert.match(android.steps.join(" "), /직접 실행/);
  const linux = getBrowserSupport({
    ...environment,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0",
    maxTouchPoints: 0,
  });
  assert.equal(linux.platform, "linux");
  assert.match(linux.description, /Windows 10\/11/);
  assert.match(linux.description, /Linux.*권장하지 않습니다/);
});
