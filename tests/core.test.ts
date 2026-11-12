import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createReport,
  escapeHtml,
  median,
  parseRadioCapture,
  summarizeRadio,
} from "../src/lib/core.ts";
import type {
  DeviceRecord,
  Inspection,
  RadioCapture,
  RadioSample,
} from "../src/lib/core.ts";
import { applyFilter } from "../src/lib/filters.ts";
import { normalizeVector, rankReferences } from "../src/lib/photo-ranking.ts";
import { guides } from "../src/data/guides.ts";

const sample = (overrides: Partial<RadioSample> = {}): RadioSample => ({
  deviceKey: "anonymous-a",
  name: "Example",
  zone: "창가",
  rssi: -60,
  timestamp: "2026-11-07T01:00:00Z",
  ...overrides,
});
const capture = (samples: RadioSample[]): RadioCapture => ({
  schema: "examguard.radio.v1",
  source: "test receiver",
  isDemo: false,
  samples,
});
test("radio importer accepts valid data and discards unexpected fields", () => {
  const input = { ...capture([sample()]), photo: "private-data" };
  assert.deepEqual(
    parseRadioCapture(JSON.stringify(input)),
    capture([sample()]),
  );
});
test("radio importer rejects malformed, unbounded and invalid measurements", () => {
  for (const bad of [
    "{}",
    "null",
    "[]",
    "{",
    JSON.stringify({ ...capture([]), isDemo: "false" }),
    " ".repeat(1_000_001),
  ])
    assert.throws(() => parseRadioCapture(bad));
  for (const bad of [
    sample({ rssi: 128 }),
    sample({ rssi: -128 }),
    sample({ rssi: NaN }),
    sample({ timestamp: "2026-11-07" }),
    sample({ timestamp: "yesterday" }),
    sample({ zone: "" }),
    sample({ deviceKey: "x".repeat(81) }),
  ])
    assert.throws(() => parseRadioCapture(JSON.stringify(capture([bad]))));
  assert.throws(() =>
    parseRadioCapture(
      JSON.stringify(
        capture(
          Array.from({ length: 101 }, (_, i) =>
            sample({ deviceKey: String(i) }),
          ),
        ),
      ),
    ),
  );
  assert.throws(() =>
    parseRadioCapture(
      JSON.stringify(
        capture(
          Array.from({ length: 31 }, (_, i) => sample({ zone: String(i) })),
        ),
      ),
    ),
  );
});
test("RSSI comparison requires repeated measurements and ignores a lone strong outlier", () => {
  const summary = summarizeRadio(
    capture([
      sample({ zone: "outlier", rssi: -10 }),
      ...[-64, -65, -63].map((rssi) => sample({ zone: "A", rssi })),
      ...[-80, -81, -79].map((rssi) => sample({ zone: "B", rssi })),
    ]),
  )[0]!;
  assert.equal(summary.strongestRepeatedZone, "A");
  assert.equal(summary.comparable, true);
  const insufficient = summarizeRadio(
    capture([sample(), sample({ zone: "B" })]),
  )[0]!;
  assert.equal(insufficient.comparable, false);
  assert.equal(insufficient.strongestRepeatedZone, null);
  assert.equal(median([-55, -95, -60]), -60);
  assert.equal(median([-50, -60]), -55);
  assert.throws(() => median([]));
});
test("report excludes training data and never guesses identity, manufacturer or signal", () => {
  const device: DeviceRecord = {
    id: "record-id",
    name: "Glass",
    source: "browser-selection",
    selectedAt: sample().timestamp,
    lastSelectedAt: sample().timestamp,
    selections: 1,
    zone: "창가",
    disposition: "unreviewed",
    preparation: [true, true, true],
  };
  const inspection: Inspection = {
    id: "observation-id",
    source: "image",
    createdAt: sample().timestamp,
    zone: "미지정",
    observations: ["충전 접점"],
  };
  const report = createReport(
    [true, true, true],
    [device, { ...device, id: "demo", source: "demo" }],
    [inspection, { ...inspection, source: "demo" }],
    { ...capture([sample()]), isDemo: true },
  );
  assert.equal(report.devices.length, 1);
  assert.equal(report.inspections.length, 1);
  assert.equal(report.radioCapture, null);
  assert.equal(report.devices[0]!.owner, null);
  assert.equal(report.devices[0]!.rssi, null);
  assert.equal(report.devices[0]!.manufacturer, null);
  assert.equal(report.preparation.phonesPoweredOff, true);
  assert.equal(
    createReport([false, false, false], [], [], capture([sample()]))
      .radioCapture?.samples.length,
    1,
  );
});
test("untrusted device names are safely escaped", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">&\''),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;",
  );
});
test("filters preserve alpha and implement reversible negative / bounded highlighting", () => {
  const original = new Uint8ClampedArray([0, 127, 255, 70, 255, 255, 255, 255]);
  const negative = original.slice();
  applyFilter(negative, 2, 1, "negative");
  assert.deepEqual([...negative], [255, 128, 0, 70, 0, 0, 0, 255]);
  applyFilter(negative, 2, 1, "negative");
  assert.deepEqual(negative, original);
  const contrast = original.slice();
  applyFilter(contrast, 2, 1, "contrast", 200);
  assert.deepEqual([...contrast.slice(4)], [255, 190, 100, 255]);
  assert.equal(contrast[3], 70);
  const edge = new Uint8ClampedArray(3 * 3 * 4).fill(255);
  applyFilter(edge, 3, 3, "edges");
  assert.equal(edge[16], 0);
  assert.equal(edge[19], 255);
});
test("photo ranking normalizes inputs, groups references and never returns a probability", () => {
  const vector = (i: number) =>
    Array.from({ length: 512 }, (_, j) => (j === i ? 1 : 0));
  const ranked = rankReferences(vector(0), [
    { id: "a", guideId: "meta", embedding: vector(0) },
    { id: "b", guideId: "meta", embedding: vector(1) },
    { id: "c", guideId: "even", embedding: vector(1) },
    { id: "d", guideId: "normal", embedding: vector(2) },
    { id: "e", guideId: "huawei", embedding: vector(3) },
  ]);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0]!.guideId, "meta");
  assert.equal(ranked[0]!.similarity, 1);
  assert.equal("probability" in ranked[0]!, false);
  assert.throws(() => normalizeVector([1, 2]));
  assert.throws(() => normalizeVector(Array(512).fill(0)));
  assert.throws(() => normalizeVector(Array(512).fill(NaN)));
});
test("committed visual index has valid provenance, dimensions, catalog mappings and self retrieval", async () => {
  const index = JSON.parse(
    await readFile("public/visual-references.json", "utf8"),
  );
  const provenance = JSON.parse(
    await readFile("docs/reference-sources.json", "utf8"),
  );
  assert.equal(index.references.length, 9);
  assert.equal(index.revision, provenance.revision);
  for (const reference of index.references) {
    assert.ok(guides.some((g) => g.id === reference.guideId));
    assert.equal(reference.embedding.length, 512);
    assert.ok(Math.abs(Math.hypot(...reference.embedding) - 1) < 0.00001);
    assert.match(reference.sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      rankReferences(reference.embedding, index.references)[0]!.guideId,
      reference.guideId,
    );
    assert.ok(
      provenance.references.find((s: { id: string }) => s.id === reference.id),
    );
  }
  for (const guide of guides)
    assert.ok(
      (await readFile(`public/sample-${guide.sample}.svg`)).length > 100,
    );
});
