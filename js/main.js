/* ==================================================================
   Lektura landing page
   The logo cube rolls onto a new face for every feature as you scroll.
   GSAP + ScrollTrigger drive the animation, Lenis smooths the scroll.
   The cube is drawn with Three.js; the CSS cube is the no-WebGL fallback.
================================================================== */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { Quaternion } from "three";
import "../css/style.css";
import { FACES } from "./faces.js";
import { createCubeStage, cssPose, webglSupported } from "./cube3d.js";

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Side-by-side story layout: wide screens, and any landscape screen (a phone
// on its side has no height for the stacked layout). Mirrors the CSS.
const wideQuery = window.matchMedia("(width > 900px), (orientation: landscape)");
const isWide = () => wideQuery.matches;
const vh = (n) => window.innerHeight * n;
const vw = (n) => window.innerWidth * n;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ------------------------------------------------------------------
   Day / night theme
   The initial theme is set inline in <head> to avoid a flash.
------------------------------------------------------------------- */
const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeColor = document.querySelector('meta[name="theme-color"]');
let themeAnimTimer = 0;

function applyTheme(theme, animate) {
  if (animate && !prefersReduced) {
    root.classList.add("theme-anim");
    clearTimeout(themeAnimTimer);
    themeAnimTimer = setTimeout(() => root.classList.remove("theme-anim"), 500);
  }
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.setAttribute("aria-label", dark ? "Switch to day mode" : "Switch to night mode");
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeColor.setAttribute("content", dark ? "#0c1622" : "#f7f4ee");
}

applyTheme(root.dataset.theme === "dark" ? "dark" : "light", false);

themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next, true);
  try { localStorage.setItem("lektura-theme", next); } catch { /* storage blocked */ }
});

// Follow the OS setting until the visitor picks a theme themselves
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  let saved = null;
  try { saved = localStorage.getItem("lektura-theme"); } catch { /* storage blocked */ }
  if (!saved) applyTheme(e.matches ? "dark" : "light", true);
});

const CORE = ["x", "y", "z"].map((a) => `<div class="cube__core cube__core--${a}"></div>`).join("");

document.querySelectorAll("[data-cube]").forEach((el) => {
  el.innerHTML = CORE + Object.entries(FACES)
    .map(([side, svg]) => `<div class="cube__face cube__face--${side}">${svg}</div>`)
    .join("");
});

/* ------------------------------------------------------------------
   Lenis smooth scroll, driven by GSAP's ticker
------------------------------------------------------------------- */
let lenis = null;

if (!prefersReduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToY(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else window.scrollTo({ top: typeof target === "number" ? target : target.offsetTop, behavior: "smooth" });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    const target = id === "#top" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    scrollToY(target);
  });
});

ScrollTrigger.create({
  start: 10,
  end: "max",
  toggleClass: { className: "is-scrolled", targets: ".nav" },
});

/* ------------------------------------------------------------------
   Quaternion helpers
   Each face has an "upright, facing the viewer" orientation. Between two
   faces we slerp, which gives the shortest, natural-looking roll.
------------------------------------------------------------------- */
const quat = (x, y, z, deg) => {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return [Math.cos(h), x * s, y * s, z * s];
};

function slerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (dot < 0) { b = b.map((v) => -v); dot = -dot; }
  if (dot > 0.9995) {
    const r = a.map((v, i) => v + (b[i] - v) * t);
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const theta = Math.acos(dot);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
}

function toRotate3d(q) {
  const w = gsap.utils.clamp(-1, 1, q[0]);
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-5) return "rotate3d(1, 0, 0, 0rad)";
  return `rotate3d(${q[1] / s}, ${q[2] / s}, ${q[3] / s}, ${2 * Math.acos(w)}rad)`;
}

/* ------------------------------------------------------------------
   Lighting (CSS fallback cube only)
   Each face's normal is rotated by the cube's full transform; its angle
   to a fixed light (upper-left, in front) sets the shade and sheen.
   Matrices are row-major 3x3, CSS axes: x right, y down, z to viewer.
------------------------------------------------------------------- */
const DEG = Math.PI / 180;
const rotX = (deg) => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
const rotY = (deg) => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const quatMat = ([w, x, y, z]) => [
  1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
  2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
  2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
];
const mul = (a, b) => {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
};

