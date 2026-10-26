// TODO: replace with Chef Abbys' real bookings email before going live
const BOOKING_EMAIL = "bookings@example.com";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// A reload always starts the story from the top. ScrollTrigger restores the browser's own
// scroll memory on refresh, so it's told to keep "manual", and the page is reset again once loaded.
history.scrollRestoration = "manual";
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.clearScrollMemory("manual");
window.scrollTo(0, 0);
addEventListener("beforeunload", () => window.scrollTo(0, 0));

/* ---------- Text splitting (keeps nested markup like <em>, <br>, pills) ---------- */
function split(root, mode = "chars") {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.forEach((t) => {
    const frag = document.createDocumentFragment();
    t.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) return frag.append(" ");
      const word = document.createElement("span");
      word.className = "word";
      if (mode === "chars") {
        [...part].forEach((c) => {
          const ch = document.createElement("span");
          ch.className = "char";
          ch.textContent = c;
          word.append(ch);
        });
      } else {
        word.textContent = part;
      }
      frag.append(word);
    });
    t.replaceWith(frag);
  });
  return mode === "chars" ? $$(".char", root) : $$(".word, .pill", root);
}

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id === "#") return e.preventDefault();
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    document.body.classList.remove("menu-open");
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  })
);

/* ---------- Hero shader: simmering jollof ---------- */
function initShader() {
  const canvas = $(".hero__canvas");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return canvas.classList.add("no-gl");

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const frag = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uScroll;
    vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1. + 2. * fract(sin(p) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
      return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
                 mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= .5; } return v; }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
      vec2 m = (uMouse - .5) * vec2(uRes.x / uRes.y, 1.);
      float d = length(p - m);
      p += (p - m) * .22 * exp(-d * 3.);            // the sauce bends around the cursor
      p.y -= uScroll * .6;
      float t = uTime * .07;
      vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p * 1.4 + 4. * q + vec2(1.7, 9.2) + t * 1.6), fbm(p * 1.4 + 4. * q + vec2(8.3, 2.8) - t));
      float f = fbm(p * 1.4 + 4. * r);
      float k = clamp(f * 1.9 + .5, 0., 1.);
      vec3 c0 = vec3(.07, .03, .02), c1 = vec3(.50, .08, .03), c2 = vec3(.89, .33, .12), c3 = vec3(.98, .70, .30);
      vec3 col = mix(c0, c1, smoothstep(.05, .45, k));
      col = mix(col, c2, smoothstep(.42, .75, k));
      col = mix(col, c3, smoothstep(.70, 1., k) * clamp(length(q) * 1.6, 0., 1.));
      col += c3 * .22 * exp(-d * 4.5);              // heat under the cursor
      col *= 1. - .55 * pow(length(uv - .5), 1.6);  // vignette
      gl_FragColor = vec4(col, 1.);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uScroll = u("uScroll");

  // The noise is soft, so rendering under native resolution looks the same and runs far faster
  const quality = Math.min(devicePixelRatio, 1.5) * 0.6;
  const resize = () => {
    canvas.width = Math.round(canvas.clientWidth * quality);
    canvas.height = Math.round(canvas.clientHeight * quality);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  addEventListener("resize", resize);

  const mouse = { x: 0.5, y: 0.5 }, target = { x: 0.65, y: 0.45 };
  addEventListener("pointermove", (e) => {
    target.x = e.clientX / innerWidth;
    target.y = 1 - e.clientY / innerHeight;
  });

  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas);

  const start = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!visible) return;
    mouse.x += (target.x - mouse.x) * 0.045;
    mouse.y += (target.y - mouse.y) * 0.045;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduce ? 20 : (now - start) / 1000 + 20);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uScroll, Math.min(scrollY / innerHeight, 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(frame);
}
initShader();

/* ---------- Cursor ---------- */
if (finePointer) {
  document.documentElement.classList.add("has-cursor");
  const cursor = $(".cursor"), label = $(".cursor__label");
  const dx = gsap.quickTo(".cursor__dot", "x", { duration: 0.1 });
  const dy = gsap.quickTo(".cursor__dot", "y", { duration: 0.1 });
  const rx = gsap.quickTo(".cursor__ring", "x", { duration: 0.55, ease: "power3" });
  const ry = gsap.quickTo(".cursor__ring", "y", { duration: 0.55, ease: "power3" });
  addEventListener("pointermove", (e) => {
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  });
  $$("[data-cursor]").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      label.textContent = el.dataset.cursor;
      cursor.classList.add("is-active");
    });
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
  });
  $$("a:not([data-cursor]), button:not([data-cursor]), .offer").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });

  // Magnetic elements
  $$(".magnetic, .hero__badge, .nav__cta").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, .4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, .4)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

/* ---------- Nav: clock, hide on scroll, mobile menu ---------- */
const clock = $("#clock");
const tickClock = () => (clock.textContent = new Date().toISOString().slice(11, 19)); // Ghana runs on GMT
tickClock();
setInterval(tickClock, 1000);

const nav = $(".nav");
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (self) => nav.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > 240),
});
// Dark nav text over the cream sections
$$('[data-nav="dark"]').forEach((section) =>
  ScrollTrigger.create({
    trigger: section,
    start: "top 40px",
    end: "bottom 40px",
    onToggle: (self) => nav.classList.toggle("nav--dark", self.isActive),
  })
);
$(".nav__burger").addEventListener("click", () => document.body.classList.toggle("menu-open"));

