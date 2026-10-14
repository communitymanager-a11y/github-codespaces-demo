// ブラウザの音声認識（Web Speech API）で話した言葉をコマンドにする
import type { Command } from './sim';

// 長いものから順に照合する（「上げ」を「上」より先に）
const KEYWORDS: [string, Command][] = [
  ['リセット', 'reset'], ['最初', 'reset'],
  ['つかんで', 'grab'], ['つかむ', 'grab'], ['掴', 'grab'], ['持って', 'grab'], ['もって', 'grab'], ['閉じ', 'grab'], ['とじ', 'grab'],
  ['はなして', 'release'], ['はなす', 'release'], ['離', 'release'], ['放', 'release'], ['開い', 'release'], ['ひらい', 'release'], ['置い', 'release'], ['おいて', 'release'],
  ['うしろ', 'back'], ['後ろ', 'back'], ['さがって', 'back'], ['下がって', 'back'],
  ['まえ', 'forward'], ['前', 'forward'], ['すすんで', 'forward'], ['進', 'forward'],
  ['ひだり', 'left'], ['左', 'left'],
  ['みぎ', 'right'], ['右', 'right'],
  ['あげ', 'up'], ['上げ', 'up'], ['うえ', 'up'], ['上', 'up'],
  ['さげ', 'down'], ['下げ', 'down'], ['した', 'down'], ['下', 'down'],
];

const PATTERN = new RegExp(KEYWORDS.map(([word]) => word).join('|'), 'g');
const LOOKUP = new Map(KEYWORDS);

/** 文章に含まれるコマンドを、出てきた順に返す（例:「下、下、つかんで」→ down, down, grab） */
export function parseCommands(text: string): Command[] {
  return Array.from(text.matchAll(PATTERN), (m) => LOOKUP.get(m[0])!);
}

// Web Speech API の型は TypeScript 標準に含まれないので、使う分だけ定義する
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function isVoiceSupported() {
  return getRecognitionCtor() !== undefined;
}

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface VoiceCallbacks {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onStateChange(listening: boolean): void;
}

export class VoiceInput {
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;

  constructor(private readonly callbacks: VoiceCallbacks) {}

  get isListening() {
    return this.listening;
  }

  start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onError('このブラウザは音声認識に対応していません（Chrome / Edge を使ってください）');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) this.callbacks.onFinal(text);
        else this.callbacks.onInterim(text);
      }
    };
    recognition.onerror = (e) => {
      // 無音で止まるのは正常なので無視する
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      this.callbacks.onError(describeError(e.error));
      this.stop();
    };
    // Chrome はしばらく無音だと自動で止まるので、聞き取り中なら再開する
    recognition.onend = () => {
      if (this.listening) recognition.start();
    };
    this.recognition = recognition;
    this.listening = true;
    recognition.start();
    this.callbacks.onStateChange(true);
  }

  stop() {
    this.listening = false;
    this.recognition?.stop();
    this.recognition = null;
    this.callbacks.onStateChange(false);
  }
}

function describeError(error: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'マイクの使用が許可されていません（アドレスバーの鍵アイコンから許可してください）';
    case 'audio-capture':
      return 'マイクが見つかりません';
    case 'network':
      return '音声認識サービスに接続できません（ネットワークを確認してください）';
    default:
      return `音声認識エラー: ${error}`;
  }
}
