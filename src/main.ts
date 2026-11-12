import "./styles.css";
import "./photo.css";
import "./modes.css";
import "./colors.css";
import "./browser-support.css";
import "./easy.css";
import { icon } from "./lib/icons";
import {
  createReport,
  DISPOSITIONS,
  escapeHtml as esc,
  parseRadioCapture,
  summarizeRadio,
  ZONES,
} from "./lib/core";
import type {
  DeviceRecord,
  Disposition,
  Inspection,
  Preflight,
  RadioCapture,
  Zone,
} from "./lib/core";
import { OpticalEngine } from "./lib/optical";
import { PhotoSearch } from "./lib/photo-search";
import type { OpticalState } from "./lib/optical";
import { FILTER_LABELS } from "./lib/filters";
import type { Filter } from "./lib/filters";
import { guides, observationLabels } from "./data/guides";
import { parseSignatureRules } from "./lib/signatures";
import type { SignatureRuleSet } from "./lib/signatures";
import { renderSignatureResults } from "./lib/signature-panel";
import { assessDeviceName, matchesDeviceListFilter } from "./lib/device-hints";
import type { DeviceListFilter } from "./lib/device-hints";
import { buildBluetoothRequest } from "./lib/bluetooth-scan";
import { buildSignalRequest, matchesGlassesName } from "./lib/glasses-signals";
import type { BluetoothRequestOptions, ScanScope } from "./lib/bluetooth-scan";
import { getBrowserSupport } from "./lib/browser-support";
import {
  easyCard,
  emptyMeta,
  hintLabel,
  parseSaved,
  PREP_LABELS,
  STORAGE_KEY,
  toCsv,
} from "./lib/easy";

type Page = "wireless" | "optical" | "guide" | "zones" | "records";
type BrowserDevice = { id: string; name?: string };
type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice(
      options: BluetoothRequestOptions | ReturnType<typeof buildSignalRequest>,
    ): Promise<BrowserDevice>;
  };
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [
  ...document.querySelectorAll<T>(selector),
];
const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
// 원본 프로젝트(문서 링크용)와, 지금 열려 있는 이 앱의 주소
const repository = "https://github.com/epoko77-ai/examguard";
const publicAppUrl = `${location.origin}${location.pathname}`;
const bluetooth = (navigator as BluetoothNavigator).bluetooth;
const browserSupport = getBrowserSupport({
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  secureContext: window.isSecureContext,
  hasBluetoothChooser: typeof bluetooth?.requestDevice === "function",
});
const bluetoothSupported = browserSupport.supported;
const nav: {
  page: Page;
  icon: string;
  title: string;
  menu?: string;
  mode?: string;
  subtitle: string;
}[] = [
  {
    page: "wireless",
    icon: "radio",
    title: "교실 전파 탐색",
    mode: "A",
    subtitle:
      "전원 종료·수거 후 남아 있는 BLE 기기를 먼저 확인하고, 실물 점검으로 연결하세요.",
  },
  {
    page: "optical",
    icon: "camera",
    title: "교탁 위 정밀 광학 판독",
    menu: "교탁 위 광학 판독",
    mode: "B",
    subtitle:
      "교탁 위에 놓인 안경의 카메라·충전부·렌즈 구조를 확대해 직접 살펴보세요.",
  },
  {
    page: "guide",
    icon: "book",
    title: "3초 실물 도감",
    mode: "C",
    subtitle:
      "발견한 안경의 기종 후보를 좁히고, 공식 자료와 부품 위치를 실물에 대조하세요.",
  },
  {
    page: "zones",
    icon: "map",
    title: "구역별 신호 비교",
    subtitle: "외부 수신기로 반복 측정한 신호 세기를 구역별로 비교하세요.",
  },
  {
    page: "records",
    icon: "clipboard",
    title: "점검 기록",
    subtitle: "관찰한 사실과 확인 상태를 정리해 다음 점검으로 연결하세요.",
  },
];
const zoneOptions = (selected: string = "미지정") =>
  ZONES.map(
    (zone) => `<option ${zone === selected ? "selected" : ""}>${zone}</option>`,
  ).join("");
const preflight: Preflight = [false, false, false];
let currentPage: Page = "wireless";
let mode: "live" | "demo" = "live";
let devices: DeviceRecord[] = [];
let inspections: Inspection[] = [];
let radioCapture: RadioCapture | null = null;
let signatureRules: SignatureRuleSet | null = null;
let deviceHintFilter: DeviceListFilter = "glasses-candidate";
let scanScope: ScanScope = "glasses";
let pendingBluetooth = false;
let sessionGeneration = 0;
let cameraState: OpticalState = {
  source: "demo",
  pending: false,
  frozen: false,
  torch: false,
  torchAvailable: false,
  message: "",
};
const deviceKeys = new Map<string, string>();
let offlineReady = false;
let guideCategory = "all";
let toastTimer: ReturnType<typeof setTimeout>;
// ───── 쉬운 화면 상태 ─────
// 주소 뒤에 ?ui=pro 를 붙이면 전문가 화면, ?demo=1 을 붙이면 시연으로 바로 시작합니다.
const UI_KEY = "examguard-easy.ui";
const params = new URLSearchParams(location.search);
const readStore = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장소를 쓸 수 없는 환경(비공개 창 등)에서는 저장 없이 동작 */
  }
};
let uiMode: "easy" | "pro" =
  params.get("ui") === "pro" ||
  (params.get("ui") !== "easy" && readStore(UI_KEY) === "pro")
    ? "pro"
    : "easy";
let easyStep = 1;
let easyNotice = "";
let meta = emptyMeta();
const EASY_STEPS = ["준비", "기기 찾기", "안경 보기", "기록"];
const menuButton = (item: (typeof nav)[number]) =>
  `<button class="nav-item ${item.page === "wireless" ? "active" : ""}" data-page="${item.page}" ${item.page === "wireless" ? 'aria-current="page"' : ""}>${icon(item.icon)}<span>${item.mode ? `<small class="nav-mode">${item.mode}</small>` : ""}${item.menu ?? item.title}</span>${item.page === "records" ? '<span id="nav-record-count" class="nav-count">0</span>' : ""}</button>`;

