import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import sceneXml from './scene.xml?raw';
import { CameraInput } from './camera';
import { Renderer } from './render';
import { Sim, type Command } from './sim';
import { isVoiceSupported, parseCommands, VoiceInput } from './voice';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const sim = await Sim.create(sceneXml, wasmUrl);
$('#loading').remove();
const renderer = new Renderer($('#viewer'), sim);

// --- コマンド実行（音声で複数出たときは少し間をあけて順に実行） ---
const queue: Command[] = [];
let lastCommandAt = 0;
const COMMAND_INTERVAL_MS = 400;

function enqueue(commands: Command[]) {
  queue.push(...commands);
}

document.querySelectorAll<HTMLButtonElement>('button[data-cmd]').forEach((button) => {
  button.addEventListener('click', () => sim.command(button.dataset.cmd as Command));
});

// --- エラー表示 ---
function showError(message: string | null) {
  const el = $('#error');
  el.hidden = message === null;
  el.textContent = message ?? '';
}

// --- 音声入力 ---
const transcript = $('#transcript');
const micButton = $<HTMLButtonElement>('#mic');

function handleSentence(text: string) {
  const commands = parseCommands(text);
  transcript.classList.remove('interim');
  transcript.textContent = `${text} → ${commands.length ? commands.join(', ') : '（コマンドなし）'}`;
  enqueue(commands);
}

const voice = new VoiceInput({
  onInterim(text) {
    transcript.classList.add('interim');
    transcript.textContent = text;
  },
  onFinal: handleSentence,
  onError: showError,
  onStateChange(listening) {
    micButton.classList.toggle('on', listening);
    micButton.textContent = listening ? '⏹ 聞き取り停止' : '🎤 聞き取り開始';
  },
});

micButton.addEventListener('click', () => {
  showError(null);
  if (voice.isListening) voice.stop();
  else voice.start();
});

$('#text-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#text-input');
  handleSentence(input.value);
  input.value = '';
});

// --- カメラ入力 ---
const video = $<HTMLVideoElement>('#video');
const camera = new CameraInput(video);
const cameraButton = $<HTMLButtonElement>('#camera');

cameraButton.addEventListener('click', async () => {
  showError(null);
  if (camera.isOn) {
    camera.stop();
    renderer.setMonitorVideo(null);
  } else {
    try {
      await camera.start();
      renderer.setMonitorVideo(video);
    } catch (e) {
      showError((e as Error).message);
    }
  }
  video.classList.toggle('on', camera.isOn);
  cameraButton.classList.toggle('on', camera.isOn);
  cameraButton.textContent = camera.isOn ? '⏹ カメラ停止' : '📷 カメラ開始';
});

// --- 状態表示 ---
const statusEl = $('#status');
let fps = 0;

function updateStatus() {
  const rows: [string, string][] = [
    ['FPS', fps.toFixed(0)],
    ['シミュ時間', `${sim.data.time.toFixed(1)} 秒`],
    ['HTTPS / localhost', window.isSecureContext ? '✅' : '❌（マイク・カメラ不可）'],
    ['音声認識 API', isVoiceSupported() ? '✅' : '❌'],
    ['カメラ API', typeof navigator.mediaDevices?.getUserMedia === 'function' ? '✅' : '❌'],
  ];
  statusEl.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = k;
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}
updateStatus();
setInterval(updateStatus, 500);

// --- メインループ ---
let last = performance.now();
let frames = 0;
let fpsWindowStart = last;

function loop(now: number) {
  if (queue.length && now - lastCommandAt >= COMMAND_INTERVAL_MS) {
    sim.command(queue.shift()!);
    lastCommandAt = now;
  }
  sim.advance((now - last) / 1000);
  renderer.render();
  last = now;

  frames++;
  if (now - fpsWindowStart >= 1000) {
    fps = (frames * 1000) / (now - fpsWindowStart);
    frames = 0;
    fpsWindowStart = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
