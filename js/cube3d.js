/* ==================================================================
   WebGL logo cube (Three.js)
   A rounded, glossy cube lit by a key light + a soft room environment,
   casting a real shadow onto an invisible ground plane.

   Each stage renders into its own small transparent canvas that the
   page keeps positioned around the cube. The camera's lens is shifted
   onto the cube, so it's seen head-on with the same perspective a CSS
   `perspective` would give.

   Performance: a stage only redraws when its inputs change, the canvas
   is just big enough for the cube + shadow, and the pixel ratio can be
   lowered at runtime if the device can't keep up. Shaders compile in the
   background (`stage.ready`), so they never freeze an animation — on
   integrated GPUs a synchronous compile can take most of a second.
================================================================== */
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FACES, FACE_BG, NAVY } from "./faces.js";

const DEG = Math.PI / 180;
const TEX_SIZE = 512;

// Box geometry material order: +x, -x, +y, -y, +z, -z
const SIDES = ["right", "left", "top", "bottom", "front", "back"];

export function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------
   CSS pose → Three.js quaternion
   CSS axes are y-down, Three's are y-up. Mirroring y turns a CSS
   rotation about (x, y, z) by θ into a rotation about (-x, y, -z) by θ.
------------------------------------------------------------------- */
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const qx = new Quaternion();
const qy = new Quaternion();
const qz = new Quaternion();
const qr = new Quaternion();

/** Same pose as CSS `rotate(rz) rotateX(tx) rotateY(ty) rotate3d(roll)` */
export function cssPose(roll, tx, ty, rz, out) {
  qz.setFromAxisAngle(Z, -rz * DEG);
  qx.setFromAxisAngle(X, -tx * DEG);
  qy.setFromAxisAngle(Y, ty * DEG);
  qr.set(-roll[1], roll[2], -roll[3], roll[0]);
  return out.copy(qz).multiply(qx).multiply(qy).multiply(qr);
}

/* ------------------------------------------------------------------
   Face textures — the same artwork as the CSS cube, painted onto
   canvases. The "L" is drawn as text so it can use the page's web font.
------------------------------------------------------------------- */
function svgImage(svg) {
  const markup = svg
    .trim()
    .replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${TEX_SIZE}" height="${TEX_SIZE}" `);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  return img.decode().then(() => img);
}

const textureListeners = new Set();

