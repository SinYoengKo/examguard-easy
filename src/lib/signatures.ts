export interface Advertisement {
  manufacturerData: { companyId: number; bytes: number[] }[];
  serviceUuids: string[];
}
export interface SignatureRule {
  id: string;
  label: string;
  companyId: number;
  serviceUuids: string[];
  payload: { offset: number; bytes: number[]; mask: number[] };
  evidence: { sourceUrl: string; model: string; notes: string };
}
export interface SignatureRuleSet {
  schema: "examguard.signatures.v1";
  source: string;
  isDemo: boolean;
  rules: SignatureRule[];
}
export type SignatureStatus =
  | "matched"
  | "ambiguous"
  | "company-only"
  | "unmatched"
  | "no-data"
  | "no-rules"
  | "demo-blocked";
export interface SignatureResult {
  deviceKey: string;
  name: string;
  status: SignatureStatus;
  observedCompanyIds: number[];
  matches: {
    ruleId: string;
    label: string;
    packetCount: number;
    firstMatchedAt: string;
    evidence: SignatureRule["evidence"];
  }[];
}
export const SIGNATURE_STATUS: Record<SignatureStatus, string> = {
  matched: "복합 규칙 일치 후보",
  ambiguous: "여러 기종 규칙 일치 · 구분 필요",
  "company-only": "회사 ID 일치 · 복합 조건 부족",
  unmatched: "등록 규칙과 불일치",
  "no-data": "광고 원자료 없음",
  "no-rules": "대조할 규칙 없음",
  "demo-blocked": "연습 규칙 · 현장 자료에 적용 안 함",
};
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const shortString = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const companyId = (v: unknown): v is number =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 65535;
function bytes(value: unknown, max: number, allowEmpty = false): number[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && !value.length) ||
    value.length > max ||
    value.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
  )
    throw new Error("바이트 배열은 0~255 정수로 작성해 주세요.");
  return [...value] as number[];
}
export function normalizeUuid(value: unknown): string {
  if (typeof value !== "string") throw new Error("UUID는 문자열이어야 합니다.");
  const v = value.toLowerCase();
  if (/^[a-f0-9]{4}$/.test(v)) return `0000${v}-0000-1000-8000-00805f9b34fb`;
  if (/^[a-f0-9]{8}$/.test(v)) return `${v}-0000-1000-8000-00805f9b34fb`;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v))
    return v;
  throw new Error(
    "UUID는 4자리·8자리 16진수 또는 하이픈이 있는 128비트 형식이어야 합니다.",
  );
}
export function parseAdvertisement(value: unknown): Advertisement {
  if (
    !object(value) ||
    !Array.isArray(value.manufacturerData) ||
    value.manufacturerData.length > 8 ||
    !Array.isArray(value.serviceUuids) ||
    value.serviceUuids.length > 32
  )
    throw new Error(
      "광고 데이터에 manufacturerData(최대 8개)와 serviceUuids(최대 32개)가 필요합니다.",
    );
  const manufacturerData = value.manufacturerData.map((entry) => {
    if (!object(entry) || !companyId(entry.companyId))
      throw new Error("회사 ID는 0~65535 정수여야 합니다.");
    return { companyId: entry.companyId, bytes: bytes(entry.bytes, 512, true) };
  });
  return {
    manufacturerData,
    serviceUuids: [...new Set(value.serviceUuids.map(normalizeUuid))],
  };
}
export function parseSignatureRules(raw: string): SignatureRuleSet {
  if (raw.length > 256_000)
    throw new Error("규칙 파일은 256 KB 이하로 선택해 주세요.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("올바른 규칙 JSON 파일이 아닙니다.");
  }
  if (
    !object(value) ||
    value.schema !== "examguard.signatures.v1" ||
    !shortString(value.source, 160) ||
    typeof value.isDemo !== "boolean" ||
    !Array.isArray(value.rules) ||
    !value.rules.length ||
    value.rules.length > 64
  )
    throw new Error(
      "examguard.signatures.v1 형식, source, isDemo와 1~64개 rules가 필요합니다.",
    );
  const rules = value.rules.map((r: unknown): SignatureRule => {
    if (
      !object(r) ||
      !shortString(r.id, 80) ||
      !shortString(r.label, 120) ||
      !companyId(r.companyId) ||
      !Array.isArray(r.serviceUuids) ||
      !r.serviceUuids.length ||
      r.serviceUuids.length > 16 ||
      !object(r.payload) ||
      !Number.isInteger(r.payload.offset) ||
      Number(r.payload.offset) < 0 ||
      Number(r.payload.offset) > 511 ||
      !object(r.evidence) ||
      !shortString(r.evidence.sourceUrl, 500) ||
      !shortString(r.evidence.model, 120) ||
      !shortString(r.evidence.notes, 1000)
    )
      throw new Error(
        "모든 규칙에 회사 ID·UUID·바이트 패턴과 모델·출처·검증 메모가 필요합니다.",
      );
    let url: URL;
    try {
      url = new URL(r.evidence.sourceUrl);
    } catch {
      throw new Error("규칙 근거는 유효한 HTTPS 주소로 작성해 주세요.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("규칙 근거는 인증 정보 없는 HTTPS 주소여야 합니다.");
    const pattern = bytes(r.payload.bytes, 64);
    const mask =
      r.payload.mask === undefined
        ? pattern.map(() => 255)
        : bytes(r.payload.mask, 64);
    if (
      mask.length !== pattern.length ||
      mask.every((v) => v === 0) ||
      Number(r.payload.offset) + pattern.length > 512
    )
      throw new Error("마스크 길이·유효 비트·페이로드 오프셋을 확인해 주세요.");
    return {
      id: r.id,
      label: r.label,
      companyId: r.companyId,
      serviceUuids: [...new Set(r.serviceUuids.map(normalizeUuid))],
      payload: { offset: Number(r.payload.offset), bytes: pattern, mask },
      evidence: {
        sourceUrl: url.href,
        model: r.evidence.model,
        notes: r.evidence.notes,
      },
    };
  });
  if (new Set(rules.map((r) => r.id)).size !== rules.length)
    throw new Error("규칙 ID가 중복되었습니다.");
  return {
    schema: "examguard.signatures.v1",
    source: value.source,
    isDemo: value.isDemo,
    rules,
  };
}
/** Match within ONE advertisement and ONE manufacturer entry. Never union evidence across packets. */
export function matchesRule(ad: Advertisement, rule: SignatureRule): boolean {
  if (!rule.serviceUuids.every((uuid) => ad.serviceUuids.includes(uuid)))
    return false;
  const { offset, bytes: pattern, mask } = rule.payload;
  return ad.manufacturerData.some(
    (entry) =>
      entry.companyId === rule.companyId &&
      entry.bytes.length >= offset + pattern.length &&
      pattern.every(
        (value, i) =>
          (entry.bytes[offset + i]! & mask[i]!) === (value & mask[i]!),
      ),
  );
}
type Sample = {
  deviceKey: string;
  name: string;
  timestamp: string;
  advertisement?: Advertisement;
};
export function analyzeSignatures(
  capture: { isDemo: boolean; samples: Sample[] },
  rules: SignatureRuleSet | null,
): SignatureResult[] {
  const grouped = new Map<string, Sample[]>();
  for (const sample of capture.samples) {
    const list = grouped.get(sample.deviceKey) ?? [];
    list.push(sample);
    grouped.set(sample.deviceKey, list);
  }
  return [...grouped].map(([deviceKey, samples]) => {
    const ads = samples.filter(
      (s) =>
        s.advertisement &&
        (s.advertisement.manufacturerData.length ||
          s.advertisement.serviceUuids.length),
    );
    const observedCompanyIds = [
      ...new Set(
        ads.flatMap((s) =>
          s.advertisement!.manufacturerData.map((m) => m.companyId),
        ),
      ),
    ];
    const result: SignatureResult = {
      deviceKey,
      name: samples[0]!.name,
      status: "no-data",
      observedCompanyIds,
      matches: [],
    };
    if (!ads.length) return result;
    if (!rules) {
      result.status = "no-rules";
      return result;
    }
    if (rules.isDemo && !capture.isDemo) {
      result.status = "demo-blocked";
      return result;
    }
    for (const rule of rules.rules) {
      const hits = ads.filter((s) => matchesRule(s.advertisement!, rule));
      if (hits.length)
        result.matches.push({
          ruleId: rule.id,
          label: rule.label,
          packetCount: hits.length,
          firstMatchedAt: hits.reduce((first, item) =>
            Date.parse(first.timestamp) <= Date.parse(item.timestamp)
              ? first
              : item,
          ).timestamp,
          evidence: { ...rule.evidence },
        });
    }
    const labels = new Set(result.matches.map((m) => m.label));
    result.status =
      labels.size > 1
        ? "ambiguous"
        : labels.size === 1
          ? "matched"
          : rules.rules.some((r) => observedCompanyIds.includes(r.companyId))
            ? "company-only"
            : "unmatched";
    return result;
  });
}
