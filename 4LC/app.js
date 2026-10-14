// Renders the featured cases from content.json. Media paths come only from there,
// so finished videos replace placeholders by overwriting the same files.
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
};
// Motion (crossfades, reveals, auto-advance) is left out when the system asks for less of it.
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lbOpen = false;  // while the enlarged view is open, videos on the page stay paused

// Videos load and play only while on screen, unless their area was paused by a click.
const seen = new IntersectionObserver((entries) => {
  for (const { target: v, isIntersecting } of entries) {
    v.vis = isIntersecting;
    if (isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; if (!v.held && !lbOpen) v.play().catch(() => {}); }
    else v.pause();
  }
}, { rootMargin: "300px" });
// Pause or resume every video in an area at once.
const hold = (box, on) => {
  box.classList.toggle("held", on);
  for (const v of box.querySelectorAll("video")) {
    v.held = on;
    if (on) v.pause(); else if (v.vis && v.src && !lbOpen) v.play().catch(() => {});
  }
};
let rate = 1;  // set from content.json before any example is built
let ver = "";  // content.json version, appended to media URLs so overwritten files are re-fetched
const bust = (u) => (u && ver ? `${u}?v=${ver}` : u);
const video = (src, poster, speed = rate) => {
  const v = el("video", { loop: "", playsinline: "", preload: "none", "data-src": bust(src) });
  v.muted = true; if (poster) v.poster = bust(poster);
  v.defaultPlaybackRate = v.playbackRate = speed;
  v.addEventListener("loadedmetadata", () => { v.playbackRate = speed; });
  seen.observe(v); return v;
};

// Clips shown side by side stay on the same frame; the first one leads.
const groups = [];
const sync = (vs) => { groups.push(vs); return vs; };
(function tick() {
  for (const [lead, ...rest] of groups) {
    if (lead.paused || lead.readyState < 2) continue;
    for (const v of rest) {
      if (v.readyState < 2) continue;
      if (Math.abs(v.currentTime - lead.currentTime) > 0.08) v.currentTime = lead.currentTime;
      if (v.paused && !v.held) v.play().catch(() => {});
    }
  }
  requestAnimationFrame(tick);
})();
// A node taken off the page releases its videos and their sync group.
const drop = (node) => {
  const vs = [...node.querySelectorAll("video")];
  for (let i = groups.length - 1; i >= 0; i--) if (groups[i].some((v) => vs.includes(v))) groups.splice(i, 1);
  for (const v of vs) { seen.unobserve(v); v.pause(); v.removeAttribute("src"); v.load(); }
};
// Crossfade: the new node fades in over the old one, which is then dropped.
const swapIn = (holder, node) => {
  const old = [...holder.children];
  holder.append(node);
  if (RM || !old.length) { old.forEach((o) => { drop(o); o.remove(); }); return; }
  node.classList.add("enter");
  old.forEach((o) => o.classList.add("leave"));  // the old one fades out too, so nothing of it lingers
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove("enter")));
  setTimeout(() => old.forEach((o) => { drop(o); o.remove(); }), 400);
};

const cell = (media, label) => el("div", { class: "cell" }, media, label && el("span", { class: "tag", text: label }));
const row = (cells) => el("div", { class: `row r${cells.length}` }, ...cells);

// Arrow keys switch the examples of whichever block the pointer is over.
let hot = null;
const keys = (box, step) => {
  box.addEventListener("pointerenter", () => { hot = step; });
  box.addEventListener("pointerleave", () => { if (hot === step) hot = null; });
};
addEventListener("keydown", (e) => {
  if (lbOpen || !hot || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.target.closest && e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); hot(e.key === "ArrowRight" ? 1 : -1); }
});

