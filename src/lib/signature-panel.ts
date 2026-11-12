import { escapeHtml as esc } from "./core";
import type { RadioCapture } from "./core";
import { analyzeSignatures, SIGNATURE_STATUS } from "./signatures";
import type { SignatureRuleSet } from "./signatures";

export function renderSignatureResults(
  capture: RadioCapture | null,
  rules: SignatureRuleSet | null,
): string {
  if (!capture)
    return '<p class="signature-empty">제조사 데이터와 UUID가 포함된 v2 측정 파일을 열면 복합 규칙과 대조합니다. 기본 브라우저 선택 기록에는 이 원자료가 없습니다.</p>';
  if (capture.schema === "examguard.radio.v1")
    return '<p class="signature-empty">이 파일은 RSSI 전용 v1 형식입니다. 바이트 패턴 대조에는 광고 원자료를 포함한 v2 파일이 필요합니다.</p>';
  const results = analyzeSignatures(capture, rules);
  return `<p class="signature-note">${capture.isDemo ? "연습 데이터 · 가상의 회사·패턴입니다. 실제 스마트안경 규칙이 아닙니다." : "사용자 제공 자료·규칙 대조 · 규칙의 출처와 실제 기기 검증 여부를 확인하세요."} 같은 광고 안에서 회사 ID·UUID·바이트 조건을 모두 확인합니다.</p><div class="signature-grid">${results.map((result) => `<article class="signature-card ${result.status}"><span class="badge">${SIGNATURE_STATUS[result.status]}</span><h3>${esc(result.name)}</h3><p>관측 회사 ID: ${result.observedCompanyIds.length ? result.observedCompanyIds.map((id) => `0x${id.toString(16).padStart(4, "0").toUpperCase()}`).join(", ") : "없음"}</p>${result.matches.length ? result.matches.map((match) => `<div class="signature-match"><strong>${esc(match.label)}</strong><span>회사 ID + UUID + 바이트 패턴 일치 · ${match.packetCount}개 관측값</span><small>규칙 ${esc(match.ruleId)} · ${esc(match.evidence.model)}</small><p>${esc(match.evidence.notes)}</p><a href="${esc(match.evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">규칙 근거 확인 ↗</a></div>`).join("") : `<p class="signature-reason">${result.status === "company-only" ? "같은 회사의 다른 제품일 수 있습니다. 복합 조건이 충족되지 않아 기종 후보로 올리지 않았습니다." : result.status === "demo-blocked" ? "연습 규칙으로 현장 기기를 분류하지 않습니다. 실제 검토한 규칙 파일을 선택하세요." : result.status === "no-rules" ? "회사 ID 단독으로 스마트안경을 분류하지 않습니다. 근거를 갖춘 규칙 파일을 추가하세요." : result.status === "no-data" ? "이 측정값에는 광고 원자료가 없습니다." : "규칙 불일치는 기기가 없거나 일반 안경이라는 뜻이 아닙니다."}</p>`}<small class="signature-limit">기종 확정·소유자·촬영/인터넷 사용 여부를 판정하지 않습니다.</small></article>`).join("")}</div>`;
}