$("#app").innerHTML = `
  <aside class="sidebar">
    <a href="#wireless" class="brand" aria-label="ExamGuard 홈"><span class="brand-symbol">${icon("shield")}</span><span>Exam<span class="mint">Guard</span><small>시험의 공정함을 지키는 도구</small></span></a>
    <div class="workspace-label"><span class="status-dot"></span> INSPECTION WORKSPACE</div>
    <nav class="primary-nav" aria-label="세 가지 점검 모드">${nav.slice(0, 3).map(menuButton).join("")}</nav>
    <div class="aux-nav-label">측정·기록 보조 도구</div><nav class="aux-nav" aria-label="측정과 기록">${nav.slice(3).map(menuButton).join("")}</nav>
    <div class="sidebar-bottom">
      <div class="local-card">${icon("lock")}<strong>이 기기 안에서만</strong><p>영상과 점검 기록을<br>서버로 전송하지 않습니다.</p><span>LOCAL PROCESSING</span></div>
      <button class="sidebar-link" id="help-button">${icon("info")} 사용 가이드 ${icon("arrow")}</button>
      <button class="sidebar-link" data-browser-help>${icon("phone")} 기기별 접속 안내 ${icon("arrow")}</button>
      <a class="sidebar-link" href="${repository}" target="_blank" rel="noopener noreferrer">${icon("github")} 오픈소스 프로젝트 ${icon("external")}</a>
      <div class="sidebar-version">v0.1.0 <span>MIT LICENSE</span></div>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumb easy-only">스마트안경 점검 도우미</div><div class="breadcrumb pro-only">감독관 도구 <span>/</span> <strong id="breadcrumb-current">무선 기기 확인</strong></div><div class="topbar-right"><span class="connection" id="connection-status"><span class="status-dot"></span> 연결 상태 확인 중</span><button class="button small ghost easy-only" id="easy-help">${icon("info")}<span>도움말</span></button><button class="button small ghost" id="ui-toggle"></button><button class="button small ghost" id="install-button">${icon("download")}<span>홈 화면에 추가</span></button></div></header>
    <main id="main" tabindex="-1">
      <div class="easy-demo-bar easy-only" id="easy-demo-bar" hidden><span>시연 중 · 가상 예시예요</span><button id="easy-demo-end">시연 끝내기</button></div>
      <nav class="easy-steps easy-only" aria-label="점검 단계">${EASY_STEPS.map((label, i) => `<button data-easy-step="${i + 1}"><b>${i + 1}</b><span>${label}</span></button>`).join("")}</nav>
      <div class="page-heading"><div><div class="eyebrow">A CLEARER VIEW. A FAIRER EXAM.</div><h1 id="page-title">교실 전파 탐색</h1><p id="page-subtitle">${nav[0]!.subtitle}</p></div><button class="button secondary small" id="reset-button">${icon("reset")} 새 점검</button></div>

      <div class="easy-tabs easy-only" id="easy-tabs"><button data-page="optical">카메라로 살펴보기</button><button data-page="guide">도감과 비교하기</button></div>

      <section id="page-wireless" class="page-section" aria-label="무선 기기 확인">
        <article class="panel easy-panel easy-start easy-only" id="easy-start"><h2>처음이신가요?</h2><p>블루투스나 안경이 없어도, 가상 예시로 끝까지 눌러볼 수 있어요. (약 1분)</p><button class="button secondary easy-big" id="easy-demo-start">시연으로 둘러보기</button></article>
        <aside class="browser-support" id="browser-support" data-supported="${bluetoothSupported}" aria-labelledby="browser-support-title">
          <div class="eyebrow">접속 안내 · 웹 주소로 사용</div>
          <h2 id="browser-support-title">${esc(browserSupport.title)}</h2>
          <p>${esc(browserSupport.description)}</p>
          ${browserSupport.steps.length ? `<ol>${browserSupport.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}
          <div class="button-row">${browserSupport.platform === "ios" && !bluetoothSupported ? `<a class="button secondary small" id="bluefy-install" href="https://apps.apple.com/kr/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener noreferrer">Bluefy 설치 (App Store) ${icon("external")}</a>` : ""}${!bluetoothSupported ? `<button class="button secondary small" data-page="optical">${icon("camera")} B · 광학 검사</button><button class="button secondary small" data-page="guide">${icon("book")} C · 도감·사진 대조</button>` : ""}<button class="button secondary small" id="browser-help" data-browser-help>기기별 여는 방법 ${icon("arrow")}</button><button class="button secondary small" id="copy-app-url">${icon("clipboard")} 앱 주소 복사</button></div>
          <details id="app-address-details"><summary>앱 주소 보기·직접 복사</summary><label class="app-address">지원 브라우저의 주소창에 붙여넣으세요<input id="app-address" type="text" readonly value="${publicAppUrl}" spellcheck="false" autocapitalize="off"/></label><a class="text-button" href="${publicAppUrl}" target="_blank" rel="noopener noreferrer">공식 앱 새 탭에서 열기 ${icon("external")}</a></details>
          <p id="browser-copy-message" role="status"></p>
        </aside>
        <div class="preflight-panel"><div class="section-heading"><h2>${icon("shield")} 점검 전 준비</h2><span class="subtle" id="preflight-count">0 / 3 완료</span></div>
          <div class="preflight-grid">${[
            ["phone", "휴대전화 전원 종료", "잠금·무음 상태와 구분해 확인"],
            ["box", "전자기기 수거 완료", "시험 주관기관의 수거 절차에 따라"],
            ["shield", "허용 장비 확인", "감독 장비·보조기기·주변 신호 구분"],
          ]
            .map(
              ([symbol, title, sub], i) =>
                `<button class="preflight-item" data-preflight="${i}" aria-pressed="false"><span class="step-icon">${icon(symbol!)}</span><span><strong>${title}</strong><small>${sub}</small></span><span class="check-circle">${icon("check")}</span></button>`,
            )
            .join("")}</div>
        </div>
        <section id="easy-scan" class="easy-only">
          <article class="panel easy-panel"><h2>이렇게 찾아요</h2>
            <ol class="easy-how"><li>아래 버튼을 누르면 <strong>기기 목록 창</strong>이 떠요.</li><li>확인할 기기를 <strong>하나 골라 ‘페어링’</strong>을 누르세요.</li><li>고른 기기가 아래에 <strong>카드</strong>로 기록돼요.</li></ol>
            <p class="easy-note">‘안경 종류만 찾기’는 <strong>이름</strong>과 <strong>제조사 번호</strong>를 함께 봐요. 이름을 바꿔도 제조사 번호가 같으면 목록에 떠요.</p>
            <div class="easy-actions"><button class="button primary easy-big" id="easy-scan-glasses"><span>안경 종류만 찾기</span><small>먼저 이 버튼부터</small></button><button class="button secondary easy-big" id="easy-scan-all"><span>모든 기기 보기</span><small>목록이 비어 있을 때</small></button></div>
            <p id="easy-scan-message" role="status"></p>
            <p class="easy-note">앱은 기기에 접속하지 않고 이름만 기록해요. 목록이 비어 있어도 ‘전자기기가 없다’는 뜻은 아니에요.</p>
            <button class="text-button" data-browser-help>이 기기에서 안 될 때 ${icon("arrow")}</button>
          </article>
          <div id="easy-device-cards"></div>
        </section>
        <div class="work-grid"><div class="main-column">
          <article class="panel wireless-panel"><div class="panel-header"><h2>${icon("radio")} A · 교실 전파 탐색</h2><div class="segmented" role="group" aria-label="점검 모드"><button id="live-mode" class="selected" aria-pressed="true">현장 점검</button><button id="demo-mode" aria-pressed="false">연습 모드</button></div></div>
            <div class="wireless-body"><div class="radar" aria-hidden="true"><div class="radar-ring r1"></div><div class="radar-ring r2"></div><div class="radar-ring r3"></div><div class="radar-axis horizontal"></div><div class="radar-axis vertical"></div><div class="radar-wedge"></div><div class="radar-core">${icon("bluetooth")}</div><span class="radar-label">BLUETOOTH LE</span><span class="radar-tick t1">N</span><span class="radar-tick t2">E</span></div>
              <div class="wireless-copy"><div class="badge muted-badge" id="scan-status">${icon("power")} 점검 준비</div><h3 id="scan-title">먼저 전원을 끄고,<br>남아 있는 기기를 확인하세요.</h3><p id="scan-description">준비 항목을 확인한 뒤 브라우저의 기기 목록을 엽니다. 목록에서 선택한 기기만 아래에 기록됩니다.</p><div class="scan-scope"><label for="scan-scope">탐색 범위</label><select id="scan-scope" aria-describedby="scan-scope-note"><option value="glasses">안경 관련 이름 · 기본</option><option value="all">주변 BLE 전체</option></select><p id="scan-scope-note"></p></div><button class="button primary" id="scan-button">${icon("bluetooth")} Bluetooth 기기 선택 ${icon("arrow")}</button><p class="tiny" id="scan-hint"></p><p id="scan-message" class="inline-message" role="status"></p></div>
            </div>
            <div class="panel-footnote">${icon("info")} <span>기기 선택창은 브라우저가 보여줍니다. 선택한 기기만 기록하며 페어링·인터넷 사용 여부는 확인되지 않습니다.</span></div><div class="ble-help-link"><button class="text-button" id="ble-help">이 모드의 탐색 방식과 확인 범위 ${icon("arrow")}</button></div>
          </article>
          <div class="stat-grid"><div class="stat-card"><span>선택한 기기</span><strong id="device-count">00</strong><small>전체 주변 기기 수가 아닙니다</small></div><div class="stat-card"><span>추가 확인 필요</span><strong class="amber" id="followup-count">00</strong><small>감독관이 표시한 항목</small></div><div class="stat-card"><span>허용 장비로 확인</span><strong class="mint" id="allowed-count">00</strong><small>확인 후 직접 분류한 장비</small></div></div>
          <article class="panel"><div class="panel-header"><h2>기기 확인 목록 <span class="count-badge" id="list-count">0</span></h2><label class="zone-picker">현재 확인 구역 <select id="current-zone" aria-label="현재 확인 구역">${zoneOptions()}</select></label></div><div class="device-hint-controls"><label>목록에 표시할 기기 <select id="device-hint-filter" aria-label="기기 목록 필터"><option value="glasses-candidate">미확인 안경 후보 · 기본</option><option value="unknown">종류 미확인</option><option value="review">확인할 기기 · 미확인 포함</option><option value="other-device-hint">다른 전자기기 이름 단서</option><option value="resolved">허용·실물 확인 완료</option><option value="all">전체 기기</option></select></label><p id="device-hint-summary" role="status"></p><button class="text-button" id="show-all-devices" hidden>분리한 기기 포함 전체 보기</button><small>이름은 변경될 수 있습니다. 회사명만으로 안경을 판정하지 않으며, 종류 미확인은 별도로 확인하세요. 기본 목록은 허용·확인 완료를 제외한 안경 후보만 표시합니다. 숨긴 기록도 전체 목록과 보고서에 남습니다.</small></div><div id="device-list"></div><div class="list-footer"><span id="list-source">현장 점검 기록 · 이 기기에만 저장</span><button class="text-button" data-page="records">전체 기록 ${icon("arrow")}</button></div></article>
        </div><aside class="context-column">
          <article class="panel workflow-panel"><div class="section-heading"><h2>현장 점검 순서</h2><span class="badge">4 STEPS</span></div><ol class="workflow">${[
            ["전원 종료·수거", "휴대전화와 전자기기 수거를 먼저 확인합니다."],
            ["남아 있는 기기 확인", "선택한 기기와 허용 장비를 구분합니다."],
            ["구역·실물 대조", "확인 구역을 기록하고 안경 외형을 살펴봅니다."],
            ["기록·담당자 확인", "관찰한 사실을 정리해 담당자에게 전달합니다."],
          ]
            .map(
              ([title, detail], i) =>
                `<li><span class="workflow-number">${i + 1}</span><div><strong>${title}</strong><p>${detail}</p></div></li>`,
            )
            .join(
              "",
            )}</ol><button class="button secondary full" data-page="optical">${icon("camera")} 교탁 위 광학 판독 ${icon("arrow")}</button><button class="button secondary full signature-shortcut" data-page="zones">${icon("layers")} 광고 패킷 복합 필터 ${icon("arrow")}</button></article>
          <article class="panel quick-guide"><div class="section-heading"><h2>작은 단서, 꼼꼼한 확인</h2>${icon("glasses")}</div><img src="${asset("sample-camera.svg")}" alt="앞쪽 부품을 표시한 스마트안경 관찰용 도식"/><p>카메라 렌즈, 충전 접점, 스피커.<br>기종별로 살펴볼 위치를 확인하세요.</p><button class="text-button" data-page="guide">스마트안경 도감 보기 ${icon("arrow")}</button></article>
          <div class="quiet-note">${icon("lock")}<p>외부로 전송되는 영상·기록 없음<br><span>기록은 이 기기에만 저장됩니다.</span></p></div>
        </aside></div>
      </section>

      <section id="page-optical" class="page-section" aria-label="광학 검사" hidden>
        <div class="work-grid"><div class="main-column"><article class="panel camera-panel"><div class="panel-header"><h2>${icon("camera")} B · 교탁 위 정밀 광학 판독</h2><span class="badge amber-badge" id="camera-source">연습용 일러스트</span></div>
          <div class="viewfinder"><canvas id="optical-canvas" aria-label="카메라 또는 선택한 이미지의 검사 화면"></canvas><div class="viewfinder-top"><span id="filter-badge">ORIGINAL</span><span id="viewfinder-source">ILLUSTRATION · 실제 측정 아님</span></div><div class="target-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span>+</span></div><div class="viewfinder-bottom"><span>안경의 위치와 각도를 바꾸어 관찰하세요</span><span id="zoom-label">1.0×</span></div></div>
          <div class="camera-toolbar"><button class="button primary small" id="camera-button">${icon("camera")} 카메라 켜기</button><button class="button secondary small" id="image-button">${icon("upload")} 사진 열기</button><input id="image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden/><div class="toolbar-spacer"></div><button class="icon-button" id="freeze-button" aria-label="화면 정지" title="화면 정지" aria-pressed="false">${icon("pause")}</button><button class="icon-button" id="torch-button" aria-label="카메라 조명" title="카메라 연결 후 지원 여부를 확인합니다" disabled aria-pressed="false">${icon("flash")}</button></div>
          <div class="camera-find"><button class="text-button" id="camera-find-guide" disabled>${icon("search")} 이 사진으로 도감 찾기 ${icon("arrow")}</button></div><p id="camera-message" class="camera-message" role="status"></p>
        </article><div class="filter-grid" role="group" aria-label="영상 필터">${Object.entries(
          FILTER_LABELS,
        )
          .map(
            ([value, label], i) =>
              `<button class="filter-card ${i === 0 ? "selected" : ""}" data-filter="${value}" aria-pressed="${i === 0}">${icon(["crosshair", "contrast", "layers", "reset"][i]!)}<strong>${label}</strong><span>${["형태와 색상 확인", "밝은 반사 부분 강조", "부품 경계 관찰", "밝고 어두운 부분 반전"][i]}</span></button>`,
          )
          .join("")}</div>
          <div class="panel optical-settings"><label>디지털 확대 <input id="zoom-range" type="range" min="1" max="3" step="0.25" value="1"/><output id="zoom-value">1.0×</output></label><label>반사 강조 기준 <input id="threshold-range" type="range" min="150" max="250" value="215" disabled/><output id="threshold-value">215</output></label></div>
          <div class="sample-picker" id="sample-picker"><span>연습 샘플</span><button data-sample="camera" class="selected" aria-pressed="true">카메라형</button><button data-sample="display" aria-pressed="false">디스플레이형</button><button data-sample="normal" aria-pressed="false">일반 안경</button></div>
          <div class="quiet-note">${icon("info")}<p>필터는 밝기와 윤곽을 강조합니다. 렌즈·HUD 자동 검출이나 AI 판정 기능은 아닙니다.</p></div>
        </div><aside class="context-column"><article class="panel observation-panel"><div class="section-heading"><h2>직접 관찰한 특징</h2><span class="badge">수동 기록</span></div><p class="panel-description">실제로 확인한 항목만 선택하세요.<br>부품처럼 보이는 형태를 기록합니다.</p><div class="observation-list">${observationLabels.map((label, i) => `<label><input type="checkbox" name="observation" value="${i}"/><span>${label}</span></label>`).join("")}</div><label class="form-label">확인 구역<select id="optical-zone">${zoneOptions()}</select></label><button class="button primary full" id="save-observation">${icon("clipboard")} 관찰 기록 추가</button><p class="tiny" id="observation-source-note">연습용 도식의 기록은 현장 보고서에서 제외됩니다.</p></article><article class="panel inspection-tips"><h2>관찰할 때</h2><p><span>01</span> 사람의 얼굴 대신 책상 위 안경을 비추세요.</p><p><span>02</span> 초점이 맞는 거리에서 앞면과 다리 안쪽을 확인하세요.</p><p><span>03</span> 빛 반사와 나사·장식도 비슷하게 보일 수 있습니다.</p><button class="text-button" data-page="guide">공식 자료와 대조 ${icon("arrow")}</button></article></aside></div>
      </section>

      <section id="page-guide" class="page-section" aria-label="스마트안경 도감" hidden><div id="photo-search-root"></div><div class="atlas-heading"><div><div class="eyebrow">KNOW WHAT TO LOOK FOR</div><h2>C · 3초 실물 도감</h2></div><span class="badge">5종 + 일반 안경 비교</span></div><div class="guide-toolbar"><div class="category-filters" role="group" aria-label="도감 분류">${[
        ["all", "전체"],
        ["camera", "카메라형"],
        ["display", "디스플레이형"],
        ["audio", "오디오형"],
        ["custom", "기타"],
      ]
        .map(
          ([id, label], i) =>
            `<button data-category="${id}" class="${i === 0 ? "selected" : ""}" aria-pressed="${i === 0}">${label}</button>`,
        )
        .join(
          "",
        )}</div><label class="search-field">${icon("search")}<input id="guide-search" type="search" placeholder="기종 또는 특징 검색" aria-label="도감 검색"/></label></div><div class="guide-grid" id="guide-grid"></div><div class="quiet-note">${icon("info")}<p>그림은 관찰 위치를 안내하는 자체 제작 도식입니다. 제품 사진·크기 비교·검증된 시그니처가 아닙니다. 자료 확인: 2026.11.07.</p></div></section>

      <section id="page-zones" class="page-section" aria-label="구역별 신호 비교" hidden><div class="import-layout"><article class="panel import-panel"><span class="feature-icon">${icon("map")}</span><div><div class="eyebrow">BRING YOUR OWN RECEIVER</div><h2>수신기의 기록을,<br>하나의 점검 화면으로.</h2><p>Android·ESP32 등 별도 수신기의 측정값을 지정된 JSON 형식으로 가져오세요. 이 브라우저가 신호 세기를 직접 측정하지는 않습니다.</p><div class="button-row"><button class="button primary" id="radio-import">${icon("upload")} 측정 파일 열기</button><button class="button secondary" id="radio-demo">${icon("play")} 예제로 살펴보기</button></div><input id="radio-input" type="file" accept=".json,application/json" hidden/><a class="text-button" href="${asset("radio-example.json")}" download="examguard-radio-example.json">예제 형식 다운로드 ${icon("download")}</a></div></article><article class="panel measurement-note"><h2>비교가 의미 있으려면</h2><ol><li>같은 수신기로 같은 기기를 측정합니다.</li><li>구역마다 3회 이상 반복합니다.</li><li>측정 시간과 방향을 비슷하게 맞춥니다.</li></ol><p>RSSI는 벽·몸·안테나 방향의 영향을 받습니다. 상대적으로 강한 구역을 보여주며, 거리·좌석·소유자를 확정하지 않습니다.</p></article></div><p id="radio-message" class="inline-message" role="status"></p><article class="panel signature-panel"><div class="signature-heading"><div><div class="eyebrow">MANUFACTURER + UUID + PAYLOAD</div><h2>광고 패킷 복합 필터</h2></div><span class="badge">외부 자료 대조</span></div><p class="panel-description">회사 ID가 같아도 바로 기종 후보로 분류하지 않습니다. 같은 광고의 UUID·바이트 배열·마스크 조건까지 함께 확인합니다.</p><div class="button-row"><button class="button secondary small" id="signature-import">${icon("upload")} 규칙 파일 열기</button><button class="button primary small" id="signature-demo">${icon("play")} 복합 필터 예제</button><button class="text-button" id="signature-clear" disabled>규칙 지우기</button><a class="text-button" href="${repository}/blob/main/docs/SIGNATURES.md" target="_blank" rel="noopener noreferrer">규칙·입력 형식 ${icon("external")}</a></div><input id="signature-input" type="file" accept=".json,application/json" hidden/><p id="signature-rules-state" class="tiny"></p><p id="signature-message" role="status"></p><div id="signature-results"></div></article><div id="radio-results"></div></section>

      <section id="page-records" class="page-section" aria-label="점검 기록" hidden><div class="report-banner"><div><span class="eyebrow">OBSERVE. VERIFY. DOCUMENT.</span><h2>판정 대신, 확인한 사실을 남깁니다.</h2><p>현장 기록만 JSON 보고서로 저장합니다. 연습 데이터와 영상·사진은 포함하지 않습니다.</p></div><button class="button primary" id="export-report">${icon("download")} 보고서 내보내기</button></div><div class="handoff-link"><button class="text-button" id="handoff-button">${icon("clipboard")} 발견 기기 실물 확인·인계 절차 ${icon("arrow")}</button></div><article class="panel sheet-panel"><h2>점검 기록지 만들기</h2><p>아래 칸은 비워도 됩니다. 적은 내용은 이 기기에만 저장돼요.</p><div class="sheet-fields"><label>시험명<input id="meta-exam" maxlength="60" autocomplete="off" placeholder="예: 기사 실기"/></label><label>시험실<input id="meta-room" maxlength="60" autocomplete="off" placeholder="예: 3층 2시험실"/></label><label>감독위원<input id="meta-proctor" maxlength="60" autocomplete="off"/></label></div><div class="button-row"><button class="button primary" id="print-sheet-button">${icon("clipboard")} 기록지 인쇄 · PDF 저장</button><button class="button secondary" id="export-csv">${icon("download")} 엑셀용 파일 받기</button><button class="text-button easy-only" id="easy-json">전문가용 원본(JSON)</button></div></article><div id="record-summary" class="stat-grid"></div><article class="panel"><div class="panel-header"><h2>이번 점검의 기록</h2><span class="badge">이 기기에만 저장</span></div><div id="all-records"></div></article><div class="quiet-note">${icon("info")}<p>‘새 점검’을 누르면 기록이 지워집니다. 필요한 기록지는 먼저 받아 두세요. 이름은 기기가 알린 값이며 소유자 정보가 아닙니다.</p></div></section>
      <footer class="main-footer"><span>${icon("shield")} ExamGuard <span class="footer-divider">/</span> 함께 만드는 공정한 시험 환경</span><span>오픈소스 · 현장 검증 전 프로토타입</span></footer>
    </main>
    <p id="easy-next-hint" class="easy-only" role="status"></p>
    <div class="easy-nav easy-only"><button class="button secondary" id="easy-prev">이전</button><button class="button primary" id="easy-next"></button></div>
  </div>
  <div class="toast" id="toast" role="status" hidden></div>
  <dialog id="dialog"><button class="dialog-close icon-button" aria-label="닫기">${icon("close")}</button><div id="dialog-content"></div></dialog>
