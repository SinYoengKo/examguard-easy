import test from "node:test";
import assert from "node:assert/strict";
import { buildBluetoothRequest } from "../src/lib/bluetooth-scan.ts";

test("focused chooser includes specific glasses search terms and excludes unrelated names", () => {
  const options = buildBluetoothRequest("glasses");
  assert.equal(options.acceptAllDevices, undefined);
  assert.ok(options.filters?.length);
  const matches = (name: string) =>
    options.filters!.some((filter) => name.startsWith(filter.namePrefix));
  for (const name of [
    "Ray-Ban Meta",
    "rayban",
    "RAY-BAN META",
    "Even_G1",
    "EVEN G2",
    "XREAL Air 2",
    "HUAWEI Eyewear 2",
    "SmartGlasses",
    "AI Glasses",
    "HeyCyan",
    "스마트안경",
  ])
    assert.ok(matches(name), name);
  for (const name of [
    "ipTIME",
    "TP-Link Router",
    "AirPods Pro",
    "LG webOS TV",
    "HP LaserJet",
    "Meta Quest 3",
    "Meta",
    "Xiaomi",
    "Unknown",
    "",
  ])
    assert.equal(matches(name), false, name);
  assert.equal(
    new Set(options.filters!.map((filter) => filter.namePrefix)).size,
    options.filters!.length,
  );
  assert.ok(options.filters!.every((filter) => filter.namePrefix.length > 0));
});

test("unnamed and renamed devices need the explicitly chosen broad search", () => {
  const focused = buildBluetoothRequest("glasses");
  for (const name of ["", "내 안경", "Alice's Ray-Ban Meta"])
    assert.equal(
      focused.filters!.some((filter) => name.startsWith(filter.namePrefix)),
      false,
    );
  const broad = buildBluetoothRequest("all");
  assert.equal(broad.acceptAllDevices, true);
  assert.equal(broad.filters, undefined);
});