/* ---------- Hero ---------- */
const heroChars = split($(".hero__title"));
gsap.set(heroChars, { yPercent: 120, rotate: 8 });
gsap.set(".hero__meta > *, .hero__bottom > *", { y: 30, opacity: 0 });
gsap.set(".hero__figure", { yPercent: 30, opacity: 0 });

function heroIntro() {
  gsap.to(".hero__figure", { yPercent: 0, opacity: 1, duration: 1.9, ease: "expo.out", delay: 0.1 });
  gsap.to(heroChars, { yPercent: 0, rotate: 0, duration: 1.6, ease: "expo.out", stagger: 0.05 });
  gsap.to(".hero__meta > *, .hero__bottom > *", { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", stagger: 0.08, delay: 0.5 });
  gsap.from(".hero__canvas", { scale: 1.3, duration: 2.4, ease: "expo.out" });
}

if (!reduce) {
  const heroST = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".hero__title .line:first-child", { xPercent: -14, ease: "none", scrollTrigger: heroST });
  gsap.to(".hero__title .line--right", { xPercent: 14, ease: "none", scrollTrigger: heroST });
  gsap.to(".hero__inner", { yPercent: 25, opacity: 0.2, ease: "none", scrollTrigger: heroST });
  gsap.to(".hero__img", { scale: 1.12, transformOrigin: "50% 100%", ease: "none", scrollTrigger: heroST });

  // She leans toward the cursor; the title drifts the other way for depth
  if (finePointer) {
    const fig = $(".hero__figure"); // moves the steam with her
    const fx = gsap.quickTo(fig, "x", { duration: 1, ease: "power3" });
    const fr = gsap.quickTo(fig, "rotate", { duration: 1, ease: "power3" });
    const lines = $$(".hero__title .line").map((l) => gsap.quickTo(l, "x", { duration: 1.2, ease: "power3" }));
    $(".hero").addEventListener("pointermove", (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      fx(nx * 30);
      fr(nx * 3);
      lines.forEach((to, i) => to(nx * (i ? -40 : -20)));
    });
  }
}

/* ---------- Headings ---------- */
$$(".split-h").forEach((h) => {
  const chars = split(h);
  if (reduce) return;
  gsap.from(chars, {
    yPercent: 70, opacity: 0, rotate: 6,
    duration: 1.1, ease: "expo.out", stagger: 0.018,
    scrollTrigger: { trigger: h, start: "top 85%" },
  });
});

/* ---------- Manifesto: words light up as you read ---------- */
const words = split($(".manifesto__text"), "words");
if (!reduce) {
  gsap.to(words, {
    opacity: 1, stagger: 0.1, ease: "none",
    scrollTrigger: { trigger: ".manifesto__text", start: "top 75%", end: "bottom 45%", scrub: true },
  });
  gsap.from(".pill", {
    scaleX: 0, transformOrigin: "left center", stagger: 0.3, ease: "none",
    scrollTrigger: { trigger: ".manifesto__text", start: "top 75%", end: "bottom 45%", scrub: true },
  });
}

/* ---------- Bands: speed follows scroll velocity ---------- */
if (!reduce) {
  const bands = $$(".band__track").map((el) => ({ el, dir: Number(el.dataset.dir), x: 0, w: 0 }));
  const measure = () => bands.forEach((b) => (b.w = b.el.scrollWidth / 2));
  measure();
  addEventListener("resize", measure);
  let velocity = 0, sign = 1;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      velocity = self.getVelocity();
      sign = velocity < 0 ? -1 : 1;
    },
  });
  gsap.ticker.add((time, dt) => {
    const boost = 1 + Math.min(Math.abs(velocity) / 250, 10);
    velocity *= 0.9;
    bands.forEach((b) => {
      b.x -= b.dir * sign * 0.7 * boost * (dt / 16.7);
      if (b.x <= -b.w) b.x += b.w;
      if (b.x > 0) b.x -= b.w;
      b.el.style.transform = `translate3d(${b.x}px,0,0)`;
    });
  });
}

/* ---------- Receipts: horizontal scroll on desktop ---------- */
const mm = gsap.matchMedia();
mm.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", () => {
  const track = $(".receipts__track");
  const distance = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: { trigger: ".receipts", pin: true, scrub: 1, end: () => "+=" + distance(), invalidateOnRefresh: true },
  });
  $$(".panel__big").forEach((big) =>
    gsap.fromTo(big, { xPercent: 35 }, {
      xPercent: -25, ease: "none",
      scrollTrigger: { trigger: big.closest(".panel"), containerAnimation: tween, start: "left right", end: "right left", scrub: true },
    })
  );
  $$(".panel__body").forEach((body) =>
    gsap.from(body.children, {
      y: 90, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.08,
      scrollTrigger: { trigger: body.closest(".panel"), containerAnimation: tween, start: "left 65%" },
    })
  );
  $$(".guest__media").forEach((media) =>
    gsap.from(media, {
      y: 160, rotate: 14, opacity: 0, duration: 1.4, ease: "expo.out",
      scrollTrigger: { trigger: media.closest(".panel"), containerAnimation: tween, start: "left 75%" },
    })
  );
});