`;

function toast(message: string) {
  const element = $("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 4000);
}
function openDialog(html: string) {
  $("#dialog-content").innerHTML = html;
  $("#dialog").setAttribute("aria-labelledby", "dialog-title");
  dialog.showModal();
}
const dialog = $<HTMLDialogElement>("dialog");
$(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }
});

const photoSearch = new PhotoSearch($("#photo-search-root"));
const optical = new OpticalEngine($("#optical-canvas"), (state) => {
  if (state.source !== cameraState.source) clearObservationSelection();
  cameraState = state;
  const cameraButton = $("#camera-button") as HTMLButtonElement;
  cameraButton.disabled = state.pending;
  $<HTMLButtonElement>("#camera-find-guide").disabled =
    state.pending || state.source === "demo";
  cameraButton.innerHTML = `${icon(state.source === "camera" ? "power" : "camera")} ${state.pending ? "권한 확인 중…" : state.source === "camera" ? "카메라 끄기" : "카메라 켜기"}`;
  $("#camera-source").textContent =
    state.source === "camera"
      ? "실시간 카메라"
      : state.source === "image"
        ? "직접 연 사진"
        : "연습용 일러스트";
  $("#camera-source").className =
    `badge ${state.source === "demo" ? "amber-badge" : "mint-badge"}`;
  $("#viewfinder-source").textContent =
    state.source === "demo"
      ? "ILLUSTRATION · 실제 측정 아님"
      : state.source === "camera"
        ? "LIVE CAMERA · 기기 내 처리"
        : "LOCAL IMAGE · 기기 내 처리";
  const freeze = $("#freeze-button") as HTMLButtonElement;
  freeze.disabled = state.source !== "camera";
  freeze.setAttribute("aria-pressed", String(state.frozen));
  freeze.setAttribute("aria-label", state.frozen ? "영상 재개" : "화면 정지");
  freeze.title = state.frozen ? "영상 재개" : "화면 정지";
  freeze.innerHTML = icon(state.frozen ? "play" : "pause");
  const torch = $("#torch-button") as HTMLButtonElement;
  torch.disabled = !state.torchAvailable;
  torch.setAttribute("aria-pressed", String(state.torch));
  torch.title = state.torchAvailable
    ? "카메라 조명"
    : "현재 카메라에서 조명을 지원하지 않습니다";
  $("#camera-message").textContent = state.message;
  $("#sample-picker").hidden = state.source !== "demo";
  $("#observation-source-note").textContent =
    state.source === "demo"
      ? "연습용 도식의 기록은 현장 보고서에서 제외됩니다."
      : "선택한 관찰 항목만 기록합니다. 영상·사진은 저장하지 않습니다.";
});
optical
  .setSample(asset("sample-camera.svg"))
  .catch(() => toast("연습용 이미지를 불러오지 못했습니다."));

function navigate(page: Page, focus = true) {
  if (!nav.some((item) => item.page === page)) return;
  currentPage = page;
  document.body.dataset.page = page;
  const selected = nav.find((item) => item.page === page)!;
  $$(".page-section").forEach((section) => {
    section.hidden = section.id !== `page-${page}`;
  });
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#page-title").textContent = selected.title;
  $("#page-subtitle").textContent = selected.subtitle;
  $("#breadcrumb-current").textContent = selected.title;
  document.title = `${selected.title} · ExamGuard`;
  optical.setActive(page === "optical");
  if (page !== "optical")
    $$<HTMLInputElement>('[name="observation"]').forEach((input) => {
      input.checked = false;
    });
  if (page === "records") renderRecords();
  if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  syncEasy(page);
  if (focus) {
    $("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>(
    "button[data-page], a[data-page]",
  );
  if (button) navigate(button.dataset.page as Page);
});
window.addEventListener("hashchange", () =>
  navigate(location.hash.slice(1) as Page),
);

function updatePreparation() {
  $$("[data-preflight]").forEach((button) => {
    const checked = preflight[Number(button.dataset.preflight)]!;
    button.classList.toggle("complete", checked);
    button.setAttribute("aria-pressed", String(checked));
  });
  $("#preflight-count").textContent =
    `${preflight.filter(Boolean).length} / 3 완료`;
  renderScan();
}
$$("[data-preflight]").forEach((button) =>
  button.addEventListener("click", () => {
    const index = Number(button.dataset.preflight);
    preflight[index] = !preflight[index];
    updatePreparation();
    persist();
  }),
);
function renderScan() {
  const isDemo = mode === "demo";
  $("#live-mode").classList.toggle("selected", !isDemo);
  $("#live-mode").setAttribute("aria-pressed", String(!isDemo));
  $("#demo-mode").classList.toggle("selected", isDemo);
  $("#demo-mode").setAttribute("aria-pressed", String(isDemo));
  $("#scan-title").innerHTML = isDemo
    ? "연습 데이터로<br>점검 흐름을 익혀보세요."
    : "먼저 전원을 끄고,<br>남아 있는 기기를 확인하세요.";
  $("#scan-description").textContent = isDemo
    ? "실제 Bluetooth를 사용하지 않는 가상 예시입니다. 연습 기록은 현장 목록과 보고서에 섞이지 않습니다."
    : "이 탐색은 Bluetooth 기기를 확인합니다. Wi-Fi 목록은 수집하지 않습니다. 선택한 기기를 기록하고 실물과 대조하세요.";
  const scopeSelect = $<HTMLSelectElement>("#scan-scope");
  scopeSelect.value = scanScope;
  scopeSelect.disabled = isDemo || pendingBluetooth;
  $("#scan-scope-note").textContent = isDemo
    ? "연습 모드에서는 탐색 범위를 적용하지 않습니다."
    : scanScope === "glasses"
      ? "Ray-Ban·Even G1 등 안경 관련 이름으로 시작하는 기기만 선택창에 표시합니다. 이름이 없거나 바뀐 기기는 빠질 수 있으니, 필요하면 ‘주변 BLE 전체’로 확인하세요."
      : "이름 조건 없이 주변 BLE 기기를 표시합니다. 공유기·TV 등 다른 장비나 교실 밖 기기도 섞일 수 있습니다. 실물과 확인 구역을 대조하세요.";
  $("#scan-status").innerHTML =
    `${icon(isDemo ? "play" : "power")} ${isDemo ? "연습 · 실제 측정 아님" : pendingBluetooth ? "브라우저 선택창 열림" : preflight.every(Boolean) ? "준비 확인 완료" : "점검 준비"}`;
  const button = $("#scan-button") as HTMLButtonElement;
  button.disabled =
    pendingBluetooth ||
    (!isDemo && (!preflight.every(Boolean) || !bluetoothSupported));
  button.innerHTML = `${icon(isDemo ? "play" : "bluetooth")} ${isDemo ? "연습 데이터 불러오기" : pendingBluetooth ? "선택창에서 기기를 선택하세요" : "교실 스캔 시작"} ${icon("arrow")}`;
  $("#scan-hint").textContent = isDemo
    ? "가상 기기 3개 · 모든 항목에 연습 표시"
    : !bluetoothSupported
      ? browserSupport.hint
      : !preflight.every(Boolean)
        ? "위의 준비 항목 3개를 먼저 확인해 주세요."
        : "빈 목록은 기기가 없다는 뜻이 아닙니다. 이름·신호만으로 교실 안팎을 판별할 수 없습니다.";
  $(".radar").classList.toggle("requesting", pendingBluetooth);
  renderEasy();
}
$("#scan-scope").addEventListener("change", (event) => {
  scanScope = (event.target as HTMLSelectElement).value as ScanScope;
  $("#scan-message").textContent = "";
  renderScan();
});
$("#live-mode").addEventListener("click", () => {
  mode = "live";
  $("#scan-message").textContent = "";
  renderScan();
  renderDevices();
});
$("#demo-mode").addEventListener("click", () => {
  mode = "demo";
  $("#scan-message").textContent = "";
  renderScan();
  renderDevices();
});
$("#scan-button").addEventListener("click", async () => {
  if (mode === "demo") {
    if (devices.some((d) => d.source === "demo")) {
      toast(
        "연습 데이터가 이미 준비되어 있습니다. 확인 구역과 상태를 바꿔보세요.",
      );
      return;
    }
    const now = new Date().toISOString();
    devices.push(
      ...[
        "Ray-Ban Meta · 가상 예시",
        "AirPods Pro · 가상 예시",
        "이름 없는 기기 · 가상 예시",
      ].map((name, i): DeviceRecord => ({
        id: crypto.randomUUID(),
        name,
        source: "demo",
        selectedAt: now,
        lastSelectedAt: now,
        selections: 1,
        zone: ["창가", "교탁", "미지정"][i] as Zone,
        disposition: (["followup", "allowed", "unreviewed"] as const)[i]!,
        preparation: [...preflight],
      })),
    );
    renderDevices();
    toast("연습 데이터 3개를 불러왔습니다. 실제 탐지 결과가 아닙니다.");
    return;
  }
  if (pendingBluetooth || !bluetoothSupported || !preflight.every(Boolean))
    return;
  const generation = sessionGeneration;
  const scopeAtRequest = scanScope;
  const preparationAtRequest: Preflight = [...preflight];
  const zoneAtRequest = ($("#current-zone") as HTMLSelectElement).value as Zone;
  pendingBluetooth = true;
  $("#scan-message").textContent = "";
  renderScan();
  try {
    // No GATT connection, identity guess, manufacturer claim, or fabricated RSSI.
    let device: BrowserDevice;
    if (scopeAtRequest === "glasses-plus") {
      try {
        device = await bluetooth!.requestDevice(buildSignalRequest());
      } catch (error) {
        // 번호 필터를 모르는 구형 브라우저는 형식 오류(TypeError)를 냅니다 → 이름 단서만으로 다시 엽니다
        if (!(error instanceof TypeError)) throw error;
        device = await bluetooth!.requestDevice(
          buildBluetoothRequest("glasses"),
        );
      }
    } else
      device = await bluetooth!.requestDevice(
        buildBluetoothRequest(scopeAtRequest),
      );
    // 번호 단서 검색에서 골랐는데 이름 단서에는 안 걸리면 → 제조사·서비스 번호로 목록에 뜬 기기
    const bySignal =
      scopeAtRequest === "glasses-plus" &&
      !matchesGlassesName(device.name ?? "");
    if (generation !== sessionGeneration) return;
    const now = new Date().toISOString();
    const existing = devices.find((d) => d.id === deviceKeys.get(device.id));
    if (existing) {
      existing.name = (device.name || "이름을 제공하지 않은 기기").slice(
        0,
        120,
      );
      existing.lastSelectedAt = now;
      existing.selections++;
      if (bySignal) existing.signal = true;
      toast("같은 기기의 선택 시각을 갱신했습니다.");
      easyNotice = "이미 기록한 기기예요. 시각만 새로 고쳤어요.";
    } else {
      const record: DeviceRecord = {
        id: crypto.randomUUID(),
        name: (device.name || "이름을 제공하지 않은 기기").slice(0, 120),
        source: "browser-selection",
        selectedAt: now,
        lastSelectedAt: now,
        selections: 1,
        zone: zoneAtRequest,
        disposition: "unreviewed",
        preparation: preparationAtRequest,
        ...(bySignal ? { signal: true } : {}),
      };
      deviceKeys.set(device.id, record.id);
      devices.push(record);
      toast("선택한 기기를 기록했습니다. 실물과 허용 여부를 확인하세요.");
      easyNotice = "기록했어요. 아래 카드에서 확인하세요.";
    }
    const selectedRecord = devices.find(
      (d) => d.id === deviceKeys.get(device.id),
    )!;
    const inCurrentList =
      mode === "live" &&
      matchesDeviceListFilter(selectedRecord, deviceHintFilter);
    $("#scan-message").textContent =
      `${assessDeviceName(device.name || "").label} · ${inCurrentList ? "아래 목록에서 이름 단서와 근거를 확인하세요." : "기록했습니다. 현장 점검의 ‘전체 기기’에서 확인할 수 있습니다."} 신호 세기·소유자는 확인되지 않았습니다.`;
  } catch (error) {
    if (generation !== sessionGeneration) return;
    const name = error instanceof Error ? error.name : "";
    easyNotice =
      name === "NotFoundError"
        ? scopeAtRequest !== "all"
          ? "고른 기기가 없어요. 목록이 비어 있었다면 ‘모든 기기 보기’로 다시 찾아보세요."
          : "고른 기기가 없어요. 목록이 비어 있어도 전자기기가 없다는 뜻은 아니에요."
        : name === "NotAllowedError" || name === "SecurityError"
          ? "블루투스 권한이 꺼져 있어요. 설정에서 블루투스와 브라우저 권한을 켜 주세요."
          : "기기 목록을 열지 못했어요. 블루투스가 켜져 있는지 확인해 주세요.";
    $("#scan-message").textContent =
      name === "NotFoundError"
        ? `기기를 선택하지 않았습니다. 취소·검색 시간 초과는 기기가 없다는 뜻이 아닙니다.${scopeAtRequest === "glasses" ? " 이름이 없거나 바뀐 기기는 ‘주변 BLE 전체’로 확인하세요." : ""}`
        : name === "NotAllowedError" || name === "SecurityError"
          ? "Bluetooth 권한이 허용되지 않았습니다. 브라우저와 운영체제 설정을 확인해 주세요."
          : scopeAtRequest === "glasses" &&
              (name === "TypeError" || name === "NotSupportedError")
            ? "이 브라우저에서 이름 조건 탐색을 열지 못했습니다. ‘주변 BLE 전체’로 바꿔 다시 시도하세요."
            : "기기 목록을 열지 못했습니다. Bluetooth 전원과 브라우저 지원 여부를 확인해 주세요.";
  } finally {
    pendingBluetooth = false;
    renderScan();
    renderDevices();
  }
});

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
const pad = (value: number) => String(value).padStart(2, "0");
function renderDeviceHint(name: string) {
  const hint = assessDeviceName(name);
  return `<div class="device-hint ${hint.kind}" data-device-hint="${hint.kind}"><strong>${hint.label}</strong><p>${esc(hint.reason)}</p>${hint.kind === "glasses-candidate" ? '<a class="text-button" href="#guide">실물 도감 대조 →</a>' : ""}</div>`;
}
$("#device-hint-filter").addEventListener("change", (event) => {
  deviceHintFilter = (event.target as HTMLSelectElement)
    .value as DeviceListFilter;
  renderDevices();
});
$("#show-all-devices").addEventListener("click", () => {
  deviceHintFilter = "all";
  $<HTMLSelectElement>("#device-hint-filter").value = "all";
  renderDevices();
});
function renderDevices() {
  $<HTMLSelectElement>("#device-hint-filter").value = deviceHintFilter;
  const visible = devices.filter((d) =>
    mode === "demo" ? d.source === "demo" : d.source !== "demo",
  );
  $("#device-count").textContent = pad(visible.length);
  $("#followup-count").textContent = pad(
    visible.filter((d) => d.disposition === "followup").length,
  );
  $("#allowed-count").textContent = pad(
    visible.filter((d) => d.disposition === "allowed").length,
  );
  $("#list-source").textContent =
    mode === "demo"
      ? "연습 데이터 · 실제 탐지 결과 아님 · 보고서에서 제외"
      : "현장 점검 기록 · 이 기기에만 저장";
  const hints = visible.map((device) => ({
    device,
    hint: assessDeviceName(device.name),
  }));
  const priority = {
    "glasses-candidate": 0,
    unknown: 1,
    "other-device-hint": 2,
  };
  const filtered = hints
    .filter((r) => matchesDeviceListFilter(r.device, deviceHintFilter))
    .sort((a, b) => priority[a.hint.kind] - priority[b.hint.kind])
    .map((r) => r.device);
  const separated = visible.length - filtered.length;
  $("#list-count").textContent = `${filtered.length} / ${visible.length}`;
  $("#device-hint-summary").textContent =
    `전체 ${visible.length}개 중 ${filtered.length}개 표시 · 의심 후보 ${hints.filter((r) => r.hint.kind === "glasses-candidate").length} · 다른 기기 이름 단서 ${hints.filter((r) => r.hint.kind === "other-device-hint").length} · 종류 미확인 ${hints.filter((r) => r.hint.kind === "unknown").length}`;
  $("#show-all-devices").hidden = separated === 0;
  $("#show-all-devices").textContent = `분리한 ${separated}개 포함 전체 보기`;
  $("#device-list").innerHTML = !visible.length
    ? `<div class="empty-state">${icon("bluetooth")}<strong>아직 선택한 기기가 없습니다</strong><p>${mode === "demo" ? "연습 데이터를 불러와 점검 흐름을 확인하세요." : "준비 항목을 확인하고 기기 선택창을 열어보세요."}</p><span>빈 목록은 전자기기가 없다는 의미가 아닙니다.</span></div>`
    : !filtered.length
      ? `<div class="empty-state"><strong>이 분류에 해당하는 기기가 없습니다</strong><p>전체 기기로 돌아가 다른 단서와 미확인 기기를 확인하세요.</p></div>`
      : `<div class="table-scroll"><table><thead><tr><th>기기 이름 · 출처 · 의심 단서</th><th>확인 구역</th><th>확인 상태</th><th>선택 시각</th></tr></thead><tbody>${filtered
          .map(
            (d) =>
              `<tr><td><div class="device-name">${icon("bluetooth")}<div><strong>${esc(d.name)}</strong><small>${d.source === "demo" ? "연습 데이터" : "브라우저에서 직접 선택"} · ${d.selections}회 선택</small></div></div>${renderDeviceHint(d.name)}</td><td><select data-device-zone="${d.id}" aria-label="${esc(d.name)} 확인 구역">${zoneOptions(d.zone)}</select></td><td><select class="disposition ${d.disposition}" data-disposition="${d.id}" aria-label="${esc(d.name)} 확인 상태">${Object.entries(
                DISPOSITIONS,
              )
                .map(
                  ([key, value]) =>
                    `<option value="${key}" ${d.disposition === key ? "selected" : ""}>${value}</option>`,
                )
                .join(
                  "",
                )}</select></td><td class="mono time-cell">${time(d.lastSelectedAt)}</td></tr>`,
          )
          .join("")}</tbody></table></div>`;
  $("#nav-record-count").textContent = String(
    devices.filter((d) => d.source !== "demo").length +
      inspections.filter((i) => i.source !== "demo").length,
  );
  persist();
  renderEasy();
}
$("#device-list").addEventListener("change", (event) => {
  const element = event.target as HTMLSelectElement;
  const record = devices.find(
    (d) => d.id === (element.dataset.deviceZone || element.dataset.disposition),
  );
  if (!record) return;
  if (element.dataset.deviceZone) {
    record.zone = element.value as Zone;
    persist();
  } else {
    record.disposition = element.value as Disposition;
    renderDevices();
  }
});

$("#camera-button").addEventListener("click", () => {
  clearObservationSelection();
  if (cameraState.source === "camera") optical.stopCamera();
  else void optical.startCamera();
});
$("#image-button").addEventListener("click", () => $("#image-input").click());
function clearObservationSelection() {
  $$<HTMLInputElement>('[name="observation"]').forEach((input) => {
    input.checked = false;
  });
}
$("#image-input").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    clearObservationSelection();
    try {
      await optical.loadImage(file);
    } catch (error) {
      toast(error instanceof Error ? error.message : "사진을 읽지 못했습니다.");
    }
  }
  input.value = "";
});
$("#freeze-button").addEventListener("click", () => optical.freeze());
$("#torch-button").addEventListener("click", () => void optical.toggleTorch());
$("#camera-find-guide").addEventListener("click", () => {
  const frame = optical.snapshot();
  if (!frame) {
    toast("카메라나 직접 연 사진을 먼저 준비해 주세요.");
    return;
  }
  navigate("guide");
  photoSearch.loadFrame(frame);
});
$$("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    optical.filter = button.dataset.filter as Filter;
    $$("[data-filter]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    $("#filter-badge").textContent = FILTER_LABELS[optical.filter];
    ($("#threshold-range") as HTMLInputElement).disabled =
      optical.filter !== "contrast";
    optical.render();
  }),
);
$("#zoom-range").addEventListener("input", (event) => {
  optical.zoom = Number((event.target as HTMLInputElement).value);
  $("#zoom-label").textContent = $("#zoom-value").textContent =
    `${optical.zoom.toFixed(1)}×`;
  optical.render();
});
$("#threshold-range").addEventListener("input", (event) => {
  optical.threshold = Number((event.target as HTMLInputElement).value);
  $("#threshold-value").textContent = String(optical.threshold);
  optical.render();
});
$$("[data-sample]").forEach((button) =>
  button.addEventListener("click", () => {
    clearObservationSelection();
    $$("[data-sample]").forEach((item) => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    optical
      .setSample(asset(`sample-${button.dataset.sample}.svg`))
      .catch(() => toast("이미지를 불러오지 못했습니다."));
  }),
);
$("#save-observation").addEventListener("click", () => {
  const observations = $$<HTMLInputElement>('[name="observation"]:checked').map(
    (input) => observationLabels[Number(input.value)]!,
  );
  inspections.push({
    id: crypto.randomUUID(),
    source: cameraState.source,
    createdAt: new Date().toISOString(),
    zone: ($("#optical-zone") as HTMLSelectElement).value as Zone,
    observations,
  });
  clearObservationSelection();
  renderDevices();
  toast(
    cameraState.source === "demo"
      ? "연습 관찰을 기록했습니다. 현장 보고서에서는 제외됩니다."
      : "관찰 내용을 기록했습니다. 사진·영상은 저장하지 않았습니다.",
  );
});

function renderGuides() {
  const query = ($("#guide-search") as HTMLInputElement).value
    .trim()
    .toLocaleLowerCase();
  const visible = guides.filter(
    (g) =>
      (guideCategory === "all" || g.category === guideCategory) &&
      `${g.name} ${g.label} ${g.description} ${g.points.join(" ")}`
        .toLocaleLowerCase()
        .includes(query),
  );
  $("#guide-grid").innerHTML = visible.length
    ? visible
        .map(
          (g, i) =>
            `<button class="guide-card" data-kind="${g.category}" data-guide="${g.id}"><div class="guide-art"><span class="art-number">${String(i + 1).padStart(2, "0")}</span><img src="${asset(`sample-${g.sample}.svg`)}" alt="${esc(g.name)} 관찰 위치를 설명하는 도식"/><span class="art-caption">관찰용 도식 · 실물 사진 아님</span></div><div class="guide-card-copy"><span class="badge">${g.label}</span><h2>${g.name}${icon("arrow")}</h2><p>${g.description}</p><span class="guide-read">관찰 포인트 ${g.points.length}개 ${icon("external")}</span></div></button>`,
        )
        .join("")
    : '<div class="empty-state"><strong>검색 결과가 없습니다</strong><p>다른 기종명이나 특징으로 검색해 주세요.</p></div>';
}
$$("[data-category]").forEach((button) =>
  button.addEventListener("click", () => {
    guideCategory = button.dataset.category!;
    $$("[data-category]").forEach((item) => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderGuides();
  }),
);
$("#guide-search").addEventListener("input", renderGuides);
$("#page-guide").addEventListener("click", (event) => {
  const card = (event.target as Element).closest<HTMLElement>("[data-guide]");
  if (!card) return;
  const guide = guides.find((g) => g.id === card.dataset.guide)!;
  openDialog(
    `<div class="eyebrow">3-SECOND FIELD REFERENCE</div><h2 id="dialog-title">${guide.name}</h2><span class="badge">${guide.label}</span><p class="glance-strip">${guide.glance}</p><div class="atlas-view"><img class="dialog-glasses" src="${asset(`sample-${guide.sample}.svg`)}" alt="${esc(guide.name)} 관찰 위치 도식"/><span>관찰용 도식 · 크기·부품 형상은 실물과 다를 수 있습니다</span></div><div class="atlas-features">${guide.features.map((feature, i) => `<article><span class="feature-number">0${i + 1}</span><div><small>${feature.location}</small><h3>${feature.title}</h3><p>${feature.detail}</p></div></article>`).join("")}</div><dl class="atlas-details"><dt>모델 표기 대조</dt><dd>${guide.marks}</dd><dt>기능·전원 확인</dt><dd>${guide.power}</dd><dt>닮은 외형 주의</dt><dd>${guide.comparison}</dd></dl><p class="dialog-note">${guide.caveat}</p><div class="button-row"><a class="button secondary" href="${guide.source}" target="_blank" rel="noopener noreferrer">${guide.sourceLabel} ${icon("external")}</a>${guide.sourcePhoto ? `<a class="text-button" href="${guide.sourcePhoto}" target="_blank" rel="noopener noreferrer">실물 사진 확인 ${icon("external")}</a>` : ""}</div>`,
  );
});

$("#radio-import").addEventListener("click", () => $("#radio-input").click());
$("#signature-import").addEventListener("click", () =>
  $("#signature-input").click(),
);
$("#signature-input").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  const generation = sessionGeneration;
  if (file)
    try {
      if (file.size > 256_000)
        throw new Error("규칙 파일은 256 KB 이하로 선택해 주세요.");
      const parsed = parseSignatureRules(await file.text());
      if (generation !== sessionGeneration) return;
      signatureRules = parsed;
      $("#signature-message").textContent = "";
      renderRadio();
    } catch (error) {
      if (generation === sessionGeneration)
        $("#signature-message").textContent =
          error instanceof Error ? error.message : "규칙을 읽지 못했습니다.";
    }
  input.value = "";
});
$("#signature-clear").addEventListener("click", () => {
  signatureRules = null;
  $("#signature-message").textContent = "";
  renderRadio();
});
$("#signature-demo").addEventListener("click", async () => {
  const generation = sessionGeneration;
  try {
    const responses = await Promise.all([
      fetch(asset("signature-example.json")),
      fetch(asset("radio-advertisement-example.json")),
    ]);
    if (responses.some((response) => !response.ok))
      throw new Error("예제 파일을 불러오지 못했습니다.");
    const [rulesText, captureText] = await Promise.all(
      responses.map((response) => response.text()),
    );
    const rules = parseSignatureRules(rulesText!),
      capture = parseRadioCapture(captureText!);
    if (generation !== sessionGeneration) return;
    if (!rules.isDemo || !capture.isDemo)
      throw new Error("연습 자료 표시를 확인할 수 없습니다.");
    signatureRules = rules;
    radioCapture = capture;
    $("#signature-message").textContent =
      "가상의 광고·규칙으로 필터 동작을 확인합니다. 현장 보고서에서 제외됩니다.";
    $("#radio-message").textContent = "";
    renderRadio();
  } catch (error) {
    if (generation === sessionGeneration)
      $("#signature-message").textContent =
        error instanceof Error ? error.message : "예제를 읽지 못했습니다.";
  }
});

$("#radio-input").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (file) {
    try {
      if (file.size > 1_000_000)
        throw new Error("1 MB 이하의 JSON 파일을 선택해 주세요.");
      const generation = sessionGeneration;
      const next = parseRadioCapture(await file.text());
      if (generation !== sessionGeneration) return;
      radioCapture = next;
      $("#radio-message").textContent = "";
      renderRadio();
      toast(
        next.isDemo
          ? "연습용 측정 파일을 열었습니다."
          : "외부 측정 파일을 열었습니다. 파일의 출처와 측정 조건을 확인하세요.",
      );
    } catch (error) {
      $("#radio-message").textContent =
        error instanceof Error ? error.message : "측정 파일을 읽지 못했습니다.";
    }
  }
  input.value = "";
});
$("#radio-demo").addEventListener("click", async () => {
  try {
    const generation = sessionGeneration;
    const response = await fetch(asset("radio-example.json"));
    if (!response.ok) throw new Error();
    const data = parseRadioCapture(await response.text());
    if (generation !== sessionGeneration) return;
    radioCapture = data;
    $("#radio-message").textContent = "";
    renderRadio();
  } catch {
    toast("예제 파일을 읽지 못했습니다. 연결 상태를 확인해 주세요.");
  }
});
function renderRadio() {
  $("#signature-results").innerHTML = renderSignatureResults(
    radioCapture,
    signatureRules,
  );
  $("#signature-rules-state").textContent = signatureRules
    ? `${signatureRules.isDemo ? "연습 규칙" : "사용자 제공 규칙"} · ${signatureRules.rules.length}개 · ${signatureRules.source}`
    : "등록된 규칙 없음 · 실측 기종 규칙은 아직 내장되어 있지 않습니다.";
  $<HTMLButtonElement>("#signature-clear").disabled = !signatureRules;
  if (!radioCapture) {
    $("#radio-results").innerHTML =
      `<div class="panel empty-state">${icon("map")}<strong>측정 파일을 기다리고 있습니다</strong><p>JSON 파일을 열거나 연습 예제로 구역 비교를 살펴보세요.</p></div>`;
    return;
  }
  const summaries = summarizeRadio(radioCapture);
  $("#radio-results").innerHTML =
    `<div class="radio-source"><span class="badge ${radioCapture.isDemo ? "amber-badge" : "mint-badge"}">${radioCapture.isDemo ? "연습 데이터 · 실제 측정 아님" : "외부 파일 · 출처 직접 확인 필요"}</span><span>${esc(radioCapture.source)} · ${radioCapture.samples.length}개 측정값</span></div><div class="radio-grid">${summaries.map((summary) => `<article class="panel signal-card"><div class="section-heading"><h2>${icon("bluetooth")}${esc(summary.name)}</h2></div><p class="tiny">파일 내 기기 키: ${esc(summary.deviceKey)} · 소유자 미확인</p><div class="signal-bars">${summary.zones.map((zone) => `<div class="signal-row"><span>${esc(zone.zone)}</span><div class="signal-track"><div style="width:${Math.max(3, Math.min(100, ((zone.median + 127) / 147) * 100))}%"></div></div><strong>${zone.median} <small>dBm</small></strong><small>${zone.count}회 · ${zone.min}~${zone.max}</small></div>`).join("")}</div><p class="signal-conclusion">${summary.comparable ? `3회 이상 측정 구역 중 중앙값이 가장 높은 곳: <strong>${esc(summary.strongestRepeatedZone!)}</strong>` : "비교 자료 부족 · 2개 이상의 구역에서 각각 3회 이상 측정하세요."}</p><p class="tiny">구역은 측정한 위치입니다. 송신기 위치나 소유자의 좌석을 뜻하지 않습니다.</p></article>`).join("")}</div>`;
}

function renderRecords() {
  const realDevices = devices.filter((d) => d.source !== "demo"),
    realInspections = inspections.filter((i) => i.source !== "demo");
  const training =
    devices.filter((d) => d.source === "demo").length +
    inspections.filter((i) => i.source === "demo").length;
  $("#record-summary").innerHTML =
    `<div class="stat-card"><span>현장 기기 기록</span><strong>${pad(realDevices.length)}</strong><small>브라우저에서 선택한 기기</small></div><div class="stat-card"><span>현장 관찰 기록</span><strong class="mint">${pad(realInspections.length)}</strong><small>카메라·직접 연 사진 관찰</small></div><div class="stat-card"><span>보고서에서 제외</span><strong class="amber">${pad(training)}</strong><small>연습 기기·도식 관찰 기록</small></div>`;
  const records = [
    ...devices.map((d) => ({
      createdAt: d.lastSelectedAt,
      isDemo: d.source === "demo",
      title: d.name,
      detail: `${d.zone} · ${DISPOSITIONS[d.disposition]} · ${d.source === "demo" ? "가상 기기" : "브라우저 선택"}`,
      symbol: "bluetooth",
    })),
    ...inspections.map((i) => ({
      createdAt: i.createdAt,
      isDemo: i.source === "demo",
      title: `광학 관찰 · ${i.observations.length}개 항목`,
      detail: `${i.zone} · ${i.source === "demo" ? "연습 도식" : i.source === "camera" ? "카메라 관찰" : "사진 관찰"} · ${i.observations.join(", ") || "관찰 항목 없음 (정상 판정 아님)"}`,
      symbol: "camera",
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $("#all-records").innerHTML = records.length
    ? `<ul class="record-list">${records.map((record) => `<li><span class="record-icon">${icon(record.symbol)}</span><div><strong>${esc(record.title)} ${record.isDemo ? '<span class="badge amber-badge">연습</span>' : ""}</strong><p>${esc(record.detail)}</p></div><time>${time(record.createdAt)}</time></li>`).join("")}</ul>`
    : '<div class="empty-state"><strong>이번 점검에 아직 기록이 없습니다</strong><p>무선 기기를 선택하거나 광학 관찰 내용을 기록해 보세요.</p></div>';
  if (radioCapture)
    $("#all-records").insertAdjacentHTML(
      "beforeend",
      `<div class="capture-record">${icon("map")} 외부 수신기 기록: ${radioCapture.samples.length}개 측정값 · ${radioCapture.isDemo ? "연습용, 보고서 제외" : "사용자 제공 파일, 보고서 포함"}</div>`,
    );
}
$("#export-report").addEventListener("click", () => {
  const report = createReport(
    preflight,
    devices,
    inspections,
    radioCapture,
    signatureRules,
  );
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `examguard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("현장 기록을 내보냈습니다. 연습 데이터와 이미지는 제외했습니다.");
});
$("#reset-button").addEventListener("click", () => {
  openDialog(
    '<div class="eyebrow">NEW INSPECTION</div><h2 id="dialog-title">새 점검을 시작할까요?</h2><p class="dialog-note">현재 기기·관찰·측정 기록과 준비 상태가 지워집니다. 필요한 기록은 먼저 보고서로 내려받으세요.</p><div class="button-row"><button class="button secondary" id="cancel-reset">돌아가기</button><button class="button primary" id="confirm-reset">기록 비우고 시작</button></div>',
  );
  $("#cancel-reset").addEventListener("click", () => dialog.close());
  $("#confirm-reset").addEventListener("click", () => {
    sessionGeneration++;
    easyStep = 1;
    easyNotice = "";
    devices = [];
    inspections = [];
    radioCapture = null;
    signatureRules = null;
    deviceHintFilter = "glasses-candidate";
    scanScope = "glasses";
    $("#signature-message").textContent = "";
    deviceKeys.clear();
    preflight.fill(false);
    mode = "live";
    optical.stopCamera();
    photoSearch.clear();
    clearObservationSelection();
    ($("#current-zone") as HTMLSelectElement).value = "미지정";
    ($("#optical-zone") as HTMLSelectElement).value = "미지정";
    $("#scan-message").textContent = "";
    $("#radio-message").textContent = "";
    updatePreparation();
    renderDevices();
    renderRadio();
    renderRecords();
    dialog.close();
    navigate("wireless");
    toast("새 점검을 시작했습니다.");
  });
});
function showBrowserHelp() {
  if (dialog.open) dialog.close();
  openDialog(
    `<div class="eyebrow">OPEN EXAMGUARD</div><h2 id="dialog-title">어떤 브라우저로 열어야 하나요?</h2><p class="dialog-note"><strong>별도 ExamGuard 앱 다운로드는 필요 없습니다.</strong><br>웹 주소로 바로 사용합니다. ‘홈 화면에 추가’는 선택 사항이며 Bluetooth 지원 여부를 바꾸지 않습니다.</p><div class="browser-guide"><article><h3>Android · Chrome 권장</h3><p>A · Bluetooth 탐색 / B · 광학 검사 / C · 도감 이용</p><ol><li>앱 주소를 복사합니다.</li><li>카카오톡·네이버·SNS 내부 화면에서 나와 <strong>Chrome 앱을 직접 실행</strong>합니다.</li><li>주소창에 붙여넣고 접속합니다.</li><li>휴대전화의 Bluetooth를 켜고 요청되는 권한을 허용합니다. 준비 항목 3개를 확인한 뒤 ‘교실 스캔 시작’을 누릅니다.</li></ol></article><article><h3>iPhone·iPad · Safari로 B·C 이용</h3><p><strong>Safari와 일반 iOS용 Chrome 모두 Web Bluetooth를 지원하지 않습니다.</strong> 홈 화면에 추가해도 해결되지 않습니다.</p><ol><li>Safari에서 앱 주소를 엽니다.</li><li>‘B · 광학 검사’에서 카메라 권한을 허용하거나 사진을 엽니다. 조명은 기기·브라우저의 지원 여부에 따라 달라집니다.</li><li>‘C · 도감·사진 대조’에서 기종 특징을 비교합니다. 사진 대조는 첫 실행 때 약 104 MB를 받으며 기기 성능에 따라 시간이 걸립니다.</li></ol><p><strong>iPhone의 BLE 대안: Bluefy 브라우저(실험적 경로)</strong></p><ol><li><a class="text-button" href="https://apps.apple.com/kr/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener noreferrer">App Store에서 Bluefy 설치</a></li><li>Bluefy 앱을 직접 실행해 ExamGuard 주소를 붙여넣습니다.</li><li>Bluetooth를 켜고 Bluefy의 Bluetooth 권한을 허용한 뒤 준비 항목 3개 확인 → ‘교실 스캔 시작’을 누릅니다.</li></ol><p>Bluefy는 Web Bluetooth를 제공하는 별도 브라우저입니다. ExamGuard와의 실기기 호환성·탐지 성능은 아직 검증하지 않았습니다. 작동하지 않으면 Android의 Chrome 또는 지원되는 PC를 사용하세요.</p><a class="text-button" href="https://bluefy.app/guide.html" target="_blank" rel="noopener noreferrer">Bluefy 공식 사용 안내</a></article><article><h3>PC · Chrome 또는 Edge</h3><p>Windows 10/11·macOS: Chrome/Edge<br>Chromebook: Chrome</p><ol><li>지원 브라우저의 주소창에 앱 주소를 붙여넣습니다.</li><li>Bluetooth 어댑터와 설정을 켜고 요청되는 브라우저·OS 권한을 허용합니다.</li></ol><p>Safari·Firefox는 Bluetooth 탐색을 지원하지 않습니다. Linux의 기본 환경도 권장하지 않습니다. 학교 관리 기기는 관리자 정책으로 차단될 수 있습니다.</p></article></div><p class="dialog-note">지원 브라우저에서도 모든 주변 기기가 나타나는 것은 아닙니다. 선택창에서 고른 기기만 앱에 기록됩니다. 기기가 나오지 않는다고 전자기기가 없다는 뜻은 아닙니다.</p><a class="text-button" href="https://developer.chrome.com/docs/capabilities/bluetooth" target="_blank" rel="noopener noreferrer">Chrome 공식 지원 안내 ${icon("external")}</a>`,
  );
}
document.addEventListener("click", (event) => {
  if ((event.target as Element).closest("[data-browser-help]"))
    showBrowserHelp();
});
$("#copy-app-url").addEventListener("click", async () => {
  const message = $("#browser-copy-message");
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(publicAppUrl);
    message.textContent =
      "앱 주소를 복사했습니다. 지원 브라우저의 주소창에 붙여넣으세요.";
  } catch {
    $<HTMLDetailsElement>("#app-address-details").open = true;
    const input = $<HTMLInputElement>("#app-address");
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
    message.textContent =
      "자동 복사가 허용되지 않았습니다. 위 주소를 길게 누르거나 선택해 직접 복사하세요.";
  }
});
function showHelp() {
  openDialog(
    `<div class="eyebrow">QUICK START</div><h2 id="dialog-title">ExamGuard 사용 가이드</h2><p class="dialog-note">다운로드 없이 웹 주소로 사용합니다. BLE 탐색은 Android의 Chrome 또는 Windows·Mac의 Chrome/Edge를 권장합니다. iPhone·iPad에서는 Safari로 광학 검사와 도감을 이용하고, 별도 Bluefy 브라우저로 BLE 탐색을 시도할 수 있습니다(ExamGuard 실기기 호환성 미검증). 홈 화면 설치로 BLE 지원이 추가되지는 않습니다.</p><button class="button secondary small" data-browser-help>기기별 접속 방법 자세히 보기 ${icon("arrow")}</button><ol class="help-steps"><li><strong>휴대전화 전원 종료·전자기기 수거</strong><p>잠금·무음과 전원 종료를 구분하고 허용된 감독 장비를 확인합니다.</p></li><li><strong>Bluetooth 목록에서 기기를 선택</strong><p>지원 브라우저에서 기기를 하나씩 선택합니다. 기본은 안경 관련 이름으로 좁힌 목록입니다. 이름이 없거나 바뀐 기기는 ‘주변 BLE 전체’로 확인하세요. 앱 목록에서도 ‘종류 미확인’과 ‘전체 기기’를 선택할 수 있습니다.</p></li><li><strong>구역과 실물을 확인</strong><p>신호가 의심되면 담당자 절차에 따라 실물을 대조합니다. 광학 필터와 도감은 육안 관찰을 돕습니다.</p></li><li><strong>기록하고 담당자에게 전달</strong><p>확인 구역과 허용 여부를 기록합니다. 최종 판단은 시험 주관기관이 합니다.</p></li></ol><div class="dialog-note"><strong>오프라인 준비</strong><p>인터넷에 연결한 상태에서 앱을 한 번 열고 상단의 ‘기본 도감 오프라인 준비 완료’를 확인하세요. 사진 대조 모델은 첫 대조 때 별도로 내려받습니다. 모델 다운로드와 대조를 마친 뒤 오프라인에서도 시험해 보세요. 브라우저가 캐시를 비우면 재다운로드가 필요합니다. 카메라·Bluetooth 권한과 하드웨어는 별도로 필요합니다. 비행기 모드에서 Bluetooth가 꺼지면 기기 선택은 작동하지 않습니다.</p><strong>기록과 개인정보</strong><p>서버 전송·분석 추적 기능이 없습니다. 기록은 이 기기의 브라우저에만 저장하며 ‘새 점검’으로 지웁니다. 내려받은 보고서는 사용자가 직접 관리합니다. 웹 호스팅 제공자의 접속 로그는 별개입니다.</p></div>`,
  );
}
$("#help-button").addEventListener("click", showHelp);
$("#ble-help").addEventListener("click", () =>
  openDialog(
    `<div class="eyebrow">MODE A · RADIO FIRST</div><h2 id="dialog-title">교실 전파 탐색의 확인 범위</h2><ol class="help-steps"><li><strong>전원 종료·수거 확인이 먼저</strong><p>휴대전화와 전자기기를 수거하고 허용된 감독 장비를 확인합니다. 남아 있는 BLE 기기를 추가 확인의 단서로 봅니다.</p></li><li><strong>기기 목록은 브라우저에서 확인</strong><p>‘교실 스캔 시작’을 누르면 안경 관련 이름으로 좁힌 BLE 선택창이 열립니다. 이름이 없거나 바뀐 기기는 ‘주변 BLE 전체’로 보완하세요. Wi-Fi 목록은 수집하지 않습니다. 앱의 기본 목록은 미확인 안경 후보만 표시하며, 나머지 기록은 필터를 바꿔 확인합니다.</p></li><li><strong>선택한 기기만 앱에 기록</strong><p>목록 전체를 자동 수집하지 않습니다. 감독관이 고른 기기와 확인 시각을 기록하며, 제조사·기종·소유자는 미확인 상태입니다.</p></li><li><strong>교탁 위 판독 → 실물 도감으로 연결</strong><p>기관 절차로 확인한 실물의 부품을 살펴보고 기종을 대조합니다. 외부 수신기 자료가 있다면 구역별 RSSI 비교도 사용할 수 있습니다.</p></li></ol><p class="dialog-note">이 웹앱은 페어링 상대나 외부 인터넷 사용 여부를 알아내지 못합니다. Wi-Fi·셀룰러 연결 또는 부정행위 자체를 검출하는 기능은 아닙니다.</p><a class="button secondary full" href="${repository}/blob/main/docs/MODE_A.md" target="_blank" rel="noopener noreferrer">제조사 코드·탐지 확장 설명 ${icon("external")}</a>`,
  ),
);

