import { writeFile } from "node:fs/promises";
const uuid = "f0f0f0f0-1111-4222-8333-444444444444";
const rules = {
  schema: "examguard.signatures.v1",
  source: "ExamGuard synthetic fixture — NOT a real product signature",
  isDemo: true,
  rules: [
    {
      id: "demo-glasses-pattern",
      label: "연습용 카메라 안경 후보",
      companyId: 65535,
      serviceUuids: [uuid],
      payload: { offset: 1, bytes: [71, 16, 160], mask: [255, 255, 240] },
      evidence: {
        sourceUrl:
          "https://github.com/epoko77-ai/examguard/blob/main/docs/SIGNATURES.md",
        model: "Fictional Demo Glasses",
        notes:
          "기능 확인용 가상 회사·UUID·바이트입니다. 실제 스마트안경 판별에 사용할 수 없습니다.",
      },
    },
  ],
};
const samples = [];
for (const [key, name, companyId, payload] of [
  ["demo-match", "복합 조건 일치 · 가상", 65535, [0, 71, 16, 167, 1]],
  [
    "demo-same-company",
    "같은 회사의 다른 제품 · 가상",
    65535,
    [0, 71, 32, 167, 1],
  ],
  ["demo-unknown", "미등록 기기 · 가상", 65534, [0, 71, 16, 167, 1]],
])
  for (const [zone, values] of [
    ["창가", [-58, -59, -60]],
    ["가운데", [-73, -75, -74]],
  ])
    for (const rssi of values)
      samples.push({
        deviceKey: key,
        name,
        zone,
        rssi,
        timestamp: new Date(
          Date.UTC(2026, 10, 7, 1, 0, samples.length * 2),
        ).toISOString(),
        advertisement: {
          manufacturerData: [{ companyId, bytes: payload }],
          serviceUuids: [uuid],
        },
      });
await writeFile(
  "public/signature-example.json",
  JSON.stringify(rules, null, 2) + "\n",
);
await writeFile(
  "public/radio-advertisement-example.json",
  JSON.stringify(
    {
      schema: "examguard.radio.v2",
      source: "ExamGuard synthetic advertisement fixture",
      isDemo: true,
      samples,
    },
    null,
    2,
  ) + "\n",
);
console.log("Created explicitly fictional compound-rule fixtures.");
