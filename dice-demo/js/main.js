/* ==================================================================
   Lektura — scroll-rolled 3D dice
   GSAP + ScrollTrigger drive the animation, Lenis smooths the scroll.
================================================================== */
gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------
   Dice builder
   Pip positions are indexes in a 3×3 grid (0 = top-left, 8 = bottom-right).
------------------------------------------------------------------- */
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Rotation (rx, ry) that brings each face to the front
const FACE_ROTATION = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

const WORDS = ["", "one", "two", "three", "four", "five", "six"];

function faceMarkup(n) {
  const cells = Array.from({ length: 9 }, (_, i) =>
    `<span class="${PIPS[n].includes(i) ? "pip" : ""}"></span>`
  ).join("");
  return `<div class="face face--${n}">${cells}</div>`;
}

document.querySelectorAll("[data-dice]").forEach((el) => {
  el.innerHTML =
    `<i class="core core--x"></i><i class="core core--y"></i><i class="core"></i>` +
    [1, 2, 3, 4, 5, 6].map(faceMarkup).join("");
});

document.querySelectorAll("[data-face]").forEach((el) => {
  el.innerHTML = faceMarkup(Number(el.dataset.face));
});

/* ------------------------------------------------------------------
   Lenis smooth scroll, synced to GSAP's ticker
------------------------------------------------------------------- */
let lenis = null;

if (!prefersReduced) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else window.scrollTo({ top: typeof target === "number" ? target : target.offsetTop, behavior: "smooth" });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    const target = id === "#top" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    scrollToTarget(target);
  });
});

/* ------------------------------------------------------------------
   HERO — the dice is thrown as you scroll
------------------------------------------------------------------- */
const hero = document.querySelector("#hero");
const heroWrap = document.querySelector("#heroDiceWrap");
const heroBob = heroWrap.querySelector(".dice-bob");
const heroDice = heroWrap.querySelector(".dice");
const heroShadow = document.querySelector("#heroShadow");
const heroImpact = document.querySelector("#heroImpact");

const isWide = () => window.innerWidth > 900;
const vh = (n) => window.innerHeight * n;
const vw = (n) => window.innerWidth * n;

// Positions are offsets from the centre of the hero
const ground = () => vh(0.14);
const startX = () => (isWide() ? vw(0.2) : 0);

gsap.set([heroWrap, heroShadow, heroImpact], { xPercent: -50, yPercent: -50 });
gsap.set(heroWrap, { x: startX, y: ground });
gsap.set(heroImpact, { y: () => ground() + heroDice.offsetHeight * 0.6 });

// Idle float before the user scrolls
let idle = null;
let idleActive = true;

function startIdle() {
  if (prefersReduced || !idleActive) return;
  idle = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 1.8, ease: "sine.inOut" } })
    .to(heroBob, { y: -22 }, 0)
    .to(heroDice, { "--irx": -8, "--iry": 16 }, 0);
}

function stopIdle() {
  idleActive = false;
  if (idle) idle.pause();
  gsap.to(heroBob, { y: 0, duration: 0.4, overwrite: "auto" });
  gsap.to(heroDice, { "--irx": 0, "--iry": 0, duration: 0.4, overwrite: "auto" });
}

function resumeIdle() {
  idleActive = true;
  if (idle) idle.restart();
  else startIdle();
}

// Intro: headline slides up, dice drops in spinning
const intro = gsap.timeline({ delay: 0.15 });
intro
  .from(".hero__title .line > span", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.1 })
  .from(".hero__copy .eyebrow, .hero__sub, .scroll-hint", { autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.08 }, 0.4)
  .from(heroBob, { y: () => -vh(1), duration: 1.4, ease: "bounce.out" }, 0.1)
  .from(heroDice, { "--irx": -540, "--iry": 450, duration: 1.4, ease: "power3.out" }, 0.1)
  .add(startIdle);

// The scroll-driven throw
const throwTl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: {
    trigger: hero,
    start: "top top",
    end: "+=260%",
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate(self) {
      if (self.progress > 0.01 && idleActive) stopIdle();
      else if (self.progress <= 0.01 && !idleActive) resumeIdle();
    },
  },
});

