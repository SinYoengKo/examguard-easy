// "glasses-plus" = 이름 단서 + 제조사·서비스 번호 단서 (쉬운 화면, glasses-signals.ts)
export type ScanScope = "glasses" | "all" | "glasses-plus";
export type BluetoothRequestOptions =
  | { filters: { namePrefix: string }[]; acceptAllDevices?: never }
  | { acceptAllDevices: true; filters?: never };

// Search terms, not verified advertisements or a device identification database.
// Web Bluetooth matches prefixes case-sensitively. Keep broad search explicit:
// an unnamed, renamed or differently capitalized device can miss these terms.
const namePrefixes = [
  "Ray-Ban",
  "Ray Ban",
  "RayBan",
  "Rayban",
  "Ray_Ban",
  "Meta Wayfarer",
  "Meta Headliner",
  "Meta Skyler",
  "Even G1",
  "Even G2",
  "Even Realities G1",
  "Even Realities G2",
  "Even_G1",
  "Even_G2",
  "XREAL Air",
  "XREAL One",
  "HUAWEI Eyewear",
  "Huawei Eyewear",
  "Mijia Audio Glasses",
  "Mijia Smart Audio Glasses",
  "Smart Glasses",
  "SmartGlasses",
  "AI Glasses",
  "AIGlasses",
  "HeyCyan",
  "Heycyan",
  // Rokid: 공개 개발 자료의 스캔 예제가 이름에 "Rokid" 또는 "Glasses"가 들어간 기기를 고릅니다.
  // (docs/EASY_GUIDE.md 의 번호·이름 단서 출처 참고)
  "Rokid",
  "Glasses",
  "스마트 안경",
  "스마트안경",
];

export function buildBluetoothRequest(
  scope: ScanScope,
): BluetoothRequestOptions {
  if (scope === "all") return { acceptAllDevices: true };
  // "glasses-plus"의 번호 단서는 glasses-signals.ts가 덧붙입니다. 여기서는 이름 단서만 만듭니다.
  const prefixes = new Set(
    namePrefixes.flatMap((prefix) => [
      prefix,
      prefix.toLowerCase(),
      prefix.toUpperCase(),
    ]),
  );
  return { filters: [...prefixes].map((namePrefix) => ({ namePrefix })) };
}
