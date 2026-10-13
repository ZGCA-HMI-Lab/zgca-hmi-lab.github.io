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

// Videos load and play only while on screen, unless their area was paused by a click.
const seen = new IntersectionObserver((entries) => {
  for (const { target: v, isIntersecting } of entries) {
    v.vis = isIntersecting;
    if (isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; if (!v.held) v.play().catch(() => {}); }
    else v.pause();
  }
}, { rootMargin: "300px" });
// Pause or resume every video in an area at once.
const hold = (box, on) => {
  box.classList.toggle("held", on);
  for (const v of box.querySelectorAll("video")) {
    v.held = on;
    if (on) v.pause(); else if (v.vis && v.src) v.play().catch(() => {});
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

const cell = (media, label) => el("div", { class: "cell" }, media, label && el("span", { class: "tag", text: label }));
const row = (cells) => el("div", { class: `row r${cells.length}` }, ...cells);

// One example block per slide. Neighbouring blocks peek in at the sides so it is clear
// there is more; arrows, dots, keys and swipe all move between them.
function carousel(box, items) {
  if (!items.length) return;  // a part with no cases (switched off) stays empty
  const slides = items.map(([node]) => el("div", { class: "slide" }, node));
  const track = el("div", { class: "track", tabindex: "0", "aria-roledescription": "carousel" }, ...slides);
  const arrow = (dir) => el("button", { type: "button", class: `arrow ${dir}`, "aria-label": dir === "prev" ? "Previous example" : "Next example" },
    el("span", { "aria-hidden": "true", text: dir === "prev" ? "←" : "→" }));
  const prev = arrow("prev"), next = arrow("next");
  const dots = items.map(([, name], i) => el("button", { type: "button", "aria-label": name || `Example ${i + 1}` }));
  const name = el("span", { class: "name" }), count = el("span", { class: "count" });
  let index = 0, shown = 0, settle;
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
  };
  const go = (i, behavior = "smooth") => {
    index = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: offset(index), behavior });
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
  // After a swipe settles, follow whichever block is nearest the centre.
  track.addEventListener("scroll", () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const c = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      slides.forEach((sl, k) => { if (Math.abs(sl.offsetLeft + sl.clientWidth / 2 - c) < Math.abs(slides[best].offsetLeft + slides[best].clientWidth / 2 - c)) best = k; });
      if (best !== index) { index = best; update(); }
    }, 120);
  }, { passive: true });
  window.addEventListener("resize", () => go(index, "instant"));
  const many = slides.length > 1;
  box.classList.toggle("single", !many);
  box.append(el("div", { class: "stage" }, track, many && prev, many && next),
    el("div", { class: "under" }, name, many && el("div", { class: "dots" }, ...dots), many && count));
  requestAnimationFrame(() => go(0, "instant"));
}

