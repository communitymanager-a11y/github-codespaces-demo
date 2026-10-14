// MuJoCo (WASM) のシミュレーションと、ロボットへのコマンド
import loadMujoco from '@mujoco/mujoco';
import type { MainModule, MjData, MjModel } from '@mujoco/mujoco';

export type Command =
  | 'left' | 'right' | 'up' | 'down' | 'forward' | 'back'
  | 'grab' | 'release' | 'reset';

// scene.xml のアームの寸法
const SHOULDER_HEIGHT = 0.13; // 床から肩関節まで
const L1 = 0.22; // 上腕
const L2 = 0.21; // 前腕（肘〜手首）

const STEP_RADIUS = 0.03;
const STEP_HEIGHT = 0.03;
const STEP_YAW = 0.2;
// 目標が 1 秒あたりに動ける量（急に動かないように補間する）
const SPEED = { radius: 0.25, height: 0.25, yaw: 1.5 };

const GRIPPER_OPEN = 0;
const GRIPPER_CLOSED = -0.035;

interface Target {
  yaw: number;
  radius: number; // 水平方向の手首までの距離
  height: number; // 手首の高さ
  gripper: number;
}

const HOME: Target = { yaw: 0, radius: 0.25, height: 0.25, gripper: GRIPPER_OPEN };

export class Sim {
  readonly mujoco: MainModule;
  readonly model: MjModel;
  readonly data: MjData;
  private goal: Target = { ...HOME };
  private current: Target = { ...HOME };

  private constructor(mujoco: MainModule, xml: string) {
    this.mujoco = mujoco;
    this.model = mujoco.MjModel.from_xml_string(xml);
    this.data = new mujoco.MjData(this.model);
    this.reset();
  }

  static async create(xml: string, wasmUrl?: string): Promise<Sim> {
    const mujoco = await loadMujoco(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
    return new Sim(mujoco, xml);
  }

  command(cmd: Command) {
    const g = this.goal;
    switch (cmd) {
      case 'left': g.yaw += STEP_YAW; break;
      case 'right': g.yaw -= STEP_YAW; break;
      case 'up': g.height += STEP_HEIGHT; break;
      case 'down': g.height -= STEP_HEIGHT; break;
      case 'forward': g.radius += STEP_RADIUS; break;
      case 'back': g.radius -= STEP_RADIUS; break;
      case 'grab': g.gripper = GRIPPER_CLOSED; break;
      case 'release': g.gripper = GRIPPER_OPEN; break;
      case 'reset': this.reset(); return;
    }
    clampToWorkspace(g);
  }

  reset() {
    this.mujoco.mj_resetData(this.model, this.data);
    this.goal = { ...HOME };
    this.current = { ...HOME };
    this.applyControl();
    // 最初から目標姿勢で表示されるように関節角もそろえる
    this.data.qpos.set(Array.from(this.data.ctrl).slice(0, 4), 0);
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** 実時間 dt 秒ぶんシミュレーションを進める */
  advance(dt: number) {
    const timestep = this.model.opt.timestep;
    const steps = Math.min(Math.round(dt / timestep), 50); // タブ復帰時などの暴走防止
    for (let i = 0; i < steps; i++) {
      this.moveTowardGoal(timestep);
      this.applyControl();
      this.mujoco.mj_step(this.model, this.data);
    }
  }

  private moveTowardGoal(dt: number) {
    const c = this.current, g = this.goal;
    c.yaw = approach(c.yaw, g.yaw, SPEED.yaw * dt);
    c.radius = approach(c.radius, g.radius, SPEED.radius * dt);
    c.height = approach(c.height, g.height, SPEED.height * dt);
    c.gripper = g.gripper;
  }

  private applyControl() {
    const [shoulder, elbow] = solveArm(this.current.radius, this.current.height);
    // グリッパーが常に真下を向くように手首を合わせる
    const wrist = Math.PI - shoulder - elbow;
    const g = this.current.gripper;
    this.data.ctrl.set([this.current.yaw, shoulder, elbow, wrist, g, g]);
  }
}

/** 2 リンクの逆運動学。手首の (水平距離, 高さ) から肩・肘の角度を求める */
function solveArm(radius: number, height: number): [number, number] {
  const dz = height - SHOULDER_HEIGHT;
  const d2 = radius * radius + dz * dz;
  const cosElbow = (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const elbow = Math.acos(Math.max(-1, Math.min(1, cosElbow)));
  const shoulder =
    Math.atan2(radius, dz) - Math.atan2(L2 * Math.sin(elbow), L1 + L2 * Math.cos(elbow));
  return [shoulder, elbow];
}

function clampToWorkspace(t: Target) {
  t.yaw = Math.max(-Math.PI, Math.min(Math.PI, t.yaw));
  t.radius = Math.max(0.12, Math.min(0.4, t.radius));
  t.height = Math.max(0.06, Math.min(0.45, t.height));
  // 腕が届く範囲に収める
  const maxReach = L1 + L2 - 0.02;
  const dz = t.height - SHOULDER_HEIGHT;
  const d = Math.hypot(t.radius, dz);
  if (d > maxReach) {
    t.radius *= maxReach / d;
    t.height = SHOULDER_HEIGHT + (dz * maxReach) / d;
  }
}

function approach(from: number, to: number, maxDelta: number) {
  return from + Math.max(-maxDelta, Math.min(maxDelta, to - from));
}
