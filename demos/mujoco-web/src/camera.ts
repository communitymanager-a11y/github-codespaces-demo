// ブラウザの Web カメラ（getUserMedia）
export class CameraInput {
  private stream: MediaStream | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  get isOn() {
    return this.stream !== null;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      // HTTPS か localhost でないと mediaDevices 自体が存在しない
      throw new Error(
        window.isSecureContext
          ? 'このブラウザはカメラに対応していません'
          : 'カメラは HTTPS か localhost でのみ使えます',
      );
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
    } catch (e) {
      throw new Error(describeError(e));
    }
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}

function describeError(e: unknown) {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'カメラの使用が許可されていません（アドレスバーの鍵アイコンから許可してください）';
    case 'NotFoundError':
      return 'カメラが見つかりません';
    case 'NotReadableError':
      return 'カメラが他のアプリで使用中です';
    default:
      return `カメラを開始できません: ${e instanceof Error ? e.message : String(e)}`;
  }
}