// Enlarged view: the clips of one example side by side, kept in step, with one play button
// and one progress bar. Videos on the page pause while it is open.
const ZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>';
const zoom = (clips) => {
  const b = el("button", { type: "button", class: "zoom", "aria-label": "Enlarge", title: "Enlarge" });
  b.innerHTML = ZOOM;
  b.addEventListener("click", (e) => { e.stopPropagation(); enlarge(typeof clips === "function" ? clips() : clips); });
  return b;
};
function enlarge(clips) {
  const back = document.activeElement;
  const was = [...document.querySelectorAll("main video")].filter((v) => !v.paused);
  was.forEach((v) => v.pause());
  lbOpen = true;
  const aspect = clips[0].aspect || 5 / 3, vids = [];
  const figs = clips.map((c) => {
    let m;
    if (c.still) m = el("img", { src: bust(c.src), alt: c.label || "" });
    else {
      m = el("video", { loop: "", playsinline: "", preload: "auto" });
      const speed = c.speed || rate;
      m.muted = true; m.defaultPlaybackRate = m.playbackRate = speed;
      m.addEventListener("loadedmetadata", () => { m.playbackRate = speed; });
      m.src = bust(c.src); vids.push(m);
    }
    m.style.aspectRatio = String(c.aspect || 5 / 3);
    return el("figure", {}, m, c.label && el("figcaption", { text: c.label }));
  });
  const grid = el("div", { class: "lb-grid" }, ...figs);
  const play = el("button", { type: "button", class: "play", "aria-label": "Pause" });
  const bar = el("input", { type: "range", min: "0", max: "1000", value: "0", "aria-label": "Playback position" });
  const close = el("button", { type: "button", class: "lb-close", "aria-label": "Close", text: "×" });
  const body = el("div", { class: "lb-body" }, grid, vids.length ? el("div", { class: "ctl" }, play, bar) : null);
  const box = el("div", { class: "lb", role: "dialog", "aria-modal": "true", "aria-label": "Enlarged example" }, close, body);
  const fit = () => {
    const n = innerWidth < 720 ? 1 : Math.min(figs.length, 3), rows = Math.ceil(figs.length / n), gap = 12;
    const w = Math.min((innerWidth * 0.94 - (n - 1) * gap) / n, ((innerHeight - 150) / rows - 30) * aspect);
    grid.style.gridTemplateColumns = `repeat(${n}, ${Math.max(160, Math.floor(w))}px)`;
  };
  fit();
  let paused = false, dragging = false, live = true;
  const lead = vids[0];
  const setPaused = (p) => {
    paused = p; play.classList.toggle("off", p); play.setAttribute("aria-label", p ? "Play" : "Pause");
    vids.forEach((v) => (p ? v.pause() : v.play().catch(() => {})));
  };
  play.addEventListener("click", () => setPaused(!paused));
  bar.addEventListener("input", () => {
    dragging = true;
    if (lead && lead.duration) vids.forEach((v) => { v.currentTime = (bar.value / 1000) * lead.duration; });
  });
  bar.addEventListener("change", () => { dragging = false; });
  (function loop() {
    if (!live) return;
    if (lead && lead.readyState >= 1 && lead.duration) {
      if (!dragging) bar.value = Math.round((lead.currentTime / lead.duration) * 1000);
      bar.style.setProperty("--p", `${(bar.value / 10).toFixed(1)}%`);
      if (!lead.paused) for (const v of vids.slice(1)) if (v.readyState >= 2 && Math.abs(v.currentTime - lead.currentTime) > 0.06) v.currentTime = lead.currentTime;
    }
    requestAnimationFrame(loop);
  })();
  const shut = () => {
    live = false; lbOpen = false;
    removeEventListener("keydown", onKey, true); removeEventListener("resize", fit);
    vids.forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
    box.remove(); document.documentElement.classList.remove("lb-on");
    was.forEach((v) => { if (!v.held) v.play().catch(() => {}); });
    if (back && back.focus) back.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); shut(); }
    else if (e.key === " " && e.target !== play) { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "Tab") {  // focus stays inside the dialog
      const f = [close, play, bar].filter((x) => x.isConnected);
      const i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
    e.stopPropagation();
  };
  close.addEventListener("click", shut);
  box.addEventListener("click", (e) => { if (e.target === box || e.target === body) shut(); });
  addEventListener("keydown", onKey, true); addEventListener("resize", fit);
  document.documentElement.classList.add("lb-on");
  document.body.append(box);
  vids.forEach((v) => v.play().catch(() => {}));
  close.focus({ preventScroll: true });
}

// One example block per slide. Neighbouring blocks peek in at the sides so it is clear
// there is more; arrows, dots, keys and swipe all move between them. `moved` hears the shown
// index; the returned function shows another one.
function carousel(box, items, moved) {
  if (!items.length) return;  // a part with no cases (switched off) stays empty
  const slides = items.map(([node]) => el("div", { class: "slide" }, node));
  const track = el("div", { class: "track", tabindex: "0", "aria-roledescription": "carousel" }, ...slides);
  const arrow = (dir) => el("button", { type: "button", class: `arrow ${dir}`, "aria-label": dir === "prev" ? "Previous example" : "Next example" },
    el("span", { "aria-hidden": "true", text: dir === "prev" ? "←" : "→" }));
  const prev = arrow("prev"), next = arrow("next");
  const dots = items.map(([, name], i) => el("button", { type: "button", "aria-label": name || `Example ${i + 1}` }));
  const name = el("span", { class: "name" }), count = el("span", { class: "count" });
  let index = 0, shown = 0, settle, aiming = false;  // aiming: a scroll started by go() is still on its way
  const offset = (i) => slides[i].offsetLeft - (track.clientWidth - slides[i].clientWidth) / 2;
  const update = () => {
    // The track takes the height of the shown block, so short blocks leave no gap below.
    track.style.height = slides[index].offsetHeight + "px";
    slides.forEach((sl, k) => sl.classList.toggle("on", k === index));
    dots.forEach((d, k) => d.setAttribute("aria-current", String(k === index)));
    prev.disabled = index === 0; next.disabled = index === slides.length - 1;
    name.textContent = items[index][1] || "";
    count.textContent = `${index + 1} / ${slides.length}`;
    if (index !== shown) { shown = index; if (box.classList.contains("held")) hold(box, false); }  // a new page plays again
    if (moved) moved(index);
  };
  const go = (i, behavior = "smooth") => {
    index = Math.max(0, Math.min(slides.length - 1, i));
    aiming = true;
    track.scrollTo({ left: offset(index), behavior: RM ? "instant" : behavior });
    update();
  };
  prev.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
  slides.forEach((sl, i) => sl.addEventListener("click", (e) => {
    if (i !== index) go(i);
    else if (!e.target.closest("button, a, input")) hold(box, !box.classList.contains("held"));
  }));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  });
  keys(box, (d) => go(index + d));
  // After a swipe settles, follow whichever block is nearest the centre.
  track.addEventListener("scroll", () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (aiming) { if (Math.abs(track.scrollLeft - offset(index)) > 2) return; aiming = false; }
      const c = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      slides.forEach((sl, k) => { if (Math.abs(sl.offsetLeft + sl.clientWidth / 2 - c) < Math.abs(slides[best].offsetLeft + slides[best].clientWidth / 2 - c)) best = k; });
      if (best !== index) { index = best; update(); }
    }, 120);
  }, { passive: true });
  for (const ev of ["pointerdown", "wheel", "touchstart"]) track.addEventListener(ev, () => { aiming = false; }, { passive: true });  // a swipe takes over
  window.addEventListener("resize", () => go(index, "instant"));
  const many = slides.length > 1;
  box.classList.toggle("single", !many);
  box.append(el("div", { class: "stage" }, track, many && prev, many && next),
    el("div", { class: "under" }, name, many && el("div", { class: "dots" }, ...dots), many && count));
  requestAnimationFrame(() => go(0, "instant"));
  return (i) => go(i);
}

