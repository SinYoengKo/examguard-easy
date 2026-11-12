export type DeviceHintKind =
  "glasses-candidate" | "other-device-hint" | "unknown";
export interface DeviceHint {
  kind: DeviceHintKind;
  label: string;
  basis: "advertised-name-only";
  reason: string;
  guideIds: string[];
  requiresPhysicalCheck: true;
}
export type DeviceListFilter = "review" | "all" | "resolved" | DeviceHintKind;

/** Presentation only. A separated record remains in the report and can be restored. */
export function matchesDeviceListFilter(
  device: {
    name: string;
    disposition: "unreviewed" | "allowed" | "followup" | "checked";
  },
  filter: DeviceListFilter,
): boolean {
  if (filter === "all") return true;
  const resolved =
    device.disposition === "allowed" || device.disposition === "checked";
  if (filter === "resolved") return resolved;
  if (filter === "glasses-candidate")
    return (
      !resolved && assessDeviceName(device.name).kind === "glasses-candidate"
    );
  if (filter === "review")
    return (
      !resolved &&
      (device.disposition === "followup" ||
        assessDeviceName(device.name).kind !== "other-device-hint")
    );
  return assessDeviceName(device.name).kind === filter;
}

// Name hints are intentionally separate from validated advertisement signatures.
// A brand name alone (Meta, Xiaomi, Samsung, etc.) never establishes device type.
const glassesNames = [
  {
    pattern: /\bray[\s-]?ban\b|\bmeta\s+(?:wayfarer|headliner|skyler)\b/i,
    name: "Ray-Ban 계열 이름",
    guide: "meta",
  },
  {
    pattern: /\beven\s+(?:realities\s+)?g[12]\b/i,
    name: "Even G 계열 이름",
    guide: "even",
  },
  {
    pattern: /\bxreal\s+(?:air|one)\b/i,
    name: "XREAL 안경 제품명",
    guide: "xreal",
  },
  {
    pattern: /\bhuawei\s+eyewear\b/i,
    name: "HUAWEI Eyewear 이름",
    guide: "huawei",
  },
  {
    pattern: /\bmijia\s+(?:smart\s+)?audio\s+glasses\b/i,
    name: "Mijia 오디오 안경 이름",
    guide: "mijia",
  },
  {
    pattern: /\brokid\b/i,
    name: "Rokid 계열 이름",
    guide: "rokid",
  },
  {
    pattern: /\b(?:smart|ai)\s*glasses\b|스마트\s*안경|\bheycyan\b|^glasses\b/i,
    name: "스마트안경 관련 명칭",
    guide: null,
  },
];
const otherNames = [
  {
    pattern: /\b(?:meta\s+)?quest\s*[1-9]\b|\boculus\b/i,
    name: "VR 헤드셋 관련 이름",
  },
  {
    pattern:
      /\bairpods\b|\bgalaxy\s*buds(?:\s*\d+)?\b|\b(?:earbuds|headphones)\b/i,
    name: "이어폰·헤드폰 관련 이름",
  },
  {
    pattern: /\biphone\b|\bgalaxy\s*[saz]\s*\d+\b|\bpixel\s*\d+\b/i,
    name: "휴대전화 관련 이름",
  },
  { pattern: /\bmacbook\b|\bthinkpad\b/i, name: "노트북 관련 이름" },
  { pattern: /\b(?:apple|galaxy)\s*watch\b/i, name: "스마트워치 관련 이름" },
  {
    pattern:
      /\b(?:router|access\s*point|iptime|tp[\s-]?link|netgear)\b|공유기/i,
    name: "공유기·네트워크 장비 관련 이름",
  },
  {
    pattern: /\b(?:printer|laserjet|officejet|deskjet)\b|프린터/i,
    name: "프린터 관련 이름",
  },
  {
    pattern: /\b(?:smart\s*tv|samsung\s*tv|lg\s*(?:webos\s*)?tv|bravia)\b/i,
    name: "TV 관련 이름",
  },
  {
    pattern: /\b(?:speaker|soundbar)\b|스피커|사운드바/i,
    name: "스피커 관련 이름",
  },
];

export function assessDeviceName(input: string): DeviceHint {
  const name = input
    .normalize("NFKC")
    .replace(/[_\u2010-\u2015]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const glasses = glassesNames.filter((rule) => rule.pattern.test(name));
  const other = otherNames.filter((rule) => rule.pattern.test(name));
  const base = {
    basis: "advertised-name-only" as const,
    requiresPhysicalCheck: true as const,
  };
  if (glasses.length && !other.length)
    return {
      ...base,
      kind: "glasses-candidate",
      label: "스마트안경 의심 후보",
      reason: `${glasses.map((r) => r.name).join(" · ")}와 일치합니다. 이름 단서이며 실물·광고 원자료 확인이 필요합니다.`,
      guideIds: [
        ...new Set(glasses.flatMap((r) => (r.guide ? [r.guide] : []))),
      ],
    };
  if (other.length && !glasses.length)
    return {
      ...base,
      kind: "other-device-hint",
      label: "다른 전자기기 이름 단서",
      reason: `${other.map((r) => r.name).join(" · ")}입니다. 스마트안경이 아니라는 확정이나 반입 허용 판정은 아닙니다.`,
      guideIds: [],
    };
  return {
    ...base,
    kind: "unknown",
    label: "종류 미확인",
    reason:
      glasses.length && other.length
        ? "이름에 서로 다른 기기 종류의 단서가 함께 있습니다. 실물을 확인하세요."
        : "등록한 안경 제품명과 일치하는 단서가 없습니다. 회사명·일반 이름만으로 기종을 판별할 수 없습니다.",
    guideIds: [],
  };
}