$("#handoff-button").addEventListener("click", () =>
  openDialog(
    `<div class="eyebrow">VERIFY & HAND OVER</div><h2 id="dialog-title">발견 기기 확인·인계</h2><ol class="help-steps"><li><strong>허용 장비부터 구분</strong><p>감독 장비·보조기기·교실 밖 신호를 확인합니다. 기기 이름을 학생 이름으로 해석하지 않습니다.</p></li><li><strong>실물 확인 이유 안내</strong><p>“전자기기 여부 확인을 위해 안경의 모델 표기와 부품을 확인하겠습니다.” 기관 절차에 따라 책상 위 안경을 대조합니다.</p></li><li><strong>부품과 제품 표기 확인</strong><p>카메라·충전부·렌즈 구조를 기록합니다. 외형만으로 전원 상태·사용 행위를 추측하지 않습니다.</p></li><li><strong>담당자가 소지자 확인·인계</strong><p>소지자 확인과 보관은 기관 절차로 진행합니다. BLE 이름·RSSI·사진 후보는 소유자의 증거가 아닙니다. 보고서는 관찰 참고 기록입니다.</p></li></ol>`,
  ),
);
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let installPrompt: InstallEvent | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallEvent;
});
$("#install-button").addEventListener("click", async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else
    openDialog(
      '<div class="eyebrow">INSTALL EXAMGUARD</div><h2 id="dialog-title">홈 화면에서 바로 열기</h2><p class="dialog-note"><strong>설치는 선택 사항입니다. 다운로드 없이 웹 주소로 사용할 수 있습니다.</strong><br>홈 화면에 추가해도 브라우저의 Bluetooth 제한은 바뀌지 않습니다. iPhone·iPad의 Safari에서는 광학 검사와 도감을 이용하세요. 홈 화면 설치로 BLE가 추가되지는 않으며, 별도 Bluefy 브라우저로 탐색을 시도할 수 있습니다. 다만 ExamGuard와의 실기기 호환성은 아직 미검증입니다.</p><p>Android·데스크톱의 지원 브라우저에서는 메뉴의 ‘앱 설치’를, iPhone·iPad에서는 Safari의 공유 메뉴 → ‘홈 화면에 추가’를 사용하세요. 설치 메뉴는 브라우저와 실행 환경에 따라 다릅니다.</p><p>처음에는 인터넷에 연결해 ‘기본 도감 오프라인 준비 완료’를 확인하세요. 비공개 모드나 저장 공간 정리로 캐시가 사라지면 다시 연결해야 합니다.</p><button class="button secondary small" data-browser-help>기기별 접속 방법 자세히 보기</button>',
    );
});
function updateConnection() {
  $("#connection-status").innerHTML =
    `<span class="status-dot ${navigator.onLine ? "" : "offline-dot"}"></span> ${offlineReady ? (navigator.onLine ? "기본 도감 오프라인 준비 완료" : "기본 도감 오프라인 사용 중") : import.meta.env.DEV ? "개발 미리보기" : navigator.onLine ? "오프라인 준비 중" : "오프라인 캐시 미확인"}`;
}
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register(asset("sw.js"), { scope: import.meta.env.BASE_URL })
    .then(async () => {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        offlineReady = event.data?.ready === true;
        updateConnection();
        channel.port1.close();
      };
      registration.active?.postMessage("CACHE_STATUS", [channel.port2]);
    })
    .catch(() => {
      $("#connection-status").textContent = "오프라인 준비 실패 · 연결 필요";
    });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    optical.setActive(false);
    photoSearch.suspend();
  } else optical.setActive(currentPage === "optical");
});
window.addEventListener("pagehide", () => {
  optical.setActive(false);
  photoSearch.cancel(false);
});

