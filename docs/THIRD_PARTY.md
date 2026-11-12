# 제3자 자료와 라이선스

앱 코드와 자체 제작 SVG는 루트 MIT 라이선스를 따릅니다. 제3자 상표와 원본 사진에는 앱 라이선스를 덧씌우지 않습니다.

## 실행 모델·라이브러리

- CLIP, Copyright (c) 2021 OpenAI, MIT. [고지 원문](../public/licenses/CLIP-MIT.txt), [원본 프로젝트](https://github.com/openai/CLIP). ONNX 변환: [Xenova/clip-vit-base-patch32](https://huggingface.co/Xenova/clip-vit-base-patch32), 모델 카드 MIT. 고정 리비전·해시는 설치 스크립트에 기재했습니다.
- ONNX Runtime, Copyright (c) Microsoft Corporation, MIT. [고지 원문](../public/licenses/onnxruntime-MIT.txt). 실행 엔진은 설치된 패키지와 같은 버전의 파일을 사용합니다.
- Transformers.js는 Apache-2.0입니다. NPM 패키지의 라이선스를 배포 고지에 포함합니다. 다른 의존성은 각 패키지의 고지를 따릅니다.
- 일부 UI 아이콘의 기하 도형은 Feather 계열을 참고했습니다. [Feather MIT 고지](../public/licenses/Feather-MIT.txt)를 포함합니다.

## 사진

`tests/fixtures/meta-crop.jpg`는 CCadio의 [Ray-Ban Meta Gen 1 smart glasses with charging case](https://commons.wikimedia.org/wiki/File:Ray-Ban_Meta_Gen_1_smart_glasses_with_charging_case.jpg)를 크롭·JPEG 재인코딩한 테스트 사진입니다. 원본 및 크롭은 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)에 따라 사용합니다. 저작자는 이 프로젝트를 보증하지 않습니다. 크롭 좌표는 참조 출처 파일에 있습니다.

일반 안경 참조 사진은 Jaschke의 [Ray Ban Original Wayfarer](https://commons.wikimedia.org/wiki/File:Ray_Ban_Original_Wayfarer.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)입니다. 앱에는 원본 픽셀을 넣지 않고 숫자 특징 벡터만 포함합니다.

Even Realities, XREAL, Xiaomi, Huawei 공식 제품 페이지의 이미지 역시 공개 저장소·배포 앱에 원본 픽셀을 포함하지 않습니다. 각 회사가 권리를 보유합니다. 개발 시 출처 이미지를 로컬에서 읽어 이미지 검색용 수치 특징을 만들었습니다. 출처·파일 해시·가공 영역을 [참조 목록](reference-sources.json)에 기록했습니다. 이 목록은 사진 재배포 허가를 의미하지 않습니다.

## 도감 도식

`public/sample-*.svg`는 관찰 위치를 설명하기 위해 코드로 그린 자체 도식입니다. 제품 사진·실측 도면·검증된 시그니처가 아니며, 정확한 모양은 연결된 공식 자료와 실물에서 확인해야 합니다.