const LIGHT = (() => {
  const v = [-0.2, -0.5, 0.85];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

// A face's normal is ± one column of the rotation matrix: [column, sign]
const NORMALS = { front: [2, 1], top: [1, -1], left: [0, -1], back: [2, -1], right: [0, 1], bottom: [1, 1] };

function faceList(cubeEl) {
  return Object.keys(NORMALS).map((side) => ({
    el: cubeEl.querySelector(`.cube__face--${side}`),
    col: NORMALS[side][0],
    sign: NORMALS[side][1],
  }));
}

function shadeCube(faces, m) {
  for (const f of faces) {
    const d = f.sign * (m[f.col] * LIGHT[0] + m[3 + f.col] * LIGHT[1] + m[6 + f.col] * LIGHT[2]);
    const lit = d * 0.5 + 0.5; // half-Lambert, so no face goes flat black
    f.el.style.setProperty("--shade", (0.38 * (1 - lit)).toFixed(3));
    f.el.style.setProperty("--gloss", Math.max(0, d - 0.55).toFixed(3));
  }
}

// Roll order: L → AI (top) → Voice (left) → Editing (back) → Face cloning (right) → Classroom (bottom) → L
// Every step is to an adjacent face, so each transition is a single roll.
const ORIENT = [
  quat(1, 0, 0, 0),    // front  — hero
  quat(1, 0, 0, -90),  // top    — AI generation
  quat(0, 1, 0, 90),   // left   — voice cloning
  quat(0, 1, 0, 180),  // back   — editing
  quat(0, 1, 0, -90),  // right  — face animation cloning
  quat(1, 0, 0, 90),   // bottom — classroom
  quat(1, 0, 0, 0),    // front  — final CTA
];

/* ------------------------------------------------------------------
   Story elements
------------------------------------------------------------------- */
const story = document.querySelector(".story");
const cubePos = story.querySelector(".cube-pos");
const cubeFloat = story.querySelector(".cube-float");
const cubeHop = story.querySelector(".cube-hop");
const cubeTilt = story.querySelector(".cube-tilt");
const cube = story.querySelector(".cube");
const cubeShadow = story.querySelector(".cube-shadow");
const panels = gsap.utils.toArray(".panel");
const railButtons = gsap.utils.toArray(".rail__btn");
const storyFaces = faceList(cube);

// Where the cube sits (offsets from the centre of the viewport)
const heroPos = () => (isWide() ? { x: vw(0.22), y: vh(0.03), scale: 1 } : { x: 0, y: vh(0.22), scale: 0.9 });
// Stacked (portrait) layout: keep the cube high enough that the tallest card can't cover it
const featurePos = () => (isWide() ? { x: -vw(0.2), y: vh(0.01), scale: 1.05 } : { x: 0, y: -vh(0.25), scale: 0.95 });
const finalPos = () => (isWide() ? { x: -vw(0.2), y: vh(0.02), scale: 1.12 } : { x: 0, y: -vh(0.22), scale: 1 });

const ISO_TILT = { tx: -30, ty: 45 };      // the logo pose
const FEATURE_TILT = { tx: -16, ty: 22 };  // face turned toward the copy

// Scroll drives `tilt`; the pointer adds a small lean on top (see ticker below)
const tilt = { ...ISO_TILT };
const pointer = { x: 0, y: 0 };

gsap.set([cubePos, cubeShadow], { xPercent: -50, yPercent: -50 });
gsap.set(cubePos, { x: () => heroPos().x, y: () => heroPos().y, scale: () => heroPos().scale });
gsap.set(panels, { autoAlpha: 0 });

/* Render the roll: face orientation + a little hop at mid-roll */
const roll = { p: 0 };
let rollQ = ORIENT[0];
let activeStep = -1;
let cssCube = true; // false once the WebGL cube takes over

function renderCube() {
  const last = ORIENT.length - 1;
  const p = gsap.utils.clamp(0, last, roll.p);
  const i = Math.min(Math.floor(p), last - 1);
  const t = p - i;

  rollQ = slerp(ORIENT[i], ORIENT[i + 1], t);
  if (cssCube) cube.style.transform = toRotate3d(rollQ);

  const lift = Math.sin(Math.PI * t);
  gsap.set(cubeHop, { y: -lift * vh(0.08), scale: 1 - lift * 0.06 });

  // Hint + step rail are toggled by how far the cube has rolled
  story.classList.toggle("has-scrolled", roll.p > 0.03);
  story.classList.toggle("show-rail", roll.p > 0.6 && roll.p < 5.4);

  // Highlight the matching step in the rail
  const step = Math.round(p);
  const next = step >= 1 && step <= 5 ? step : -1;
  if (next !== activeStep) {
    activeStep = next;
    railButtons.forEach((b, idx) => b.classList.toggle("is-active", idx + 1 === next));
  }
}
renderCube();

/* ------------------------------------------------------------------
   Intro + idle float
------------------------------------------------------------------- */
let idle = null;
let idleOn = true;

function startIdle() {
  if (prefersReduced || !idleOn) return;
  idle = gsap.to(cubeFloat, { y: -16, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
}
function pauseIdle() {
  idleOn = false;
  if (idle) idle.pause();
  gsap.to(cubeFloat, { y: 0, duration: 0.4, overwrite: "auto" });
}
function resumeIdle() {
  idleOn = true;
  if (idle) idle.restart();
  else startIdle();
}

gsap.timeline({ delay: 0.15 })
  .from(".hero__line-inner", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.1 })
  .from(".hero .eyebrow, .hero__sub, .hero__actions, .scroll-hint", { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.08 }, 0.35);

// The cube waits offstage until it's ready to draw (see "WebGL stage")
gsap.set(cubeFloat, { autoAlpha: 0 });

/** The cube's entrance: falls in spinning, then starts floating */
function dropCube(delay = 0) {
  gsap.fromTo(cubeFloat,
    { y: () => -vh(0.55), rotation: -90, autoAlpha: 0 },
    {
      y: 0, rotation: 0, autoAlpha: 1, duration: 1.3, ease: "back.out(1.3)", delay,
      onComplete: startIdle,
    });
}

/* The first time the browser shows a 3D feature card it has to rasterise
   and composite it, which froze the page — and the rolling cube — for
   ~0.3 s on integrated GPUs. Paint the cards once, invisibly, in the
   page's very first frames, while nothing is animating yet (the hero
   text is still masked and the cube is offstage), so that cost folds
   into the initial render instead of landing mid-scroll. */
function prewarmPanels() {
  if (window.scrollY > 0) return; // reloaded mid-page: the cards are needed for real
  story.classList.add("is-prewarm");
  requestAnimationFrame(() => requestAnimationFrame(() => story.classList.remove("is-prewarm")));
}
prewarmPanels();

/* ------------------------------------------------------------------
   The scroll story
   Label f1…f5 = a feature face is showing. Each transition takes 1 unit,
   followed by a 0.6 hold so each face gets a moment on screen.
------------------------------------------------------------------- */
const MOVE = 1;
const HOLD = 0.6;

const story_tl = gsap.timeline({
  defaults: { ease: "power2.inOut" },
  scrollTrigger: {
    trigger: story,
    start: "top top",
    end: () => "+=" + vh(6),
    pin: true,
    scrub: 0.3, // Lenis already smooths the wheel; a longer scrub makes the story lag behind
    invalidateOnRefresh: true,
    onUpdate(self) {
      if (self.progress > 0.005 && idleOn) pauseIdle();
      else if (self.progress <= 0.005 && !idleOn) resumeIdle();
    },
  },
});

/* Cards hinge in from the cube's side like a door, then their contents
   fade up in a stagger. The card itself only snaps its visibility, since
   opacity < 1 would flatten its 3D layers mid-animation. */
const panelIn = (el, at) => {
  story_tl
    .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, at)
    .fromTo(el,
      { rotationY: -55, rotationX: 8, z: -220, x: -60 },
      { rotationY: 0, rotationX: 0, z: 0, x: 0, duration: 0.6, ease: "power3.out", immediateRender: false }, at)
    .fromTo(el.children,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power2.out", immediateRender: false }, at + 0.08);
};

const panelOut = (el, at) => {
  story_tl
    .to(el.children, { autoAlpha: 0, y: -20, duration: 0.3, stagger: 0.02, ease: "power2.in" }, at)
    .to(el, { rotationY: 40, rotationX: -6, z: -180, x: 40, duration: 0.4, ease: "power2.in" }, at)
    .to(el, { autoAlpha: 0, duration: 0.01 }, at + 0.4);
};

// Hero → first feature
story_tl
  .addLabel("hero", 0)
  .to(".hero", { autoAlpha: 0, x: () => -vw(0.04), duration: 0.5, ease: "power2.in" }, 0)
  .fromTo(cubePos,
    { x: () => heroPos().x, y: () => heroPos().y, scale: () => heroPos().scale },
    { x: () => featurePos().x, y: () => featurePos().y, scale: () => featurePos().scale, duration: MOVE }, 0)
  .fromTo(tilt, ISO_TILT, { ...FEATURE_TILT, duration: MOVE }, 0)
  .to(roll, { p: 1, duration: MOVE, onUpdate: renderCube }, 0);
panelIn(panels[0], 0.55);
story_tl.addLabel("f1", MOVE);

// Feature → feature
for (let i = 1; i < 5; i++) {
  const start = MOVE + (i - 1) * (MOVE + HOLD) + HOLD;
  panelOut(panels[i - 1], start);
  story_tl.to(roll, { p: i + 1, duration: MOVE, onUpdate: renderCube }, start);
  panelIn(panels[i], start + 0.55);
  story_tl.addLabel(`f${i + 1}`, start + MOVE);
}

// Last feature → back to the "L" in the logo pose
const finalStart = MOVE + 4 * (MOVE + HOLD) + HOLD;
panelOut(panels[4], finalStart);
story_tl
  .to(roll, { p: 6, duration: MOVE, onUpdate: renderCube }, finalStart)
  .to(tilt, { ...ISO_TILT, duration: MOVE }, finalStart)
  .to(cubePos, { x: () => finalPos().x, y: () => finalPos().y, scale: () => finalPos().scale, duration: MOVE }, finalStart);
panelIn(panels[5], finalStart + 0.55);
story_tl
  .addLabel("end", finalStart + MOVE)
  .to({}, { duration: HOLD });

// Rail buttons jump to their feature
railButtons.forEach((btn) => {
  btn.addEventListener("click", () => scrollToY(story_tl.scrollTrigger.labelToScroll(btn.dataset.goto)));
});

/* ------------------------------------------------------------------
   Pointer parallax: the cube leans toward the cursor and the feature
   cards tilt, so their depth layers slide against each other.
------------------------------------------------------------------- */
const panelsEl = story.querySelector(".panels");
gsap.set(panelsEl, { transformPerspective: 1100 });

if (finePointer && !prefersReduced) {
  const px = gsap.quickTo(pointer, "x", { duration: 0.8, ease: "power3.out" });
  const py = gsap.quickTo(pointer, "y", { duration: 0.8, ease: "power3.out" });
  const rx = gsap.quickTo(panelsEl, "rotationX", { duration: 0.8, ease: "power3.out" });
  const ry = gsap.quickTo(panelsEl, "rotationY", { duration: 0.8, ease: "power3.out" });

  window.addEventListener("pointermove", (e) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    px(x);
    py(y);
    rx(isWide() ? -y * 10 : 0);
    ry(isWide() ? x * 12 : 0);
  });
  document.documentElement.addEventListener("pointerleave", () => {
    px(0); py(0); rx(0); ry(0);
  });
}

/* ------------------------------------------------------------------
   WebGL stage
   GSAP keeps animating the (hidden) DOM cubes' wrappers; each frame we
   work out where the cube is from GSAP's own values — no layout reads —
   and draw the WebGL cube there.

   There is one canvas and one renderer for both cubes. The story and the
   CTA are never on screen together, so the canvas simply moves to
   whichever is visible; shaders compile once, in the background.
   In the story the canvas covers the section and never moves: the cube
   moves inside it. (A small canvas that followed the cube via a CSS
   transform tore on Windows/Intel in Chromium browsers — parts of the
   cube went missing for a frame. Redrawing only on change keeps the
   bigger canvas cheap.)
------------------------------------------------------------------- */
const ctaWrap = document.querySelector(".cta__cube");
const ctaCube = ctaWrap.querySelector(".cube");
const ctaHop = ctaWrap.querySelector(".cube-hop");
const cubeCanvas = story.querySelector(".cube-canvas");
const storySlot = cubeCanvas.nextElementSibling; // re-inserted before this

let stage = null;

if (webglSupported()) {
  try {
    stage = createCubeStage(cubeCanvas, { maxDpr: 1.25 });
    root.classList.add("webgl");
    cssCube = false;
  } catch (err) {
    console.warn("WebGL cube unavailable, using the CSS cube.", err);
    stage = null;
  }
}

// Drop the cube in once its shaders are compiled, so the intro animation
// can't stall halfway. (CSS fallback: drop it straight away.)
let stageReady = false;
if (stage) {
  const showCube = () => {
    if (stageReady) return;
    stageReady = true;
    // The next frame draws the (still invisible) cube for the first time,
    // which also compiles the shadow shaders; start the drop after that so
    // the one slow frame can't eat into the animation
    requestAnimationFrame(() => requestAnimationFrame(() => dropCube()));
  };
  stage.ready.then(showCube, showCube);
  setTimeout(showCube, 4000); // never keep the hero empty on a very slow GPU
} else {
  dropCube(0.25);
}

// Only draw while on screen. The story starts on screen, so don't wait for
// the observer's first (async) report before drawing it.
const inView = new Map([[story, true]]);
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => inView.set(e.target, e.isIntersecting));
});
io.observe(story);
io.observe(ctaWrap);