// Readout wipe: the chosen representation's readout on the left, the generated video on the right.
// Every representation is loaded and kept in step, so switching only changes which one is visible.
let reps = [], rep = "rgb";
const wipes = [];
const wipe = (c) => {
  const box = el("div", { class: "wipe" });
  const under = video(c.media["output.mp4"], c.poster);
  const layers = Object.fromEntries(reps.map((r) => [r.key, video(c.media[r.file])]));
  const range = el("input", { type: "range", min: "0", max: "100", value: "33", "aria-label": "Compare cache readout and generated video" });
  const set = (x) => { range.value = x; box.style.setProperty("--x", x + "%"); };
  range.addEventListener("input", () => set(+range.value));  // keyboard
  // The divider moves only when it is dragged; a plain click pauses or resumes the whole readout.
  let drag = null;
  const at = (e) => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 100, e.clientX - r.left - r.width * range.value / 100]; };
  const near = (e) => Math.abs(at(e)[1]) < 24;
  box.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, grab: near(e), moved: false }; box.setPointerCapture(e.pointerId); });
  box.addEventListener("pointermove", (e) => {
    if (!drag) { box.classList.toggle("near", near(e)); return; }
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
    if (drag.grab && drag.moved) set(Math.round(Math.max(0, Math.min(100, at(e)[0]))));
  });
  box.addEventListener("pointerup", () => {
    if (drag && !drag.moved) { const ro = box.parentElement; hold(ro, !ro.classList.contains("held")); }
    drag = null;
  });
  box.addEventListener("pointercancel", () => { drag = null; });
  box.addEventListener("pointerleave", () => box.classList.remove("near"));
  const label = el("span", { class: "tag" });
  box.append(under, el("div", { class: "wipe-over" }, ...Object.values(layers)), el("span", { class: "grip", "aria-hidden": "true" }), range,
    label, el("span", { class: "tag right", text: "Generated" }));
  sync([under, ...Object.values(layers)]);
  const show = () => {
    for (const [k, v] of Object.entries(layers)) v.classList.toggle("on", k === rep);
    const r = reps.find((x) => x.key === rep);
    label.textContent = `${r.label} readout`;
  };
  wipes.push(show); show();
  return box;
};
// Representation buttons; `on` gets the chosen key. Each section keeps its own choice.
const repTabs = (list, on) => {
  let cur = list[0].key;
  const buttons = list.map((r) => {
    const b = el("button", { type: "button", text: r.label });
    b.addEventListener("click", () => { cur = r.key; update(); });
    return [r.key, b];
  });
  const update = () => {
    for (const [k, b] of buttons) b.setAttribute("aria-pressed", String(k === cur));
    on(cur);
  };
  update();
  return el("div", { class: "reps" }, el("div", { class: "rep-tabs", role: "group", "aria-label": "Representation" }, ...buttons.map(([, b]) => b)));
};

const still = (e) => el("img", { class: "still", src: bust(e.media["input.jpg"]), alt: e.title, loading: "lazy" });