/* ---------- Tour: the road draws itself ---------- */
function countUp(el) {
  const to = Number(el.dataset.to), pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 1.4, ease: "power3.out", onUpdate: () => (el.textContent = pre + Math.round(o.v) + suf) });
}
(() => {
  const svg = $(".gh"), NS = "http://www.w3.org/2000/svg";
  const road = $(".road-draw", svg), base = $(".road-base", svg), dot = $(".road-dot", svg), glow = $(".road-glow", svg), day = $("#day");
  const stats = $$(".tstat"), stops = $$(".stop"), photos = $$(".tphoto");

  // Fit Ghana's bounding box so the route can be drawn before the outline loads
  const projection = d3.geoMercator().fitExtent([[60, 30], [540, 770]], {
    type: "MultiPoint", coordinates: [[-3.26, 4.74], [1.19, 11.17]],
  });
  // Regions named in coverage of the tour, each pinned at its capital; the order is geographic, not a day-by-day log
  const places = [
    { name: "Accra", lonlat: [-0.19, 5.6], label: [16, 5, "start"] },
    { name: "Koforidua", lonlat: [-0.26, 6.09], label: [16, 5, "start"] },
    { name: "Cape Coast", lonlat: [-1.25, 5.1], label: [0, 30, "middle"] },
    { name: "Kumasi", lonlat: [-1.62, 6.69], label: [-16, 5, "end"] },
    { name: "Tamale", lonlat: [-0.85, 9.4], label: [16, 5, "start"] },
    { name: "Bolgatanga", lonlat: [-0.85, 10.79], label: [16, 5, "start"] },
  ].map((p) => ({ ...p, xy: projection(p.lonlat) }));

  const d = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(places.map((p) => p.xy));
  road.setAttribute("d", d);
  base.setAttribute("d", d);
  const len = road.getTotalLength();
  road.style.strokeDasharray = len;

  // Where along the road each stop sits
  const samples = d3.range(0, 1.0001, 0.0025).map((t) => ({ t, pt: road.getPointAtLength(t * len) }));
  places.forEach((p) => {
    p.at = samples.reduce((best, s) => (Math.hypot(s.pt.x - p.xy[0], s.pt.y - p.xy[1]) < Math.hypot(best.pt.x - p.xy[0], best.pt.y - p.xy[1]) ? s : best)).t;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "gh-pin");
    g.setAttribute("transform", `translate(${p.xy[0]},${p.xy[1]})`);
    g.innerHTML = `<circle r="7"/><text x="${p.label[0]}" y="${p.label[1]}" text-anchor="${p.label[2]}">${p.name}</text>`;
    $(".gh__pins", svg).append(g);
    p.pin = g;
  });

  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json")
    .then((r) => r.json())
    .then((world) => {
      const ghana = topojson.feature(world, world.objects.countries).features.find((f) => f.id === "288");
      const outline = d3.geoPath(projection)(ghana);
      $(".gh__land", svg).setAttribute("d", outline);
      $(".gh__edge", svg).setAttribute("d", outline);
    })
    .catch(() => {});

  // Swap the stop card on the left, and drop that stop's photo onto the map
  let active = 0;
  const show = (i) => {
    if (i === active) return;
    const dir = i > active ? 1 : -1, from = stops[active], to = stops[i];
    active = i;
    if (reduce) {
      from.classList.remove("is-active");
      to.classList.add("is-active");
    } else {
      gsap.killTweensOf([from, to, ...from.children, ...to.children]);
      gsap.to(from, { autoAlpha: 0, y: -40 * dir, duration: 0.35, ease: "power2.in", onComplete: () => stops[active] !== from && from.classList.remove("is-active") });
      to.classList.add("is-active");
      gsap.fromTo(to, { autoAlpha: 0, y: 50 * dir }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.2, ease: "expo.out" });
      gsap.fromTo(to.children, { y: 30 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.25, stagger: 0.06, ease: "expo.out" });
    }
    photos.forEach((ph) => {
      const on = i >= Number(ph.dataset.stop);
      if (on === ph.classList.contains("is-on")) return;
      ph.classList.toggle("is-on", on);
      const r = getComputedStyle(ph).getPropertyValue("--r") || "0deg";
      if (reduce) return gsap.set(ph, { autoAlpha: on ? 1 : 0, rotate: r });
      if (on) gsap.fromTo(ph, { autoAlpha: 0, y: 120, rotate: 0, scale: 1.15 }, { autoAlpha: 1, y: 0, rotate: r, scale: 1, duration: 0.9, ease: "expo.out" });
      else gsap.to(ph, { autoAlpha: 0, y: 80, duration: 0.4, ease: "power2.in" });
    });
  };

  const thresholds = [0.12, 0.4, 0.66, 0.92];
  const render = (p) => {
    // The road takes most of the scroll; the last stretch holds on the finale
    const r = Math.min(p / 0.86, 1), l = len * r;
    road.style.strokeDashoffset = len - l;
    const pt = road.getPointAtLength(l);
    dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
    glow.setAttribute("cx", pt.x); glow.setAttribute("cy", pt.y);
    day.textContent = String(Math.round(1 + 24 * p)).padStart(2, "0");
    let reached = 0;
    places.forEach((pl, i) => {
      const on = r >= pl.at - 0.005;
      pl.pin.classList.toggle("is-on", on);
      if (on) reached = i;
    });
    show(p >= 0.93 ? stops.length - 1 : reached);
    stats.forEach((s, i) => {
      const on = p >= thresholds[i];
      s.classList.toggle("is-on", on);
      if (on && !s.dataset.done) {
        s.dataset.done = "1";
        countUp($("strong", s));
      }
    });
  };

  if (reduce) return render(1);
  render(0);
  const state = { p: 0 };
  gsap.to(state, {
    p: 1, ease: "none",
    onUpdate: () => render(state.p),
    scrollTrigger: { trigger: ".tour", start: "top top", end: "+=400%", pin: true, scrub: 1 },
  });
})();