// ════════════════ 쉬운 화면 ════════════════
// 원본 기능 위에 "4단계 안내"를 얹은 층입니다. 기록 구조와 판단 규칙은 원본 그대로 씁니다.

/** 현장 기록을 이 기기의 브라우저 저장소에 보관 (연습·시연 기록은 저장하지 않음) */
function persist() {
  if (mode === "demo") return; // 시연 중에는 아무것도 저장하지 않습니다
  writeStore(
    STORAGE_KEY,
    JSON.stringify({
      v: 1,
      preflight,
      devices: devices.filter((d) => d.source !== "demo"),
      inspections: inspections.filter((i) => i.source !== "demo"),
      deviceKeys: [...deviceKeys],
      meta,
      step: easyStep,
    }),
  );
}
/** 화면이 바뀌면 그에 맞는 단계 번호로 맞춥니다 */
function syncEasy(page: Page) {
  if (page === "optical" || page === "guide") easyStep = 3;
  else if (page === "records") easyStep = 4;
  else if (page === "wireless" && easyStep > 2) easyStep = 2;
  renderEasy();
  persist();
}
function setStep(step: number, focus = true) {
  easyStep = Math.min(4, Math.max(1, step));
  navigate(
    easyStep <= 2 ? "wireless" : easyStep === 3 ? "optical" : "records",
    focus,
  );
}
const EASY_TITLES: [string, string][] = [
  ["먼저 3가지를 확인하세요", "하나씩 눌러 체크하면 다음으로 넘어가요."],
  [
    "켜져 있는 기기를 찾아요",
    "걷은 뒤에도 켜져 있는 블루투스 기기를 확인합니다.",
  ],
  [
    "안경을 가까이 살펴봐요",
    "교탁에 놓인 안경만 비추세요. 사람 얼굴은 찍지 않습니다.",
  ],
  [
    "기록을 남겨요",
    "확인한 사실만 적습니다. 최종 판단은 기관 절차에 따릅니다.",
  ],
];
function renderEasy() {
  const easy = uiMode === "easy";
  document.body.classList.toggle("ui-easy", easy);
  document.body.classList.toggle("ui-pro", !easy);
  document.body.dataset.step = String(easyStep);
  $("#ui-toggle").textContent = easy ? "전문가 화면" : "쉬운 화면";
  if (!easy) return;
  const demo = mode === "demo";
  const ready = preflight.every(Boolean);
  $$("[data-easy-step]").forEach((button) => {
    const n = Number(button.dataset.easyStep);
    button.classList.toggle("active", n === easyStep);
    button.classList.toggle("done", n < easyStep);
    if (n === easyStep) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (currentPage !== "zones") {
    const [title, subtitle] = EASY_TITLES[easyStep - 1]!;
    $("#page-title").textContent = title;
    $("#page-subtitle").textContent = subtitle;
  }
  $("#easy-demo-bar").hidden = !demo;
  $("#easy-start").hidden = demo;
  $$("#easy-tabs button").forEach((button) =>
    button.classList.toggle("active", button.dataset.page === currentPage),
  );
  // 아래쪽 이전·다음 버튼
  $("#easy-prev").hidden = easyStep === 1;
  const next = $<HTMLButtonElement>("#easy-next");
  next.textContent =
    easyStep === 1
      ? "다음: 기기 찾기"
      : easyStep === 2
        ? "다음: 안경 살펴보기"
        : easyStep === 3
          ? "다음: 기록 남기기"
          : demo
            ? "시연 끝내기"
            : "새 점검 시작";
  next.disabled = easyStep === 1 && !ready;
  $("#easy-next-hint").textContent =
    easyStep === 1 && !ready ? "위 3가지를 모두 체크하면 넘어갈 수 있어요" : "";
  // 2단계: 찾기 버튼과 안내
  const blocked =
    pendingBluetooth || (!demo && (!bluetoothSupported || !ready));
  $<HTMLButtonElement>("#easy-scan-glasses").disabled = blocked;
  $<HTMLButtonElement>("#easy-scan-all").disabled = blocked;
  $("#easy-scan-message").textContent = pendingBluetooth
    ? "목록 창에서 기기를 하나 골라 주세요."
    : !demo && !bluetoothSupported
      ? "이 기기(브라우저)에서는 ‘기기 찾기’를 쓸 수 없어요. 안드로이드 Chrome이나 PC의 Chrome·Edge로 열어 주세요. 3·4단계는 그대로 쓸 수 있어요."
      : !demo && !ready
        ? "1단계의 3가지를 먼저 체크해 주세요."
        : easyNotice;
  // 2단계: 신호등 카드 (의심 후보 → 미확인 → 다른 기기 → 확인 끝 순서)
  const order = { red: 0, yellow: 1, gray: 2, green: 3 };
  const cards = devices
    .filter((d) => (demo ? d.source === "demo" : d.source !== "demo"))
    .map((d) => ({ d, card: easyCard(d) }))
    .sort((a, b) => order[a.card.light] - order[b.card.light]);
  $("#easy-device-cards").innerHTML = cards.length
    ? `<div class="easy-cards">${cards
        .map(
          ({ d, card }) =>
            `<article class="easy-card ${card.light}"><span class="light">${card.title}</span><h3>${esc(d.name)}</h3><p>${card.action}</p><div class="choices" role="group" aria-label="${esc(d.name)} 확인 결과">${(
              [
                ["allowed", "허용 장비"],
                ["followup", "더 확인 필요"],
                ["checked", "실물 확인 끝"],
              ] as const
            )
              .map(
                ([value, label]) =>
                  `<button data-easy-disposition="${value}" data-id="${d.id}" aria-pressed="${d.disposition === value}">${label}</button>`,
              )
              .join(
                "",
              )}</div><label>확인한 곳 <select data-easy-zone="${d.id}" aria-label="${esc(d.name)} 확인한 곳">${zoneOptions(d.zone)}</select></label></article>`,
        )
        .join("")}</div>`
    : '<div class="easy-empty">아직 기록한 기기가 없어요.</div>';
}
$$("[data-easy-step]").forEach((button) =>
  button.addEventListener("click", () => {
    const step = Number(button.dataset.easyStep);
    if (
      step > 1 &&
      mode !== "demo" &&
      !preflight.every(Boolean) &&
      easyStep === 1
    )
      return toast("1단계의 3가지를 먼저 체크해 주세요.");
    setStep(step);
  }),
);
$("#easy-prev").addEventListener("click", () => setStep(easyStep - 1));
$("#easy-next").addEventListener("click", () => {
  if (easyStep < 4) return setStep(easyStep + 1);
  if (mode === "demo") endDemo();
  else $("#reset-button").click();
});
$("#ui-toggle").addEventListener("click", () => {
  uiMode = uiMode === "easy" ? "pro" : "easy";
  writeStore(UI_KEY, uiMode);
  navigate(currentPage);
});

// ── 시연: 블루투스·안경 없이 가상 예시로 4단계를 끝까지 눌러봅니다 ──
function addDemoDevices(names: string[]) {
  const now = new Date().toISOString();
  const fresh = names.filter(
    (name) => !devices.some((d) => d.source === "demo" && d.name === name),
  );
  devices.push(
    ...fresh.map((name): DeviceRecord => ({
      id: crypto.randomUUID(),
      name,
      source: "demo",
      selectedAt: now,
      lastSelectedAt: now,
      selections: 1,
      zone: "미지정",
      disposition: "unreviewed",
      preparation: [...preflight],
    })),
  );
  easyNotice = fresh.length
    ? `가상 기기 ${fresh.length}대를 기록했어요. 아래 카드의 버튼을 눌러 보세요.`
    : "이미 불러온 예시예요. 다른 버튼도 눌러 보세요.";
  renderDevices();
}
function startDemo() {
  if (uiMode !== "easy") {
    uiMode = "easy";
    writeStore(UI_KEY, uiMode);
  }
  mode = "demo";
  easyNotice = "";
  preflight.fill(false);
  updatePreparation();
  renderDevices();
  setStep(1);
  toast("시연을 시작합니다. 가상 예시라서 실제 결과가 아니에요.");
}
function endDemo() {
  mode = "live";
  easyNotice = "";
  devices = devices.filter((d) => d.source !== "demo");
  inspections = inspections.filter((i) => i.source !== "demo");
  preflight.fill(false);
  updatePreparation();
  renderDevices();
  renderRecords();
  setStep(1);
  toast("시연을 마쳤습니다. 시연 기록은 지웠어요.");
}
$("#easy-demo-start").addEventListener("click", startDemo);
$("#easy-demo-end").addEventListener("click", endDemo);
function easyScan(scope: ScanScope) {
  if (mode === "demo")
    return addDemoDevices(
      scope !== "all"
        ? ["Ray-Ban Meta · 가상 예시"]
        : ["AirPods Pro · 가상 예시", "이름 없는 기기 · 가상 예시"],
    );
  scanScope = scope;
  easyNotice = "";
  renderScan();
  $("#scan-button").click();
}
$("#easy-scan-glasses").addEventListener("click", () =>
  easyScan("glasses-plus"),
);
$("#easy-scan-all").addEventListener("click", () => easyScan("all"));
$("#easy-device-cards").addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>(
    "[data-easy-disposition]",
  );
  const record = devices.find((d) => d.id === button?.dataset.id);
  if (!button || !record) return;
  const value = button.dataset.easyDisposition as Disposition;
  // 같은 버튼을 다시 누르면 선택을 풉니다
  record.disposition = record.disposition === value ? "unreviewed" : value;
  renderDevices();
});
$("#easy-device-cards").addEventListener("change", (event) => {
  const select = event.target as HTMLSelectElement;
  const record = devices.find((d) => d.id === select.dataset.easyZone);
  if (!record) return;
  record.zone = select.value as Zone;
  renderDevices();
});