async function paintFace(side, texture) {
  const c = texture.image;
  const ctx = c.getContext("2d");
  const s = TEX_SIZE / 100;

  ctx.fillStyle = FACE_BG[side];
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.shadowColor = "rgb(0 0 0 / 28%)";
  ctx.shadowOffsetX = 2 * s;
  ctx.shadowOffsetY = 3 * s;
  ctx.shadowBlur = 2.5 * s;

  if (side === "front") {
    try { await document.fonts.load(`${76 * s}px "DM Serif Display"`); } catch { /* fall back to Georgia */ }
    ctx.font = `${76 * s}px "DM Serif Display", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = NAVY;
    ctx.fillText("L", 50 * s, 79 * s);
  } else {
    try {
      ctx.drawImage(await svgImage(FACES[side]), 0, 0, TEX_SIZE, TEX_SIZE);
    } catch { /* keep the plain face colour */ }
  }
  texture.needsUpdate = true;
  // Stages skip unchanged frames, so tell them the artwork arrived
  textureListeners.forEach((fn) => fn());
}

let sharedMaterials = null;
let facesPainted = null;

/** Resolves once every face has its artwork (so the cube never pops in half-drawn) */
export function cubeReady() {
  cubeMaterials();
  return facesPainted;
}

function cubeMaterials() {
  if (sharedMaterials) return sharedMaterials;
  const painting = [];
  sharedMaterials = SIDES.map((side) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEX_SIZE;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    // Start as the plain face colour; the artwork is painted in async
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = FACE_BG[side];
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    painting.push(paintFace(side, map));

    // Standard (not Physical/clearcoat) keeps the shader cheap; the low
    // roughness picks up a soft highlight from the key and fill lights
    return new MeshStandardMaterial({ map, roughness: 0.38 });
  });
  facesPainted = Promise.all(painting);
  return sharedMaterials;
}

/* ------------------------------------------------------------------
   Stage
------------------------------------------------------------------- */
/**
 * One renderer, one canvas. The page can move the canvas between spots
 * (the story and the CTA are never on screen together), so shaders only
 * ever compile once.
 * maxDpr: upper bound for the canvas pixel ratio
 */
export function createCubeStage(canvas, { maxDpr = 1.5 } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 1, 6000);
  let perspective = 1000;

  // Soft ambient (sky above, warm floor bounce) + a front fill stand in for
  // an environment map, which would cost a heavy shader compile up front
  scene.add(new HemisphereLight(0xffffff, 0xe6dccb, 2.3));
  const fill = new DirectionalLight(0xffffff, 1.1);
  fill.position.set(0.6, 0.2, 1);
  scene.add(fill);

  const cube = new Mesh(new RoundedBoxGeometry(1, 1, 1, 5, 0.085), cubeMaterials());
  cube.castShadow = true;
  scene.add(cube);

  // Key light: above, a little left and in front
  const lightDir = new Vector3(-0.25, 1, 0.35).normalize();
  const key = new DirectionalLight(0xffffff, 1.5);
  key.castShadow = true;
  // A small, blurred shadow map: it's a soft blob anyway
  key.shadow.mapSize.set(256, 256);
  key.shadow.radius = 12;
  key.shadow.blurSamples = 10;
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);

  const groundMat = new ShadowMaterial({ color: new Color(NAVY), opacity: 0.3 });
  const ground = new Mesh(new PlaneGeometry(1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  let lastSize = 0;
  let dirty = true;
  const last = { cx: NaN, cy: NaN, groundY: NaN, shadow: NaN, dark: null, onDark: null };
  const lastPose = new Quaternion(NaN, NaN, NaN, NaN);
  let lastParams = null;

  const markDirty = () => { dirty = true; };
  textureListeners.add(markDirty);

  // Resizing a WebGL canvas clears it. Redraw straight away so the cube
  // never shows a blank frame.
  function redrawNow() {
    dirty = true;
    if (lastParams) render(lastParams);
  }

  /** CSS size of the canvas; call on layout changes, not every frame */
  function setSize(w, h) {
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    redrawNow();
  }

  /** Lower (or restore) the resolution when the device is struggling */
  function setPixelRatio(next) {
    next = Math.min(next, maxDpr);
    if (next === dpr) return;
    dpr = next;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    redrawNow();
  }

  function updateSize(size) {
    cube.scale.setScalar(size);
    ground.scale.setScalar(size * 3.6);
    key.position.copy(lightDir).multiplyScalar(size * 4);
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -size * 2.4;
    cam.right = cam.top = size * 2.4;
    cam.near = size;
    cam.far = size * 9;
    cam.updateProjectionMatrix();
  }

  function updateCamera(cx, cy) {
    // 1 world unit = 1 CSS px on the cube's plane
    camera.position.set(0, 0, perspective);
    camera.far = perspective * 6;
    camera.fov = 2 * Math.atan(height / 2 / perspective) / DEG;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Shift the lens so the cube lands at (cx, cy) while still being viewed head-on
    const pm = camera.projectionMatrix;
    pm.elements[8] = -((cx / width) * 2 - 1);
    pm.elements[9] = -(1 - (cy / height) * 2);
    camera.projectionMatrixInverse.copy(pm).invert();
  }

  const near = (a, b, eps) => Math.abs(a - b) < eps;

  /**
   * Draw the cube centred on (cx, cy) in canvas pixels. Returns false
   * when nothing changed and the previous frame was kept.
   * size: cube edge in px · groundY: ground line in canvas px
   * pose: Quaternion · shadow: 0–1 shadow strength · dark: night theme
   * perspective: camera distance in px (like CSS `perspective`)
   * onDark: drawn over a dark panel, so always use a black shadow
   */
  function render(params) {
    const { cx, cy, size, groundY, pose, shadow = 1, dark = false, onDark = false } = params;
    lastParams = params;
    if (!width || !height) return false;

    const sizeChanged = !near(size, lastSize, 0.05);
    const persp = params.perspective ?? 1000;
    const camChanged = sizeChanged || dirty || persp !== perspective
      || !near(cx, last.cx, 0.05) || !near(cy, last.cy, 0.05);
    perspective = persp;
    const changed = camChanged
      || !near(groundY, last.groundY, 0.1)
      || !near(shadow, last.shadow, 0.005)
      || dark !== last.dark
      || onDark !== last.onDark
      || Math.abs(pose.dot(lastPose)) < 0.9999995;
    if (!changed) return false;

    if (sizeChanged) { updateSize(size); lastSize = size; }
    if (camChanged) updateCamera(cx, cy);

    cube.quaternion.copy(pose);
    lastPose.copy(pose);

    // The ground only spans the shadow camera's view, so the edge of the
    // shadow map never shows up as a line across the page.
    // Keep it just under the cube's lowest corner: a tilted, rolling cube
    // can dip below the resting ground line, and the shadow would then be
    // painted over the corner that sank "into the floor".
    const { x, y, z, w } = pose;
    const lowest = -0.5 * size * (
      Math.abs(2 * (x * y + w * z)) + Math.abs(1 - 2 * (x * x + z * z)) + Math.abs(2 * (y * z - w * x))
    );
    ground.position.y = Math.min(-(groundY - cy), lowest - size * 0.02);
    const black = dark || onDark;
    groundMat.color.set(black ? 0x000000 : NAVY);
    groundMat.opacity = (black ? 0.5 : 0.22) * shadow;

    Object.assign(last, { cx, cy, groundY, shadow, dark, onDark });
    dirty = false;
    renderer.render(scene, camera);
    return true;
  }

  // Ready once the artwork is painted and the materials' shaders are
  // compiled off the main thread (KHR_parallel_shader_compile)
  const ready = cubeReady().then(() => renderer.compileAsync(scene, camera));

  return { render, setSize, setPixelRatio, ready, get pixelRatio() { return dpr; } };
}
