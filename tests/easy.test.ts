// 쉬운 화면 도우미 검증: 신호등 분류, 엑셀용 CSV, 자동 저장 복원
import test from "node:test";
import assert from "node:assert/strict";
import { easyCard, emptyMeta, parseSaved, toCsv } from "../src/lib/easy.ts";
import type { DeviceRecord, Inspection } from "../src/lib/core.ts";

const device = (over: Partial<DeviceRecord>): DeviceRecord => ({
  id: "d1",
  name: "Ray-Ban Meta",
  source: "browser-selection",
  selectedAt: "2026-11-12T01:00:00.000Z",
  lastSelectedAt: "2026-11-12T01:00:00.000Z",
  selections: 1,
  zone: "교탁",
  disposition: "unreviewed",
  preparation: [true, true, true],
  ...over,
});

test("신호등: 안경 이름은 빨강, 다른 기기는 회색, 모르면 노랑, 확인 끝은 초록", () => {
  assert.equal(easyCard(device({})).light, "red");
  assert.equal(easyCard(device({ name: "AirPods Pro" })).light, "gray");
  assert.equal(easyCard(device({ name: "LE-1234" })).light, "yellow");
  assert.equal(easyCard(device({ name: "Meta" })).light, "yellow"); // 회사명만으로는 판정 안 함
  assert.equal(easyCard(device({ disposition: "allowed" })).light, "green");
  assert.equal(easyCard(device({ disposition: "checked" })).light, "green");
  assert.equal(easyCard(device({ disposition: "followup" })).light, "red");
});

test("CSV: BOM으로 시작하고, 연습 기록은 빼며, 수식 주입과 쉼표를 막는다", () => {
  const inspection: Inspection = {
    id: "i1",
    source: "camera",
    createdAt: "2026-11-12T01:05:00.000Z",
    zone: "교탁",
    observations: ["앞면 원형 부품", "다리 안쪽 단자"],
  };
  const csv = toCsv(
    { exam: "기사 실기", room: "3층, 2시험실", proctor: "" },
    [true, true, false],
    [
      device({ name: "=HYPERLINK(1)" }),
      device({ id: "d2", name: "연습 기기", source: "demo" }),
    ],
    [inspection],
  );
  assert.ok(csv.startsWith("﻿구분,기록 시각"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes('"3층, 2시험실"'));
  assert.ok(!csv.includes("연습 기기"));
  assert.ok(csv.includes("앞면 원형 부품 / 다리 안쪽 단자"));
  assert.ok(csv.includes("허용 장비 확인,,,미확인"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 1 + 3 + 1 + 1); // 머리글 + 준비 3 + 기기 1 + 관찰 1
  const withDemo = toCsv(
    emptyMeta(),
    [true, true, true],
    [device({ source: "demo" })],
    [],
    true,
  );
  assert.ok(withDemo.includes("연습·시연용 예시"));
});

test("자동 저장: 정상 자료는 되살리고, 깨진 자료는 버린다", () => {
  const good = JSON.stringify({
    v: 1,
    preflight: [true, false, true],
    devices: [device({})],
    inspections: [],
    deviceKeys: [["browser-id", "d1"]],
    meta: { exam: "시험", room: "1실", proctor: "" },
    step: 2,
  });
  const restored = parseSaved(good);
  assert.equal(restored?.devices[0]?.name, "Ray-Ban Meta");
  assert.equal(restored?.step, 2);
  assert.deepEqual(restored?.preflight, [true, false, true]);
  assert.equal(parseSaved(null), null);
  assert.equal(parseSaved("{not json"), null);
  assert.equal(parseSaved(JSON.stringify({ v: 2 })), null);
  assert.equal(parseSaved(good.replace('"교탁"', '"없는 구역"')), null);
  assert.equal(parseSaved(good.replace('"step":2', '"step":9'))?.step, 1);
});