const storyPose = new Quaternion();
const ctaPose = new Quaternion();
const ISO_ROLL = ORIENT[0];

/* Layout, measured only when the page is (re)laid out */
const layout = { w: 0, h: 0, base: 0, cta: null };
let spot = "story"; // where the canvas currently lives: "story" | "cta"
let canvasOpacity = NaN;

function measure() {
  layout.w = story.clientWidth;
  layout.h = story.clientHeight;
  layout.base = cube.offsetWidth;

  if (spot === "story") {
    stage.setSize(layout.w, layout.h);
  } else {
    // In the CTA the canvas never moves relative to its cube (the section
    // scales both), so its numbers are fixed until the next layout
    const size = ctaCube.offsetWidth;
    layout.cta = {
      size,
      cx: ctaHop.offsetLeft + ctaHop.offsetWidth / 2 - cubeCanvas.offsetLeft,
      cy: ctaHop.offsetTop + ctaHop.offsetHeight / 2 - cubeCanvas.offsetTop,
      groundY: ctaHop.offsetTop + ctaHop.offsetHeight + size * 0.08 - cubeCanvas.offsetTop,
    };
    stage.setSize(cubeCanvas.offsetWidth, cubeCanvas.offsetHeight);
  }
}

function moveCanvas(next) {
  if (next === spot) return;
  spot = next;
  if (spot === "cta") {
    ctaWrap.prepend(cubeCanvas);
    cubeCanvas.classList.add("cube-canvas--cta");
    cubeCanvas.style.opacity = "";
  } else {
    story.insertBefore(cubeCanvas, storySlot);
    cubeCanvas.classList.remove("cube-canvas--cta");
  }
  canvasOpacity = NaN;
  measure();
}

