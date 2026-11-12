import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseSignatureRules,
  parseAdvertisement,
  normalizeUuid,
  matchesRule,
  analyzeSignatures,
} from "../src/lib/signatures.ts";
import { parseRadioCapture, createReport } from "../src/lib/core.ts";
import type { Advertisement } from "../src/lib/signatures.ts";
const ruleJson = JSON.parse(
  await readFile("public/signature-example.json", "utf8"),
);
const captureJson = JSON.parse(
  await readFile("public/radio-advertisement-example.json", "utf8"),
);
const rules = parseSignatureRules(JSON.stringify(ruleJson));
const capture = parseRadioCapture(JSON.stringify(captureJson));
const clone = <T>(value: T): T => structuredClone(value);
const rule = rules.rules[0]!;
const matching = clone(capture.samples[0]!.advertisement!);

test("compound rules require company, all UUIDs and a masked payload match in one advertisement", () => {
  assert.equal(matchesRule(matching, rule), true);
  const wrongCompany = clone(matching);
  wrongCompany.manufacturerData[0]!.companyId = 1;
  assert.equal(matchesRule(wrongCompany, rule), false);
  const wrongUuid = clone(matching);
  wrongUuid.serviceUuids = [];
  assert.equal(matchesRule(wrongUuid, rule), false);
  const wrongByte = clone(matching);
  wrongByte.manufacturerData[0]!.bytes[2] = 99;
  assert.equal(matchesRule(wrongByte, rule), false);
  const masked = clone(matching);
  masked.manufacturerData[0]!.bytes[3] = 175;
  assert.equal(matchesRule(masked, rule), true);
  masked.manufacturerData[0]!.bytes[3] = 191;
  assert.equal(matchesRule(masked, rule), false);
  const short = clone(matching);
  short.manufacturerData[0]!.bytes = [0, 71];
  assert.equal(matchesRule(short, rule), false);
});
test("same-company other product stays unconfirmed; unknown company is not declared safe", () => {
  const results = analyzeSignatures(capture, rules);
  assert.deepEqual(
    results.map((r) => r.status),
    ["matched", "company-only", "unmatched"],
  );
  assert.equal(results[0]!.matches[0]!.packetCount, 6);
  assert.equal(results[1]!.matches.length, 0);
  assert.equal(results[2]!.matches.length, 0);
});
test("evidence cannot be combined across packets or different manufacturer entries", () => {
  const a = clone(matching);
  a.serviceUuids = [];
  const b = clone(matching);
  b.manufacturerData[0]!.bytes[2] = 99;
  const base = capture.samples[0]!;
  const result = analyzeSignatures(
    {
      isDemo: true,
      samples: [
        { ...base, advertisement: a },
        { ...base, advertisement: b },
      ],
    },
    rules,
  )[0]!;
  assert.equal(result.status, "company-only");
  const split: Advertisement = {
    serviceUuids: matching.serviceUuids,
    manufacturerData: [
      { companyId: rule.companyId, bytes: [0] },
      { companyId: 2, bytes: matching.manufacturerData[0]!.bytes },
    ],
  };
  assert.equal(matchesRule(split, rule), false);
});
test("multiple different labels remain ambiguous and every required UUID must be observed", () => {
  const duplicate = clone(rules);
  duplicate.rules.push({
    ...clone(rule),
    id: "other-model",
    label: "Different model",
  });
  assert.equal(analyzeSignatures(capture, duplicate)[0]!.status, "ambiguous");
  const multi = clone(rule);
  multi.serviceUuids.push(normalizeUuid("180f"));
  assert.equal(matchesRule(matching, multi), false);
  const complete = clone(matching);
  complete.serviceUuids.push(normalizeUuid("180F"));
  assert.equal(matchesRule(complete, multi), true);
});
test("missing data, empty data, missing rules and demo rules on live input are distinct", () => {
  const base = capture.samples[0]!;
  assert.equal(
    analyzeSignatures(
      { isDemo: true, samples: [{ ...base, advertisement: undefined }] },
      rules,
    )[0]!.status,
    "no-data",
  );
  assert.equal(
    analyzeSignatures(
      {
        isDemo: true,
        samples: [
          {
            ...base,
            advertisement: { manufacturerData: [], serviceUuids: [] },
          },
        ],
      },
      rules,
    )[0]!.status,
    "no-data",
  );
  assert.equal(analyzeSignatures(capture, null)[0]!.status, "no-rules");
  assert.equal(
    analyzeSignatures({ ...capture, isDemo: false }, rules)[0]!.status,
    "demo-blocked",
  );
});
test("rule parser rejects company-only, unconstrained masks, unsafe URLs and unbounded input", () => {
  for (const edit of [
    (v: any) => {
      v.rules[0].serviceUuids = [];
    },
    (v: any) => {
      delete v.rules[0].payload;
    },
    (v: any) => {
      v.rules[0].payload.mask = [0, 0, 0];
    },
    (v: any) => {
      v.rules[0].payload.mask = [255];
    },
    (v: any) => {
      v.rules[0].payload.offset = 511;
    },
    (v: any) => {
      v.rules[0].payload.bytes = [256];
    },
    (v: any) => {
      v.rules[0].companyId = -1;
    },
    (v: any) => {
      v.rules[0].evidence.sourceUrl = "javascript:alert(1)";
    },
    (v: any) => {
      v.rules[0].evidence.sourceUrl = "https://user:pass@example.com/";
    },
    (v: any) => {
      v.rules.push(clone(v.rules[0]));
    },
  ]) {
    const v = clone(ruleJson);
    edit(v);
    assert.throws(() => parseSignatureRules(JSON.stringify(v)));
  }
  assert.throws(() => parseSignatureRules(" ".repeat(256001)));
  assert.throws(() => parseSignatureRules("null"));
  assert.throws(() =>
    parseSignatureRules(
      JSON.stringify({ ...ruleJson, rules: Array(65).fill(ruleJson.rules[0]) }),
    ),
  );
});
test("advertisement parser bounds bytes, normalizes UUIDs and ignores unrecognized fields", () => {
  assert.equal(normalizeUuid("180F"), "0000180f-0000-1000-8000-00805f9b34fb");
  assert.equal(normalizeUuid("0000180F"), normalizeUuid("180f"));
  assert.throws(() => normalizeUuid("bad"));
  const result = parseAdvertisement({
    ...matching,
    macAddress: "private-address",
  });
  assert.equal("macAddress" in result, false);
  for (const ad of [
    null,
    { manufacturerData: [], serviceUuids: ["bad"] },
    { manufacturerData: [{ companyId: 1, bytes: [-1] }], serviceUuids: [] },
    {
      manufacturerData: [{ companyId: 1, bytes: Array(513).fill(0) }],
      serviceUuids: [],
    },
    { manufacturerData: [], serviceUuids: Array(33).fill("180f") },
  ])
    assert.throws(() => parseAdvertisement(ad));
});
test("v1 ignores advertisement extras, v2 validates them, export excludes demo analyses", () => {
  const legacy = parseRadioCapture(
    JSON.stringify({ ...captureJson, schema: "examguard.radio.v1" }),
  );
  assert.equal(legacy.samples[0]!.advertisement, undefined);
  const invalid = clone(captureJson);
  invalid.samples[0].advertisement.manufacturerData[0].bytes = [999];
  assert.throws(() => parseRadioCapture(JSON.stringify(invalid)));
  assert.equal(
    createReport([true, true, true], [], [], capture, rules).signatureAnalysis,
    null,
  );
  const live = { ...capture, isDemo: false };
  assert.equal(
    createReport([true, true, true], [], [], live, rules).signatureAnalysis,
    null,
  );
  const liveRules = { ...rules, isDemo: false };
  const report = createReport([true, true, true], [], [], live, liveRules);
  assert.equal(report.signatureAnalysis?.results[0]?.status, "matched");
  assert.deepEqual(report.signatureAnalysis?.rules, liveRules);
});
test("first matching time is chronological even if imported rows are unordered", () => {
  const base = capture.samples[0]!;
  const results = analyzeSignatures(
    {
      isDemo: true,
      samples: [
        { ...base, timestamp: "2026-11-07T02:00:00Z" },
        { ...base, timestamp: "2026-11-07T09:30:00+08:00" },
      ],
    },
    rules,
  );
  assert.equal(
    results[0]!.matches[0]!.firstMatchedAt,
    "2026-11-07T09:30:00+08:00",
  );
});
