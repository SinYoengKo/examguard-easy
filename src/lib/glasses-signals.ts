// 이름을 바꾼 기기도 목록에 뜨게 하는 "제조사 번호 · 서비스 번호" 단서.
//
// 블루투스 기기는 이름과 별도로, 신호 안에 제조사 번호(Bluetooth SIG 회사 식별자)나
// 서비스 번호(UUID)를 넣어 보냅니다. 이 값은 사용자가 이름을 바꿔도 그대로입니다.
//
// 주의: 아래 값은 실기기로 직접 검증한 것이 아니라, 공개 프로젝트들이 공개한 값을 모은 것입니다.
// 같은 제조사의 다른 제품(예: VR 기기)도 같은 번호를 쓰므로 "안경 확정"이 아니라 "실물 확인 대상"입니다.
// 값을 추가·삭제할 때는 반드시 출처를 함께 적어 주세요.
import { buildBluetoothRequest } from "./bluetooth-scan.ts";

export interface GlassesSignal {
  kind: "company" | "service";
  /** company: 0~65535 정수 / service: 16비트 번호 또는 128비트 UUID 문자열 */
  value: number | string;
  label: string;
  products: string;
  /** 다른 제품과 겹칠 가능성 */
  caveat: string;
  sources: string[];
}

const NEARBY = "https://github.com/yjeanrenaud/yj_nearbyglasses";
const SQUACH =
  "https://github.com/skizzophrenic/SquachWatch-CYD/blob/master/docs/DETECTIONS.md";
const ZUCKOFF =
  "https://dev.to/saptadev27/how-zuckoff-uses-ble-fingerprints-to-detect-camera-glasses-nearby-nai";
const BANRAYS = "https://github.com/NullPxl/banrays";
const ROKID_MIAZGA = "https://marcinmiazga.com/rokid-cxrm-upgrade";
const ROKID_DOCS =
  "https://github.com/buildwithfenna/rokid-docs/blob/main/cxr-m/device-connection.md";
const ROKID_SF = "https://segmentfault.com/a/1190000047319027";

/** 목록 창 필터에 실제로 쓰는 단서 (공개 프로젝트 2곳 이상에서 같은 값을 쓰는 것 위주) */
export const GLASSES_SIGNALS: GlassesSignal[] = [
  {
    kind: "company",
    value: 0x01ab,
    label: "Meta Platforms",
    products: "Ray-Ban Meta 등",
    caveat: "Meta의 다른 블루투스 제품(Quest 등)도 같은 번호",
    sources: [NEARBY, SQUACH, BANRAYS],
  },
  {
    kind: "company",
    value: 0x058e,
    label: "Meta Platforms Technologies",
    products: "Meta 웨어러블",
    caveat: "Meta의 다른 블루투스 제품도 같은 번호",
    sources: [NEARBY, SQUACH, ZUCKOFF],
  },
  {
    kind: "company",
    value: 0x0d53,
    label: "Luxottica",
    products: "Ray-Ban Meta, Oakley Meta",
    caveat: "Luxottica의 다른 블루투스 제품이 있다면 같은 번호",
    sources: [NEARBY, SQUACH, ZUCKOFF],
  },
  {
    kind: "company",
    value: 0x03c2,
    label: "Snap",
    products: "Spectacles",
    caveat: "Snap의 다른 블루투스 제품이 있다면 같은 번호",
    sources: [NEARBY, SQUACH, ZUCKOFF],
  },
  {
    kind: "service",
    value: 0xfd5f,
    label: "Meta(Oculus) 서비스 번호",
    products: "Ray-Ban Meta",
    caveat: "Meta의 VR 기기도 쓸 수 있는 번호",
    sources: [SQUACH, ZUCKOFF, BANRAYS],
  },
  {
    kind: "service",
    value: 0x9100,
    label: "Rokid Glasses 서비스 번호",
    products: "Rokid Glasses (AI 안경)",
    caveat:
      "공식 등록 번호가 아니라 다른 기기가 우연히 같은 번호를 쓸 수 있음. 페어링 모드가 아닐 때도 신호가 나오는지는 미확인",
    sources: [ROKID_MIAZGA, ROKID_DOCS, ROKID_SF],
  },
  {
    kind: "service",
    value: "7905fff0-b5ce-4e99-a40f-4b1e122d00d0",
    label: "HeyCyan 계열 서비스 번호",
    products: "HeyCyan 앱을 쓰는 보급형 카메라 안경",
    caveat: "출처 1곳",
    sources: [NEARBY],
  },
];

/**
 * 일부러 넣지 않은 값. 넣으면 일반 이어폰이 대량으로 걸립니다.
 * (문서·검토용 기록이며 필터에는 쓰지 않습니다.)
 */
export const EXCLUDED_SIGNALS: GlassesSignal[] = [
  {
    kind: "company",
    value: 0x05d6,
    label: "Zhuhai Jieli Technology",
    products: "일부 보급형 카메라 안경",
    caveat: "범용 블루투스 칩 제조사라 저가 이어폰·스피커 다수가 같은 번호",
    sources: [NEARBY],
  },
];

type Filter =
  | { namePrefix: string }
  | { manufacturerData: { companyIdentifier: number }[] }
  | { services: (number | string)[] };

/** "안경 종류만 찾기"용: 이름 단서 + 제조사·서비스 번호 단서를 한 목록 창에 함께 겁니다. */
export function buildSignalRequest(): { filters: Filter[] } {
  const names = buildBluetoothRequest("glasses").filters ?? [];
  return {
    filters: [
      ...names,
      ...GLASSES_SIGNALS.map((signal): Filter =>
        signal.kind === "company"
          ? {
              manufacturerData: [{ companyIdentifier: signal.value as number }],
            }
          : { services: [signal.value] },
      ),
    ],
  };
}

/** 이름 단서(접두어)에 걸리는 이름인지. 아니라면 번호 단서로 목록에 뜬 기기입니다. */
export function matchesGlassesName(name: string): boolean {
  return (buildBluetoothRequest("glasses").filters ?? []).some((filter) =>
    name.startsWith(filter.namePrefix),
  );
}
