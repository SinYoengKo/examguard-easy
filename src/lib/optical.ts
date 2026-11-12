import { applyFilter } from "./filters";
import type { Filter } from "./filters";

export interface OpticalState {
  source: "demo" | "camera" | "image";
  pending: boolean;
  frozen: boolean;
  torch: boolean;
  torchAvailable: boolean;
  message: string;
}
export class OpticalEngine {
  state: OpticalState = {
    source: "demo",
    pending: false,
    frozen: false,
    torch: false,
    torchAvailable: false,
    message: "",
  };
  filter: Filter = "original";
  threshold = 215;
  zoom = 1;
  private video = document.createElement("video");
  private raw = document.createElement("canvas");
  private work = document.createElement("canvas");
  private image: HTMLImageElement | null = null;
  private sample: HTMLImageElement | null = null;
  private stream: MediaStream | null = null;
  private request = 0;
  private sampleRequest = 0;
  private frame = 0;
  private active = false;
  private lastFrame = 0;
  private disposed = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private changed: (state: OpticalState) => void,
  ) {
    canvas.width = this.raw.width = this.work.width = 768;
    canvas.height = this.raw.height = this.work.height = 480;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
  }
  private notify() {
    this.changed({ ...this.state });
  }
  async setSample(url: string) {
    const id = ++this.sampleRequest;
    const image = new Image();
    image.src = url;
    await image.decode();
    if (this.disposed || id !== this.sampleRequest) return;
    this.sample = image;
    if (this.state.source === "demo") {
      this.state.frozen = false;
      this.drawRaw();
      this.render();
      this.notify();
    }
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) this.stopCamera();
    cancelAnimationFrame(this.frame);
    if (active) {
      this.drawRaw();
      this.render();
      this.frame = requestAnimationFrame(this.loop);
    }
  }
  private loop = (time: number) => {
    if (!this.active || this.disposed) return;
    if (
      time - this.lastFrame > 66 &&
      this.state.source === "camera" &&
      !this.state.frozen
    ) {
      this.lastFrame = time;
      this.drawRaw();
      this.render();
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  private drawRaw() {
    if (this.state.frozen) return;
    const image =
      this.state.source === "camera"
        ? this.video.readyState >= 2
          ? this.video
          : null
        : this.state.source === "image"
          ? this.image
          : this.sample;
    if (!image) return;
    const width =
      image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
    const height =
      image instanceof HTMLVideoElement
        ? image.videoHeight
        : image.naturalHeight;
    if (!width || !height) return;
    const aspect = this.raw.width / this.raw.height;
    const cropWidth = Math.min(width, height * aspect);
    const cropHeight = cropWidth / aspect;
    this.raw
      .getContext("2d")!
      .drawImage(
        image,
        (width - cropWidth) / 2,
        (height - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        this.raw.width,
        this.raw.height,
      );
  }
  render() {
    const context = this.work.getContext("2d", { willReadFrequently: true })!;
    const { width, height } = this.work;
    const cropWidth = width / this.zoom,
      cropHeight = height / this.zoom;
    context.drawImage(
      this.raw,
      (width - cropWidth) / 2,
      (height - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );
    if (this.filter !== "original") {
      const pixels = context.getImageData(0, 0, width, height);
      applyFilter(pixels.data, width, height, this.filter, this.threshold);
      context.putImageData(pixels, 0, 0);
    }
    this.canvas.getContext("2d")!.drawImage(this.work, 0, 0);
  }
  async startCamera() {
    if (this.state.pending) return;
    this.stopCamera();
    const request = ++this.request;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.state.message =
        "카메라는 HTTPS 또는 localhost와 카메라 지원 브라우저가 필요합니다.";
      this.notify();
      return;
    }
    this.state.pending = true;
    this.state.message = "";
    this.notify();
    let incoming: MediaStream | null = null;
    try {
      incoming = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 800 },
        },
        audio: false,
      });
      if (request !== this.request || !this.active) {
        incoming.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = incoming;
      this.video.srcObject = incoming;
      await this.video.play();
      if (request !== this.request || !this.active) {
        incoming.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = incoming.getVideoTracks()[0]!;
      const capabilities =
        track.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
        };
      this.state = {
        source: "camera",
        pending: false,
        frozen: false,
        torch: false,
        torchAvailable: capabilities?.torch === true,
        message: "",
      };
      track.addEventListener("ended", () => {
        if (this.stream === incoming) {
          this.stopCamera();
          this.state.message = "카메라 연결이 종료되었습니다. 다시 켜 주세요.";
          this.notify();
        }
      });
      this.drawRaw();
      this.render();
      this.notify();
    } catch (error) {
      incoming?.getTracks().forEach((track) => track.stop());
      if (request !== this.request) return;
      this.stopCamera();
      const name = error instanceof DOMException ? error.name : "";
      this.state.message =
        name === "NotAllowedError"
          ? "카메라 권한이 허용되지 않았습니다. 브라우저 설정을 확인하거나 사진을 열어 주세요."
          : name === "NotFoundError"
            ? "사용 가능한 카메라가 없습니다. 사진을 열어 검사할 수 있습니다."
            : "카메라를 시작하지 못했습니다. 다른 앱의 카메라 사용 여부를 확인해 주세요.";
      this.notify();
    }
  }
  stopCamera() {
    this.request++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.image = null;
    this.state = {
      source: "demo",
      pending: false,
      frozen: false,
      torch: false,
      torchAvailable: false,
      message: "",
    };
    this.raw.getContext("2d")!.clearRect(0, 0, this.raw.width, this.raw.height);
    this.drawRaw();
    this.render();
    this.notify();
  }
  async loadImage(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 12_000_000
    )
      throw new Error("12 MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
    this.stopCamera();
    const request = ++this.request;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (request !== this.request || !this.active) return;
      if (image.naturalWidth * image.naturalHeight > 40_000_000)
        throw new Error("4,000만 화소 이하의 사진을 사용해 주세요.");
      this.image = image;
      this.state.source = "image";
      this.drawRaw();
      this.render();
      this.notify();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  freeze() {
    this.state.frozen = !this.state.frozen;
    this.notify();
  }
  snapshot(): ImageData | null {
    if (this.state.source === "demo" || this.state.pending) return null;
    this.drawRaw();
    return this.raw
      .getContext("2d")!
      .getImageData(0, 0, this.raw.width, this.raw.height);
  }
  async toggleTorch() {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !this.state.torchAvailable) return;
    const next = !this.state.torch;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      if (this.stream?.getVideoTracks()[0] === track) this.state.torch = next;
    } catch {
      this.state.message = "이 카메라에서 조명을 제어할 수 없습니다.";
    }
    this.notify();
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.stopCamera();
    this.sample = null;
  }
}
