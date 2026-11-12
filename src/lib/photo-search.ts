import { icon } from "./icons";
import type { PhotoCandidate } from "./photo-ranking";
import { guides } from "../data/guides";
import { escapeHtml as esc } from "./core";

export class PhotoSearch {
  private worker: Worker | null = null;
  private id = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private source = document.createElement("canvas");
  private preview = document.createElement("canvas");
  private busy = false;
  constructor(private root: HTMLElement) {
    root.innerHTML = `<article class="panel photo-search"><div class="photo-search-intro"><div class="feature-icon">${icon("search")}</div><div><div class="eyebrow">PHOTO → FIELD GUIDE</div><h2>사진으로 비슷한 기종 찾기</h2><p>안경을 크게 찍어보세요. 닮은 도감 후보 3개와 확인할 부품을 함께 보여드립니다.</p><div class="button-row"><button class="button primary" id="photo-capture">${icon("camera")} 사진 찍기</button><button class="button secondary" id="photo-file">${icon("upload")} 사진 선택</button><button class="text-button" id="photo-clear" hidden>사진·결과 지우기 ${icon("close")}</button></div><p class="tiny">처음 사용 시 약 110 MB 다운로드 · 사진은 이 기기에서 처리 · 현장 정확도 미검증</p></div></div><input type="file" id="photo-capture-input" accept="image/jpeg,image/png,image/webp" capture="environment" hidden/><input type="file" id="photo-file-input" accept="image/jpeg,image/png,image/webp" hidden/><div class="photo-progress" role="status" id="photo-progress" hidden></div><div id="photo-crop" class="photo-crop" hidden><div class="photo-preview-wrap"></div><div><strong>안경이 크게 보이나요?</strong><p>다른 물체와 얼굴은 제외하세요. 필요하면 확대하고 위치를 조정한 뒤 대조를 시작하세요.</p><label>확대 <input id="photo-zoom" type="range" min="1" max="3" step="0.1" value="1"/></label><label>좌우 <input id="photo-x" type="range" min="-100" max="100" value="0"/></label><label>위아래 <input id="photo-y" type="range" min="-100" max="100" value="0"/></label><button class="button primary" id="photo-run">${icon("search")} 도감 후보 찾기</button><button class="button secondary" id="photo-cancel" hidden>대조 취소</button></div></div><div id="photo-results" class="photo-results" aria-live="polite"></div></article>`;
    this.preview.width = this.preview.height = 512;
    this.preview.setAttribute("aria-label", "대조할 사진 영역");
    root.querySelector(".photo-preview-wrap")!.append(this.preview);
    for (const mode of ["capture", "file"]) {
      this.get(`photo-${mode}`).addEventListener("click", () =>
        this.get(`photo-${mode}-input`).click(),
      );
      this.get(`photo-${mode}-input`).addEventListener(
        "change",
        async (event) => {
          const input = event.target as HTMLInputElement,
            file = input.files?.[0];
          if (file) await this.loadFile(file);
          input.value = "";
        },
      );
    }
    ["zoom", "x", "y"].forEach((name) =>
      this.get(`photo-${name}`).addEventListener("input", () => {
        this.drawPreview();
        this.get("photo-results").innerHTML = "";
      }),
    );
    this.get("photo-run").addEventListener("click", () => this.run());
    this.get("photo-cancel").addEventListener("click", () => this.cancel());
    this.get("photo-clear").addEventListener("click", () => this.clear());
  }
  private get(id: string) {
    return this.root.querySelector<HTMLElement>(`#${id}`)!;
  }
  private status(message: string) {
    this.get("photo-progress").textContent = message;
    this.get("photo-progress").hidden = !message;
  }
  async loadFile(file: File) {
    this.cancel(false);
    this.get("photo-results").innerHTML = "";
    this.get("photo-crop").hidden = true;
    const request = ++this.id;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 12_000_000
    ) {
      this.status("12 MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
      return;
    }
    try {
      const image = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (request !== this.id) {
        image.close();
        return;
      }
      if (
        image.width < 128 ||
        image.height < 128 ||
        image.width * image.height > 40_000_000
      ) {
        image.close();
        throw new Error(
          "가로·세로 128픽셀 이상, 4,000만 화소 이하의 사진을 사용해 주세요.",
        );
      }
      const scale = Math.min(1, 1536 / Math.max(image.width, image.height));
      this.source.width = Math.round(image.width * scale);
      this.source.height = Math.round(image.height * scale);
      this.source
        .getContext("2d")!
        .drawImage(image, 0, 0, this.source.width, this.source.height);
      image.close();
      this.ready();
    } catch {
      if (request === this.id)
        this.status(
          "사진을 읽지 못했습니다. 가로·세로 128픽셀 이상, 4,000만 화소 이하의 JPG·PNG·WebP를 사용해 주세요.",
        );
    }
  }
  loadFrame(frame: ImageData) {
    this.cancel(false);
    ++this.id;
    this.source.width = frame.width;
    this.source.height = frame.height;
    this.source.getContext("2d")!.putImageData(frame, 0, 0);
    this.ready();
  }
  private ready() {
    (this.get("photo-zoom") as HTMLInputElement).value = "1";
    (this.get("photo-x") as HTMLInputElement).value = "0";
    (this.get("photo-y") as HTMLInputElement).value = "0";
    this.get("photo-clear").hidden = false;
    this.get("photo-crop").hidden = false;
    this.get("photo-results").innerHTML = "";
    this.status("");
    this.drawPreview();
  }
  private drawPreview() {
    const context = this.preview.getContext("2d")!,
      size = this.preview.width;
    const zoom = Number((this.get("photo-zoom") as HTMLInputElement).value);
    const x =
      ((Number((this.get("photo-x") as HTMLInputElement).value) / 100) * size) /
      2;
    const y =
      ((Number((this.get("photo-y") as HTMLInputElement).value) / 100) * size) /
      2;
    const scale =
      (size / Math.max(this.source.width, this.source.height)) * zoom;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(
      this.source,
      (size - this.source.width * scale) / 2 + x,
      (size - this.source.height * scale) / 2 + y,
      this.source.width * scale,
      this.source.height * scale,
    );
  }
  private setBusy(busy: boolean) {
    this.busy = busy;
    [
      "photo-run",
      "photo-capture",
      "photo-file",
      "photo-zoom",
      "photo-x",
      "photo-y",
    ].forEach((id) => {
      (this.get(id) as HTMLButtonElement | HTMLInputElement).disabled = busy;
    });
    this.get("photo-cancel").hidden = !busy;
  }
  private run() {
    if (this.busy || this.get("photo-crop").hidden) return;
    const id = ++this.id;
    this.get("photo-results").innerHTML = "";
    this.setBusy(true);
    this.status(
      "사진 대조 모델을 준비합니다. 첫 사용에는 다운로드 시간이 필요합니다.",
    );
    try {
      if (!this.worker) {
        this.worker = new Worker(
          new URL("./photo-worker.ts", import.meta.url),
          { type: "module" },
        );
        this.worker.onmessage = (event) => {
          if (event.data.id !== this.id) return;
          if (event.data.type === "progress") {
            this.status(event.data.message);
            return;
          }
          if (this.timer) clearTimeout(this.timer);
          this.timer = null;
          this.setBusy(false);
          if (event.data.type === "result") {
            this.status(
              "대조 완료 · 후보 순서는 외형 유사도이며 기종 확정이나 적발 확률이 아닙니다.",
            );
            this.results(event.data.candidates);
          } else {
            this.status(
              "사진 대조를 실행하지 못했습니다. 첫 사용에는 인터넷 연결과 충분한 메모리가 필요합니다. 도감은 계속 이용할 수 있습니다.",
            );
            this.worker?.terminate();
            this.worker = null;
          }
        };
        this.worker.onerror = () => {
          this.cancel(false);
          this.status(
            "이 브라우저에서 사진 대조 엔진을 시작하지 못했습니다. 지원 브라우저에서 다시 시도하거나 도감을 직접 대조해 주세요.",
          );
        };
      }
      this.timer = setTimeout(() => {
        this.cancel(false);
        this.status(
          "사진 대조가 오래 걸려 중단했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
      }, 180_000);
      const pixels = this.preview
        .getContext("2d")!
        .getImageData(0, 0, 512, 512);
      this.worker.postMessage(
        {
          id,
          base: new URL(import.meta.env.BASE_URL, document.baseURI).href,
          data: pixels.data,
          width: 512,
          height: 512,
        },
        [pixels.data.buffer],
      );
    } catch {
      this.cancel(false);
      this.status(
        "사진 대조 기능을 시작하지 못했습니다. 도감을 직접 대조해 주세요.",
      );
    }
  }
  private results(candidates: PhotoCandidate[]) {
    const weak = !candidates.length || candidates[0]!.similarity < 0.55;
    const ambiguous =
      candidates.length > 1 &&
      candidates[0]!.similarity - candidates[1]!.similarity < 0.04;
    this.get("photo-results").innerHTML =
      `<div class="photo-result-heading"><h3>${weak ? "대조하기 어려운 사진입니다" : "이 기종부터 대조해 보세요"}</h3><span class="badge amber-badge">실험적 외형 검색</span></div><p>${weak ? "안경이 작거나 참조 자료와 외형이 다를 수 있습니다. 아래 후보는 참고만 하고 정면·다리 사진을 다시 촬영하세요." : ambiguous ? "후보 간 차이가 작습니다. 카메라·충전부·렌즈 내부 구조를 직접 대조하세요." : "후보의 부품 위치를 직접 확인하세요. 도감 밖의 제품과 일반 안경도 비슷하게 나올 수 있습니다."}</p><div class="photo-candidate-grid">${candidates
        .map((candidate, index) => {
          const guide = guides.find((g) => g.id === candidate.guideId);
          if (!guide) return "";
          return `<button class="photo-candidate" data-guide="${guide.id}"><span class="candidate-rank">0${index + 1}</span><img src="${import.meta.env.BASE_URL}sample-${guide.sample}.svg" alt="${esc(guide.name)} 관찰용 도식"/><strong>${esc(guide.name)}</strong><span>${esc(guide.points[0]!)}</span><small>도감과 실물 대조 ${icon("arrow")}</small></button>`;
        })
        .join("")}</div>`;
  }
  cancel(notify = true) {
    ++this.id;
    this.worker?.terminate();
    this.worker = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setBusy(false);
    if (notify)
      this.status(
        "대조를 중단했습니다. 사진을 조정하거나 다시 시작할 수 있습니다.",
      );
  }
  clear() {
    this.cancel(false);
    this.source.width = this.source.height = 0;
    this.preview.getContext("2d")!.clearRect(0, 0, 512, 512);
    this.get("photo-crop").hidden = true;
    this.get("photo-clear").hidden = true;
    this.get("photo-results").innerHTML = "";
    this.status("");
  }
  suspend() {
    this.cancel(this.busy);
  }
}