if (stage) {
  measure();
  ScrollTrigger.addEventListener("refresh", measure);
}

/* Adaptive quality: if frames stay slow while the cube is drawing, step
   the canvas resolution down (never below 1x, never back up).
   Ignores the first seconds, when font loads and layout settle make
   frames slow on every machine. */
const DPR_STEPS = [1.25, 1];
const WATCH_AFTER = 4; // seconds
let slowFrames = 0;
let sampledFrames = 0;

function watchFrameRate(drew) {
  if (!drew || !stage || gsap.ticker.time < WATCH_AFTER) return;
  sampledFrames++;
  if (gsap.ticker.deltaRatio(60) > 1.6) slowFrames++; // under ~37 fps
  if (sampledFrames < 180) return;
  if (slowFrames > 120) {
    const next = DPR_STEPS.find((d) => d < stage.pixelRatio - 0.01);
    if (next) stage.setPixelRatio(next);
  }
  slowFrames = sampledFrames = 0;
}

/* ------------------------------------------------------------------
   Every frame: tilt + lean the cube, then draw it (WebGL) or relight
   the CSS faces and move the fake ground shadow (fallback).
------------------------------------------------------------------- */
const ctaFaces = faceList(ctaCube);
const ctaTilt = mul(rotX(ISO_TILT.tx), rotY(ISO_TILT.ty));

