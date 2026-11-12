// 쉬운 화면 전용 도우미: 신호등 카드 문구, 엑셀용 CSV, 자동 저장.
// 화면(DOM)을 건드리지 않는 순수 함수만 둡니다. → tests/easy.test.ts 로 검증.
import { DISPOSITIONS, ZONES } from "./core.ts";
import type { DeviceRecord, Inspection, Preflight } from "./core.ts";
import { assessDeviceName } from "./device-hints.ts";

/** 점검 전 준비 3가지 (화면·기록지·CSV 공통 문구) */
export const PREP_LABELS = [
  "휴대전화 전원 끄기",
  "전자기기 걷기",
  "허용 장비 확인",
] as const;

export type Light = "red" | "yellow" | "gray" | "green";
export interface EasyCard {
  light: Light;
  title: string;
  action: string;
}

/** 기기 한 대를 "신호등 색 + 한 줄 설명 + 다음에 할 일"로 바꿉니다. */
/** 기록지·CSV의 "판단 단서" 칸에 적는 말 */
export function hintLabel(
  device: Pick<DeviceRecord, "name" | "signal">,
): string {
  const byName = assessDeviceName(device.name);
  return device.signal && byName.kind !== "glasses-candidate"
    ? "제조사·서비스 번호 단서 (이름은 다름)"
    : byName.label;
}

export function easyCard(
  device: Pick<DeviceRecord, "name" | "disposition" | "signal">,
): EasyCard {
  if (device.disposition === "allowed")
    return {
      light: "green",
      title: "허용 장비로 확인했어요",
      action: "더 할 일이 없어요.",
    };
  if (device.disposition === "checked")
    return {
      light: "green",
      title: "실물 확인을 마쳤어요",
      action: "확인한 내용은 기록지에 남아요.",
    };
  const kind = assessDeviceName(device.name).kind;
  if (device.signal && kind !== "glasses-candidate")
    return {
      light: "red",
      title: "안경 제조사 신호와 같아요",
      action:
        "이름은 다르지만 Meta·Luxottica·Snap 등의 번호가 잡혔어요. 같은 회사의 다른 제품일 수도 있으니 실물을 확인하세요.",
    };
  if (kind === "glasses-candidate")
    return {
      light: "red",
      title: "스마트안경일 수 있어요",
      action: "기관 절차에 따라 안경을 교탁에 놓게 하고, 3단계에서 살펴보세요.",
    };
  if (kind === "other-device-hint")
    return {
      light: "gray",
      title: "안경이 아닌 전자기기 이름이에요",
      action: "걷지 못한 기기일 수 있어요. 전원과 수거 여부를 확인하세요.",
    };
  return {
    light: "yellow",
    title: "어떤 기기인지 알 수 없어요",
    action: "감독 장비인지 먼저 확인하고, 아니면 주변을 살펴보세요.",
  };
}

export interface SheetMeta {
  exam: string;
  room: string;
  proctor: string;
}
export const emptyMeta = (): SheetMeta => ({ exam: "", room: "", proctor: "" });

/** 엑셀이 수식으로 오해하지 않게 막고, 쉼표·따옴표·줄바꿈을 감쌉니다. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { hour12: false });

/**
 * 엑셀용 CSV. 맨 앞에 UTF-8 BOM을 붙여 한글이 깨지지 않게 합니다.
 * includeDemo=false(기본)면 연습·시연 기록은 뺍니다.
 */