// Wipe divider: it moves only when dragged; a plain click calls `click` (pause or resume), or,
// without one, is passed on to the area around it.
// `down` turns the divider horizontal: the over layer shows above it and the divider is dragged up and down.
const dragWipe = (box, range, set, click, down) => {
  range.addEventListener("input", () => set(+range.value));  // keyboard
  let drag = null, moved = false;
  const at = (e) => {
    const r = box.getBoundingClientRect(), [p, o, len] = down ? [e.clientY, r.top, r.height] : [e.clientX, r.left, r.width];
    return [(p - o) / len * 100, p - o - len * range.value / 100];
  };
  const near = (e) => Math.abs(at(e)[1]) < 24;
  box.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".zoom")) return;
    drag = { x: e.clientX, y: e.clientY, grab: near(e), moved: false }; box.setPointerCapture(e.pointerId);
  });
  box.addEventListener("pointermove", (e) => {
    if (!drag) { box.classList.toggle("near", near(e)); return; }
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
    if (drag.grab && drag.moved) set(Math.round(Math.max(0, Math.min(100, at(e)[0]))));
  });
  box.addEventListener("pointerup", () => { if (drag) { moved = drag.moved; if (!moved && click) click(); } drag = null; });
  box.addEventListener("pointercancel", () => { drag = null; });
  box.addEventListener("pointerleave", () => box.classList.remove("near"));
  box.addEventListener("click", (e) => { if (moved || click) e.stopPropagation(); moved = false; });
};
const wipeBox = (under, overs, x, click, tags, down = false) => {
  const box = el("div", { class: down ? "wipe down" : "wipe" }), key = down ? "--y" : "--x";
  box.style.setProperty(key, x + "%");
  const range = el("input", { type: "range", min: "0", max: "100", value: String(x), "aria-label": "Move the divider" });
  const set = (v) => { range.value = v; box.style.setProperty(key, v + "%"); };
  dragWipe(box, range, set, click, down);
  overs.forEach((v) => v.classList.add("on"));  // the clipped side is always shown
  box.append(under, el("div", { class: "wipe-over" }, ...overs), el("span", { class: "grip", "aria-hidden": "true" }), range, ...tags);
  return box;
};

// Readout wipe: the chosen representation's readout on the left, the generated video on the right.
// Every representation is loaded and kept in step, so switching only changes which one is visible.
let reps = [], rep = "rgb";
const wipes = [];
const wipe = (c) => {
  const under = video(c.media["output.mp4"], c.poster);
  const layers = Object.fromEntries(reps.map((r) => [r.key, video(c.media[r.file])]));
  const label = el("span", { class: "tag" });
  const cur = () => reps.find((x) => x.key === rep);
  const box = wipeBox(under, Object.values(layers), 33, () => { const ro = box.parentElement; hold(ro, !ro.classList.contains("held")); },
    [label, el("span", { class: "tag right", text: "Generated" })]);
  box.append(zoom(() => [{ src: c.media[cur().file], label: `${cur().label} readout` }, { src: c.media["output.mp4"], label: "Generated" }]));
  sync([under, ...Object.values(layers)]);
  const show = () => {
    for (const [k, v] of Object.entries(layers)) v.classList.toggle("on", k === rep);
    label.textContent = `${cur().label} readout`;
  };
  wipes.push(show); show();
  return box;
};
// Representation buttons; `on` gets the chosen key. Each section keeps its own choice.
// A pill slides to the chosen button.
const repTabs = (list, on) => {
  let cur = list[0].key;
  const pill = el("span", { class: "pill", "aria-hidden": "true" });
  const buttons = list.map((r) => {
    const b = el("button", { type: "button" }, el("span", { text: r.label }));
    b.addEventListener("click", () => { cur = r.key; update(); });
    return [r.key, b];
  });
  const group = el("div", { class: "rep-tabs", role: "group", "aria-label": "Representation" }, pill, ...buttons.map(([, b]) => b));
  const place = () => {
    const b = buttons.find(([k]) => k === cur)[1];
    if (!b.offsetWidth) return;
    Object.assign(pill.style, { left: b.offsetLeft + "px", top: b.offsetTop + "px", width: b.offsetWidth + "px", height: b.offsetHeight + "px" });
    if (!group.classList.contains("ready")) requestAnimationFrame(() => group.classList.add("ready"));
  };
  const update = () => {
    for (const [k, b] of buttons) b.setAttribute("aria-pressed", String(k === cur));
    place(); on(cur);
  };
  update();
  requestAnimationFrame(place); addEventListener("resize", place);
  if (document.fonts) document.fonts.ready.then(place);
  return el("div", { class: "reps" }, group);
};

