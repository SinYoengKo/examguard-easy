import test from "node:test";
import assert from "node:assert/strict";
import {
  assessDeviceName,
  matchesDeviceListFilter,
} from "../src/lib/device-hints.ts";
import { guides } from "../src/data/guides.ts";

test("specific glasses names yield an explained candidate, never a confirmed identity", () => {
  for (const name of [
    "Ray-Ban Meta",
    "rayban",
    "Even_G1",
    "XREAL Air 2",
    "HUAWEI Eyewear 2",
    "Mijia Smart Audio Glasses",
    "AI Glasses",
    "HeyCyan",
  ]) {
    const hint = assessDeviceName(name);
    assert.equal(hint.kind, "glasses-candidate", name);
    assert.equal(hint.basis, "advertised-name-only");
    assert.equal(hint.requiresPhysicalCheck, true);
    for (const id of hint.guideIds)
      assert.ok(
        guides.some((g) => g.id === id),
        id,
      );
  }
});
test("same-company VR devices and common electronics get different hints, not a safe verdict", () => {
  for (const name of [
    "Meta Quest 3",
    "AirPods Pro",
    "Galaxy Buds2",
    "iPhone 16",
    "Galaxy S25",
    "MacBook Pro",
    "Apple Watch",
    "ipTIME_A3004",
    "TP-Link Router",
    "NETGEAR_01",
    "HP LaserJet",
    "LG webOS TV",
    "Bluetooth Speaker",
  ]) {
    const hint = assessDeviceName(name);
    assert.equal(hint.kind, "other-device-hint", name);
    assert.equal(hint.requiresPhysicalCheck, true);
  }
});
test("brand-only, anonymous and conflicting names stay unidentified", () => {
  for (const name of [
    "Meta",
    "Xiaomi",
    "Samsung",
    "G1",
    "XREAL",
    "Unknown",
    "",
    "Ray-Ban Meta Quest 3",
    "AI Glasses Speaker",
    "Meta Router Smart Glasses",
    "<img src=x onerror=alert(1)>",
  ])
    assert.equal(assessDeviceName(name).kind, "unknown", name);
});

test("review list separates other electronics and completed checks while retaining unknown and explicit follow-ups", () => {
  const glasses = { name: "Ray-Ban Meta", disposition: "unreviewed" as const };
  const router = { name: "ipTIME", disposition: "unreviewed" as const };
  const unknown = { name: "Unknown", disposition: "unreviewed" as const };
  const allowed = { ...glasses, disposition: "allowed" as const };
  const checked = { ...unknown, disposition: "checked" as const };
  assert.equal(matchesDeviceListFilter(glasses, "review"), true);
  assert.equal(matchesDeviceListFilter(unknown, "review"), true);
  assert.equal(matchesDeviceListFilter(router, "review"), false);
  assert.equal(matchesDeviceListFilter(allowed, "review"), false);
  assert.equal(matchesDeviceListFilter(checked, "review"), false);
  assert.equal(matchesDeviceListFilter(glasses, "glasses-candidate"), true);
  assert.equal(matchesDeviceListFilter(unknown, "glasses-candidate"), false);
  assert.equal(matchesDeviceListFilter(router, "glasses-candidate"), false);
  assert.equal(matchesDeviceListFilter(allowed, "glasses-candidate"), false);
  assert.equal(matchesDeviceListFilter(checked, "glasses-candidate"), false);
  assert.equal(
    matchesDeviceListFilter({ ...router, disposition: "followup" }, "review"),
    true,
  );
  assert.equal(matchesDeviceListFilter(allowed, "resolved"), true);
  assert.equal(matchesDeviceListFilter(checked, "resolved"), true);
  assert.equal(matchesDeviceListFilter(unknown, "resolved"), false);
  for (const device of [glasses, router, unknown, allowed, checked])
    assert.equal(matchesDeviceListFilter(device, "all"), true);
  assert.equal(matchesDeviceListFilter(router, "other-device-hint"), true);
  assert.equal(matchesDeviceListFilter(unknown, "unknown"), true);
  assert.equal(router.disposition, "unreviewed");
  assert.equal(allowed.disposition, "allowed");
});
