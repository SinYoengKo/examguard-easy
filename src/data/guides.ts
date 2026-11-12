export interface Guide {
  id: string;
  name: string;
  category: "camera" | "display" | "audio" | "custom";
  label: string;
  sample: string;
  description: string;
  points: string[];
  caveat: string;
  source: string;
  sourceLabel: string;
  glance: string;
  marks: string;
  power: string;
  comparison: string;
  sourcePhoto?: string;
  features: { location: string; title: string; detail: string }[];
}
export const guides: Guide[] = [
  {
    id: "meta",
    name: "Ray-Ban Meta · Wayfarer",
    category: "camera",
    label: "카메라 · 오디오",
    sample: "camera",
    description:
      "일반 Wayfarer와 닮은 프레임. 앞쪽 양 끝의 원형 부품부터 확인하세요.",
    glance: "앞쪽 카메라·표시등 → 안경다리 스피커 → 모델명",
    points: [
      "앞쪽의 카메라 렌즈와 촬영 표시등",
      "안경다리의 스피커·전원 스위치",
      "제품 표기와 공식 자료 대조",
    ],
    features: [
      {
        location: "앞면 양 끝",
        title: "카메라 렌즈와 촬영 표시등",
        detail:
          "두 원형 부품의 용도는 다릅니다. 일반 프레임의 금속 장식·리벳과 비교하세요.",
      },
      {
        location: "안경다리",
        title: "스피커와 전원 스위치",
        detail:
          "별도 개구부·조작부를 관찰합니다. 다리 두께 하나만으로 판정하지 않습니다.",
      },
      {
        location: "모델 표기",
        title: "세대와 제품명 확인",
        detail:
          "같은 Wayfarer라도 세대·크기별 모델이 다릅니다. 안쪽 표기를 공식 제품 페이지와 대조하세요.",
      },
    ],
    marks: "Ray-Ban Meta Wayfarer · 일반 Wayfarer와 구분",
    power:
      "카메라·오디오 기능. 표시등이 꺼진 상태가 전원 종료를 뜻하지는 않습니다.",
    comparison:
      "일반 Wayfarer의 앞쪽 장식도 점처럼 보입니다. 렌즈·표시등·조작부를 함께 확인하세요.",
    caveat:
      "Wayfarer 계열의 관찰 안내입니다. 모든 Meta 제품이 같은 기능·외형을 갖는 것은 아닙니다.",
    source:
      "https://www.ray-ban.com/usa/c/frequently-asked-questions-ray-ban-meta-smart-glasses",
    sourceLabel: "Ray-Ban 공식 FAQ",
    sourcePhoto:
      "https://commons.wikimedia.org/wiki/File:Ray-Ban_Meta_Gen_1_smart_glasses_with_charging_case.jpg",
  },
  {
    id: "even",
    name: "Even Realities G1",
    category: "display",
    label: "디스플레이",
    sample: "g1",
    description:
      "얇은 프레임과 디지털 렌즈. 다리 끝의 TouchBar와 충전 표면이 단서입니다.",
    glance: "렌즈 광학부 → 다리 끝 TouchBar → 충전 표면",
    points: [
      "렌즈 안의 디지털 표시 영역",
      "다리 끝부분의 TouchBar",
      "다리 끝의 충전 접촉 표면",
    ],
    features: [
      {
        location: "렌즈·앞 프레임",
        title: "디지털 렌즈와 광학 엔진",
        detail:
          "공식 설명서의 digital lenses·optical engines 위치를 대조합니다. 단순 코팅 반사와 구별해야 합니다.",
      },
      {
        location: "안경다리 끝",
        title: "TouchBar 영역",
        detail:
          "귀 뒤로 내려오는 팁 부분에 터치 조작 영역이 있습니다. 몸체와 다리 끝을 함께 살펴보세요.",
      },
      {
        location: "안경다리 끝·케이스",
        title: "충전 접촉 표면",
        detail:
          "설명서는 wireless charging contact surfaces로 표기합니다. 노출 금속 핀이 반드시 있다는 뜻은 아닙니다.",
      },
    ],
    marks: "G1 · G2 및 다른 세대와 제품 표기 대조",
    power:
      "렌즈로 정보를 표시합니다. 카메라 부품만 찾는 검사로는 충분하지 않습니다.",
    comparison:
      "일반 금속테도 코팅의 녹색 반사가 생깁니다. 색만 보고 디스플레이로 판단하지 마세요.",
    caveat: "도식은 관찰 위치를 설명하며 실제 격자·크기를 재현하지 않습니다.",
    source:
      "https://support.evenrealities.com/hc/en-us/articles/14301335051023-User-guide",
    sourceLabel: "Even G1 공식 사용자 가이드",
    sourcePhoto: "https://www.evenrealities.com/g1",
  },
  {
    id: "xreal",
    name: "XREAL Air 2",
    category: "display",
    label: "유선 디스플레이",
    sample: "xreal",
    description:
      "선글라스 뒤의 별도 광학부. USB-C 연결부와 안쪽 렌즈 구조를 확인하세요.",
    glance: "안쪽 광학부 → USB-C 연결부 → Air 2 모델 표기",
    points: [
      "렌즈 뒤쪽의 별도 광학부",
      "안경다리의 USB-C 연결부",
      "Air 2 / Pro / Ultra 모델 구분",
    ],
    features: [
      {
        location: "렌즈 안쪽",
        title: "디스플레이 광학계",
        detail:
          "바깥 렌즈 뒤쪽 구조를 옆·아래에서 확인합니다. 앞면만 보면 일반 선글라스와 닮았습니다.",
      },
      {
        location: "안경다리 끝",
        title: "탈착식 USB-C 연결",
        detail:
          "구성품에 USB Type-C 케이블이 포함됩니다. 케이블 연결부가 주요 단서입니다.",
      },
      {
        location: "모델·부품",
        title: "Air 2 모델 확인",
        detail:
          "Air 2는 실세계 촬영 카메라가 없는 모델입니다. Pro·Ultra와 기능을 혼동하지 마세요.",
      },
    ],
    marks: "XREAL Air 2 · Pro / Ultra와 구분",
    power:
      "연결 기기에서 화면을 받는 유선 디스플레이. BLE 목록에 나타난다고 가정하면 안 됩니다.",
    comparison:
      "도수 삽입 렌즈와 디스플레이 광학계를 구분하고 USB-C 연결부·제품 표기를 대조하세요.",
    caveat: "공식 무게는 72 g이지만 손으로 느낀 무게는 식별 기준이 아닙니다.",
    source: "https://us.shop.xreal.com/products/xreal-air-2",
    sourceLabel: "XREAL Air 2 공식 제품·FAQ",
    sourcePhoto: "https://us.shop.xreal.com/products/xreal-air-2",
  },
  {
    id: "mijia",
    name: "Xiaomi Mijia Smart Audio",
    category: "audio",
    label: "오디오",
    sample: "mijia",
    description:
      "Browline·Pilot 등 여러 프레임. 소리 구멍과 충전 접점을 대조하세요.",
    glance: "안경다리 소리 구멍 → 터치 영역 → 금속 충전 접점",
    points: [
      "귀걸이 앞쪽의 소리 구멍",
      "안경다리의 터치 조작 영역",
      "충전 케이블이 닿는 금속 접점",
    ],
    features: [
      {
        location: "귀 앞쪽 안경다리",
        title: "소리 구멍",
        detail:
          "공식 FAQ는 소리 구멍이 다리의 ear loops 앞쪽에 있다고 설명합니다. 일반 나사 구멍과 비교하세요.",
      },
      {
        location: "안경다리 외측",
        title: "터치 조작 영역",
        detail:
          "다리의 터치 영역으로 음악·통화 등을 조작합니다. 버튼이 보이지 않아도 전자 기능이 있을 수 있습니다.",
      },
      {
        location: "안경다리 충전부",
        title: "금속 충전 접점",
        detail:
          "공식 FAQ의 충전 케이블·접점 안내와 대조합니다. 프레임 교체가 가능해 앞면만으로 구분하기 어렵습니다.",
      },
    ],
    marks: "Mijia Smart Audio Glasses · Xiaomi AI Glasses와 구분",
    power: "오디오 기능 중심. 카메라형 Xiaomi AI Glasses와 구분해야 합니다.",
    comparison:
      "브로우라인·금속테는 일반 안경에도 흔합니다. 전자부가 들어 있는 다리를 먼저 보세요.",
    caveat:
      "지역·세대별 제품이 다릅니다. 아래 글로벌 제품·FAQ에 연결된 모델을 기준으로 합니다.",
    source: "https://www.mi.com/global/support/faq/details/KA-652551/",
    sourceLabel: "Xiaomi 공식 Mijia FAQ",
    sourcePhoto: "https://www.mi.com/global/product/mijia-smart-audio-glasses/",
  },
  {
    id: "huawei",
    name: "HUAWEI Eyewear 2",
    category: "audio",
    label: "오디오",
    sample: "huawei",
    description:
      "다양한 금속·선글라스 프레임. 스피커 그릴과 자석식 충전부를 확인하세요.",
    glance: "안경다리 스피커 → 터치 영역 → 자석식 충전 접점",
    points: [
      "안경다리의 스피커 그릴",
      "다리 부분의 자석식 충전 접점",
      "HUAWEI Eyewear 2 모델 표기",
    ],
    features: [
      {
        location: "안경다리",
        title: "스피커 그릴",
        detail:
          "공식 제품 안내의 open acoustic design과 다리 부분의 그릴을 대조합니다.",
      },
      {
        location: "안경다리",
        title: "터치 조작 영역",
        detail:
          "터치·스와이프 조작 영역을 확인합니다. 두께만으로 전자기기를 확정하지 않습니다.",
      },
      {
        location: "다리 충전부",
        title: "자석식 충전 접점",
        detail:
          "충전 컨버터가 양쪽 다리에 연결됩니다. 공식 사양의 magnetic springs 방식과 대조하세요.",
      },
    ],
    marks: "HUAWEI Eyewear 2 · 초기 Eyewear와 구분",
    power:
      "블루투스 오디오·통화 기능. 카메라가 없어도 전자 기능이 있을 수 있습니다.",
    comparison:
      "장식·나사와 충전 접점을 구분하고 모델명과 충전 구조를 함께 대조하세요.",
    caveat:
      "보조공학 기기 등 허용 장비의 판단은 시험 주관기관 절차를 따릅니다.",
    source: "https://consumer.huawei.com/en/audio/huawei-eyewear-2/specs/",
    sourceLabel: "HUAWEI 공식 제품 사양",
    sourcePhoto: "https://consumer.huawei.com/en/audio/huawei-eyewear-2/",
  },
  {
    id: "normal",
    name: "일반 안경 · 외형 비교",
    category: "custom",
    label: "비교 참고",
    sample: "normal",
    description: "리벳·나사·코팅 반사가 전자부처럼 보이는 경우를 비교하세요.",
    glance: "장식·나사 → 코팅 반사 → 제품 표기",
    points: [
      "장식 리벳과 카메라 렌즈 구분",
      "코팅 반사와 별도 광학부 구분",
      "모델 표기로 실제 제품 대조",
    ],
    features: [
      {
        location: "앞면",
        title: "장식 리벳",
        detail:
          "일반 안경에도 금속 리벳이 있습니다. 점이나 반사만으로 카메라로 간주하지 않습니다.",
      },
      {
        location: "렌즈",
        title: "코팅 반사",
        detail:
          "일반 렌즈에서도 유색 반사가 보입니다. 색상 하나로 HUD를 판별하지 않습니다.",
      },
      {
        location: "안경다리",
        title: "제품 표기 대조",
        detail:
          "제조사·모델 표기와 부품을 확인합니다. 이 카드와 닮았다는 결과는 정상 판정이 아닙니다.",
      },
    ],
    marks: "제조사·모델별 표기가 다릅니다.",
    power: "사진 유사도는 전원·전자 기능의 존재를 판정하지 못합니다.",
    comparison:
      "일반 안경과 스마트안경의 전체 형태는 비슷합니다. 작은 부품의 실물 대조가 필요합니다.",
    caveat:
      "비교용 카드입니다. 검색 결과에 제시되어도 전자 기능이 없다는 뜻은 아닙니다.",
    source:
      "https://commons.wikimedia.org/wiki/File:Ray_Ban_Original_Wayfarer.jpg",
    sourceLabel: "일반 Wayfarer 참고 사진·출처",
  },
];
export const observationLabels = [
  "카메라처럼 보이는 원형 부품",
  "충전 접점 또는 연결 단자",
  "스피커·마이크로 보이는 개구부",
  "렌즈 내부의 별도 광학 영역",
  "모델명·전자기기 표기",
];