throwTl
  // copy leaves
  .to(".hero__copy", { yPercent: -25, autoAlpha: 0, duration: 2, ease: "power1.in" }, 0)
  .to(".scroll-hint", { autoAlpha: 0, duration: 0.6 }, 0)

  // flight path: up, down, bounce, bounce, settle
  .fromTo(heroWrap,
    { x: startX, y: ground, scale: 1 },
    { x: () => (isWide() ? vw(0.05) : 0), y: () => ground() - vh(0.42), scale: 1.1, duration: 3, ease: "power2.out" }, 0)
  .to(heroWrap, { x: () => -vw(0.02), y: ground, scale: 1.2, duration: 2.4, ease: "power2.in" }, 3)
  .to(heroWrap, { x: 0, y: () => ground() - vh(0.13), duration: 0.9, ease: "power2.out" }, 5.4)
  .to(heroWrap, { y: ground, duration: 0.9, ease: "power2.in" }, 6.3)
  .to(heroWrap, { y: () => ground() - vh(0.03), duration: 0.35, ease: "power1.out" }, 7.2)
  .to(heroWrap, { y: ground, duration: 0.35, ease: "power1.in" }, 7.55)

  // tumbling: lands on 6 (rx 0, ry 180) after full turns on every axis
  .fromTo(heroDice,
    { "--rx": 0, "--ry": 0, "--rz": 0 },
    { "--rx": 720, "--ry": 900, "--rz": 360, duration: 7.9, ease: "power2.out" }, 0)

  // landing ring on first impact
  .fromTo(heroImpact,
    { x: () => -vw(0.02), scale: 0.3, autoAlpha: 0.9 },
    { scale: 2.2, autoAlpha: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, 5.4)

  // result
  .to(".hero__glow", { opacity: 1, duration: 1.5 }, 7.4)
  .fromTo(".hero__result",
    { autoAlpha: 0, y: 40 },
    { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out" }, 8)
  .to({}, { duration: 1 }); // hold the final frame for a beat

/* ------------------------------------------------------------------
   Shadows follow their dice every frame
------------------------------------------------------------------- */
function followShadow(wrap, bob, dice, shadow, groundY, fadeRange) {
  const s = gsap.getProperty(wrap, "scale");
  const y = gsap.getProperty(wrap, "y") + gsap.getProperty(bob, "y") * s;
  const height = Math.max(0, groundY - y);
  const k = gsap.utils.clamp(0.15, 1, 1 - height / fadeRange);
  gsap.set(shadow, {
    x: gsap.getProperty(wrap, "x"),
    y: groundY + dice.offsetHeight * s * 0.62,
    scale: s * (0.45 + 0.55 * k),
    opacity: 0.9 * k,
  });
}

/* ------------------------------------------------------------------
   PLAY — click-to-roll dice
------------------------------------------------------------------- */
const playWrap = document.querySelector("#playDiceWrap");
const playBob = playWrap.querySelector(".dice-bob");
const playDice = document.querySelector("#playDice");
const playShadow = document.querySelector("#playShadow");
const rollBtn = document.querySelector("#rollBtn");
const playNumber = document.querySelector("#playNumber");
const playWord = document.querySelector("#playWord");
const playHistory = document.querySelector("#playHistory");

const PLAY_GROUND = -10;
gsap.set([playWrap, playShadow], { xPercent: -50, yPercent: -50 });
gsap.set(playWrap, { x: 0, y: PLAY_GROUND });

const playState = { rx: 0, ry: 0, rz: 0 };
const applyPlayState = () => {
  playDice.style.setProperty("--rx", playState.rx);
  playDice.style.setProperty("--ry", playState.ry);
  playDice.style.setProperty("--rz", playState.rz);
};

// Smallest angle >= current + minSpin that lands on the same orientation as base
const spinTo = (current, base, minSpin) =>
  base + 360 * Math.ceil((current + minSpin - base) / 360);

function roll() {
  const value = 1 + Math.floor(Math.random() * 6);
  const [bx, by] = FACE_ROTATION[value];

  rollBtn.disabled = true;
  playWord.textContent = "Rolling…";

  const tl = gsap.timeline({
    onComplete() {
      rollBtn.disabled = false;
      playNumber.textContent = String(value).padStart(2, "0");
      playWord.textContent = `You rolled a ${WORDS[value]}.`;
      const li = document.createElement("li");
      li.textContent = value;
      playHistory.prepend(li);
      if (playHistory.children.length > 10) playHistory.lastElementChild.remove();
      gsap.from(li, { scale: 0, duration: 0.4, ease: "back.out(2)" });
      gsap.fromTo(playNumber, { yPercent: 30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" });
    },
  });

  tl.to(playState, {
    rx: spinTo(playState.rx, bx, 720),
    ry: spinTo(playState.ry, by, 720),
    rz: playState.rz + 360,
    duration: prefersReduced ? 0.3 : 1.7,
    ease: "power3.out",
    onUpdate: applyPlayState,
  }, 0);

  if (!prefersReduced) {
    tl.to(playWrap, { y: PLAY_GROUND - 150, scale: 1.08, duration: 0.45, ease: "power2.out" }, 0)
      .to(playWrap, { y: PLAY_GROUND, scale: 1, duration: 1.1, ease: "bounce.out" }, 0.45);
  }
}

rollBtn.addEventListener("click", roll);

/* ------------------------------------------------------------------
   Per-frame shadow updates
------------------------------------------------------------------- */
gsap.ticker.add(() => {
  followShadow(heroWrap, heroBob, heroDice, heroShadow, ground(), vh(0.5));
  followShadow(playWrap, playBob, playDice, playShadow, PLAY_GROUND, 220);
});

/* ------------------------------------------------------------------
   Section reveals
------------------------------------------------------------------- */
document.querySelectorAll(".reveal").forEach((el) => {
  gsap.from(el, {
    yPercent: 40,
    autoAlpha: 0,
    duration: 1.2,
    ease: "power4.out",
    scrollTrigger: { trigger: el, start: "top 85%" },
  });
});

gsap.set(".card", { autoAlpha: 0, y: 80 });
ScrollTrigger.batch(".card", {
  start: "top 88%",
  once: true,
  onEnter: (batch) =>
    gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.12 }),
});

// Mini dice faces spin in as their card appears
document.querySelectorAll(".card__face").forEach((el) => {
  gsap.from(el, {
    rotate: -180,
    scale: 0.4,
    duration: 1.2,
    ease: "back.out(1.6)",
    scrollTrigger: { trigger: el, start: "top 88%" },
  });
});

// Marquee rows slide in opposite directions with the scroll
gsap.fromTo(".marquee__track--a", { xPercent: 0 }, {
  xPercent: -33.333,
  ease: "none",
  scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "bottom top", scrub: true },
});
gsap.fromTo(".marquee__track--b", { xPercent: -33.333 }, {
  xPercent: 0,
  ease: "none",
  scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "bottom top", scrub: true },
});

// Footer wordmark rises
gsap.from(".footer__big", {
  yPercent: 60,
  ease: "none",
  scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true },
});