fetch("content.json", { cache: "no-cache" }).then((r) => r.json()).then((c) => {
  const by = Object.fromEntries(["camera", "time", "multiview", "image", "edit"].flatMap((k) => c[k].map((e) => [e.id, e])));
  const cmp = Object.fromEntries(c.compare.map((e) => [e.id, e]));
  const f = c.featured, $ = (id) => document.getElementById(id);
  rate = (c.playback && c.playback.rate) || 1;
  ver = c.version || "";

  const t = $("teaser");
  if (!t.hidden) { t.muted = true; t.poster = bust(c.teaser.poster); t.dataset.src = bust(c.teaser.video); seen.observe(t); }

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

  // Camera, time, image-to-video and image-to-world slides are composed videos from tools/montage.py.
  // Per-section speed overrides (e.g. the longer image-to-world rollouts play faster).
  const montage = (sec) => carousel($(sec), c.montage[sec].map((m) => {
    const v = video(m.video, m.poster, (c.playback && c.playback[sec]) || rate);
    v.classList.add("montage");
    v.style.aspectRatio = `${m.size[0]} / ${m.size[1]}`;
    return [v, ""];
  }));
  // Camera, time and image-to-video: pages of four, 2 x 2 like the readout grid. Each card is the
  // result at close to its native size, with the input in a small window at the lower left.
  const cards = (sec) => carousel($(sec), c.montage[sec].map((m) => {
    const speed = (c.playback && c.playback[sec]) || rate;
    return [el("div", { class: "quad" }, ...m.pairs.map((p) => {
      const out = video(p.b, by[p.case] && by[p.case].poster, speed);
      const still = p.a.endsWith(".jpg");
      const inp = still ? el("img", { src: bust(p.a), alt: "", loading: "lazy" }) : video(p.a, undefined, speed);
      if (!still) sync([out, inp]);
      const card = el("div", { class: "card" }, out, p.lb && p.lb !== "Generated" && el("span", { class: "tag", text: p.lb }),
        el("div", { class: "pip" }, inp, el("span", { class: "tag", text: still ? "Input image" : "Input" })));
      // Editing: the instruction is shown under the result.
      return p.edit ? el("figure", { class: "edited" }, card, el("figcaption", {}, p.edit)) : card;
    })), ""];
  }));
  cards("camera");
  cards("time");

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
    }), el("div", { class: "center" }, inp, el("span", { class: "tag", text: `Input · ${e.group}` }))), ""];
  }));

  cards("i2v");
  montage("i2w");
  cards("edit");

  // Sources & Credits: one table per shown section, cases in page order ("2.3" = page 2, card 3).
  const link = (text, href) => href ? el("a", { href, text, target: "_blank", rel: "noopener noreferrer" }) : document.createTextNode(text || "—");
  const groups = {};
  for (const r of c.credits || []) (groups[r.section] ||= []).push(r);
  $("credit-list").append(...Object.entries(groups).filter(([sec]) => $(sec) && !$(sec).hidden).map(([sec, rows]) => {
    // Source: platform and item id, linked to the original page.
    const short = (s) => `${s.platform} · ${s.url.replace(/\/$/, "").split("/").pop().replace(/^.*-(\d+)$/, "$1")}`;
    const head = el("tr", {}, ...["#", "Case", "Source"].map((t) => el("th", { text: t })));
    const body = rows.flatMap((r) => r.inputs.map((s, k) => el("tr", {},
      el("td", { text: k ? "" : r.where }), el("td", { text: k ? "" : r.case }), el("td", {}, link(short(s), s.url)))));
    return el("div", { class: "credit-group" }, el("h3", { text: $(sec).dataset.nav }),
      el("div", { class: "credit-scroll" }, el("table", {}, el("thead", {}, head), el("tbody", {}, ...body))));
  }));

  // Parts switched off in index.html are not built, so their media are never requested.
  // NeoVerse comparison: one case per page. Top row 4LC (input | Cache readout, switchable | result),
  // bottom row NeoVerse (input | 4DGS-rendered condition | result); times are seconds per 81-frame request.
  const cs = $("s-compare");
  if (!cs.hidden) {
    const picked = f.compare.map((id) => cmp[id]);
    // Every representation any case has; a case still missing one keeps showing its RGB readout (tag says so).
    const list = (c.readout_reps || []).filter((r) => picked.some((e) => e.reps.some((x) => x.key === r.key)));
    const shows = [];
    let pick = list.length ? list[0].key : "";
    if (list.length > 1) $("compare").before(repTabs(list, (k) => { pick = k; shows.forEach((g) => g()); }));
    const box = (v, tag) => el("div", {}, cell(v, tag));
    carousel($("compare"), picked.map((e) => {
      const m = e.media;
      const ins = [video(m["input.mp4"], e.poster), video(m["input.mp4"], e.poster)];
      const nc = video(m["neoverse-condition.mp4"]), nv = video(m["neoverse.mp4"]), out = video(m["ours.mp4"]);
      const layers = Object.fromEntries(e.reps.map((r) => [r.key, video(r.file)]));
      const tag = el("span", { class: "tag" });
      const stack = el("div", { class: "cell stack" }, ...Object.values(layers), tag);
      const show = () => {
        const k = layers[pick] ? pick : e.reps[0].key;
        for (const [r, v] of Object.entries(layers)) v.classList.toggle("on", r === k);
        tag.textContent = `${e.reps.find((r) => r.key === k).label} readout`;
      };
      shows.push(show); show();
      sync([ins[0], nc, nv, ins[1], ...Object.values(layers), out]);
      const head = (t, ours) => el("h3", { class: ours ? "cmp-head ours" : "cmp-head", text: t });
      return [el("div", { class: "cmp" },
        head("4LC-Video", true),
        el("div", { class: "row r3" }, box(ins[1], "Input"), stack, box(out, "Generated")),
        head("NeoVerse"),
        el("div", { class: "row r3" }, box(ins[0], "Input"), box(nc, "4DGS render"), box(nv, "Generated"))), ""];
    }));
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

// Scroll cue: only while the TL;DR is still below the fold at the top of the page.
(() => {
  const more = document.querySelector(".more"), tldr = document.querySelector(".tldr");
  if (!more || !tldr) return;
  const check = () => more.classList.toggle("gone", scrollY > 40 || tldr.getBoundingClientRect().top < innerHeight - 16);
  addEventListener("scroll", check, { passive: true }); addEventListener("resize", check); check();
})();