function drawStory(tx, ty, floatY, hopY, k, dark) {
  // .cube-pos is centred on the story, then moved/scaled by GSAP;
  // the float + hop offsets live inside that scaled space.
  const s = gsap.getProperty(cubePos, "scale");
  const restY = layout.h / 2 + gsap.getProperty(cubePos, "y");
  const cx = layout.w / 2 + gsap.getProperty(cubePos, "x");
  const cy = restY + (floatY + hopY) * s;
  const size = layout.base * s * gsap.getProperty(cubeHop, "scale");
  const groundY = restY + layout.base * s * 0.8;

  const opacity = gsap.getProperty(cubeFloat, "opacity");
  if (opacity !== canvasOpacity) {
    cubeCanvas.style.opacity = opacity;
    canvasOpacity = opacity;
  }

  return stage.render({
    cx,
    cy,
    size,
    groundY,
    pose: cssPose(rollQ, tx, ty, gsap.getProperty(cubeFloat, "rotation"), storyPose),
    shadow: k,
    dark,
  });
}

gsap.ticker.add((time) => {
  const tx = tilt.tx - pointer.y * 14;
  const ty = tilt.ty + pointer.x * 18;
  const spin = prefersReduced ? 0 : (time * 360 / 14) % 360;
  const dark = root.dataset.theme === "dark";

  // Shadow fades as the cube rises off the ground
  const floatY = gsap.getProperty(cubeFloat, "y");
  const hopY = gsap.getProperty(cubeHop, "y");
  const k = gsap.utils.clamp(0.35, 1, 1 - -(floatY + hopY) / vh(0.22));

  if (stage) {
    if (!stageReady) return;
    if (inView.get(story)) {
      moveCanvas("story");
      watchFrameRate(drawStory(tx, ty, floatY, hopY, k, dark));
    } else if (inView.get(ctaWrap)) {
      moveCanvas("cta");
      stage.render({
        ...layout.cta,
        pose: cssPose(ISO_ROLL, ISO_TILT.tx, ISO_TILT.ty + spin, 0, ctaPose),
        perspective: 800,
        onDark: true,
        dark,
      });
    }
    return;
  }

  cubeTilt.style.setProperty("--tx", tx.toFixed(2));
  cubeTilt.style.setProperty("--ty", ty.toFixed(2));
  shadeCube(storyFaces, mul(mul(rotX(tx), rotY(ty)), quatMat(rollQ)));

  ctaCube.style.transform = `rotateY(${spin.toFixed(2)}deg)`;
  shadeCube(ctaFaces, mul(ctaTilt, rotY(spin)));

  const s = gsap.getProperty(cubePos, "scale");
  gsap.set(cubeShadow, {
    x: gsap.getProperty(cubePos, "x"),
    y: gsap.getProperty(cubePos, "y") + cube.offsetHeight * 0.92 * s,
    scale: s * (0.6 + 0.4 * k),
    opacity: k * gsap.getProperty(cubeFloat, "opacity"),
  });
});

/* ------------------------------------------------------------------
   Section reveals
------------------------------------------------------------------- */
gsap.utils.toArray(".reveal").forEach((el) => {
  gsap.from(el, {
    y: 50,
    autoAlpha: 0,
    duration: 1.1,
    ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 85%" },
  });
});

const batchReveal = (selector) => {
  gsap.set(selector, { autoAlpha: 0, y: 60 });
  ScrollTrigger.batch(selector, {
    start: "top 88%",
    once: true,
    // clearProps hands `transform` back to the CSS afterwards, so hover effects (the tile lift) work
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, clearProps: "transform" }),
  });
};
batchReveal(".step");
batchReveal(".tile");
batchReveal(".who__item");

gsap.to(".steps__progress", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { trigger: ".steps", start: "top 75%", end: "bottom 55%", scrub: true },
});

gsap.from(".cta", {
  scale: 0.94,
  borderRadius: 80,
  ease: "none",
  scrollTrigger: { trigger: ".cta", start: "top bottom", end: "top 40%", scrub: true },
});