const still = (e) => el("img", { class: "still", src: bust(e.media["input.jpg"]), alt: e.title, loading: "lazy" });

// Result card: the result fills the card, the input sits in a small window at the lower left.
const card = (p, poster, speed) => {
  const out = video(p.b, poster, speed);
  const isStill = p.a.endsWith(".jpg");
  const inp = isStill ? el("img", { src: bust(p.a), alt: "", loading: "lazy" }) : video(p.a, undefined, speed);
  if (!isStill) sync([out, inp]);
  const n = el("div", { class: "card" }, out, p.lb && p.lb !== "Generated" && el("span", { class: "tag", text: p.lb }),
    el("div", { class: "pip" }, inp, el("span", { class: "tag", text: isStill ? "Input image" : "Input" })),
    zoom([{ src: p.a, label: isStill ? "Input image" : "Input", still: isStill, speed }, { src: p.b, label: p.name ? `Generated · ${p.name}` : "Generated", speed }]));
  n.out = out;
  return n;
};
const where = {};  // credits: how each rebuilt section numbers its cases

fetch("content.json", { cache: "no-cache" }).then((r) => r.json()).then((c) => {
  const by = Object.fromEntries(["camera", "time", "multiview", "image", "edit"].flatMap((k) => c[k].map((e) => [e.id, e])));
  const cmp = Object.fromEntries(c.compare.map((e) => [e.id, e]));
  const f = c.featured, $ = (id) => document.getElementById(id);
  rate = (c.playback && c.playback.rate) || 1;
  ver = c.version || "";
  const speedOf = (sec) => (c.playback && c.playback[sec]) || rate;
  const pairs = (sec) => c.montage[sec].flatMap((m) => m.pairs);

  const t = $("teaser");
  // The main video waits on its first frame until the viewer presses play.
  if (!t.hidden) { t.muted = true; t.poster = bust(c.teaser.poster); t.src = bust(c.teaser.video); }

  // Long-horizon: condition-acquisition time per segment from the paper (NeoVerse 2.75 s, 4LC 0.04 s),
  // times the number of segments; NeoVerse pays it again for every segment.
  const seg = $("segments"), nv = 2.75, ours = 0.04;
  const accum = () => {
    const k = +seg.value, max = +seg.max * nv;
    $("seg-n").value = k;
    $("acc-nv").style.setProperty("--w", (k * nv / max) * 100 + "%");
    $("acc-ours").style.setProperty("--w", (k * ours / max) * 100 + "%");
    $("acc-nv-n").textContent = `${(k * nv).toFixed(1)} s condition acquisition`;
    $("acc-ours-n").textContent = `${(k * ours).toFixed(2)} s condition acquisition`;
  };
  seg.addEventListener("input", accum); accum();

  reps = c.readout_reps || [{ key: "rgb", label: "Cache", file: "condition.mp4" }];
  const ro = $("readout");
  ro.before(repTabs(reps, (k) => { rep = k; wipes.forEach((f) => f()); }));
  ro.append(...f.readout.map((id) => wipe(by[id])));  // 2 x 2, near the clips' native size

  // Image to world: composed videos from tools/montage.py (they play faster, being longer).
  const montage = (sec) => carousel($(sec), c.montage[sec].map((m) => {
    const v = video(m.video, m.poster, speedOf(sec));
    v.classList.add("montage");
    v.style.aspectRatio = `${m.size[0]} / ${m.size[1]}`;
    return [el("div", { class: "cell" }, v, zoom([{ src: m.video, speed: speedOf(sec), aspect: m.size[0] / m.size[1] }])), ""];
  }));

  // Camera control: one large result with its input beside it, and every camera move below as a
  // thumbnail. The shown move advances by itself after two loops until a thumbnail is chosen.
  (() => {
    const box = $("camera"), list = pairs("camera"), speed = speedOf("camera"), LOOPS = 2;
    if (!list.length) return;
    where["s-camera"] = list.map((_, i) => String(i + 1));
    const main = el("div", { class: "swap" }), side = el("div", { class: "swap" });
    const name = el("p", { class: "feat-name" }), count = el("span", { class: "count" });
    const thumbs = list.map((p, i) => {
      const b = el("button", { type: "button", class: "thumb", "aria-label": p.lb },
        el("span", { class: "thumb-img" }, el("img", { src: bust(by[p.case].poster), alt: "", loading: "lazy" }), el("i", { class: "prog" })),
        el("span", { class: "thumb-name", text: p.lb }));
      b.addEventListener("click", () => pick(i, true));
      return b;
    });
    let i = -1, auto = !RM, loops = 0, last = 0, lead = null;
    const manual = () => { if (auto) { auto = false; box.classList.add("manual"); } };
    const pick = (k, user) => {
      if (user) manual();
      k = (k + list.length) % list.length;
      if (k === i) return;
      i = k; loops = 0; last = 0;
      const p = list[i];
      const out = video(p.b, by[p.case].poster, speed), inp = video(p.a, undefined, speed);
      const toggle = () => { manual(); hold(box, !box.classList.contains("held")); };
      out.addEventListener("click", toggle); inp.addEventListener("click", toggle);
      sync([out, inp]); lead = out;
      swapIn(main, el("div", { class: "card pz" }, out, zoom([{ src: p.a, label: "Input", speed }, { src: p.b, label: `Generated · ${p.lb}`, speed }])));
      swapIn(side, cell(inp, "Input"));
      if (box.classList.contains("held")) hold(box, false);
      name.textContent = p.lb; count.textContent = `${i + 1} / ${list.length}`;
      thumbs.forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.style.setProperty("--p", "0"); });
    };
    (function step() {
      if (auto && lead && lead.readyState >= 2 && lead.duration) {
        const t = lead.currentTime / lead.duration;
        if (t < last - 0.3) loops++;
        last = t;
        if (loops >= LOOPS) pick(i + 1);
        else thumbs[i].style.setProperty("--p", ((loops + t) / LOOPS).toFixed(3));
      }
      requestAnimationFrame(step);
    })();
    keys(box, (d) => pick(i + d, true));
    box.append(el("div", { class: "feat" }, main, el("div", { class: "feat-side" }, el("div", { class: "feat-head" }, name, count), side)),
      el("div", { class: "thumbs" }, ...thumbs));
    pick(0);
  })();

  // Time control: one column per mode. Under each result two tracks show where the camera is in
  // the clip and which moment of the scene is shown: frozen, running backwards, or stopping.
  // Thumbnails list each mode's cases; like camera control, a column moves on by itself after
  // two loops until one of its thumbnails (or its video) is used.
  (() => {
    const box = $("time"), list = pairs("time"), speed = speedOf("time");
    const modes = [...new Set(list.map((p) => p.lb))];
    const order = [], ticks = [];
    box.append(...modes.map((mode) => {
      const items = list.filter((p) => p.lb === mode);
      const short = mode.replace(/^Time /, "");
      items.forEach((p, k) => { order[list.indexOf(p)] = `${short[0].toUpperCase()}${short.slice(1)} ${k + 1}`; });
      const holder = el("div", { class: "swap" });
      const cam = el("i"), scene = el("i");
      const clock = el("div", { class: "clock", "aria-hidden": "true" },
        el("span", { text: "Camera" }), el("div", { class: "tl" }, cam), el("span", { text: "Scene" }), el("div", { class: "tl" }, scene));
      let i = -1, out = null, curve = {}, auto = !RM && items.length > 1, loops = 0, last = 0;
      const thumbs = items.map((p, k) => {
        const b = el("button", { type: "button", class: "thumb", "aria-label": by[p.case].title },
          el("span", { class: "thumb-img" }, el("img", { src: bust(by[p.case].poster), alt: "", loading: "lazy" }), el("i", { class: "prog" })),
          el("span", { class: "thumb-name", text: by[p.case].title }));
        b.addEventListener("click", () => go(k, true));
        return b;
      });
      const col = el("div", { class: "mode" }, el("h3", { text: mode }), holder, clock,
        items.length > 1 && el("div", { class: "thumbs few" }, ...thumbs));
      const manual = () => { if (auto) { auto = false; col.classList.add("manual"); } };
      const go = (k, user) => {
        if (user) manual();
        k = (k + items.length) % items.length;
        if (k === i) return;
        i = k; loops = 0; last = 0;
        const p = items[i], n = card({ ...p, lb: "", name: mode }, by[p.case].poster, speed);
        n.classList.add("pz");
        n.out.addEventListener("click", () => { manual(); hold(col, !col.classList.contains("held")); });
        out = n.out; curve = by[p.case].curve || {};
        swapIn(holder, n);
        if (col.classList.contains("held")) hold(col, false);
        thumbs.forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.style.setProperty("--p", "0"); });
      };
      // Scene time for clip time t (seconds). "auto_stride" freezes a frame picked within the
      // first second (the subject in mid-stride); it is drawn at half a second.
      const sceneAt = (t, T) => {
        const at = typeof curve.at === "number" ? curve.at : 0.5;
        if (curve.mode === "reverse") return T - t;
        if (curve.mode === "pause") return Math.min(t, at);
        if (curve.mode === "freeze") return at;
        return t;
      };
      ticks.push(() => {
        if (!out || out.readyState < 1 || !out.duration) return;
        const T = out.duration, t = out.currentTime;
        cam.style.left = `${(t / T) * 100}%`;
        scene.style.left = `${Math.max(0, Math.min(1, sceneAt(t, T) / T)) * 100}%`;
        if (auto && out.readyState >= 2) {
          if (t / T < last - 0.3) loops++;
          last = t / T;
          if (loops >= 2) go(i + 1);
          else thumbs[i].style.setProperty("--p", ((loops + t / T) / 2).toFixed(3));
        }
      });
      keys(col, (d) => go(i + d, true));
      go(0);
      return col;
    }));
    where["s-time"] = order;
    (function step() { ticks.forEach((g) => g()); requestAnimationFrame(step); })();
  })();

  // Multiple views: the four new views sit 2 x 2 where their cameras are (left / right, raised or
  // further out on top), with the input view in a window at the centre.
  const spots = (vs) => {
    const x = (v) => (v.right || 0) + (v.yaw || 0) / 100;
    const vert = vs.some((v) => v.up || v.pitch);
    let pos = vs.map((v) => [vert ? (v.up > 0 || v.pitch > 0 ? 0 : 1) : 0, x(v) < 0 ? 0 : 1]);
    if (!vert) for (const col of [0, 1]) {
      vs.map((_, i) => i).filter((i) => pos[i][1] === col)
        .sort((a, b) => Math.abs(x(vs[b])) - Math.abs(x(vs[a]))).forEach((i, k) => { pos[i][0] = k; });
    }
    if (new Set(pos.map(String)).size !== vs.length || pos.some((p) => p[0] > 1)) pos = vs.map((_, i) => [i >> 1, i & 1]);
    return pos;
  };
  carousel($("multiview"), f.multiview.map((id) => {
    const e = by[id];
    const inp = video(e.media["input.mp4"], e.poster), vs = e.views.map((_, i) => video(e.media[`view-${i}.mp4`]));
    sync([inp, ...vs]);
    const pos = spots(e.views);
    return [el("div", { class: "mvq" }, ...vs.map((v, i) => {
      const n = cell(v);
      n.classList.add(`r${pos[i][0]}`, `c${pos[i][1]}`);
      n.style.gridArea = `${pos[i][0] + 1} / ${pos[i][1] + 1}`;
      return n;
    }), el("div", { class: "center" }, inp, el("span", { class: "tag", text: `Input · ${e.group}` })),
    zoom([{ src: e.media["input.mp4"], label: `Input · ${e.group}` }, ...e.views.map((_, i) => ({ src: e.media[`view-${i}.mp4`], label: `View ${i + 1}` }))])), ""];
  }));

  // Image to video: every case at once in a wall; hovering a tile shows its input image,
  // clicking opens it large.
  (() => {
    const box = $("i2v"), list = pairs("i2v"), speed = speedOf("i2v");
    where["s-i2v"] = list.map((_, i) => String(i + 1));
    box.append(...list.map((p) => {
      const out = video(p.b, by[p.case].poster, speed);
      const clips = [{ src: p.a, label: "Input image", still: true }, { src: p.b, label: "Generated", speed }];
      const tile = el("div", { class: "tile", role: "button", tabindex: "0", "aria-label": `${by[p.case].title}: enlarge` },
        out, el("div", { class: "pip" }, el("img", { src: bust(p.a), alt: "", loading: "lazy" }), el("span", { class: "tag", text: "Input image" })));
      tile.addEventListener("click", () => enlarge(clips));
      tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enlarge(clips); } });
      return tile;
    }));
  })();

  montage("i2w");

  // Video editing: the instructions on the left, the chosen edit on the right as a wipe between
  // the input (above the divider) and the edited video (below); a horizontal divider crosses the
  // edited subject wherever it walks in the frame. Transition edits change the camera path, so their frames do
  // not line up and the two videos sit side by side instead.
  (() => {
    const box = $("edit"), list = pairs("edit"), speed = speedOf("edit");
    if (!list.length) return;
    where["s-edit"] = list.map((_, i) => String(i + 1));
    const stage = el("div", { class: "swap" });
    let i = -1;
    const items = list.map((p, k) => {
      const b = el("button", { type: "button", class: "ed-item" },
        el("span", { class: "ed-kind", text: by[p.case].group || "Edit" }), el("span", { class: "ed-text", text: p.edit }));
      b.addEventListener("click", () => go(k));
      return b;
    });
    const go = (k) => {
      k = (k + list.length) % list.length;
      if (k === i) return;
      i = k;
      const p = list[i];
      const out = video(p.b, by[p.case].poster, speed), inp = video(p.a, undefined, speed);
      sync([out, inp]);
      const clips = [{ src: p.a, label: "Input", speed }, { src: p.b, label: "Edited", speed }];
      const toggle = () => hold(box, !box.classList.contains("held"));
      let n;
      if (by[p.case].group === "Transition") {
        out.addEventListener("click", toggle); inp.addEventListener("click", toggle);
        n = el("div", { class: "ed-pair pz" }, cell(inp, "Input"), cell(out, "Edited"), zoom(clips));
      } else {
        n = wipeBox(out, [inp], 50, toggle, [el("span", { class: "tag", text: "Input" }), el("span", { class: "tag low", text: "Edited" })], true);
        n.classList.add("pz"); n.append(zoom(clips));
      }
      swapIn(stage, n);
      if (box.classList.contains("held")) hold(box, false);
      items.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    };
    keys(box, (d) => go(i + d));
    box.append(el("div", { class: "ed-list" }, ...items), stage);
    go(0);
  })();

  // Sources & Credits: one table per shown section, cases in page order. Carousels number them
  // "page.card"; the rebuilt sections number them as they now appear.
  const link = (text, href) => href ? el("a", { href, text, target: "_blank", rel: "noopener noreferrer" }) : document.createTextNode(text || "—");
  const credits = {};
  for (const r of c.credits || []) (credits[r.section] ||= []).push(r);
  $("credit-list").append(...Object.entries(credits).filter(([sec]) => $(sec) && !$(sec).hidden).map(([sec, rows]) => {
    const names = where[sec] && where[sec].length === rows.length ? where[sec] : null;
    // Source: platform and item id, linked to the original page.
    const short = (s) => `${s.platform} · ${s.url.replace(/\/$/, "").split("/").pop().replace(/^.*-(\d+)$/, "$1")}`;
    const head = el("tr", {}, ...["#", "Case", "Source"].map((t) => el("th", { text: t })));
    const body = rows.flatMap((r, j) => r.inputs.map((s, k) => el("tr", {},
      el("td", { text: k ? "" : names ? names[j] : r.where }), el("td", { text: k ? "" : r.case }), el("td", {}, link(short(s), s.url)))));
    return el("div", { class: "credit-group" }, el("h3", { text: $(sec).dataset.nav }),
      el("div", { class: "credit-scroll" }, el("table", {}, el("thead", {}, head), el("tbody", {}, ...body))));
  }));

  // Parts switched off in index.html are not built, so their media are never requested.
  // NeoVerse comparison: one case per page. Top row 4LC (input | Cache readout, switchable | result),
  // bottom row NeoVerse (input | 4DGS-rendered condition | result). Below, the two results meet in a
  // wipe, and one progress bar moves every clip of the case.
  const cs = $("s-compare");
  if (!cs.hidden) {
    const picked = f.compare.map((id) => cmp[id]);
    // Every representation any case has; a case still missing one keeps showing its RGB readout (tag says so).
    const list = (c.readout_reps || []).filter((r) => picked.some((e) => e.reps.some((x) => x.key === r.key)));
    const shows = [], bars = [];
    let pick = list.length ? list[0].key : "";
    const area = $("compare");
    // Every case as a small thumbnail above the comparison (grouped by task), so the count shows at once
    // and any case is one click away; the representation buttons sit on the next line.
    const kinds = [["Time control", picked.filter((e) => c.time.some((x) => x.id === e.id))],
      ["Camera control", picked.filter((e) => !c.time.some((x) => x.id === e.id))]].filter(([, es]) => es.length);
    const pills = new Map();
    const cases = el("div", { class: "cases", role: "group", "aria-label": "Case" }, ...kinds.flatMap(([kind, es]) => [
      el("span", { class: "case-kind", text: kind }),
      ...es.map((e) => {
        const b = el("button", { type: "button", class: "case", "aria-label": e.title },
          el("img", { src: bust(e.poster), alt: "", loading: "lazy" }));
        b.addEventListener("click", () => show(picked.indexOf(e)));
        pills.set(e, b);
        return b;
      })]));
    area.before(el("div", { class: "cmp-bar" }, cases, list.length > 1 && repTabs(list, (k) => { pick = k; shows.forEach((g) => g()); })));
    const box = (v, tag) => el("div", {}, cell(v, tag));
    const show = carousel(area, picked.map((e) => {
      const m = e.media;
      const ins = [video(m["input.mp4"], e.poster), video(m["input.mp4"], e.poster)];
      const nc = video(m["neoverse-condition.mp4"]), nv = video(m["neoverse.mp4"]), out = video(m["ours.mp4"]);
      const wa = video(m["ours.mp4"]), wb = video(m["neoverse.mp4"]);
      const layers = Object.fromEntries(e.reps.map((r) => [r.key, video(r.file)]));
      const tag = el("span", { class: "tag" });
      const stack = el("div", { class: "cell stack" }, ...Object.values(layers), tag);
      const show = () => {
        const k = layers[pick] ? pick : e.reps[0].key;
        for (const [r, v] of Object.entries(layers)) v.classList.toggle("on", r === k);
        tag.textContent = `${e.reps.find((r) => r.key === k).label} readout`;
      };
      shows.push(show); show();
      const vs = sync([ins[0], nc, nv, ins[1], ...Object.values(layers), out, wa, wb]);
      const head = (t, ours) => el("h3", { class: ours ? "cmp-head ours" : "cmp-head", text: t });
      const both = wipeBox(wb, [wa], 50, null, [el("span", { class: "tag ours", text: "4LC-Video" }), el("span", { class: "tag right", text: "NeoVerse" })]);
      both.append(zoom([{ src: m["input.mp4"], label: "Input" }, { src: m["ours.mp4"], label: "4LC-Video" }, { src: m["neoverse.mp4"], label: "NeoVerse" }]));
      // Shared progress bar: dragging moves every clip of the case; the button pauses the section.
      const play = el("button", { type: "button", class: "play", "aria-label": "Pause" });
      const bar = el("input", { type: "range", min: "0", max: "1000", value: "0", "aria-label": "Playback position" });
      play.addEventListener("click", (ev) => { ev.stopPropagation(); hold(area, !area.classList.contains("held")); });
      let dragging = false;
      bar.addEventListener("input", () => {
        dragging = true;
        const lead = vs[0];
        if (lead.duration) vs.forEach((v) => { if (v.readyState >= 1) v.currentTime = (bar.value / 1000) * lead.duration; });
      });
      bar.addEventListener("change", () => { dragging = false; });
      bar.addEventListener("click", (ev) => ev.stopPropagation());
      bars.push(() => {
        const lead = vs[0], off = area.classList.contains("held");
        play.classList.toggle("off", off); play.setAttribute("aria-label", off ? "Play" : "Pause");
        if (!dragging && lead.readyState >= 1 && lead.duration) bar.value = Math.round((lead.currentTime / lead.duration) * 1000);
        bar.style.setProperty("--p", `${(bar.value / 10).toFixed(1)}%`);
      });
      // The method names sit beside their rows rather than above them, to save height.
      return [el("div", { class: "cmp" },
        el("div", { class: "cmp-line" }, head("4LC-Video", true), el("div", { class: "row r3" }, box(ins[1], "Input"), stack, box(out, "Generated"))),
        el("div", { class: "cmp-line" }, head("NeoVerse"), el("div", { class: "row r3" }, box(ins[0], "Input"), box(nc, "4DGS render"), box(nv, "Generated"))),
        el("div", { class: "cmp-line" }, el("span"), el("div", { class: "cmp-both" }, both, el("div", { class: "ctl" }, play, bar)))), ""];  // centred under the rows
    }), (i) => picked.forEach((e, k) => pills.get(e).setAttribute("aria-pressed", String(k === i))));
    (function step() { bars.forEach((g) => g()); requestAnimationFrame(step); })();
  }
});

