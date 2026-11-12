export type BrowserEnvironment = {
  userAgent: string;
  maxTouchPoints: number;
  secureContext: boolean;
  hasBluetoothChooser: boolean;
};

// UA is used only to explain alternatives. Actual API presence controls access.
export function getBrowserSupport(environment: BrowserEnvironment) {
  const { userAgent, maxTouchPoints, secureContext, hasBluetoothChooser } =
    environment;
  const platform =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
      ? "ios"
      : /Android/i.test(userAgent)
        ? "android"
        : /CrOS/i.test(userAgent)
          ? "chromeos"
          : /Windows/i.test(userAgent)
            ? "windows"
            : /Macintosh|Mac OS X/i.test(userAgent)
              ? "mac"
              : /Linux/i.test(userAgent)
                ? "linux"
                : "other";
  const supported = secureContext && hasBluetoothChooser;
  if (supported)
    return {
      platform,
      supported,
      title:
        platform === "ios"
          ? "iPhone·iPad의 BLE 선택 기능 확인 · 호환성 시험"
          : "이 브라우저는 Bluetooth 기기 선택을 지원합니다",
      description:
        platform === "ios"
          ? "브라우저의 Bluetooth 선택 기능이 확인됐습니다. Bluefy 등 별도 iOS 브라우저와 ExamGuard의 실기기 호환성은 아직 검증하지 않았습니다. Bluetooth를 켜고 요청되는 권한을 허용한 뒤 시험해 보세요."
          : "별도 ExamGuard 앱 다운로드 없이 사용할 수 있습니다. Bluetooth를 켜고 요청되는 권한을 허용하세요. 실제 탐색에는 사용 가능한 Bluetooth 어댑터가 필요합니다.",
      hint: "위의 준비 항목 3개를 확인한 뒤 기기 선택창을 여세요.",
      steps: [] as string[],
    };
  if (platform === "ios")
    return {
      platform,
      supported,
      title: "현재 iPhone·iPad 브라우저에서는 BLE 탐색을 지원하지 않습니다",
      description:
        "Safari와 일반 iPhone·iPad용 Chrome은 Web Bluetooth를 지원하지 않습니다. 홈 화면에 추가해도 이 제한은 해결되지 않습니다. 별도 Bluefy 브라우저에서는 BLE 탐색을 시도할 수 있습니다.",
      hint: "iPhone: Bluefy에서 BLE 탐색을 시도할 수 있습니다(실기기 미검증). Safari에서는 B·C 모드를 이용하세요.",
      steps: [
        "아래 App Store 링크에서 Bluefy를 설치하고 ‘앱 주소 복사’를 누르세요.",
        "Bluefy 앱을 직접 실행해 주소창에 붙여넣으세요. Bluetooth를 켜고 Bluefy의 Bluetooth 권한을 허용하세요.",
        "준비 항목 3개를 확인한 뒤 ‘교실 스캔 시작’을 누르세요. ExamGuard와의 실기기 호환성은 아직 검증하지 않았습니다.",
        "광학 검사·도감은 Safari에서 이용할 수 있습니다. BLE 탐색이 작동하지 않으면 Android의 Chrome 또는 지원 PC를 이용하세요.",
      ],
    };
  if (!secureContext)
    return {
      platform,
      supported,
      title: "보안 연결(HTTPS)로 앱을 열어주세요",
      description:
        "현재 연결에서는 Bluetooth 기능을 사용할 수 없습니다. 아래 공식 HTTPS 주소로 접속하세요. 파일을 다운로드해 여는 방식은 필요하지 않습니다.",
      hint: "아래 앱 주소를 지원 브라우저의 주소창에 붙여넣어 여세요.",
      steps: [
        "아래 ‘앱 주소 복사’를 누르세요.",
        "Android의 Chrome 또는 Windows·Mac의 Chrome/Edge를 직접 실행해 주소창에 붙여넣으세요.",
      ],
    };
  if (platform === "android")
    return {
      platform,
      supported,
      title: "Android에서는 Chrome 앱으로 열어주세요",
      description:
        "현재 브라우저에서 Bluetooth 기능을 사용할 수 없습니다. 카카오톡·네이버·SNS 안에서 열린 화면이라면 Chrome 앱을 직접 실행하세요. 별도 ExamGuard 앱 다운로드는 필요 없습니다.",
      hint: "Android: 앱 주소 복사 → Chrome 앱 실행 → 주소창에 붙여넣기.",
      steps: [
        "아래 ‘앱 주소 복사’를 누르세요.",
        "휴대전화의 Chrome 앱을 직접 실행하고 주소창에 붙여넣으세요.",
        "Bluetooth를 켜고 요청되는 권한을 허용하세요. Chrome에서도 안내가 계속되면 최신 버전·기기 설정을 확인하세요.",
      ],
    };
  return {
    platform,
    supported,
    title: "Bluetooth 탐색은 지원되는 PC 브라우저에서 열어주세요",
    description:
      "Windows 10/11·macOS에서는 Chrome 또는 Edge, Chromebook에서는 Chrome을 이용하세요. Safari·Firefox는 Web Bluetooth를 지원하지 않으며, Linux의 기본 환경도 권장하지 않습니다.",
    hint: "Windows·Mac: Chrome/Edge를 사용하세요. Safari에서는 광학 검사와 도감을 이용할 수 있습니다.",
    steps: [
      "아래 앱 주소를 복사해 지원 브라우저의 주소창에서 여세요.",
      "PC의 Bluetooth 어댑터와 Bluetooth 설정을 켜고 브라우저 권한을 확인하세요.",
    ],
  };
}