// ── 4단계: 기록지(인쇄·PDF)와 엑셀용 파일 ──
const metaInputs = {
  exam: "#meta-exam",
  room: "#meta-room",
  proctor: "#meta-proctor",
} as const;
(Object.keys(metaInputs) as (keyof typeof metaInputs)[]).forEach((key) =>
  $<HTMLInputElement>(metaInputs[key]).addEventListener("input", (event) => {
    meta[key] = (event.target as HTMLInputElement).value.slice(0, 60);
    persist();
  }),
);
const printSheet = document.createElement("section");
printSheet.id = "print-sheet";
printSheet.setAttribute("aria-hidden", "true");
document.body.append(printSheet);
function buildSheet() {
  const demo = mode === "demo";
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { hour12: false });
  const shownDevices = devices.filter((d) =>
    demo ? true : d.source !== "demo",
  );
  const shownInspections = inspections.filter((i) =>
    demo ? true : i.source !== "demo",
  );
  const blank =
    '<tr><td colspan="6" style="text-align:center">기록 없음</td></tr>';
  printSheet.innerHTML = `${demo ? '<p class="demo-mark">시연용 예시 · 실제 점검 기록이 아닙니다</p>' : ""}
    <h1>스마트안경 점검 기록지</h1>
    <table><tbody><tr><th>시험명</th><td>${esc(meta.exam)}</td><th>시험실</th><td>${esc(meta.room)}</td></tr><tr><th>감독위원</th><td>${esc(meta.proctor)}</td><th>작성 시각</th><td>${stamp(new Date().toISOString())}</td></tr></tbody></table>
    <h2>1. 점검 전 준비</h2>
    <table><tbody><tr>${PREP_LABELS.map((label, i) => `<td>${preflight[i] ? "☑" : "☐"} ${label}</td>`).join("")}</tr></tbody></table>
    <h2>2. 확인한 기기 (${shownDevices.length}건)</h2>
    <table><thead><tr><th>번호</th><th>기록 시각</th><th>기기 이름</th><th>판단 단서</th><th>확인한 곳</th><th>확인 상태</th></tr></thead><tbody>${shownDevices.map((d, i) => `<tr><td>${i + 1}</td><td>${stamp(d.lastSelectedAt)}</td><td>${esc(d.name)}</td><td>${hintLabel(d)}</td><td>${d.zone}</td><td>${DISPOSITIONS[d.disposition]}</td></tr>`).join("") || blank}</tbody></table>
    <h2>3. 안경 관찰 기록 (${shownInspections.length}건)</h2>
    <table><thead><tr><th>번호</th><th>기록 시각</th><th>확인한 곳</th><th>방법</th><th colspan="2">관찰한 특징</th></tr></thead><tbody>${shownInspections.map((i, n) => `<tr><td>${n + 1}</td><td>${stamp(i.createdAt)}</td><td>${i.zone}</td><td>${i.source === "demo" ? "연습용 그림" : i.source === "camera" ? "카메라" : "사진"}</td><td colspan="2">${esc(i.observations.join(" / ") || "관찰 항목 없음 (정상 판정 아님)")}</td></tr>`).join("") || blank}</tbody></table>
    <p class="note">※ 이 기록지는 관찰한 사실을 적은 참고 자료입니다. 부정행위 여부와 소지자 확인은 시험 주관기관의 절차에 따릅니다.<br>※ 기기 이름은 기기가 스스로 알린 값이며, 바꿀 수 있고 소유자 정보가 아닙니다.</p>
    <div class="sign"><span>감독위원: ________________ (서명)</span><span>확인자: ________________ (서명)</span></div>`;
}
$("#print-sheet-button").addEventListener("click", () => {
  buildSheet();
  window.print();
});
$("#export-csv").addEventListener("click", () => {
  const blob = new Blob(
    [toCsv(meta, preflight, devices, inspections, mode === "demo")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `examguard-record-${new Date().toISOString().slice(0, 10)}.csv`; // 한글 파일명은 일부 브라우저에서 무시되어 영문 사용
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("엑셀용 파일을 받았습니다. 엑셀에서 바로 열 수 있어요.");
});
$("#easy-json").addEventListener("click", () => $("#export-report").click());
$("#easy-help").addEventListener("click", () =>
  openDialog(
    `<h2 id="dialog-title">이렇게 쓰세요</h2><ol class="help-steps"><li><strong>준비</strong><p>휴대전화 끄기 · 전자기기 걷기 · 허용 장비 확인을 체크합니다.</p></li><li><strong>기기 찾기</strong><p>버튼을 누르고 목록에서 기기를 하나 고르면 카드로 기록됩니다.</p></li><li><strong>안경 보기</strong><p>의심되는 안경은 교탁에 놓고 카메라로 살펴보거나 도감과 비교합니다.</p></li><li><strong>기록</strong><p>기록지를 인쇄하거나 엑셀용 파일로 받습니다.</p></li></ol><div class="dialog-note"><strong>카드 색의 뜻</strong><p>빨강: 스마트안경일 수 있음 (이름 또는 제조사 번호) · 노랑: 어떤 기기인지 모름 · 회색: 안경이 아닌 전자기기 이름 · 초록: 확인 끝</p><strong>꼭 알아 두세요</strong><p>교실 전체를 자동으로 훑지 못합니다. 목록에서 고른 기기만 기록합니다.<br>전원이 꺼진 안경은 목록에 나오지 않습니다. 눈으로 하는 확인이 기본입니다.<br>이 도구는 판정하지 않습니다. 최종 판단은 기관 절차에 따릅니다.</p></div><button class="button secondary small" data-browser-help>기기별로 여는 방법 ${icon("arrow")}</button><p class="tiny">원본: <a class="text-button" href="${repository}" target="_blank" rel="noopener noreferrer">ExamGuard (epoko77-ai, MIT 라이선스)</a> · 쉬운 화면을 덧붙인 수정본입니다.</p>`,
  ),
);

// 저장해 둔 현장 기록을 되살립니다 (새로고침·실수로 닫기 대비)
const saved = parseSaved(readStore(STORAGE_KEY));
if (saved) {
  saved.preflight.forEach((value, i) => (preflight[i] = value));
  devices = saved.devices;
  inspections = saved.inspections;
  saved.deviceKeys.forEach(([key, id]) => deviceKeys.set(key, id));
  meta = saved.meta;
  easyStep = saved.step;
}
(Object.keys(metaInputs) as (keyof typeof metaInputs)[]).forEach(
  (key) => ($<HTMLInputElement>(metaInputs[key]).value = meta[key]),
);

updatePreparation();
renderDevices();
renderGuides();
renderRadio();
renderRecords();
updateConnection();
const startPage = location.hash.slice(1);
if (uiMode === "easy" && !startPage) setStep(easyStep, false);
else navigate((startPage || "wireless") as Page, false);
if (params.get("demo") === "1") startDemo();
else if (saved && saved.devices.length + saved.inspections.length > 0)
  toast("이전에 하던 점검 기록을 불러왔습니다.");