// BibTeX: one-click copy
document.querySelectorAll(".bib").forEach(box => {
  const btn = box.querySelector(".copy"), label = btn.querySelector("span");
  btn.addEventListener("click", async () => {
    const text = box.querySelector("code").textContent;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
    }
    btn.classList.add("done"); label.textContent = "Copied";
    clearTimeout(btn.timer);
    btn.timer = setTimeout(() => { btn.classList.remove("done"); label.textContent = "Copy"; }, 1600);
  });
});

// Motion: sections fade up once as they come into view; the condition-acquisition bars grow and
// the two factors count up; the 4LC mark's outlines drift apart as the first screen scrolls away.
if (!RM) {
  const rise = new IntersectionObserver((es) => {
    // Shown once in view, or once scrolled past (a fast scroll or a jump can skip the moment it enters).
    for (const e of es) if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("in"); rise.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("main section").forEach((s) => { s.classList.add("rise"); rise.observe(s); });

  const cost = document.querySelector(".cost");
  if (cost) {
    const nums = [...cost.querySelectorAll(".num")].map((n) => [n, parseFloat(n.textContent), (n.textContent.split(".")[1] || "").length]);
    cost.classList.add("pre");
    nums.forEach(([n, , d]) => { n.textContent = (0).toFixed(d); });
    const go = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting || e.boundingClientRect.top < 0)) return;
      go.disconnect();
      cost.classList.add("grow"); cost.classList.remove("pre");
      setTimeout(() => cost.classList.remove("grow"), 1400);
      const t0 = performance.now(), dur = 1200;
      (function count(t) {
        const k = Math.max(0, Math.min(1, (t - t0) / dur)), ease = 1 - Math.pow(1 - k, 3);
        nums.forEach(([n, to, d]) => { n.textContent = (to * ease).toFixed(d); });
        if (k < 1) requestAnimationFrame(count);
      })(t0);
    }, { threshold: 0.35 });
    go.observe(cost);
  }

  const hero = document.querySelector(".hero");
  let queued = false;
  const drift = () => { queued = false; hero.style.setProperty("--p", Math.min(1, Math.max(0, scrollY / (innerHeight * 0.7))).toFixed(3)); };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(drift); } }, { passive: true });
  drift();
}

