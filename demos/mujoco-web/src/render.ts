// MuJoCo の geom を three.js のメッシュとして描画する
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Sim } from './sim';

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly monitor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(private readonly container: HTMLElement, private readonly sim: Sim) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xeef1f5);

    // MuJoCo と同じく Z 軸を上にする
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 20);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-0.45, -0.75, 0.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.15, 0.05, 0.12);
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(0.6, -0.4, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8 });
    this.scene.add(sun);

    this.createGeoms();
    this.monitor = this.createMonitor();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Web カメラの映像をシーン内のモニターに映す（null で消す） */
  setMonitorVideo(video: HTMLVideoElement | null) {
    const material = this.monitor.material;
    material.map?.dispose();
    material.map = video ? new THREE.VideoTexture(video) : null;
    material.color.set(video ? 0xffffff : 0x22252b);
    material.needsUpdate = true;
  }

  render() {
    const { model, data } = this.sim;
    // WASM のメモリが伸びるとビューが無効になるので、毎フレーム取り直す
    const xpos: Float64Array = data.geom_xpos;
    const xmat: Float64Array = data.geom_xmat;
    for (let i = 0; i < model.ngeom; i++) {
      const p = i * 3, m = i * 9;
      this.meshes[i].matrix.set(
        xmat[m], xmat[m + 1], xmat[m + 2], xpos[p],
        xmat[m + 3], xmat[m + 4], xmat[m + 5], xpos[p + 1],
        xmat[m + 6], xmat[m + 7], xmat[m + 8], xpos[p + 2],
        0, 0, 0, 1,
      );
    }
    this.renderer.render(this.scene, this.camera);
  }

  private createGeoms() {
    const { mujoco, model } = this.sim;
    const T = mujoco.mjtGeom;
    const type: Int32Array = model.geom_type;
    const size: Float64Array = model.geom_size;
    const rgba: Float32Array = model.geom_rgba;

    for (let i = 0; i < model.ngeom; i++) {
      const [sx, sy, sz] = size.subarray(i * 3, i * 3 + 3);
      let geometry: THREE.BufferGeometry;
      switch (type[i]) {
        case T.mjGEOM_PLANE.value:
          geometry = new THREE.PlaneGeometry(2 * sx, 2 * sy);
          break;
        case T.mjGEOM_SPHERE.value:
          geometry = new THREE.SphereGeometry(sx, 24, 16);
          break;
        case T.mjGEOM_ELLIPSOID.value:
          geometry = new THREE.SphereGeometry(1, 24, 16).scale(sx, sy, sz);
          break;
        case T.mjGEOM_CAPSULE.value:
          // three.js は Y 軸方向、MuJoCo は Z 軸方向
          geometry = new THREE.CapsuleGeometry(sx, 2 * sy, 8, 16).rotateX(Math.PI / 2);
          break;
        case T.mjGEOM_CYLINDER.value:
          geometry = new THREE.CylinderGeometry(sx, sx, 2 * sy, 32).rotateX(Math.PI / 2);
          break;
        case T.mjGEOM_BOX.value:
          geometry = new THREE.BoxGeometry(2 * sx, 2 * sy, 2 * sz);
          break;
        default:
          // メッシュなどはこの検証では使わない
          geometry = new THREE.BufferGeometry();
      }
      const [r, g, b, a] = rgba.subarray(i * 4, i * 4 + 4);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r, g, b),
        transparent: a < 1,
        opacity: a,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = type[i] !== T.mjGEOM_PLANE.value;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private createMonitor() {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.02, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x30343c }),
    );
    frame.position.set(0.2, 0.5, 0.22);
    frame.castShadow = true;
    this.scene.add(frame);

    const screen = new THREE.Mesh(
      // 平面の表をカメラ側（-Y）に向ける
      new THREE.PlaneGeometry(0.32, 0.24).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x22252b }),
    );
    screen.position.set(0.2, 0.489, 0.22);
    this.scene.add(screen);
    return screen;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