export function toCsv(
  meta: SheetMeta,
  preflight: Preflight,
  devices: DeviceRecord[],
  inspections: Inspection[],
  includeDemo = false,
): string {
  const rows: string[][] = [
    [
      "구분",
      "기록 시각",
      "이름·내용",
      "판단 단서",
      "확인 구역",
      "확인 상태",
      "시험명",
      "시험실",
      "감독위원",
      "비고",
    ],
  ];
  const tail = [meta.exam, meta.room, meta.proctor];
  PREP_LABELS.forEach((label, i) =>
    rows.push([
      "준비",
      "",
      label,
      "",
      "",
      preflight[i] ? "확인" : "미확인",
      ...tail,
      "",
    ]),
  );
  for (const d of devices) {
    if (d.source === "demo" && !includeDemo) continue;
    rows.push([
      "기기",
      stamp(d.lastSelectedAt),
      d.name,
      hintLabel(d),
      d.zone,
      DISPOSITIONS[d.disposition],
      ...tail,
      d.source === "demo"
        ? "연습·시연용 예시"
        : "기기가 스스로 알린 이름 (소유자 정보 아님)",
    ]);
  }
  for (const i of inspections) {
    if (i.source === "demo" && !includeDemo) continue;
    rows.push([
      "안경 관찰",
      stamp(i.createdAt),
      i.observations.join(" / ") || "관찰 항목 없음 (정상 판정 아님)",
      "",
      i.zone,
      "",
      ...tail,
      i.source === "demo"
        ? "연습·시연용 예시"
        : i.source === "camera"
          ? "카메라로 관찰"
          : "사진으로 관찰",
    ]);
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// ───────── 자동 저장 (이 기기의 브라우저 저장소에만 보관) ─────────
export const STORAGE_KEY = "examguard-easy.session.v1";
export interface SavedSession {
  v: 1;
  preflight: Preflight;
  devices: DeviceRecord[];
  inspections: Inspection[];
  deviceKeys: [string, string][];
  meta: SheetMeta;
  step: number;
}
const str = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 저장된 내용을 엄격히 검사해 되살립니다. 하나라도 이상하면 null (새로 시작). */
export function parseSaved(raw: string | null): SavedSession | null {
  if (!raw || raw.length > 500_000) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!obj(s) || s.v !== 1) return null;
    const pf = s.preflight;
    if (
      !Array.isArray(pf) ||
      pf.length !== 3 ||
      pf.some((x) => typeof x !== "boolean")
    )
      return null;
    if (
      !Array.isArray(s.devices) ||
      !Array.isArray(s.inspections) ||
      !Array.isArray(s.deviceKeys)
    )
      return null;
    if (s.devices.length > 500 || s.inspections.length > 500) return null;
    const zoneOk = (z: unknown) => ZONES.includes(z as never);
    const devices = s.devices.map((d): DeviceRecord => {
      if (
        !obj(d) ||
        !str(d.id, 64) ||
        !str(d.name, 120) ||
        !["browser-selection", "demo"].includes(d.source as string) ||
        !str(d.selectedAt, 40) ||
        !str(d.lastSelectedAt, 40) ||
        typeof d.selections !== "number" ||
        !zoneOk(d.zone) ||
        !(String(d.disposition) in DISPOSITIONS) ||
        !Array.isArray(d.preparation) ||
        d.preparation.length !== 3
      )
        throw new Error("bad device");
      return {
        id: d.id,
        name: d.name,
        source: d.source as DeviceRecord["source"],
        selectedAt: d.selectedAt,
        lastSelectedAt: d.lastSelectedAt,
        selections: d.selections,
        zone: d.zone as DeviceRecord["zone"],
        disposition: d.disposition as DeviceRecord["disposition"],
        preparation: d.preparation.map(Boolean) as Preflight,
        ...(d.signal === true ? { signal: true } : {}),
      };
    });
    const inspections = s.inspections.map((i): Inspection => {
      if (
        !obj(i) ||
        !str(i.id, 64) ||
        !str(i.createdAt, 40) ||
        !zoneOk(i.zone) ||
        !["camera", "image", "demo"].includes(i.source as string) ||
        !Array.isArray(i.observations) ||
        i.observations.some((o) => !str(o, 200))
      )
        throw new Error("bad inspection");
      return {
        id: i.id,
        source: i.source as Inspection["source"],
        createdAt: i.createdAt,
        zone: i.zone as Inspection["zone"],
        observations: i.observations as string[],
      };
    });
    const deviceKeys = s.deviceKeys.map((k): [string, string] => {
      if (!Array.isArray(k) || !str(k[0], 200) || !str(k[1], 64))
        throw new Error("bad key");
      return [k[0], k[1]];
    });
    const m = obj(s.meta) ? s.meta : {};
    const meta: SheetMeta = {
      exam: str(m.exam, 60) ? m.exam : "",
      room: str(m.room, 60) ? m.room : "",
      proctor: str(m.proctor, 60) ? m.proctor : "",
    };
    const step = [1, 2, 3, 4].includes(s.step as number)
      ? (s.step as number)
      : 1;
    return {
      v: 1,
      preflight: pf as Preflight,
      devices,
      inspections,
      deviceKeys,
      meta,
      step,
    };
  } catch {
    return null;
  }
}
