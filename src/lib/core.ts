import { analyzeSignatures, parseAdvertisement } from "./signatures.ts";
import type { Advertisement, SignatureRuleSet } from "./signatures.ts";
import { assessDeviceName } from "./device-hints.ts";

export type Zone =
  "미지정" | "교탁" | "창가" | "가운데" | "복도 쪽" | "교실 밖";
export const ZONES: Zone[] = [
  "미지정",
  "교탁",
  "창가",
  "가운데",
  "복도 쪽",
  "교실 밖",
];
export type Disposition = "unreviewed" | "allowed" | "followup" | "checked";
export const DISPOSITIONS: Record<Disposition, string> = {
  unreviewed: "실물 미확인",
  allowed: "허용 장비로 확인",
  followup: "추가 확인 필요",
  checked: "실물 확인 완료",
};
export type Preflight = [boolean, boolean, boolean];
export interface DeviceRecord {
  id: string;
  name: string;
  source: "browser-selection" | "demo";
  selectedAt: string;
  lastSelectedAt: string;
  selections: number;
  zone: Zone;
  disposition: Disposition;
  preparation: Preflight;
  /** 쉬운 화면: 이름이 아니라 제조사·서비스 번호 단서로 목록에 뜬 기기 */
  signal?: boolean;
}
export interface Inspection {
  id: string;
  source: "camera" | "image" | "demo";
  createdAt: string;
  zone: Zone;
  observations: string[];
}
export interface RadioSample {
  deviceKey: string;
  name: string;
  zone: string;
  rssi: number;
  timestamp: string;
  advertisement?: Advertisement;
}
export interface RadioCapture {
  schema: "examguard.radio.v1" | "examguard.radio.v2";
  source: string;
  isDemo: boolean;
  samples: RadioSample[];
}
export interface RadioSummary {
  deviceKey: string;
  name: string;
  zones: {
    zone: string;
    median: number;
    count: number;
    min: number;
    max: number;
  }[];
  comparable: boolean;
  strongestRepeatedZone: string | null;
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) throw new Error("측정값이 없습니다.");
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** Strict, bounded import. Imported values are measurements, never identity assertions. */
export function parseRadioCapture(raw: string): RadioCapture {
  if (raw.length > 1_000_000)
    throw new Error("1 MB 이하의 JSON 파일을 선택해 주세요.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("올바른 JSON 파일이 아닙니다.");
  }
  if (
    !isObject(parsed) ||
    !["examguard.radio.v1", "examguard.radio.v2"].includes(
      String(parsed.schema),
    ) ||
    !validString(parsed.source, 80) ||
    typeof parsed.isDemo !== "boolean" ||
    !Array.isArray(parsed.samples) ||
    !parsed.samples.length ||
    parsed.samples.length > 5000
  ) {
    throw new Error(
      "examguard.radio.v1 또는 v2 형식, source, isDemo, 1~5,000개 samples가 필요합니다.",
    );
  }
  const samples: RadioSample[] = parsed.samples.map(
    (sample: unknown, i: number) => {
      if (
        !isObject(sample) ||
        !validString(sample.deviceKey, 80) ||
        !validString(sample.name, 120) ||
        !validString(sample.zone, 40) ||
        typeof sample.rssi !== "number" ||
        !Number.isFinite(sample.rssi) ||
        sample.rssi < -127 ||
        sample.rssi > 20 ||
        !validString(sample.timestamp, 40) ||
        !/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(sample.timestamp) ||
        !Number.isFinite(Date.parse(sample.timestamp))
      ) {
        throw new Error(
          `${i + 1}번째 측정값의 기기·구역·RSSI·시간 형식을 확인해 주세요.`,
        );
      }
      return {
        deviceKey: sample.deviceKey,
        name: sample.name,
        zone: sample.zone,
        rssi: sample.rssi,
        timestamp: sample.timestamp,
        ...(parsed.schema === "examguard.radio.v2" &&
        sample.advertisement !== undefined
          ? { advertisement: parseAdvertisement(sample.advertisement) }
          : {}),
      };
    },
  );
  if (
    new Set(samples.map((s) => s.deviceKey)).size > 100 ||
    new Set(samples.map((s) => s.zone)).size > 30
  ) {
    throw new Error(
      "한 파일에는 기기 100개, 구역 30개까지만 넣을 수 있습니다.",
    );
  }
  return {
    schema: parsed.schema as RadioCapture["schema"],
    source: parsed.source,
    isDemo: parsed.isDemo,
    samples,
  };
}
export function summarizeRadio(capture: RadioCapture): RadioSummary[] {
  const devices = new Map<string, RadioSample[]>();
  for (const sample of capture.samples) {
    const values = devices.get(sample.deviceKey) ?? [];
    values.push(sample);
    devices.set(sample.deviceKey, values);
  }
  return [...devices].map(([deviceKey, samples]) => {
    const grouped = new Map<string, number[]>();
    for (const sample of samples) {
      const values = grouped.get(sample.zone) ?? [];
      values.push(sample.rssi);
      grouped.set(sample.zone, values);
    }
    const zones = [...grouped]
      .map(([zone, values]) => ({
        zone,
        median: median(values),
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      }))
      .sort((a, b) => b.median - a.median);
    const repeated = zones.filter((z) => z.count >= 3);
    return {
      deviceKey,
      name: samples[0]!.name,
      zones,
      comparable: repeated.length >= 2,
      strongestRepeatedZone: repeated.length >= 2 ? repeated[0]!.zone : null,
    };
  });
}
export function createReport(
  preparation: Preflight,
  devices: DeviceRecord[],
  inspections: Inspection[],
  capture: RadioCapture | null,
  rules: SignatureRuleSet | null = null,
) {
  return {
    schema: "examguard.report.v1",
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    preparation: {
      phonesPoweredOff: preparation[0],
      devicesCollected: preparation[1],
      permittedEquipmentReviewed: preparation[2],
    },
    devices: devices
      .filter((d) => d.source !== "demo")
      .map((d) => ({
        ...d,
        nameAssessment: assessDeviceName(d.name),
        rssi: null,
        manufacturer: null,
        owner: null,
        locationBasis:
          "operator-entered inspection zone; not transmitter location",
      })),
    inspections: inspections.filter((i) => i.source !== "demo"),
    radioCapture: capture && !capture.isDemo ? capture : null,
    signatureAnalysis:
      capture?.schema === "examguard.radio.v2" &&
      !capture.isDemo &&
      rules &&
      !rules.isDemo
        ? {
            engine: "examguard.signature-engine.v1",
            rules,
            results: analyzeSignatures(capture, rules),
            basis:
              "User-provided rules; conjunction within one advertisement. A match is not a validated device identification or activity verdict.",
          }
        : null,
    limitations: [
      "Not a misconduct verdict or proof of absence.",
      "Device names are self-reported and do not establish device type or owner.",
      "Browser selections do not provide room-wide scanning or RSSI.",
      "Name-prefix search can omit unnamed or renamed devices. List filters never remove recorded devices from this report. Names cannot establish whether a device is inside or outside the room.",
      "Imported measurements are user-provided; RSSI cannot establish a seat or an owner.",
      "Training records are excluded. No images or browser-issued Bluetooth device IDs are included. Imported advertisement payloads may contain identifying bytes.",
      "Signature results compare user-provided advertisements and rules. Company ID alone never promotes a device candidate; Wi-Fi traffic and optical lens detection are not analyzed.",
    ],
  };
}