// Side rail: the parts are the nodes (large titles, grey until reached); their sections are
// listed underneath in small type. The line fills down to the current part.
(() => {
  const rail = document.querySelector(".rail");
  if (!rail) return;
  const fill = el("span", { class: "fill" });
  // Hidden sections (unfinished parts switched off in index.html) are left out of the rail.
  const parts = [...document.querySelectorAll("main > .part, main > section[data-nav]:not([hidden])")].map(node => {
    const secs = node.matches("section") ? [] : [...node.querySelectorAll(":scope > section[data-nav]:not([hidden])")];
    const first = secs[0] || node;
    const head = el("a", { class: "part-name", href: `#${first.id}` }, node.dataset.part || node.dataset.nav);
    const subs = secs.map(sec => ({ sec, a: el("a", { href: `#${sec.id}` }, sec.dataset.nav) }));
    const li = el("li", {}, head, ...(subs.length ? [el("div", { class: "subs" }, el("ul", {}, ...subs.map(x => el("li", {}, x.a))))] : []));
    return { node, head, subs, li };
  });
  const ol = el("ol", {}, fill, ...parts.map(p => p.li));
  // Back to the top of the page, sitting on the line's axis above the first part.
  const up = el("a", { class: "top", href: "#", "aria-label": "Back to top", title: "Back to top" });
  up.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5h12M12 19V9m-5 5 5-5 5 5"/></svg>';
  up.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0 }); history.replaceState(null, "", location.pathname + location.search); });
  rail.append(up, ol);
  const mid = a => a.getBoundingClientRect().top + a.offsetHeight / 2 - ol.getBoundingClientRect().top;

  let ticking = false;
  const update = () => {
    ticking = false;
    const line = innerHeight * 0.4, end = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    let cur = -1;
    parts.forEach((p, i) => { if (p.node.getBoundingClientRect().top <= line) cur = i; });
    if (end) cur = parts.length - 1;
    if (cur !== last) { last = cur; follow(); }
    rail.classList.toggle("shown", cur >= 0);
    parts.forEach((p, i) => {
      p.li.classList.toggle("on", i === cur); p.li.classList.toggle("done", i < cur);
      let sub = -1;
      if (i === cur) p.subs.forEach((x, j) => { if (x.sec.getBoundingClientRect().top <= line) sub = j; });
      if (i === cur && end) sub = p.subs.length - 1;
      p.subs.forEach((x, j) => x.a.classList.toggle("on", j === Math.max(sub, 0) && i === cur));
    });
    place();
  };
  // Keep the line on the nodes while a part opens or closes.
  let last = -2, until = 0;
  const place = () => {
    const top = mid(parts[0].head);
    ol.style.setProperty("--top", `${top}px`);
    ol.style.setProperty("--span", `${mid(parts.at(-1).head) - top}px`);
    ol.style.setProperty("--fill", `${last >= 0 ? mid(parts[last].head) - top : 0}px`);
  };
  const follow = () => {
    const run = !until; until = performance.now() + 600;
    if (run) requestAnimationFrame(function step(t) { place(); if (t < until) requestAnimationFrame(step); else until = 0; });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
})();