/* ---------- Passport: a camera flies over a dot-matrix world map ---------- */
(() => {
  const section = $(".passport"), stage = $(".passport__pin"), svg = $(".map"), cam = $(".cam", svg), dotmap = $(".dotmap", section);
  const NS = "http://www.w3.org/2000/svg";
  const GOLD = "#f2a541", RED = "#e4572e";
  const isMobile = () => innerWidth <= 768;

  // World units: the map is projected into a fixed 1600×1000 space; the camera maps it to the screen
  const projection = d3.geoMercator().fitExtent([[40, 40], [1560, 960]], {
    type: "MultiPoint",
    coordinates: [[-26, -2], [60, -2], [-26, 58], [60, 58]],
  });
  const P = (lon, lat) => { const [x, y] = projection([lon, lat]); return { x, y }; };

  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.append(n);
    return n;
  };

  // Quadratic arc that always bows upward
  const arc = (a, b, bend) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    let nx = -dy / d, ny = dx / d;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const cx = mx + nx * d * bend, cy = my + ny * d * bend;
    return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, mid: { x: (mx + cx) / 2, y: (my + cy) / 2 } };
  };

  const makePin = (p, label, cls, [dx, dy, anchor] = [12, -10, "start"]) => {
    const g = el("g", { class: `pin ${cls}`, transform: `translate(${p.x},${p.y})` }, $(".pins", svg));
    const pop = el("g", {}, g);
    const inner = el("g", { class: "pin__inner" }, pop);
    el("circle", { class: "pin__pulse", r: 14 }, inner);
    el("circle", { class: "pin__dot", r: 5 }, inner);
    el("text", { class: "pin__label", x: dx, y: dy, "text-anchor": anchor }, inner).textContent = label.toUpperCase();
    gsap.set(pop, { scale: 0, svgOrigin: "0 0" });
    return pop;
  };

  const PLANE = "M0,-7 L1.6,-2 L7.5,1.5 L7.5,3 L1.6,1.6 L1.2,5.4 L3.2,7 L3.2,8 L0,7.1 L-3.2,8 L-3.2,7 L-1.2,5.4 L-1.6,1.6 L-7.5,3 L-7.5,1.5 L-1.6,-2 Z";
  const makePlane = () => {
    const g = el("g", { class: "plane" }, $(".planes", svg));
    el("path", { d: PLANE, transform: "scale(1.7)" }, el("g", { class: "pin__inner" }, g));
    gsap.set(g, { autoAlpha: 0 });
    return g;
  };

  const home = P(-1.62, 6.69);
  const homePop = makePin(home, "Kumasi", "pin--home", [0, -16, "middle"]);
  const legs = [
    { key: "fr", label: "Cannes", ...P(7.01, 43.55) },
    { key: "gb", label: "United Kingdom", ...P(-0.13, 51.51) },
    { key: "ae", label: "Abu Dhabi", ...P(54.37, 24.45) },
  ].map((leg) => {
    const a = arc(home, leg, 0.3);
    return {
      ...leg,
      mid: a.mid,
      glow: el("path", { class: "arc arc--glow", d: a.d }, $(".arcs", svg)),
      path: el("path", { class: "arc", d: a.d }, $(".arcs", svg)),
      plane: makePlane(),
      pop: makePin(leg, leg.label, ""),
    };
  });
  // Label offsets keep the crowded coast readable: [dx, dy, anchor]
  const wa = [
    ["Lomé", 1.23, 6.13, [0, 22, "middle"]], ["Cotonou", 2.42, 6.37, [12, 4, "start"]],
    ["Dakar", -17.47, 14.72, [0, -14, "middle"]],
  ].map(([label, lon, lat, offset]) => {
    const p = P(lon, lat), a = arc(home, p, 0.28);
    el("path", { class: "arc arc--wa", d: a.d, "stroke-dasharray": "3 4" }, $(".arcs-wa", svg));
    return { ...p, mask: el("path", { d: a.d }, $(".wa-mask", svg)), pop: makePin(p, label, "pin--wa", offset) };
  });

  // Camera
  const camState = { x: 800, y: 500, k: 1, fx: 0.5, fy: 0.5 };
  // Stage size is cached; reading it every frame would force a layout right after we move things
  let W = stage.clientWidth, H = stage.clientHeight;
  const base = () => Math.min(W / 1600, H / 1000);
  const applyCam = () => {
    const w = W, h = H, S = camState.k * base();
    const tx = camState.fx * w - S * camState.x, ty = camState.fy * h - S * camState.y;
    cam.setAttribute("transform", `translate(${tx},${ty}) scale(${S})`);
    dotmap.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${S})`;
    svg.style.setProperty("--S", S);
  };
  addEventListener("resize", () => {
    W = stage.clientWidth; H = stage.clientHeight;
    applyCam();
  });
  applyCam();

  // One canvas for all the land, plus one per highlighted country that fades in when she lands there
  const groups = { gh: ["288"], fr: ["250"], gb: ["826"], ae: ["784"], wa: ["768", "204", "686"] };
  const keys = Object.keys(groups);
  const layers = { base: document.createElement("canvas") };
  dotmap.append(layers.base);
  keys.forEach((k) => dotmap.append((layers[k] = document.createElement("canvas"))));

  const zoomK = () => (isMobile() ? 4 : 2.8);
  const FX = () => (isMobile() ? 0.5 : 0.34);
  const FY = () => (isMobile() ? 0.3 : 0.5);
  const fitK = (a, b) => {
    const s = base(), dx = Math.abs(a.x - b.x) * s + 1, dy = Math.abs(a.y - b.y) * s + 1;
    return gsap.utils.clamp(1, isMobile() ? 4 : 3, Math.min((W * 0.6) / dx, (H * 0.45) / dy));
  };

  // Cards, stamps, counter
  const cards = $$(".pass", section), stamps = cards.map((c) => $(".pass__stamp", c));
  const counter = { c: 0 }, countEl = $("#hud-count");
  const bump = (to) => gsap.to(counter, { c: to, duration: 0.3, ease: "none", snap: { c: 1 }, onUpdate: () => (countEl.textContent = counter.c) });
  const cardIn = (i) => gsap.timeline()
    .fromTo(cards[i], { autoAlpha: 0, y: 80, rotate: 5 }, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.6, ease: "expo.out" })
    .fromTo(stamps[i], { autoAlpha: 0, scale: 2.6, rotate: -45 }, { autoAlpha: 1, scale: 1, rotate: -14, duration: 0.3, ease: "power4.in" }, "+=0.15");
  const cardOut = (i) => gsap.to(cards[i], { autoAlpha: 0, y: -60, rotate: -4, duration: 0.45, ease: "power2.in" });

  // Draw an arc; if there's a plane, fly it along the arc pointing where it's heading
  const drawArc = (path, plane, dur = 1.3, glow) => {
    const len = path.getTotalLength(), strokes = glow ? [path, glow] : path;
    gsap.set(strokes, { strokeDasharray: len, strokeDashoffset: len });
    const sub = gsap.timeline().to(strokes, { strokeDashoffset: 0, duration: dur, ease: "power1.inOut" }, 0);
    if (plane) {
      const p = { t: 0 };
      sub.to(p, {
        t: 1, duration: dur, ease: "power1.inOut",
        onUpdate: () => {
          const a = path.getPointAtLength(p.t * len), b = path.getPointAtLength(Math.min(len, p.t * len + 2));
          const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
          plane.setAttribute("transform", `translate(${a.x},${a.y}) rotate(${angle})`);
        },
      }, 0)
        .fromTo(plane, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0)
        .to(plane, { autoAlpha: 0, duration: 0.15 }, dur - 0.15);
    }
    return sub;
  };

  const tl = gsap.timeline({
    paused: reduce,
    defaults: { ease: "power2.inOut" },
    onUpdate: applyCam,
    scrollTrigger: reduce ? undefined : { trigger: section, start: "top top", end: "+=700%", pin: true, scrub: 1, invalidateOnRefresh: true },
  });

  // 1. Zoom into home
  tl.to({}, { duration: 0.4 })
    .addLabel("home")
    .to(".passport__head", { autoAlpha: 0, y: -40, duration: 0.6 }, "home")
    .to(camState, { x: home.x, y: home.y, k: zoomK, fx: FX, fy: FY, duration: 1.3 }, "home")
    .to(layers.gh, { opacity: 1, duration: 0.6 }, "home+=0.5")
    .to(homePop, { scale: 1, duration: 0.5, ease: "back.out(2)" }, "home+=0.8")
    .add(bump(1), "home+=0.8")
    .add(cardIn(0), "home+=0.9")
    .to({}, { duration: 0.8 });

  // 2. Fly to each country
  legs.forEach((leg, i) => {
    const L = `leg${i}`;
    tl.addLabel(L)
      .add(cardOut(i), L)
      .to(camState, { x: leg.mid.x, y: leg.mid.y, k: () => fitK(home, leg), fx: 0.5, fy: () => (isMobile() ? 0.32 : 0.52), duration: 1 }, L)
      .add(drawArc(leg.path, leg.plane, 1.3, leg.glow), `${L}+=0.35`)
      .to(camState, { x: leg.x, y: leg.y, k: zoomK, fx: FX, fy: FY, duration: 1 }, `${L}+=1.5`)
      .to(layers[leg.key], { opacity: 1, duration: 0.5 }, `${L}+=1.45`)
      .to(leg.pop, { scale: 1, duration: 0.5, ease: "back.out(2)" }, `${L}+=1.5`)
      .add(bump(i + 2), `${L}+=1.5`)
      .add(cardIn(i + 1), `${L}+=2`)
      .to({}, { duration: 0.8 });
  });

  // 3. West Africa: the tour still under way, drawn as dashed routes
  const waCenter = P(-7.5, 10.5);
  tl.addLabel("wa")
    .add(cardOut(legs.length), "wa")
    .to(camState, { x: waCenter.x, y: waCenter.y, k: () => fitK(wa[2], wa[1]) * 0.85, fx: FX, fy: FY, duration: 1.3 }, "wa")
    .to(layers.wa, { opacity: 1, duration: 0.6 }, "wa+=1");
  wa.forEach((c, j) => {
    tl.add(drawArc(c.mask, null, 0.9), `wa+=${0.7 + j * 0.15}`)
      .to(c.pop, { scale: 1, duration: 0.4, ease: "back.out(2)" }, `wa+=${1.4 + j * 0.15}`);
  });
  tl.add(bump(legs.length + 1 + wa.length), "wa+=1.6")
    .add(cardIn(legs.length + 1), "wa+=1.7").to({}, { duration: 0.9 });

  // 4. Pull back to see everything
  tl.addLabel("end")
    .add(cardOut(legs.length + 1), "end")
    .to(camState, { x: 800, y: 480, k: 1, fx: 0.5, fy: () => (isMobile() ? 0.45 : 0.46), duration: 1.4 }, "end")
    .to(".passport__hud", { autoAlpha: 0, duration: 0.4 }, "end")
    .to(".pin--wa .pin__label, .pin--home .pin__label", { autoAlpha: 0, duration: 0.4 }, "end")
    .to(".passport__head", { autoAlpha: 1, y: 0, duration: 0.6 }, "end+=0.8")
    .fromTo(".passport__finale > *", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "expo.out" }, "end+=0.9")
    .to({}, { duration: 0.8 });
  tl.fromTo(".hud__bar i", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: tl.duration() }, 0);

  if (reduce) tl.progress(1);

  // Dot-matrix land, sampled from real country shapes
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json")
    .then((r) => r.json())
    .then((world) => {
      const countries = topojson.feature(world, world.objects.countries).features;
      const canvas = (fill) => {
        const c = document.createElement("canvas");
        c.width = 1600; c.height = 1000;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const path = d3.geoPath(projection, ctx);
        countries.forEach((f) => {
          const style = fill(f);
          if (!style) return;
          ctx.fillStyle = style;
          ctx.beginPath(); path(f); ctx.fill();
        });
        return ctx.getImageData(0, 0, 1600, 1000).data;
      };
      const land = canvas(() => "#fff");
      // Each highlighted country gets its own red value; only fully-covered pixels count, so borders never bleed
      const ids = canvas((f) => {
        const k = keys.findIndex((g) => groups[g].includes(f.id));
        return k < 0 ? null : `rgb(${(k + 1) * 40},0,0)`;
      });

      const step = 9, r = 2.3, dots = { base: [] };
      keys.forEach((k) => (dots[k] = []));
      for (let y = step / 2, row = 0; y < 1000; y += step, row++) {
        for (let x = row % 2 ? step : step / 2; x < 1600; x += step) {
          const i = (Math.floor(y) * 1600 + Math.floor(x)) * 4;
          if (land[i + 3] < 128) continue;
          dots.base.push(x, y);
          const k = ids[i + 3] === 255 ? Math.round(ids[i] / 40) : 0;
          if (k >= 1 && k <= keys.length) dots[keys[k - 1]].push(x, y);
        }
      }

      // Paint at the sharpest scale the camera reaches, capped to keep memory sane on phones
      const R = Math.min(Math.max((isMobile() ? 4 : 3) * base() * devicePixelRatio, 1), isMobile() ? 2 : 2.5);
      const paint = (cv, pts, color, pad = r + 1) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
          x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
          y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
        }
        if (!pts.length) return;
        x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
        cv.width = Math.ceil((x1 - x0) * R); cv.height = Math.ceil((y1 - y0) * R);
        Object.assign(cv.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
        const ctx = cv.getContext("2d");
        ctx.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 2) { ctx.moveTo(pts[i] + r, pts[i + 1]); ctx.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2); }
        ctx.fill();
      };
      paint(layers.base, dots.base, "rgba(246,237,220,0.16)");
      keys.forEach((k) => paint(layers[k], dots[k], k === "gh" ? GOLD : RED));
    })
    .catch(() => section.classList.add("no-map"));
})();

/* ---------- Menu: the pinned plate changes as each dish scrolls past ---------- */
(() => {
  const dishes = $$(".dish"), photos = $$(".plate-frame__stack img"), count = $("#dish-count"), bar = $(".plate-frame__bar b");
  let active = 0;
  const show = (i) => {
    if (i === active) return;
    active = i;
    dishes.forEach((d, j) => d.classList.toggle("is-active", j === i));
    count.textContent = String(i + 1).padStart(2, "0");
    bar.style.width = `${((i + 1) / dishes.length) * 100}%`;
    photos.forEach((img, j) => {
      const on = j <= i;
      if (on === img.classList.contains("is-on")) return;
      img.classList.toggle("is-on", on);
      if (reduce) return gsap.set(img, { clipPath: on ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)" });
      // Each dish wipes up over the one before; scrolling back slides it away again
      gsap.to(img, { clipPath: on ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)", duration: 1, ease: "expo.inOut", overwrite: true });
      if (on) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.4, ease: "expo.out" });
    });
  };
  dishes[0].classList.add("is-active");
  dishes.forEach((dish, i) =>
    ScrollTrigger.create({ trigger: dish, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && show(i) })
  );
  if (reduce) return;
  dishes.forEach((dish) =>
    gsap.from($$(":scope > :not(.dish__img)", dish), {
      y: 50, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.07,
      scrollTrigger: { trigger: dish, start: "top 70%" },
    })
  );
})();

if (!reduce) {
  gsap.from(".offer", {
    y: 120, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.1,
    scrollTrigger: { trigger: ".offers", start: "top 85%" },
  });
  gsap.fromTo(".work__portrait img", { clipPath: "inset(100% 0% 0% 0%)", scale: 1.2 }, {
    clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.6, ease: "expo.inOut",
    scrollTrigger: { trigger: ".work__grid", start: "top 75%" },
  });
  gsap.from(".work__lead, .field, .form__end", {
    y: 40, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.06,
    scrollTrigger: { trigger: ".work__grid", start: "top 75%" },
  });
}

/* ---------- Footer: giant type that bounces ---------- */
const footChars = $$(".footer__big .split").flatMap((el) => split(el));
if (!reduce) {
  gsap.from(footChars, {
    yPercent: 100, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.04,
    scrollTrigger: { trigger: ".footer__big", start: "top 90%" },
  });
  footChars.forEach((c) =>
    c.addEventListener("mouseenter", () => {
      if (gsap.isTweening(c)) return;
      gsap.fromTo(c, { y: 0 }, { y: "-0.18em", duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1 });
    })
  );
}

/* ---------- Contact form: opens the visitor's email app ---------- */
$("#contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  const subject = `${d.get("type")} enquiry from ${d.get("name")}`;
  const body = [
    `Name: ${d.get("name")}`,
    `Email: ${d.get("email")}`,
    `Organisation: ${d.get("org") || "-"}`,
    `Enquiry: ${d.get("type")}`,
    "",
    d.get("message"),
  ].join("\n");
  window.location.href = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $("#form-note").textContent = "Opening your email app…";
});

$("#year").textContent = new Date().getFullYear();

/* ---------- Loader → reveal ---------- */
function finishLoading() {
  document.body.classList.remove("is-loading");
  window.scrollTo(0, 0);
  if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.start();
  }
  ScrollTrigger.refresh();
}

if (reduce) {
  $(".loader").remove();
  gsap.set(heroChars, { clearProps: "all" });
  gsap.set(".hero__meta > *, .hero__bottom > *, .hero__figure", { clearProps: "all" });
  finishLoading();
} else {
  const num = $("#loader-num"), bar = $(".loader__bar i");
  const o = { v: 0 };
  gsap.timeline()
    .to(o, {
      v: 100, duration: 2.4, ease: "power2.inOut",
      onUpdate: () => {
        num.textContent = String(Math.round(o.v)).padStart(3, "0");
        bar.style.transform = `scaleX(${o.v / 100})`;
      },
    })
    .to(".loader > *", { yPercent: -40, opacity: 0, duration: 0.6, ease: "power3.in", stagger: 0.05 })
    .to(".loader", { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut" }, "-=0.25")
    .add(heroIntro, "-=0.55")
    .add(() => {
      $(".loader").remove();
      finishLoading();
    });
}

document.fonts.ready.then(() => ScrollTrigger.refresh());

/* ---------- Journey: photo scenes ---------- */
(() => {
  const scenes = $$(".scene");
  if (!scenes.length) return;
  const yearEl = $("#story-year");

  // The giant background year rolls over to each scene's year
  let current = yearEl.textContent;
  const setYear = (y, dir) => {
    if (y === current) return;
    current = y;
    if (reduce) return (yearEl.textContent = y);
    gsap.timeline()
      .to(yearEl, { yPercent: -100 * dir, opacity: 0, duration: 0.35, ease: "power2.in" })
      .add(() => (yearEl.textContent = y))
      .fromTo(yearEl, { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out" });
  };
  scenes.forEach((scene, i) => {
    const prev = i ? scenes[i - 1].dataset.year : "1999";
    ScrollTrigger.create({
      trigger: scene, start: "top 55%", end: "bottom 55%",
      onEnter: () => setYear(scene.dataset.year, 1),
      onLeaveBack: () => setYear(prev, -1),
    });
  });

  if (reduce) {
    $$(".feast__big span[data-to]").forEach((el) => (el.textContent = el.dataset.to + el.dataset.suffix));
    return;
  }

  scenes.forEach((scene) => {
    // Photos unveil upward, then drift inside their frame as you scroll
    $$(".reveal", scene).forEach((frame, j) => {
      const img = $("img", frame);
      gsap.fromTo(frame, { clipPath: "inset(100% 0% 0% 0%)" }, {
        clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut", delay: j * 0.25,
        scrollTrigger: { trigger: scene, start: "top 70%" },
      });
      if (scene.classList.contains("scene--archive")) return; // a print keeps its border, so no drift
      gsap.fromTo(img, { scale: 1.18, yPercent: -3 }, {
        scale: 1.02, yPercent: 3, ease: "none",
        scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
    const float = $(".reveal--float", scene);
    if (float) gsap.fromTo(float, { y: 80 }, { y: -60, ease: "none", scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true } });

    gsap.from($(".scene__text", scene).children, {
      y: 60, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.09,
      scrollTrigger: { trigger: scene, start: "top 60%" },
    });
    gsap.from($$("figcaption span", scene), { y: 20, opacity: 0, duration: 0.8, stagger: 0.1, delay: 0.8, ease: "power3.out", scrollTrigger: { trigger: scene, start: "top 70%" } });
  });

  // The menu card is dealt onto the table, then its courses are served one by one
  gsap.from(".royal", { y: 120, rotate: -14, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".scene--menu", start: "top 65%" } });
  gsap.from(".royal__list li", { x: -30, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, delay: 0.5, scrollTrigger: { trigger: ".scene--menu", start: "top 65%" } });
  gsap.from(".royal__seal", { scale: 3, rotate: -60, opacity: 0, duration: 0.5, ease: "power4.in", delay: 1.3, scrollTrigger: { trigger: ".scene--menu", start: "top 65%" } });

  gsap.from(".feast", { scale: 0.85, borderRadius: "50%", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".scene--feast", start: "top 70%" } });
  $$(".feast__big span[data-to]").forEach((el) =>
    ScrollTrigger.create({ trigger: el, start: "top 80%", once: true, onEnter: () => countUp(el) })
  );
})();

/* ---------- Faces: the photo strip drifts with the scroll ---------- */
(() => {
  const track = $(".faces__track");
  if (!track || reduce) return;
  // Starts with the first photo at the left gutter and stops with its twin at the right gutter
  const gutter = () => parseFloat(getComputedStyle($(".faces__head")).paddingLeft) || 16;
  gsap.fromTo(track, { x: gutter }, {
    x: () => -(track.scrollWidth - innerWidth + gutter()), ease: "none",
    // Pinned, so both ends are actually seen at rest
    scrollTrigger: { trigger: ".faces", start: "center center", end: () => "+=" + (track.scrollWidth - innerWidth), pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
})();

/* ---------- Trophy shelf: medals hang from Ghana-striped ribbons ---------- */
(() => {
  const tones = {
    red: ["#e4572e", "#a8281a", "#f6eddc"], gold: ["#f7c46c", "#c98420", "#120b07"], green: ["#2c6b50", "#0e2a20", "#f6eddc"],
    plum: ["#9a4f7d", "#4f2240", "#f6eddc"], ink: ["#4a382b", "#120b07", "#f6eddc"], stone: ["#cfc2aa", "#958670", "#120b07"],
  };
  // One V-shaped ribbon strip: red, gold and green bands
  const strip = (dir) => {
    const x = (o) => dir * o;
    const band = (a, b, fill) => `<polygon points="${x(a)},-150 ${x(b)},-150 ${x(b * 0.35)},-62 ${x(a * 0.35)},-62" fill="${fill}"/>`;
    return band(8, 22, "#c8341c") + band(22, 36, "#f2a541") + band(36, 50, "#1d6b43");
  };
  $$(".award").forEach((card, i) => {
    const [hi, lo, ink] = tones[card.dataset.tone] || tones.ink;
    const id = `m${i}`;
    $(".award__medal", card).innerHTML = `
      <svg viewBox="-100 -150 200 262" aria-hidden="true">
        <defs>
          <radialGradient id="${id}g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
          <path id="${id}r" d="M0,30 m-66,0 a66,66 0 1,1 132,0 a66,66 0 1,1 -132,0"/>
        </defs>
        <g class="medal">
          ${strip(-1)}${strip(1)}
          <rect x="-26" y="-68" width="52" height="14" rx="3" fill="${lo}"/>
          <circle cx="0" cy="30" r="80" fill="url(#${id}g)"/>
          <circle cx="0" cy="30" r="56" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="1.2"/>
          <circle cx="0" cy="30" r="76" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="1"/>
          <text class="medal__ring-text" fill="${ink}" fill-opacity=".8"><textPath href="#${id}r" textLength="410">${card.dataset.ring}</textPath></text>
          <text class="medal__mark" x="0" y="46" text-anchor="middle" fill="${ink}">${card.dataset.mark}</text>
          <ellipse class="medal__shine" cx="-26" cy="0" rx="34" ry="22" fill="#fff" opacity=".35" transform="rotate(-30 -26 0)"/>
        </g>
      </svg>`;
  });

  if (reduce) return;
  const medals = $$(".award .medal");
  gsap.set(medals, { transformOrigin: "50% -150px" });
  gsap.from(".award", {
    y: 80, opacity: 0, duration: 1.1, ease: "expo.out", stagger: { each: 0.07, from: "start" },
    scrollTrigger: { trigger: ".shelf__grid", start: "top 80%" },
  });
  // Medals drop onto their hooks and settle with a swing
  gsap.from(medals, {
    y: -60, rotate: () => gsap.utils.random(-28, 28), opacity: 0, duration: 2.2, ease: "elastic.out(1, .35)", stagger: 0.08, delay: 0.3,
    scrollTrigger: { trigger: ".shelf__grid", start: "top 80%" },
  });
  $$(".award").forEach((card) => {
    const medal = $(".medal", card);
    card.addEventListener("mouseenter", (e) => {
      const r = card.getBoundingClientRect();
      const side = e.clientX < r.left + r.width / 2 ? 1 : -1;
      gsap.fromTo(medal, { rotate: 16 * side }, { rotate: 0, duration: 1.8, ease: "elastic.out(1, .25)", overwrite: true });
    });
  });
})();
