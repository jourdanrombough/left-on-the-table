"use strict";
/* Traffic Gap Scanner · insights layer (v2)
   Thirteen extra charts plus a written read-out for every chart in the report.
   Loads after app.js and wraps showResults(), so the scan engine is untouched.
   Uses globals from app.js: SCAN, R, scenarios, ctr, CTR, PACK, fmt, short, money, esc, fav, $ */
(() => {
  const P = { green: "#3ee98a", lime: "#b6ff3b", cyan: "#2fd0ff", blue: "#4d7cff", violet: "#9b8cff", purple: "#c56bff", pink: "#ff4fa8", red: "#ff5d6c", orange: "#ff8a3d", gold: "#ffc13b", yellow: "#ffe14d", teal: "#2dd4bf", slate: "#6b7099" };
  const ST = { top: P.green, page1: P.cyan, close: P.gold, far: P.violet, none: P.pink };
  const STN = { top: "Top 3", page1: "Page one (#4 to #10)", close: "Page two (#11 to #20)", far: "Ranked #21+", none: "Not ranking" };
  const ORDER = ["top", "page1", "close", "far", "none"];
  const RAINBOW = [P.cyan, P.pink, P.gold, P.lime, P.purple, P.orange, P.teal, P.blue, P.yellow, P.violet, P.green, P.red];
  const SITEC = [P.pink, P.cyan, P.orange, P.purple, P.yellow, P.teal];
  const MONO = "JetBrains Mono, ui-monospace, Menlo, monospace", SANS = "Instrument Sans, Helvetica Neue, Arial, sans-serif";

  /* ---------- small helpers ---------- */
  const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
  const pc = x => { const v = 100 * (x || 0); if (v <= 0) return "0%"; if (v < 0.1) return "<0.1%"; if (v < 10) return v.toFixed(1).replace(/\.0$/, "") + "%"; return Math.round(v) + "%"; };
  const cut = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s; };
  const B = (s, c) => `<b${c ? ` style="color:${c}"` : ""}>${s}</b>`;
  const q = s => "“" + esc(s) + "”";
  const and = a => a.length <= 1 ? (a[0] || "") : a.length === 2 ? a[0] + " and " + a[1] : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const times = r => !isFinite(r) || r < 1.15 ? null : r >= 10 ? Math.round(r) + "×" : r.toFixed(1).replace(/\.0$/, "") + "×";
  const plural = (n, a, b) => fmt(n) + " " + (Math.round(n) === 1 ? a : (b || a + "s"));
  const byId = id => document.getElementById(id);

  /* ---------- tooltip ---------- */
  let tipT;
  function tipOn(e, html) {
    const T = $("#tip"); T.innerHTML = html; T.style.display = "block";
    T.style.left = Math.max(8, Math.min(innerWidth - T.offsetWidth - 8, e.clientX + 16)) + "px";
    T.style.top = Math.max(8, Math.min(innerHeight - T.offsetHeight - 8, e.clientY + 16)) + "px";
    clearTimeout(tipT); if (e.pointerType === "touch") tipT = setTimeout(tipOff, 2800);
  }
  function tipOff() { $("#tip").style.display = "none"; }
  const tr = (l, v, c) => `<div class="r"><span>${l}</span><span${c ? ` style="color:${c}"` : ""}>${v}</span></div>`;
  function tip(sel, html) { sel.on("pointermove", (e, d) => tipOn(e, html(d))).on("pointerdown", (e, d) => tipOn(e, html(d))).on("pointerleave", tipOff); return sel; }

  /* ---------- svg helpers ---------- */
  function svgIn(id, H, Wfix) {
    const box = byId(id); box.innerHTML = "";
    const W = Wfix || Math.max(280, box.clientWidth || 600);
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", Wfix ? W : "100%").attr("height", H).style("display", "block").style("overflow", "visible").style("max-width", Wfix ? "none" : "100%");
    return { svg, W, H, box };
  }
  const T = (g, x, y, s, o = {}) => g.append("text").attr("x", x).attr("y", y).attr("fill", o.c || "#b3b7e0").attr("font-size", o.fs || 11).attr("font-family", o.ff || MONO).attr("font-weight", o.fw || 500).attr("text-anchor", o.a || "start").text(s);
  function grad(svg, id, stops, vertical) {
    let defs = svg.select("defs"); if (defs.empty()) defs = svg.insert("defs", ":first-child");
    const g = defs.append("linearGradient").attr("id", id);
    if (vertical) g.attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
    stops.forEach((s, i) => { const a = Array.isArray(s); g.append("stop").attr("offset", (100 * i / (stops.length - 1)) + "%").attr("stop-color", a ? s[0] : s).attr("stop-opacity", a && s[1] != null ? s[1] : 1); });
    return `url(#${id})`;
  }
  const glow = c => `drop-shadow(0 0 6px ${c}aa)`;

  /* ---------- the written read-outs ---------- */
  function story(id, o) {
    const el = byId(id); if (!el) return;
    if (!o) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="story ${o.cls || ""}" style="--a:${o.c || P.cyan}"><div class="st-k">${o.k || "What this chart is saying"}</div>${o.read ? `<p class="st-read"><b>How to read it.</b> ${o.read}</p>` : ""}${(o.say || []).filter(Boolean).map(p => `<p>${p}</p>`).join("")}${o.move ? `<div class="st-move"><b>${o.mk || "The move"}</b><span>${o.move}</span></div>` : ""}</div>`;
  }

  /* ---------- derived numbers shared by charts and stories ---------- */
  let D = null;
  function derive() {
    const S = SCAN, Rr = R, it = Rr.items, n = it.length;
    const SC = scenarios(Rr), ex = SC.exp;
    const comps = Rr.comps, topics = Rr.topics;
    const topicComp = (c, t) => { let cl = 0; t.idx.forEach(i => { const p = c.pos[i], k = c.pack && c.pack[i], x = it[i]; if (!x) return; if (p) cl += x.v * ctr(p) * x.f; if (k) cl += x.v * PACK[k - 1]; }); return cl; };
    const youLead = t => t.yours > 0 && t.yours >= (t.lead ? t.lead.clicks : 0);
    const led = { you: topics.filter(youLead).length };
    comps.forEach(c => led[c.d] = topics.filter(t => t.lead && t.lead.d === c.d && !youLead(t)).length);
    const kw10 = it.filter(x => x.p && x.p <= 10).length;
    const strike = it.filter(x => x.p > 3 && x.p <= 20).sort((a, b) => b.pot - a.pot);
    const untapped = it.filter(x => !x.p || x.p > 20);
    const hasVal = Rr.market.value > 0;
    const full = Math.max(Rr.you.clicks + Rr.table.clicks, Rr.you.clicks + ex.gain);
    const dv = it.filter(x => x.d != null && x.v > 0), medV = d3.median(dv, x => x.v) || 0;
    const quad = x => x.d == null || !(x.v > 0) ? null : x.d < 30 ? (x.v >= medV ? "qw" : "lt") : (x.v >= medV ? "bb" : "hl");
    const bp = Rr.basis.local && Rr.market.clicks ? Math.max(.05, Rr.basis.clicks / Rr.market.clicks) : 1;
    return { S, Rr, it, n, SC, ex, comps, topics, topicComp, led, kw10, strike, untapped, hasVal, full, dv, medV, quad, bp, lead: comps[0], dom: B(esc(S.domain), P.green), where: esc(S.location.city || S.location.region || S.location.label) };
  }

  /* =====================================================================
     1. Market vital signs: ring gauges
     ===================================================================== */
  function drawGauges() {
    const box = byId("vzGauges"); box.innerHTML = "";
    const { Rr, n, kw10, lead, hasVal, it } = D, loc = Rr.basis.local;
    const gs = [
      { l: "Share of clicks", v: Rr.you.share, lv: lead ? lead.share : null, a: P.green, b: P.lime, s: "of the organic clicks measured" },
      { l: "Page-one coverage", v: n ? kw10 / n : 0, lv: lead && n && !loc ? lead.kw10 / n : null, a: P.cyan, b: P.blue, s: `${fmt(kw10)} of ${fmt(n)} searches` },
      { l: "Top-3 coverage", v: n ? Rr.you.kw3 / n : 0, lv: lead && n && !loc ? lead.kw3 / n : null, a: P.gold, b: P.orange, s: `${fmt(Rr.you.kw3)} searches in the top 3` },
      hasVal ? { l: "Click value captured", v: Rr.you.value / Rr.market.value, lv: lead && Rr.basis.value ? lead.value / Rr.basis.value : null, a: P.pink, b: P.purple, s: `${money(Rr.you.value)} of ${money(Rr.market.value)} a month` }
        : { l: "Searches you rank for", v: n ? it.filter(x => x.p).length / n : 0, lv: lead && n && !loc ? Object.keys(lead.pos).length / n : null, a: P.pink, b: P.purple, s: "anywhere in the top 100" },
    ];
    gs.forEach((g, j) => {
      const d = document.createElement("div"); d.className = "gauge"; box.appendChild(d);
      const S = 180, r = 74, w = 15;
      const svg = d3.select(d).append("svg").attr("viewBox", `0 0 ${S} ${S - 26}`);
      const fill = grad(svg, "gg" + j, [g.a, g.b]);
      const c = svg.append("g").attr("transform", `translate(${S / 2},${S / 2 + 2})`);
      const a0 = -0.75 * Math.PI, a1 = 0.75 * Math.PI, sc = d3.scaleLinear().domain([0, 1]).range([a0, a1]).clamp(true);
      const arc = d3.arc().innerRadius(r - w).outerRadius(r).cornerRadius(w / 2);
      c.append("path").attr("d", arc({ startAngle: a0, endAngle: a1 })).attr("fill", "#1b1e44");
      [0, .25, .5, .75, 1].forEach(t => { const an = sc(t); c.append("line").attr("x1", Math.sin(an) * (r + 4)).attr("y1", -Math.cos(an) * (r + 4)).attr("x2", Math.sin(an) * (r + 8)).attr("y2", -Math.cos(an) * (r + 8)).attr("stroke", "#3b3f73").attr("stroke-width", 1.5); });
      c.append("path").attr("fill", fill).style("filter", glow(g.a))
        .transition().duration(1500).delay(j * 160).ease(d3.easeCubicOut)
        .attrTween("d", () => { const i = d3.interpolate(a0, sc(Math.max(g.v, 0.006))); return t => arc({ startAngle: a0, endAngle: i(t) }); });
      if (g.lv != null && g.lv > 0) {
        const an = sc(g.lv);
        c.append("line").attr("x1", Math.sin(an) * (r - w - 4)).attr("y1", -Math.cos(an) * (r - w - 4)).attr("x2", Math.sin(an) * (r + 5)).attr("y2", -Math.cos(an) * (r + 5)).attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linecap", "round").attr("opacity", 0).transition().delay(1300 + j * 160).attr("opacity", .95);
        tip(c.append("circle").attr("cx", Math.sin(an) * (r - w / 2)).attr("cy", -Math.cos(an) * (r - w / 2)).attr("r", 12).attr("fill", "transparent").style("cursor", "help"), () => `<b>${esc(lead.d)}</b>${tr("Market leader on this measure", pc(g.lv), P.pink)}${tr("You", pc(g.v), g.a)}`);
      }
      const big = T(c, 0, 4, pc(g.v), { c: g.a, fs: 30, ff: SANS, fw: 800, a: "middle" }).attr("opacity", 0);
      big.transition().delay(400 + j * 160).duration(600).attr("opacity", 1);
      T(c, 0, 24, g.lv != null && g.lv > 0 ? "leader " + pc(g.lv) : "", { c: "#9ea3d4", fs: 10, a: "middle" });
      d.insertAdjacentHTML("beforeend", `<div class="g-l" style="color:${g.a}">${g.l}</div><div class="g-s">${g.s}</div>`);
    });
  }
  function storyGauges() {
    const { Rr, n, kw10, lead, hasVal } = D, sh = Rr.you.share, k3 = Rr.you.kw3;
    const tier = Rr.you.clicks < 1 ? ["not on the board yet", "Every click in this market is currently going to someone else."]
      : sh < .01 ? ["barely on the board", `Out of every 100 organic clicks people make here, you get less than one.`]
        : sh < .05 ? ["a small player", `Out of every 100 organic clicks, about ${Math.max(1, Math.round(sh * 100))} land on your site.`]
          : sh < .15 ? ["a real contender", `About ${Math.round(sh * 100)} of every 100 organic clicks land on your site.`]
            : ["one of the leaders", `About ${Math.round(sh * 100)} of every 100 organic clicks land on your site, which puts you near the top of this market.`];
    const lr = lead && sh > 0 ? times(lead.share / sh) : null;
    const weakest = !n || kw10 / n < .12 ? "page" : k3 / Math.max(1, kw10) < .35 ? "top3" : "share";
    return {
      c: P.lime, k: "Reading the dials",
      read: `Each dial runs from 0% on the left to 100% on the right. The colored arc is you. The white tick, where it shows, is the market leader${lead ? ` (${esc(lead.d)})` : ""} on the same measure, so the gap between your arc and that tick is the distance between you and the site everyone else is chasing.`,
      say: [
        `On share of clicks, ${D.dom} is ${B(tier[0], P.lime)}. ${tier[1]} ${lead ? `${B(esc(lead.d), P.pink)} takes ${pc(lead.share)}${lr ? `, which is ${lr} your share` : ""}.` : ""}`,
        `Coverage tells you why. You're on page one for ${B(fmt(kw10), P.cyan)} of the ${fmt(n)} searches in this market (${pc(n ? kw10 / n : 0)}), and in the top 3 for ${B(fmt(k3), P.gold)} of them. That second number matters most: on a typical results page the top three spots collect about two thirds of every click page one gets, while positions 4 to 10 split the rest.`,
        hasVal ? `In money terms, the traffic you capture would cost ${B(money(Rr.you.value), P.pink)} a month to buy as Google Ads, out of ${money(Rr.market.value)} the whole market is worth. That's the clearest way to explain the stakes to anyone who doesn't live in SEO.` : null,
      ],
      move: weakest === "page" ? `Get onto page one for more of this market. You're there for only ${pc(n ? kw10 / n : 0)} of these searches, and a page outside the top 10 earns almost nothing. The opportunity map below shows which searches to target first.` : weakest === "top3" ? `You're on page one plenty, but rarely in the top 3. Pages sitting at #4 to #10 are the cheapest upgrade in this report: improve the ones already ranking before writing anything new.` : "Your coverage is healthy. Defend your top-3 positions and widen into the topics where the leader is weakest (see the heatmap in the competitor section).",
    };
  }

  /* =====================================================================
     2. Concentration curve (Lorenz)
     ===================================================================== */
  function lorenzData() {
    const xs = D.it.slice().sort((a, b) => b.mk - a.mk), Tm = sum(xs, x => x.mk) || 1, Y = sum(xs, x => x.now);
    let c = 0, cy = 0; const pts = [{ x: 0, m: 0, y: 0, i: 0 }];
    xs.forEach((x, i) => { c += x.mk; cy += x.now; pts.push({ x: (i + 1) / xs.length, m: c / Tm, y: Y ? cy / Y : 0, k: x.k, i: i + 1, mk: x.mk }); });
    const at = (key, lvl) => pts.find(p => p[key] >= lvl) || pts[pts.length - 1];
    return { xs, pts, Y, Tm, p50: at("m", .5), p80: at("m", .8), y50: Y ? at("y", .5) : null, top10: pts[Math.min(10, pts.length - 1)] };
  }
  function drawLorenz() {
    const L = lorenzData(), { pts, Y } = L;
    const { svg, W, H } = svgIn("vzLorenz", 330), m = { l: 46, r: 18, t: 16, b: 40 };
    const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    [0, .25, .5, .75, 1].forEach(t => {
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044");
      T(svg, m.l - 8, y(t) + 4, Math.round(t * 100) + "%", { c: "#6a70a8", fs: 10, a: "end" });
      T(svg, x(t), H - m.b + 16, Math.round(t * 100) + "%", { c: "#6a70a8", fs: 10, a: "middle" });
    });
    T(svg, (m.l + W - m.r) / 2, H - 4, "share of searches, biggest first →", { c: "#7a7fae", fs: 10.5, a: "middle" });
    T(svg, m.l + 6, m.t + 12, "↑ share of clicks", { c: "#7a7fae", fs: 10.5 });
    svg.append("line").attr("x1", x(0)).attr("y1", y(0)).attr("x2", x(1)).attr("y2", y(1)).attr("stroke", "#4a4f8a").attr("stroke-dasharray", "4 5");
    T(svg, x(.62), y(.55), "if every search were equal", { c: "#5d6296", fs: 10 }).attr("transform", `rotate(${-Math.atan2(y(0) - y(1), x(1) - x(0)) * 180 / Math.PI},${x(.62)},${y(.55)})`);
    const fillG = grad(svg, "lzf", [[P.pink, .38], [P.gold, .04]], true), lineG = grad(svg, "lzl", [P.pink, P.gold, P.lime]);
    const area = d3.area().x(d => x(d.x)).y0(y(0)).y1(d => y(d.m)).curve(d3.curveMonotoneX);
    const line = d3.line().x(d => x(d.x)).y(d => y(d.m)).curve(d3.curveMonotoneX);
    svg.append("path").attr("d", area(pts)).attr("fill", fillG).attr("opacity", 0).transition().duration(1200).delay(400).attr("opacity", 1);
    const mp = svg.append("path").attr("d", line(pts)).attr("fill", "none").attr("stroke", lineG).attr("stroke-width", 3.5).attr("stroke-linecap", "round").style("filter", glow(P.pink));
    const len = mp.node().getTotalLength(); mp.attr("stroke-dasharray", len).attr("stroke-dashoffset", len).transition().duration(1700).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
    if (Y > 0) {
      const yl = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveStepAfter);
      const yp = svg.append("path").attr("d", yl(pts)).attr("fill", "none").attr("stroke", P.green).attr("stroke-width", 2.2).attr("stroke-dasharray", "1 0");
      const l2 = yp.node().getTotalLength(); yp.attr("stroke-dasharray", l2).attr("stroke-dashoffset", l2).transition().delay(700).duration(1700).attr("stroke-dashoffset", 0);
    }
    const p = L.p80, gg = svg.append("g").attr("opacity", 0);
    gg.append("line").attr("x1", x(p.x)).attr("x2", x(p.x)).attr("y1", y(0)).attr("y2", y(p.m)).attr("stroke", P.gold).attr("stroke-dasharray", "3 3");
    gg.append("line").attr("x1", m.l).attr("x2", x(p.x)).attr("y1", y(p.m)).attr("y2", y(p.m)).attr("stroke", P.gold).attr("stroke-dasharray", "3 3");
    gg.append("circle").attr("cx", x(p.x)).attr("cy", y(p.m)).attr("r", 6).attr("fill", P.gold).attr("stroke", "#0a0b19").attr("stroke-width", 2);
    const right = p.x > .55;
    T(gg, x(p.x) + (right ? -10 : 10), y(p.m) + 22, `${pc(p.x)} of searches = 80% of clicks`, { c: P.gold, fs: 11.5, fw: 700, a: right ? "end" : "start" });
    gg.transition().delay(1500).duration(500).attr("opacity", 1);
    const lg = svg.append("g").attr("transform", `translate(${W - m.r - 150},${y(.2)})`);
    lg.append("rect").attr("width", 14).attr("height", 3).attr("y", -4).attr("fill", P.pink); T(lg, 20, 0, "whole market", { c: "#c9cdf5", fs: 10.5 });
    if (Y > 0) { lg.append("rect").attr("width", 14).attr("height", 3).attr("y", 12).attr("fill", P.green); T(lg, 20, 16, "your clicks", { c: "#c9cdf5", fs: 10.5 }); }
    const hv = svg.append("g").style("display", "none");
    hv.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#8b90c8").attr("stroke-dasharray", "2 3");
    hv.append("circle").attr("r", 5).attr("fill", P.pink).attr("stroke", "#fff").attr("stroke-width", 1.5);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent")
      .on("pointermove pointerdown", e => {
        const [mx] = d3.pointer(e, svg.node()); const fx = Math.max(0, Math.min(1, x.invert(mx)));
        const d = pts[Math.max(1, Math.min(pts.length - 1, Math.round(fx * (pts.length - 1))))];
        hv.style("display", null); hv.select("line").attr("x1", x(d.x)).attr("x2", x(d.x)); hv.select("circle").attr("cx", x(d.x)).attr("cy", y(d.m));
        tipOn(e, `<b>The ${plural(d.i, "biggest search", "biggest searches")}</b>${tr("Share of searches", pc(d.x))}${tr("Share of market clicks", pc(d.m), P.pink)}${Y ? tr("Share of your clicks", pc(d.y), P.green) : ""}${tr("Search #" + d.i, esc(cut(d.k, 28)))}`);
      }).on("pointerleave", () => { hv.style("display", "none"); tipOff(); });
  }
  function storyLorenz() {
    const L = lorenzData(), { p50, p80, y50, top10, xs } = L, n = xs.length;
    const shape = p80.x < .15 ? ["top-heavy", P.pink, `a small set of head searches decides who wins here`] : p80.x < .35 ? ["moderately concentrated", P.gold, `the big searches matter most, but there's real traffic spread underneath them`] : ["spread out", P.lime, `no single search decides it; traffic is scattered across a long tail of specific queries`];
    const heads = xs.filter(x => !(x.p && x.p <= 3)).slice(0, 3).map(x => q(x.k));
    let you = null;
    if (!L.Y) you = `There's no green line on this one because ${D.dom} doesn't earn clicks from this market yet. When it does, that line shows whether your traffic comes from the big searches or the small ones.`;
    else if (y50) {
      const r = y50.x / Math.max(p50.x, 1e-6);
      you = r > 2 ? `The green line is your traffic. It climbs much more slowly than the pink one: half of your clicks come only after you include the top ${B(pc(y50.x), P.green)} of searches, while half the market's clicks sit in the top ${pc(p50.x)}. In plain terms, ${D.dom} lives off the long tail while the big money searches go to competitors.`
        : r < .6 ? `The green line is your traffic, and it rises faster than the market's. Half of your clicks come from the top ${B(pc(y50.x), P.green)} of searches, so you're already winning some of the big head terms. That's a strong position to expand from.`
          : `The green line is your traffic, and it tracks the market fairly closely: half of your clicks come from the top ${B(pc(y50.x), P.green)} of searches, versus ${pc(p50.x)} for the market. Your traffic is spread the same way the demand is.`;
    }
    return {
      c: P.pink,
      read: `Every search is lined up from biggest to smallest along the bottom. The pink curve adds up their clicks as you go. If all searches were the same size, the curve would follow the dashed diagonal. The more it bulges toward the top left, the more the market is controlled by a few big searches. Hover anywhere on the curve to see exactly how much the biggest searches are worth.`,
      say: [
        `This market is ${B(shape[0], shape[1])}: just ${B(pc(p80.x), P.gold)} of the ${fmt(n)} searches (${plural(Math.round(p80.x * n), "search", "searches")}) account for 80% of all the clicks, and the ten biggest alone hold ${B(pc(top10.m), P.pink)}. In other words, ${shape[2]}.`,
        you,
        heads.length ? `The biggest searches where you're not yet in the top 3 are ${and(heads)}. Those are the head terms that move this curve.` : null,
      ],
      move: p80.x < .2 ? `Build one genuinely best-in-class page for each of the top head terms before spreading effort across hundreds of small ones. In a top-heavy market a single #1 ranking can outweigh a hundred long-tail wins.` : `Win with breadth. Plan a cluster of focused pages that each answer a specific question, then link them together so the whole group ranks. That's how sites take a spread-out market.`,
    };
  }

  /* =====================================================================
     3. Search intent sunburst
     ===================================================================== */
  const IN = { commercial: P.gold, informational: P.cyan, transactional: P.pink, navigational: P.violet, unclassified: P.slate };
  const INX = { commercial: "comparing options and providers", informational: "looking to learn or answer a question", transactional: "ready to buy, book or sign up", navigational: "looking for a specific site or brand", unclassified: "searches Google hasn't labeled" };
  function intentStats() {
    const by = {}, U = SCAN.universe; D.it.forEach(x => { const k = ((U[x.i] || {}).i) || "unclassified"; const o = by[k] || (by[k] = { k, mk: 0, now: 0, n: 0, st: {} }); o.mk += x.mk; o.now += x.now; o.n++; o.st[x.st] = (o.st[x.st] || 0) + x.mk; });
    return Object.values(by).sort((a, b) => b.mk - a.mk);
  }
  function drawSun() {
    const box = byId("vzSun"); box.innerHTML = "";
    const ins = intentStats(), tot = sum(ins, o => o.mk) || 1;
    const W = Math.max(280, box.clientWidth || 500), Sz = Math.min(W, 340), R0 = Sz / 2 - 4;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${Sz} ${Sz}`).attr("width", Sz).attr("height", Sz).style("display", "block").style("margin", "0 auto");
    const root = d3.hierarchy({ children: ins.map(o => ({ name: o.k, children: ORDER.filter(s => o.st[s] > 0).map(s => ({ name: s, v: o.st[s], intent: o.k })) })) }).sum(d => d.v || 0);
    d3.partition().size([2 * Math.PI, 1])(root);
    const g = svg.append("g").attr("transform", `translate(${Sz / 2},${Sz / 2})`);
    const arc = d3.arc().startAngle(d => d.a0).endAngle(d => d.a1).padAngle(.008).padRadius(R0 / 2)
      .innerRadius(d => d.depth === 1 ? R0 * .38 : R0 * .7).outerRadius(d => d.depth === 1 ? R0 * .68 : R0).cornerRadius(3);
    const nodes = root.descendants().filter(d => d.depth);
    const cBig = T(g, 0, 2, pc(1), { c: "#fff", fs: 24, ff: SANS, fw: 800, a: "middle" }), cSm = T(g, 0, 20, "of market clicks", { c: "#9ea3d4", fs: 10, a: "middle" }), cTop = T(g, 0, -22, "ALL INTENTS", { c: "#9ea3d4", fs: 9.5, fw: 700, a: "middle" });
    const reset = () => { cTop.text("ALL INTENTS").attr("fill", "#9ea3d4"); cBig.text(fmt(tot)).attr("fill", "#fff"); cSm.text("clicks / month"); paths.attr("opacity", d => d.depth === 1 ? 1 : .92); };
    const paths = g.selectAll("path").data(nodes).enter().append("path")
      .attr("fill", d => d.depth === 1 ? IN[d.data.name] : ST[d.data.name]).attr("stroke", "#0c0e22").attr("stroke-width", 1).style("cursor", "pointer")
      .each(d => { d.a0 = d.x0; d.a1 = d.x0; });
    paths.transition().duration(1300).delay(d => d.depth === 1 ? 0 : 450).ease(d3.easeCubicOut).attrTween("d", d => { const i = d3.interpolate(d.x0, d.x1); return t => { d.a0 = d.x0; d.a1 = i(t); return arc(d); }; });
    paths.on("pointermove pointerdown", (e, d) => {
      const intent = d.depth === 1 ? d.data.name : d.data.intent, o = ins.find(z => z.k === intent);
      paths.attr("opacity", z => (z === d || z.parent === d || (d.depth === 2 && z === d.parent)) ? 1 : .25);
      if (d.depth === 1) { cTop.text(intent.toUpperCase()).attr("fill", IN[intent]); cBig.text(pc(d.value / tot)).attr("fill", IN[intent]); cSm.text("of market clicks"); }
      else { cTop.text(STN[d.data.name].toUpperCase()).attr("fill", ST[d.data.name]); cBig.text(pc(d.value / d.parent.value)).attr("fill", ST[d.data.name]); cSm.text("of " + intent + " clicks"); }
      tipOn(e, `<b style="text-transform:capitalize">${esc(intent)}${d.depth === 2 ? " · " + STN[d.data.name] : ""}</b>${tr("Market clicks / mo", fmt(d.value))}${tr("Share of all clicks", pc(d.value / tot))}${d.depth === 1 ? tr("Searches", fmt(o.n)) + tr("You capture", pc(o.now / (o.mk || 1)), P.green) : ""}`);
    }).on("pointerleave", () => { reset(); tipOff(); });
    reset();
    const lg = document.createElement("div"); lg.className = "vlg col"; box.appendChild(lg);
    lg.innerHTML = ins.map(o => `<span><i style="background:${IN[o.k]}"></i><em style="text-transform:capitalize">${o.k}</em><b>${pc(o.mk / tot)}</b><small>you get ${pc(o.now / (o.mk || 1))}</small></span>`).join("") + `<div class="vlg-sub">Outer ring: ${ORDER.map(s => `<span><i style="background:${ST[s]}"></i>${STN[s]}</span>`).join("")}</div>`;
  }
  function storySun() {
    const ins = intentStats(), tot = sum(ins, o => o.mk) || 1, top = ins[0];
    const known = ins.filter(o => o.k !== "unclassified" && o.mk > tot * .03);
    const cap = o => o.now / (o.mk || 1);
    const best = known.slice().sort((a, b) => cap(b) - cap(a))[0], worst = known.slice().sort((a, b) => cap(a) - cap(b))[0];
    const tc = top.k === "unclassified" && ins[1] ? ins[1] : top;
    return {
      c: P.gold,
      read: `The inner ring splits the market by what people are trying to do when they search. The outer ring shows how much of each slice you rank for, using the same colors as the rest of the report: green is your top-3 territory, cyan is page one, gold is page two, violet is deeper, and hot pink is searches where you don't show up at all. Hover a slice to see its numbers in the center.`,
      say: [
        `The biggest slice is ${B(tc.k, IN[tc.k])} intent: people ${INX[tc.k]}. It accounts for ${B(pc(tc.mk / tot), IN[tc.k])} of the clicks in this market across ${plural(tc.n, "search", "searches")}. ${tc.k === "commercial" ? "That's good news for a business: these searchers are shopping, and they turn into leads at a much higher rate than people just reading." : tc.k === "informational" ? "These searchers are earlier in their journey. They rarely convert on the first visit, but whoever teaches them first tends to be the one they come back to." : tc.k === "transactional" ? "These are the hottest searches there are: the person is ready to act right now." : ""}`,
        best && cap(best) < .005 ? `Right now you capture almost none of the clicks in any of the main intent groups, so every slice of this wheel is open ground. That's not unusual for a site entering a new market.` : best && worst && best !== worst ? `Your coverage is uneven. You capture ${B(pc(cap(best)), P.green)} of the ${best.k} clicks but only ${B(pc(cap(worst)), P.pink)} of the ${worst.k} ones. ${worst.k === "commercial" || worst.k === "transactional" ? "That's the expensive gap: the buyer-ready searches are the ones going to competitors." : worst.k === "informational" ? "That gap is usually filled with guides, explainers and FAQ content that feeds visitors into your service pages." : ""}` : best ? `You capture ${B(pc(cap(best)), P.green)} of the ${best.k} clicks in this market.` : null,
        `A lot of hot pink in the outer ring means a lot of searches where you're simply absent. Pink isn't a failure, it's the map of where new pages would go.`,
      ],
      move: worst && (worst.k === "commercial" || worst.k === "transactional") ? `Prioritise service and landing pages built around the ${worst.k} searches: clear offer, pricing cues, proof and a call to action. That's where the slice is biggest and your share is smallest.` : `Build helpful content for the ${(worst || tc).k} searches and link each piece to the service page it supports, so the traffic you earn has somewhere to go.`,
    };
  }

  /* =====================================================================
     4. Head terms vs the long tail (stacked bars by query length)
     ===================================================================== */
  const WL = ["1 word", "2 words", "3 words", "4 words", "5 words", "6+ words"];
  function tailData() {
    const b = WL.map((l, j) => ({ l, j, n: 0, mk: 0, now: 0, st: {}, xs: [] }));
    D.it.forEach(x => { const w = Math.min(6, String(x.k).trim().split(/\s+/).length) - 1; const o = b[w]; o.n++; o.mk += x.mk; o.now += x.now; o.st[x.st] = (o.st[x.st] || 0) + x.mk; o.xs.push(x); });
    return b.filter(o => o.n);
  }
  function drawTail() {
    const b = tailData(), { svg, W, H } = svgIn("vzTail", 320), m = { l: 46, r: 10, t: 34, b: 48 };
    const x = d3.scaleBand().domain(b.map(o => o.l)).range([m.l, W - m.r]).padding(.28), y = d3.scaleLinear().domain([0, d3.max(b, o => o.mk) || 1]).nice().range([H - m.b, m.t]);
    y.ticks(4).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044"); T(svg, m.l - 8, y(t) + 4, short(t), { c: "#6a70a8", fs: 10, a: "end" }); });
    T(svg, 4, m.t - 18, W < 560 ? "market clicks / mo · w = words · grey = searches" : "market clicks / mo", { c: "#7a7fae", fs: 10.5 });
    b.forEach((o, j) => {
      let acc = 0; const g = svg.append("g");
      ORDER.forEach(s => {
        const v = o.st[s] || 0; if (!v) return;
        const y0 = acc, y1 = acc + v; acc = y1;
        tip(g.append("rect").attr("x", x(o.l)).attr("width", x.bandwidth()).attr("y", y(0)).attr("height", 0).attr("fill", ST[s]).attr("rx", 2).style("cursor", "pointer"), () => `<b>${o.l} · ${STN[s]}</b>${tr("Market clicks / mo", fmt(v))}${tr("Share of this length", pc(v / o.mk))}`)
          .transition().duration(900).delay(j * 110 + ORDER.indexOf(s) * 90).attr("y", y(y1)).attr("height", Math.max(0, y(y0) - y(y1)));
      });
      T(svg, x(o.l) + x.bandwidth() / 2, y(o.mk) - 8, "you " + pc(o.now / (o.mk || 1)), { c: P.green, fs: 10.5, fw: 700, a: "middle" }).attr("opacity", 0).transition().delay(900 + j * 110).attr("opacity", 1);
      const nar = W < 560;
      T(svg, x(o.l) + x.bandwidth() / 2, H - m.b + 16, nar ? o.l.replace(/ words?/, "w") : o.l, { c: "#d6d9ff", fs: nar ? 10 : 10.5, fw: 600, a: "middle" });
      T(svg, x(o.l) + x.bandwidth() / 2, H - m.b + 30, nar ? fmt(o.n) : plural(o.n, "search", "searches"), { c: "#6a70a8", fs: 9.5, a: "middle" });
    });
    const lg = document.createElement("div"); lg.className = "vlg"; byId("vzTail").appendChild(lg);
    lg.innerHTML = ORDER.map(s => `<span><i style="background:${ST[s]}"></i>${STN[s]}</span>`).join("");
  }
  function storyTail() {
    const b = tailData(), tot = sum(b, o => o.mk) || 1, yt = sum(b, o => o.now);
    const head = b.filter(o => o.j <= 1), tail = b.filter(o => o.j >= 3);
    const hm = sum(head, o => o.mk), tm = sum(tail, o => o.mk), hn = sum(head, o => o.now), tn = sum(tail, o => o.now);
    const peak = b.slice().sort((a, z) => z.mk - a.mk)[0], yPeak = b.slice().sort((a, z) => z.now - a.now)[0];
    return {
      c: P.cyan,
      read: `Searches are grouped by how many words they contain. Short one and two word searches are the "head" of the market: big, broad and fiercely contested. Searches of four words or more are the "long tail": smaller and more specific, but usually much easier to rank for and closer to a decision. Each bar is stacked by where you rank, and the green label on top is the share of that bar's clicks you already get.`,
      say: [
        `The busiest group is ${B(peak.l, P.cyan)} searches, with ${B(fmt(peak.mk))} clicks a month. Head searches (one or two words) hold ${B(pc(hm / tot), P.pink)} of the market's clicks, and long-tail searches (four or more words) hold ${B(pc(tm / tot), P.lime)}.`,
        yt > 0 ? `You capture ${B(pc(hn / (hm || 1)), P.green)} of the head clicks and ${B(pc(tn / (tm || 1)), P.green)} of the long-tail clicks. Most of your own traffic comes from ${B(yPeak.l, P.green)} searches. ${tn / (tm || 1) > hn / (hm || 1) * 2 ? "That's a classic pattern for a growing site: you win the specific questions first, and those wins build the authority you'll need to compete for the broad terms." : hn / (hm || 1) > tn / (tm || 1) * 2 ? "That's unusual and valuable: you're already competitive on broad terms. The long tail beneath them is often easier, so there's likely cheap traffic waiting there." : "Your share is fairly even across lengths, so there's no obvious blind spot here."}` : `You don't capture clicks in any length group yet. The long tail is usually the place to start: specific searches have weaker competition and the people typing them know exactly what they want.`,
      ],
      move: `Use the long tail as your ladder. Each specific page you rank builds topical authority that eventually lifts your broad pages too. Look for four and five word searches in the opportunity list with low difficulty, and give each its own focused answer.`,
    };
  }

  /* =====================================================================
     5. Ranking position histogram
     ===================================================================== */
  const BK = [["#1", p => p === 1, P.lime], ["#2-3", p => p >= 2 && p <= 3, P.green], ["#4-10", p => p >= 4 && p <= 10, P.cyan], ["#11-20", p => p >= 11 && p <= 20, P.gold], ["#21-50", p => p >= 21 && p <= 50, P.orange], ["#51-100", p => p >= 51, P.violet], ["Not ranking", p => !p, P.pink]];
  function histData() { return BK.map(([l, f, c]) => { const xs = D.it.filter(x => f(x.p)); return { l, c, xs, n: xs.length, now: sum(xs, x => x.now), mk: sum(xs, x => x.mk), pot: sum(xs, x => x.pot) }; }); }
  function drawHist() {
    const b = histData(), { svg, W, H } = svgIn("vzHist", 320), m = { l: 40, r: 8, t: 26, b: 48 };
    const x = d3.scaleBand().domain(b.map(o => o.l)).range([m.l, W - m.r]).padding(.22), y = d3.scaleSqrt().domain([0, d3.max(b, o => o.n) || 1]).range([H - m.b, m.t]);
    [0, .25, .5, 1].map(f => Math.round(f * (d3.max(b, o => o.n) || 1))).filter((v, i, a) => a.indexOf(v) === i).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044"); T(svg, m.l - 6, y(t) + 4, fmt(t), { c: "#6a70a8", fs: 10, a: "end" }); });
    T(svg, 4, 12, W < 560 ? "searches (√ scale) · green = visits/mo" : "searches (√ scale)", { c: "#7a7fae", fs: 10.5 });
    b.forEach((o, j) => {
      const gid = grad(svg, "hb" + j, [o.c, [o.c, .35]], true), bx = x(o.l), bw = x.bandwidth();
      tip(svg.append("rect").attr("x", bx).attr("width", bw).attr("y", y(0)).attr("height", 0).attr("rx", 6).attr("fill", gid).style("filter", glow(o.c)).style("cursor", "pointer"),
        () => `<b>${o.l === "Not ranking" ? "Searches you don't rank for" : "You rank " + o.l}</b>${tr("Searches", fmt(o.n))}${tr("Your visits / mo", fmt(o.now), P.green)}${tr("Market clicks / mo", fmt(o.mk))}${o.pot ? tr("On the table", "+" + fmt(o.pot) + " visits", P.gold) : ""}${o.xs.length ? `<div style="margin-top:6px;color:#9ea3d4;font-size:12px">${o.xs.slice().sort((a, z) => z.v - a.v).slice(0, 3).map(x => esc(cut(x.k, 34))).join("<br>")}</div>` : ""}`)
        .transition().duration(1000).delay(j * 110).ease(d3.easeBackOut.overshoot(1.1)).attr("y", y(o.n)).attr("height", Math.max(0, y(0) - y(o.n)));
      T(svg, bx + bw / 2, y(o.n) - 7, fmt(o.n), { c: o.c, fs: 12.5, fw: 800, ff: SANS, a: "middle" }).attr("opacity", 0).transition().delay(800 + j * 110).attr("opacity", 1);
      const nar = W < 560;
      T(svg, bx + bw / 2, H - m.b + 16, nar ? o.l.replace("Not ranking", "None").replace("#51-100", "#51+") : o.l, { c: "#d6d9ff", fs: nar ? 9 : 10.5, fw: 600, a: "middle" });
      T(svg, bx + bw / 2, H - m.b + 30, short(o.now) + (nar ? "" : " visits"), { c: o.now > 0 ? P.green : "#5d6296", fs: 9.5, a: "middle" });
    });
  }
  function storyHist() {
    const b = histData(), g = l => b.find(o => o.l === l), ranked = D.it.filter(x => x.p).length, n = D.n;
    const p1 = g("#1").n + g("#2-3").n + g("#4-10").n, p2 = g("#11-20"), deep = g("#21-50").n + g("#51-100").n, nr = g("Not ranking");
    const yt = sum(b, o => o.now) || 1, t3now = g("#1").now + g("#2-3").now;
    return {
      c: P.cyan,
      read: `Every search in this market, sorted by where ${esc(SCAN.domain)} ranks for it today. The number on each bar is how many searches fall in that range; the green number underneath is the traffic those rankings actually bring. The height uses a square-root scale so small bars stay visible next to big ones.`,
      say: [
        `You rank somewhere in the top 100 for ${B(fmt(ranked), P.cyan)} of the ${fmt(n)} searches in this market, and ${B(fmt(p1), P.green)} of those are on page one. ${t3now > 0 ? `Your top-3 positions alone deliver ${B(pc(t3now / yt), P.lime)} of your traffic from this market, which shows how lopsided the click curve is.` : "None of them are in the top 3 yet, which is where most of the clicks go."}`,
        p2.n ? `Look hard at the gold bar: ${B(plural(p2.n, "search", "searches"), P.gold)} sit on page two (#11 to #20). Page two gets well under 1% of clicks per spot, so these bring you just ${fmt(p2.now)} visits a month, yet reaching the top 3 on them would add about ${B("+" + fmt(p2.pot), P.gold)}. They're the closest thing SEO has to found money.` : null,
        deep ? `Another ${fmt(deep)} searches rank between #21 and #100. Google has noticed those pages but doesn't rate them yet; they usually need a real content upgrade, not just a tweak.` : null,
        nr.n ? `The pink bar is the biggest blind spot: ${B(plural(nr.n, "search", "searches"), P.pink)} where you don't appear at all, worth ${fmt(nr.mk)} clicks a month across the market.` : null,
      ],
      move: p2.n ? `Pull the page-two list from the opportunity table (filter "Striking distance"), and for each one: tighten the title around the exact search, expand the answer, and add two or three internal links from your strongest pages.` : `Most of your upside is in searches you don't rank for yet. Head to the opportunity map below to see which ones are easiest.`,
    };
  }

  /* =====================================================================
     6. Pages doing the work
     ===================================================================== */
  function pageData() {
    const m = {}; (SCAN.ranked || []).filter(r => r.u).forEach(r => { const o = m[r.u] || (m[r.u] = { u: r.u, v: 0, n: 0, best: 999, top: null }); const vis = (r.v || 0) * ctr(r.p); o.v += vis; o.n++; o.best = Math.min(o.best, r.p || 999); if (!o.top || r.v > o.top.v) o.top = r; });
    return Object.values(m).sort((a, b) => (b.v - a.v) || (b.n - a.n));
  }
  function drawPages() {
    const ps = pageData().slice(0, 10), box = byId("vzPages");
    if (!ps.length) { box.innerHTML = `<div class="vz-empty">No ranking pages were returned for this domain.</div>`; return; }
    const mob = (box.clientWidth || 600) < 560, rowH = 38, { svg, W, H } = svgIn("vzPages", ps.length * rowH + 14), lw = mob ? Math.min(150, W * .42) : Math.min(260, W * .38), m = { l: lw + 8, r: 70 };
    const x = d3.scaleLinear().domain([0, d3.max(ps, p => p.v) || 1]).range([0, W - m.l - m.r]);
    ps.forEach((p, j) => {
      const yy = 6 + j * rowH, c = RAINBOW[j % RAINBOW.length], path = p.u.replace(/^https?:\/\/[^/]+/, "") || "/";
      T(svg, m.l - 10, yy + 15, cut(path, Math.floor(lw / 6.6)), { c: "#e6e8ff", fs: 11.5, fw: 600, a: "end" });
      T(svg, m.l - 10, yy + 28, `${plural(p.n, "keyword")} · best #${p.best}`, { c: "#6a70a8", fs: 9.5, a: "end" });
      svg.append("rect").attr("x", m.l).attr("y", yy + 6).attr("width", W - m.l - m.r).attr("height", 20).attr("rx", 6).attr("fill", "#141633");
      tip(svg.append("rect").attr("x", m.l).attr("y", yy + 6).attr("height", 20).attr("rx", 6).attr("width", 0).attr("fill", grad(svg, "pg" + j, [c, [c, .55]])).style("filter", glow(c)), () => `<b>${esc(path)}</b>${tr("Est. visits / mo", fmt(p.v), P.green)}${tr("Keywords ranking", fmt(p.n))}${tr("Best position", "#" + p.best)}${p.top ? tr("Biggest keyword", esc(cut(p.top.k, 30))) : ""}`)
        .transition().duration(1100).delay(j * 90).attr("width", Math.max(3, x(p.v)));
      T(svg, W - m.r + 8, yy + 20, fmt(p.v), { c, fs: 12.5, fw: 800, ff: SANS });
    });
  }
  function storyPages() {
    const ps = pageData(); if (!ps.length) return null;
    const tot = sum(ps, p => p.v), top = ps[0], zero = ps.filter(p => p.v < 1).length, path = u => esc(u.replace(/^https?:\/\/[^/]+/, "") || "/");
    return {
      c: P.purple,
      read: `Each bar is one page on ${esc(SCAN.domain)}, sized by the visits a month its rankings should bring in (search volume × the click-through rate for its position). The small grey line under each address shows how many keywords that page ranks for and its best position.`,
      say: [
        tot > 0 ? `${B(path(top.u), P.cyan)} is your workhorse, earning about ${B(fmt(top.v), P.green)} visits a month, ${B(pc(top.v / tot), P.cyan)} of everything your ranking pages bring in. ${top.v / tot > .5 ? "That's a lot of eggs in one basket. If that page slips a few positions, most of your search traffic goes with it." : "Traffic is reasonably spread across pages, which makes the site more resilient to any single ranking drop."}` : `None of these pages rank high enough to earn meaningful clicks yet. They're indexed and Google associates them with keywords, but they're sitting too deep in the results for people to reach them.`,
        zero ? `${B(plural(zero, "page"), P.pink)} rank for keywords but earn close to nothing because every ranking is below page one. Those are pages Google already knows about; refreshing them is far faster than publishing new ones.` : null,
      ],
      move: `Treat your top two or three pages as assets: keep them updated, point internal links at them, and make sure each has a clear next step for the visitor. Then pick the near-zero pages with the most keywords and give them a proper rewrite.`,
    };
  }

  /* =====================================================================
     7. Opportunity matrix (difficulty × volume)
     ===================================================================== */
  const QD = { qw: { n: "Quick wins", c: P.lime, s: "low difficulty, big volume" }, bb: { n: "Big bets", c: P.orange, s: "high volume, hard to rank" }, lt: { n: "Easy long tail", c: P.cyan, s: "small but easy" }, hl: { n: "Hold for later", c: P.violet, s: "small and hard" } };
  let QF = null;
  function quadStats() { const o = {}; Object.keys(QD).forEach(k => { const xs = D.it.filter(x => D.quad(x) === k && x.pot > 0).sort((a, b) => b.pot - a.pot); o[k] = { xs, n: xs.length, pot: sum(xs, x => x.pot), val: sum(xs, x => x.potVal) }; }); return o; }
  function drawMatrix() {
    const box = byId("vzMatrix"); const pts = D.dv.slice().sort((a, b) => b.pot - a.pot);
    if (pts.length < 3) { box.innerHTML = `<div class="vz-empty">Not enough difficulty data in this scan to plot the matrix.</div>`; byId("vzMatrixQ").innerHTML = ""; return; }
    const W0 = box.clientWidth || 600, H = Math.max(350, Math.min(480, W0 * .64)), { svg, W } = svgIn("vzMatrix", H), m = { l: 50, r: 14, t: 26, b: 40 };
    const vmin = d3.min(pts, x => x.v), vmax = d3.max(pts, x => x.v);
    const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]), y = d3.scaleLog().domain([Math.max(1, vmin * .7), vmax * 1.4]).range([H - m.b, m.t]).nice();
    const r = d3.scaleSqrt().domain([0, d3.max(pts, p => p.pot) || 1]).range([2.6, W < 600 ? 13 : 19]);
    const xs = x(30), ys = y(Math.max(D.medV, y.domain()[0]));
    const qr = { qw: [m.l, m.t, xs - m.l, ys - m.t], bb: [xs, m.t, W - m.r - xs, ys - m.t], lt: [m.l, ys, xs - m.l, H - m.b - ys], hl: [xs, ys, W - m.r - xs, H - m.b - ys] };
    Object.entries(qr).forEach(([k, a]) => { svg.append("rect").attr("x", a[0]).attr("y", a[1]).attr("width", a[2]).attr("height", a[3]).attr("fill", QD[k].c).attr("opacity", .055).attr("class", "qbg q-" + k); });
    y.ticks(5).filter(t => String(t)[0] === "1").forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044"); T(svg, m.l - 7, y(t) + 4, short(t), { c: "#6a70a8", fs: 10, a: "end" }); });
    [0, 20, 40, 60, 80, 100].forEach(t => T(svg, x(t), H - m.b + 16, t, { c: "#6a70a8", fs: 10, a: "middle" }));
    T(svg, (m.l + W - m.r) / 2, H - 6, "keyword difficulty (0 easy → 100 brutal)", { c: "#7a7fae", fs: 10.5, a: "middle" });
    T(svg, 4, 11, "↑ searches / mo", { c: "#7a7fae", fs: 10.5 });
    svg.append("line").attr("x1", xs).attr("x2", xs).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#5d6296").attr("stroke-dasharray", "4 4");
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", ys).attr("y2", ys).attr("stroke", "#5d6296").attr("stroke-dasharray", "4 4");
    const ql = (k, xx, yy, a) => T(svg, xx, yy, QD[k].n.toUpperCase(), { c: QD[k].c, fs: W < 600 ? 10 : 12, fw: 800, a }).attr("opacity", .85);
    ql("qw", m.l + 8, m.t + 16, "start"); ql("bb", W - m.r - 8, m.t + 16, "end"); ql("lt", m.l + 8, H - m.b - 8, "start"); ql("hl", W - m.r - 8, H - m.b - 8, "end");
    const dots = svg.append("g").selectAll("circle").data(pts).enter().append("circle")
      .attr("cx", d => x(d.d)).attr("cy", d => y(d.v)).attr("r", 0).attr("fill", d => ST[d.st]).attr("fill-opacity", .8).attr("stroke", "#0a0b19").attr("stroke-width", .8).style("cursor", "pointer");
    dots.transition().duration(700).delay((d, i) => 200 + Math.min(i, 400) * 3).attr("r", d => r(d.pot));
    tip(dots, d => `<b>${esc(d.k)}</b>${tr("Quadrant", QD[D.quad(d)].n, QD[D.quad(d)].c)}${tr("Searches / mo", fmt(d.v))}${tr("Difficulty", d.d)}${tr("You", d.p ? "#" + d.p : "not ranking", ST[d.st])}${d.c ? tr("CPC", "$" + d.c.toFixed(2)) : ""}${tr("On the table", "+" + fmt(d.pot) + " visits" + (d.potVal ? " · " + money(d.potVal) : ""), P.gold)}`);
    const apply = () => { dots.attr("fill-opacity", d => !QF || D.quad(d) === QF ? .85 : .06).attr("stroke-opacity", d => !QF || D.quad(d) === QF ? 1 : .1); svg.selectAll(".qbg").attr("opacity", function () { return !QF || this.classList.contains("q-" + QF) ? (QF ? .14 : .055) : .02; }); document.querySelectorAll("#vzMatrixQ .quad").forEach(e => e.classList.toggle("on", e.dataset.q === QF)); };
    const qs = quadStats();
    byId("vzMatrixQ").innerHTML = Object.entries(QD).map(([k, o]) => `<div class="quad" data-q="${k}" style="--q:${o.c}"><b>${o.n}</b><strong>+${fmt(qs[k].pot)}</strong><span>visits/mo · ${plural(qs[k].n, "search", "searches")}<br>${o.s}</span></div>`).join("");
    document.querySelectorAll("#vzMatrixQ .quad").forEach(e => e.onclick = () => { QF = QF === e.dataset.q ? null : e.dataset.q; apply(); });
    apply();
  }
  function storyMatrix() {
    const qs = quadStats(), noD = D.it.filter(x => x.d == null).length, qw = qs.qw, bb = qs.bb;
    const names = qw.xs.slice(0, 3).map(x => q(x.k) + ` (+${fmt(x.pot)})`), bigs = bb.xs.slice(0, 2).map(x => q(x.k));
    return {
      c: P.lime,
      read: `Every dot is a search. Further right means harder to rank (DataForSEO's keyword difficulty score), higher up means more people search it each month, and bigger dots mean more traffic left on the table. Dot color is your current ranking. The dashed lines split the chart at a difficulty of 30 and at the market's median search volume (${fmt(D.medV)}), which gives four kinds of opportunity. Tap a card below the chart to light up just that group.`,
      say: [
        qw.n ? `The top-left corner is where you want to live. There are ${B(plural(qw.n, "quick win"), P.lime)} here worth ${B("+" + fmt(qw.pot) + " visits a month", P.lime)}${qw.val ? ` (${money(qw.val)} in click value)` : ""}: searches with real volume that a well-made page can realistically rank for. The biggest are ${and(names)}.` : `There are no true quick wins in this market: every high-volume search is rated difficult. That's normal in mature, competitive niches, and it means the long tail is your way in.`,
        bb.n ? `Top right are the ${B(plural(bb.n, "big bet"), P.orange)}, worth ${B("+" + fmt(bb.pot), P.orange)} visits a month. ${bigs.length ? `Searches like ${and(bigs)} ` : "These "}are worth chasing over the long run, but they need authority: strong links, a deep cluster of supporting content and patience.` : null,
        `The bottom half is quieter. ${B(plural(qs.lt.n, "easy long-tail search", "easy long-tail searches"), P.cyan)} add up to +${fmt(qs.lt.pot)} visits, and they're perfect for FAQ sections and supporting articles. ${qs.hl.n ? `The ${plural(qs.hl.n, "search", "searches")} in the bottom right are small and hard; leave them for last.` : ""}${noD ? ` (${plural(noD, "search", "searches")} had no difficulty score and aren't plotted.)` : ""}`,
      ],
      move: qw.n ? `Start in the top-left. Write or upgrade one page per quick win this quarter, then use those rankings as the internal-link foundation for the big bets.` : `Start in the bottom-left with the easy long tail, then point those pages at one big-bet page per topic so authority flows up.`,
    };
  }

  /* =====================================================================
     8. Launchpad: striking-distance dumbbells
     ===================================================================== */
  function drawLaunch() {
    const xs = D.strike.slice(0, 12), box = byId("vzLaunch");
    if (!xs.length) { box.innerHTML = `<div class="vz-empty"><b>No searches in striking distance yet.</b><br>Nothing ranks between #4 and #20 for this market, so there's nothing to push up. The opportunity map shows where to start fresh.</div>`; return; }
    const rowH = 36, W0 = box.clientWidth || 600, mob = W0 < 560, H = xs.length * rowH + 44, { svg, W } = svgIn("vzLaunch", H), m = { l: mob ? Math.min(140, W * .4) : Math.min(250, W * .36), r: 64, t: 34 };
    const x = d3.scaleLinear().domain([20, 1]).range([m.l + 6, W - m.r]);
    [[20, 10.5, P.gold, "page two"], [10.5, 3.5, P.cyan, "page one"], [3.5, 1, P.green, "top 3"]].forEach(([a, b, c, l]) => {
      svg.append("rect").attr("x", x(a)).attr("width", x(b) - x(a)).attr("y", m.t - 8).attr("height", H - m.t).attr("fill", c).attr("opacity", .07);
      T(svg, (x(a) + x(b)) / 2, 14, l.toUpperCase(), { c, fs: 10, fw: 800, a: "middle" });
    });
    [20, 15, 10, 5, 3, 1].forEach(p => T(svg, x(p), 27, "#" + p, { c: "#6a70a8", fs: 9.5, a: "middle" }));
    const gl = grad(svg, "lnch", [P.gold, P.lime]);
    xs.forEach((d, j) => {
      const yy = m.t + j * rowH + rowH / 2, g = svg.append("g");
      T(g, m.l - 8, yy + 4, cut(d.k, Math.floor(m.l / 6.4)), { c: "#e6e8ff", fs: 11.5, fw: 600, a: "end" });
      g.append("line").attr("x1", x(20)).attr("x2", x(1)).attr("y1", yy).attr("y2", yy).attr("stroke", "#1d2044");
      g.append("rect").attr("x", x(d.p)).attr("y", yy - 2.5).attr("height", 5).attr("rx", 2.5).attr("width", 0).attr("fill", gl).style("filter", glow(P.lime)).transition().duration(1000).delay(250 + j * 80).attr("width", Math.max(0, x(3) - x(d.p)));
      g.append("circle").attr("cx", x(3)).attr("cy", yy).attr("r", 6).attr("fill", "none").attr("stroke", P.lime).attr("stroke-width", 2).style("filter", glow(P.lime)).attr("opacity", 0).transition().delay(1100 + j * 80).attr("opacity", 1);
      g.append("circle").attr("cx", x(d.p)).attr("cy", yy).attr("r", 6).attr("fill", P.gold).attr("stroke", "#0a0b19").attr("stroke-width", 1.5);
      T(g, x(d.p), yy - 9, "#" + d.p, { c: P.gold, fs: 9.5, fw: 700, a: "middle" });
      T(g, W - m.r + 8, yy + 4, "+" + short(d.pot), { c: P.lime, fs: 12, fw: 800, ff: SANS });
      tip(g.append("rect").attr("x", 0).attr("width", W).attr("y", yy - rowH / 2).attr("height", rowH).attr("fill", "transparent"), () => `<b>${esc(d.k)}</b>${tr("You today", "#" + d.p, P.gold)}${tr("Searches / mo", fmt(d.v))}${d.d != null ? tr("Difficulty", d.d) : ""}${tr("#1 right now", d.lead ? esc(d.lead.d) : "–")}${tr("Gain at the top 3", "+" + fmt(d.pot) + " visits" + (d.potVal ? " · " + money(d.potVal) : ""), P.lime)}`);
    });
  }
  function storyLaunch() {
    const s = D.strike; if (!s.length) return { c: P.gold, say: [`Nothing ranks between #4 and #20 in this market yet, so there are no pages to push up. That's fine: it just means growth comes from new pages, which the opportunity map above sorts by difficulty.`], move: "Pick three quick wins from the matrix and publish focused pages for them first." };
    const tot = sum(s, x => x.pot), p2 = s.filter(x => x.p > 10).length, avg = sum(s, x => x.p) / s.length, top = s.slice(0, 3).map(x => `${q(x.k)} (#${x.p})`);
    return {
      c: P.gold,
      read: `Each row is a search where you already rank between #4 and #20. The gold dot is where you are now, the green ring is the top 3, and the line between them is the climb. The number on the right is the extra traffic a month you'd get on arrival. Rows are sorted by that number, biggest first.`,
      say: [
        `You have ${B(plural(s.length, "search", "searches"), P.gold)} in striking distance, sitting at an average position of ${B("#" + avg.toFixed(1), P.gold)}. Getting them all into the top 3 is worth about ${B("+" + fmt(tot) + " visits a month", P.lime)}${D.hasVal ? ` (${money(sum(s, x => x.potVal))} in click value)` : ""}. ${p2 ? `${plural(p2, "of them is", "of them are")} on page two, where hardly anyone clicks, so even a modest jump changes the numbers fast.` : ""}`,
        `These are the cheapest wins in SEO because Google already trusts the page enough to rank it. You're not starting from zero; you're closing a gap. The biggest ones are ${and(top)}.`,
      ],
      move: `Work down this list from the top. For each page: match the title and first paragraph to the exact search, answer it better than the current #1, add fresh examples or data, and link to it from two or three of your strongest pages. Recheck rankings after four to six weeks.`,
    };
  }

  /* =====================================================================
     9. Waterfall: today → 12 months → full potential
     ===================================================================== */
  function wfSteps() {
    const { Rr, ex, full } = D, base = Rr.you.clicks, e12 = base + ex.gain;
    return [
      { l: "Today", t: 1, v: base, c: P.green },
      ex.push.clicks > 0 && { l: "Push current pages", v: ex.push.clicks, c: P.gold },
      ex.win.clicks > 0 && { l: "Win new rankings", v: ex.win.clicks, c: P.orange },
      ex.map.clicks > 0 && { l: "Map pack", v: ex.map.clicks, c: P.cyan },
      { l: "Month 12", t: 1, v: e12, c: P.yellow },
      full - e12 > 0.5 && { l: "Still open", v: full - e12, c: P.pink },
      { l: "Full potential", t: 1, v: Math.max(full, e12), c: P.purple },
    ].filter(Boolean);
  }
  function drawWaterfall() {
    const st = wfSteps(), { svg, W, H } = svgIn("vzWater", 330), m = { l: 46, r: 8, t: 26, b: 56 };
    let run = 0; st.forEach(s => { if (s.t) { s.a = 0; s.b = s.v; run = s.v; } else { s.a = run; s.b = run + s.v; run = s.b; } });
    const x = d3.scaleBand().domain(st.map((s, i) => i)).range([m.l, W - m.r]).padding(.26), y = d3.scaleLinear().domain([0, d3.max(st, s => s.b) * 1.08 || 1]).nice().range([H - m.b, m.t]);
    y.ticks(4).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044"); T(svg, m.l - 7, y(t) + 4, short(t), { c: "#6a70a8", fs: 10, a: "end" }); });
    T(svg, 4, 12, "visits / month", { c: "#7a7fae", fs: 10.5 });
    st.forEach((s, i) => {
      const bx = x(i), bw = x.bandwidth(), gid = grad(svg, "wf" + i, [s.c, [s.c, s.t ? .7 : .45]], true);
      if (i < st.length - 1) svg.append("line").attr("x1", bx + bw).attr("x2", x(i + 1)).attr("y1", y(s.b)).attr("y2", y(s.b)).attr("stroke", "#5d6296").attr("stroke-dasharray", "3 3");
      tip(svg.append("rect").attr("x", bx).attr("width", bw).attr("rx", 5).attr("y", y(s.a)).attr("height", 0).attr("fill", gid).style("filter", glow(s.c)), () => `<b>${s.l}</b>${tr(s.t ? "Visits / mo" : "Adds", (s.t ? "" : "+") + fmt(s.v), s.c)}`)
        .transition().duration(800).delay(i * 220).attr("y", y(s.b)).attr("height", Math.max(1.5, y(s.a) - y(s.b)));
      T(svg, bx + bw / 2, y(s.b) - 7, (s.t ? "" : "+") + short(s.v), { c: s.c, fs: 12, fw: 800, ff: SANS, a: "middle" }).attr("opacity", 0).transition().delay(600 + i * 220).attr("opacity", 1);
      const nar = W < 560, words = s.l.split(" "), lines = []; let cur = ""; words.forEach(w => { if (cur && (nar || (cur + " " + w).length > Math.max(6, Math.floor(bw / 6.2)))) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }); lines.push(cur);
      lines.slice(0, 3).forEach((ln, k) => T(svg, bx + bw / 2, H - m.b + 15 + k * 11.5, ln, { c: s.t ? "#e6e8ff" : "#9ea3d4", fs: nar ? 8.5 : 9.5, fw: s.t ? 700 : 500, a: "middle" }));
    });
  }
  function storyWater() {
    const { Rr, ex, full } = D, base = Rr.you.clicks, e12 = base + ex.gain, open = Math.max(0, full - e12), parts = [];
    if (ex.push.clicks > 0) parts.push(`${B("+" + fmt(ex.push.clicks), P.gold)} from pushing ${plural(ex.push.n, "page")} you already rank into the top 3`);
    if (ex.win.clicks > 0) parts.push(`${B("+" + fmt(ex.win.clicks), P.orange)} from winning ${plural(ex.win.n, "new ranking")}`);
    if (ex.map.clicks > 0) parts.push(`${B("+" + fmt(ex.map.clicks), P.cyan)} from map-pack spots`);
    const big = [["push", ex.push.clicks], ["win", ex.win.clicks], ["map", ex.map.clicks]].sort((a, b) => b[1] - a[1])[0][0];
    return {
      c: P.yellow,
      read: `Read it left to right like a bank statement. The first bar is your traffic today. Each floating bar after it adds one source of growth on top of the last, landing on the yellow month-12 total. The pink bar is what's still unclaimed after that, and the purple bar on the far right is the ceiling: an average top-3 position on every search in this market.`,
      say: [
        `On the expected plan, ${D.dom} grows from ${B(fmt(base), P.green)} to ${B(fmt(e12), P.yellow)} visits a month${base > 0 && times(e12 / base) ? `, ${times(e12 / base)} today's traffic` : ""}. That's built from ${and(parts) || "small gains across the board"}.`,
        big === "push" ? `Most of the growth comes from pages that already exist. That's the best kind of plan: lower cost, lower risk, and results usually show up first.` : big === "win" ? `Most of the growth comes from new rankings, which means new or substantially rebuilt pages. That takes longer to show up, so expect the early months to look quiet.` : `Most of the growth comes from the map pack, which runs on your Google Business Profile, reviews and local signals more than on page content.`,
        open > 0 ? `Even after that, ${B(fmt(open) + " visits a month", P.pink)} are still open. That's the case for year two: the full-potential ceiling of ${B(fmt(full), P.purple)} is the size of the prize, not a 12-month promise.` : null,
      ],
      move: big === "push" ? `Lead with the striking-distance list above. It delivers the biggest single block of growth for the least effort.` : `Commit to a publishing cadence now (two to four strong pages a month) because new rankings compound: each one makes the next easier.`,
    };
  }

  /* =====================================================================
     10. Competitor radar
     ===================================================================== */
  let RHIDE = new Set();
  function radarData() {
    const { Rr, comps, led, it } = D, loc = Rr.basis.local, pool = loc ? it.filter(x => x.live) : it;
    const p10 = pool.filter(x => x.p && x.p <= 10);
    const you = { d: SCAN.domain, me: true, share: Rr.you.share, kw3: pool.filter(x => (x.p && x.p <= 3) || x.pk).length, kw10: p10.length, avg: p10.length ? sum(p10, x => x.p) / p10.length : null, led: led.you, cov: pool.filter(x => x.p).length, packs: Rr.you.packs, c: P.green };
    const ents = [you, ...comps.slice(0, 3).map((c, j) => ({ d: c.d, share: c.share, kw3: c.kw3, kw10: c.kw10, avg: c.avg, led: led[c.d] || 0, cov: Object.keys(c.pos).length, packs: c.packs, c: SITEC[j], type: c.type }))];
    const ax = [["Click share", "share", pc], ["Top-3 spots", "kw3", fmt], ["Page one", "kw10", fmt], ["Avg position", "avgS", (v, e) => e.avg ? "#" + e.avg.toFixed(1) : "–"], ["Topics led", "led", fmt], ["Coverage", "cov", fmt]];
    if (loc) ax.push(["Map pack", "packs", fmt]);
    ents.forEach(e => e.avgS = e.avg ? Math.max(0, (11 - e.avg) / 10) : 0);
    return { ents, ax };
  }
  function drawRadar() {
    const { ents, ax } = radarData(), box = byId("vzRadar"); box.innerHTML = "";
    const W = Math.max(280, box.clientWidth || 500), Sz = Math.min(W, 440), Rd = Sz / 2 - (W < 420 ? 62 : 74);
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${Sz} ${Sz}`).attr("width", Sz).attr("height", Sz).style("display", "block").style("margin", "0 auto").style("overflow", "visible");
    const g = svg.append("g").attr("transform", `translate(${Sz / 2},${Sz / 2})`), N = ax.length, ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
    const mx = ax.map(([, k]) => Math.max(1e-9, ...ents.map(e => e[k] || 0)));
    [.25, .5, .75, 1].forEach(t => g.append("polygon").attr("points", ax.map((a, i) => [Math.cos(ang(i)) * Rd * t, Math.sin(ang(i)) * Rd * t].join(",")).join(" ")).attr("fill", t === 1 ? "rgba(255,255,255,.02)" : "none").attr("stroke", "#262a55"));
    ax.forEach(([l], i) => {
      const c = Math.cos(ang(i)), s = Math.sin(ang(i));
      g.append("line").attr("x2", c * Rd).attr("y2", s * Rd).attr("stroke", "#262a55");
      T(g, c * (Rd + 14), s * (Rd + 14) + 4, l, { c: "#d6d9ff", fs: W < 420 ? 9.5 : 10.5, fw: 600, a: Math.abs(c) < .3 ? "middle" : c > 0 ? "start" : "end" });
    });
    const pt = (e, i) => { const v = (e[ax[i][1]] || 0) / mx[i]; return [Math.cos(ang(i)) * Rd * v, Math.sin(ang(i)) * Rd * v]; };
    ents.slice().reverse().forEach(e => {
      if (RHIDE.has(e.d)) return;
      const gg = g.append("g").attr("transform", "scale(0)");
      gg.append("polygon").attr("points", ax.map((a, i) => pt(e, i).join(",")).join(" ")).attr("fill", e.c).attr("fill-opacity", e.me ? .22 : .1).attr("stroke", e.c).attr("stroke-width", e.me ? 3 : 2).attr("stroke-linejoin", "round").style("filter", e.me ? glow(e.c) : null);
      ax.forEach((a, i) => { const [px, py] = pt(e, i); tip(gg.append("circle").attr("cx", px).attr("cy", py).attr("r", 4.5).attr("fill", e.c).attr("stroke", "#0a0b19").style("cursor", "pointer"), () => `<b>${esc(e.d)}</b>${ax.map(([l, k, f]) => tr(l, k === "avgS" ? f(0, e) : f(e[k] || 0), e.c)).join("")}`); });
      gg.transition().duration(1100).delay(e.me ? 500 : 150).ease(d3.easeBackOut.overshoot(1.2)).attr("transform", "scale(1)");
    });
    const lg = document.createElement("div"); lg.className = "vlg center"; box.appendChild(lg);
    lg.innerHTML = ents.map(e => `<button class="lgb ${RHIDE.has(e.d) ? "off" : ""}" data-d="${esc(e.d)}"><i style="background:${e.c}"></i>${esc(cut(e.d, 24))}${e.me ? " (you)" : ""}</button>`).join("");
    lg.querySelectorAll("button").forEach(b => b.onclick = () => { const d = b.dataset.d; RHIDE.has(d) ? RHIDE.delete(d) : RHIDE.add(d); drawRadar(); });
  }
  function storyRadar() {
    const { ents, ax } = radarData(); if (ents.length < 2) return null;
    const you = ents[0], top = ents[1];
    const rel = ax.map(([l, k]) => ({ l, r: (you[k] || 0) / Math.max(1e-9, top[k] || 0), y: you[k] || 0, t: top[k] || 0 })).filter(a => a.t > 0);
    const strong = rel.slice().sort((a, b) => b.r - a.r)[0], weak = rel.slice().sort((a, b) => a.r - b.r)[0];
    const beats = rel.filter(a => a.r >= 1).map(a => a.l.toLowerCase());
    return {
      c: P.pink,
      read: `Each spoke is one measure of strength in this market, and each colored shape is a website. The further a shape reaches along a spoke, the stronger that site is on that measure (each spoke is scaled to whoever is best on it). A big, round shape is a site that's strong everywhere; a small or lopsided one has gaps. Tap a name under the chart to hide or show it.`,
      say: [
        `The shape to beat is ${B(esc(top.d), top.c)}, the biggest site in this market by clicks. ${beats.length ? `${D.dom} already matches or beats it on ${B(and(beats), P.green)}.` : `Right now ${D.dom}'s shape sits inside it on every spoke.`}`,
        strong && weak && strong !== weak ? `Your relative strength is ${B(strong.l.toLowerCase(), P.green)}${strong.r >= 1 ? "" : ` (${pc(strong.r)} of the leader's level)`}. Your biggest gap is ${B(weak.l.toLowerCase(), P.pink)}, where you're at ${pc(weak.r)} of ${esc(top.d)}. ${weak.l === "Coverage" ? "That's a breadth problem: they simply have pages for far more of these searches than you do." : weak.l === "Top-3 spots" ? "That's a quality and authority problem: you're showing up, but not at the very top where the clicks are." : weak.l === "Topics led" ? "They lead whole topic groups, which usually means they've built clusters of interlinked pages rather than one-off posts." : ""}` : null,
        `"Avg position" measures how high your page-one rankings sit on average (a #1 average fills the spoke, a #10 average barely registers), and "Coverage" counts every search a site ranks for anywhere in the top 100. ${ax.some(a => a[1] === "packs") ? "\"Map pack\" counts appearances in the local three-pack on the live-checked searches." : ""}`,
      ],
      move: weak ? (weak.l === "Coverage" ? `Close the coverage gap first: use the heatmap and the untapped topics below to list the searches ${esc(top.d)} ranks for that you don't, and build pages for the biggest.` : `Concentrate on ${weak.l.toLowerCase()}: that's the spoke where a modest improvement changes your shape the most.`) : "",
    };
  }

  /* =====================================================================
     11. Heatmap: topics × sites
     ===================================================================== */
  function heatData() {
    const { topics, comps, topicComp } = D;
    const Tp = topics.filter(t => t.clicks > 0).slice(0, 10), C = [{ d: SCAN.domain, me: true }, ...comps.slice(0, 6)];
    const cell = Tp.map(t => C.map(c => { const v = c.me ? t.yours : topicComp(c, t); return { t, c, v, s: v / (t.clicks || 1) }; }));
    return { Tp, C, cell };
  }
  function drawHeat() {
    const { Tp, C, cell } = heatData(), box = byId("vzHeat");
    if (!Tp.length) { box.innerHTML = `<div class="vz-empty">Not enough topic data to build the heatmap.</div>`; return; }
    const avail = Math.max(300, box.clientWidth || 700), mob = avail < 600, lw = mob ? 118 : Math.min(220, avail * .26), cw = Math.max(mob ? 52 : 64, Math.min(110, (avail - lw - 10) / C.length)), chh = 34, hh = mob ? 96 : 104;
    const W = Math.max(avail, lw + cw * C.length + 10), H = hh + Tp.length * chh + 8;
    const { svg } = svgIn("vzHeat", H, W > avail ? W : null);
    const mxS = d3.max(cell.flat(), z => z.s) || 1;
    const col = d3.scaleSequentialSqrt(d3.interpolateRgbBasis(["#15173a", "#33307a", "#8a3fd1", "#ff4fa8", "#ff8a3d", "#ffe14d"])).domain([0, mxS]);
    C.forEach((c, j) => {
      const cx = lw + j * cw + cw / 2;
      svg.append("image").attr("href", fav(c.d)).attr("x", cx - 8).attr("y", hh - 24).attr("width", 16).attr("height", 16);
      T(svg, cx - 2, hh - 32, cut(c.d, mob ? 14 : 20), { c: c.me ? P.green : "#d6d9ff", fs: 10.5, fw: c.me ? 800 : 600 }).attr("transform", `rotate(-38,${cx - 2},${hh - 32})`);
    });
    Tp.forEach((t, i) => {
      const yy = hh + i * chh;
      T(svg, lw - 10, yy + chh / 2 - 1, cut(t.name, mob ? 15 : 26), { c: "#e6e8ff", fs: 11.5, fw: 600, a: "end" }).style("text-transform", "capitalize");
      T(svg, lw - 10, yy + chh / 2 + 11, short(t.clicks) + " clicks", { c: "#6a70a8", fs: 9, a: "end" });
      cell[i].forEach((z, j) => {
        const x0 = lw + j * cw + 2, r = svg.append("rect").attr("x", x0).attr("y", yy + 2).attr("width", cw - 4).attr("height", chh - 4).attr("rx", 7).attr("fill", "#15173a").attr("stroke", z.c.me ? P.green : "none").attr("stroke-width", z.c.me ? 1.5 : 0).style("cursor", "pointer");
        r.transition().duration(700).delay(i * 60 + j * 40).attr("fill", col(z.s));
        tip(r, () => `<b style="text-transform:capitalize">${esc(t.name)}</b>${tr("Site", esc(z.c.d), z.c.me ? P.green : null)}${tr("Clicks / mo", fmt(z.v))}${tr("Share of this topic", pc(z.s), P.gold)}${tr("Topic size", fmt(t.clicks) + " clicks")}`);
        const lum = d3.hsl(col(z.s)).l;
        T(svg, x0 + (cw - 4) / 2, yy + chh / 2 + 4, z.s >= .0005 ? pc(z.s) : "·", { c: lum > .6 ? "#120a1f" : "#e6e8ff", fs: 11, fw: 700, a: "middle" }).style("pointer-events", "none").attr("opacity", 0).transition().delay(500 + i * 60 + j * 40).attr("opacity", 1);
      });
    });
    const sc = document.createElement("div"); sc.className = "heatscale"; box.appendChild(sc);
    sc.innerHTML = `<span>0%</span><i style="background:linear-gradient(90deg,${[0, .2, .4, .6, .8, 1].map(f => col(f * mxS)).join(",")})"></i><span>${pc(mxS)} of a topic</span>`;
  }
  function storyHeat() {
    const { Tp, C, cell } = heatData(); if (!Tp.length) return null;
    const rows = Tp.map((t, i) => { const best = cell[i].slice().sort((a, b) => b.s - a.s)[0]; return { t, best, you: cell[i][0] }; });
    const open = rows.filter(r => r.best.s < .08), dom = rows.filter(r => r.best.s >= .25 && !r.best.c.me), mine = rows.filter(r => r.you.s > 0).sort((a, b) => b.you.s - a.you.s);
    const cnt = {}; rows.forEach(r => { if (r.best.v > 0) cnt[r.best.c.d] = (cnt[r.best.c.d] || 0) + 1; });
    const king = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    return {
      c: P.orange,
      read: `Rows are the biggest topic groups in this market; columns are you (outlined in green) and the six biggest competitors. Each cell is that site's share of the clicks in that topic. Dark cells mean the site is barely present; the hotter the color (purple, pink, orange, yellow) the more of that topic it owns. Hover any cell for the exact clicks.`,
      say: [
        king ? `${B(esc(king[0]), P.orange)} is the strongest presence across topics, holding the biggest share in ${plural(king[1], "of these " + Tp.length + " topics", "of these " + Tp.length + " topics")}.` : null,
        dom.length ? `Some topics are locked up: in ${and(dom.slice(0, 3).map(r => B(esc(r.t.name), P.pink) + ` (${esc(r.best.c.d)} ${pc(r.best.s)})`))}, one site takes a quarter or more of all clicks. Breaking in there means beating an entrenched page, so it's slower going.` : `No single site holds a quarter of any topic, so nobody has this market locked up.`,
        open.length ? `The cooler rows are the opportunity. In ${and(open.slice(0, 3).map(r => B(esc(r.t.name), P.lime)))}, no site takes more than 8% of the clicks. These are open fields where a focused set of pages can become the leader quickly.` : null,
        mine.length ? `Your strongest topic is ${B(esc(mine[0].t.name), P.green)} at ${pc(mine[0].you.s)} of its clicks.` : `Your column is empty for now, which is exactly why the cooler rows matter: they're the fastest place to put a first mark on the map.`,
      ],
      move: open.length ? `Claim the open fields first: pick the biggest cool row and build a small cluster (one main page plus three to five supporting pages) around it.` : `Pick the topic where the leader's share is lowest and build a deeper, better-linked cluster than theirs.`,
    };
  }

  /* =====================================================================
     12. Sankey: topics → sites
     ===================================================================== */
  let SK_ALL = false;
  function sankeyData() {
    const { topics, comps, topicComp } = D;
    const Tp = topics.filter(t => t.clicks > 0).slice().sort((a, b) => b.clicks - a.clicks);
    const left = Tp.slice(0, 7).map((t, j) => ({ name: t.name, ts: [t], c: RAINBOW[j] }));
    if (Tp.length > 7) left.push({ name: "other topics", ts: Tp.slice(7), c: P.slate });
    const right = [{ name: SCAN.domain, me: true, c: P.green }, ...comps.slice(0, 5).map((c, j) => ({ name: c.d, comp: c, c: SITEC[j] })), { name: "everyone else", rest: true, c: "#4a4f8a" }];
    const flows = [];
    left.forEach((L, li) => { const tot = sum(L.ts, t => t.clicks); let named = 0; right.forEach((Rn, ri) => { let v; if (Rn.me) v = sum(L.ts, t => t.yours); else if (Rn.rest) v = Math.max(0, tot - named); else v = sum(L.ts, t => topicComp(Rn.comp, t)); if (!Rn.rest) named += v; if (v > 0) flows.push({ li, ri, v }); }); });
    return { left, right, flows };
  }
  function drawSankey() {
    const all = sankeyData(), box = byId("vzSankey");
    const right = SK_ALL ? all.right : all.right.filter(r => !r.rest), ri = new Map(right.map((r, j) => [all.right.indexOf(r), j]));
    const flows = all.flows.filter(f => ri.has(f.ri)).map(f => ({ ...f, ri: ri.get(f.ri) })), left = all.left;
    left.forEach((L, i) => L.v = sum(flows.filter(f => f.li === i), f => f.v)); right.forEach((Rn, i) => Rn.v = sum(flows.filter(f => f.ri === i), f => f.v));
    const total = sum(flows, f => f.v);
    if (!total) { box.innerHTML = `<div class="vz-empty">None of the named sites rank for these topics in this scan. Switch to "all clicks" to see the whole market.</div>`; return; }
    const W0 = box.clientWidth || 800, mob = W0 < 600, H = Math.max(360, Math.max(left.length, right.length) * (mob ? 46 : 54)), { svg, W } = svgIn("vzSankey", H);
    const m = { l: mob ? 96 : 180, r: mob ? 92 : 180, t: 8, b: 8 }, nw = 12, pad = 10;
    const k = Math.min((H - m.t - m.b - pad * (left.length - 1)) / total, (H - m.t - m.b - pad * (right.length - 1)) / total);
    const stack = (arr) => { const used = sum(arr, a => Math.max(2, a.v * k)) + pad * (arr.length - 1); let y = m.t + (H - m.t - m.b - used) / 2; arr.forEach(a => { a.y0 = y; a.h = Math.max(2, a.v * k); a.off = y; y += a.h + pad; }); };
    stack(left); stack(right);
    const x0 = m.l, x1 = W - m.r - nw;
    flows.sort((a, b) => a.li - b.li || a.ri - b.ri).forEach(f => { f.h = Math.max(.8, f.v * k); f.ya = left[f.li].off; left[f.li].off += f.h; });
    flows.slice().sort((a, b) => a.ri - b.ri || a.li - b.li).forEach(f => { f.yb = right[f.ri].off; right[f.ri].off += f.h; });
    const xa = x0 + nw, xb = x1, xm = (xa + xb) / 2;
    const links = svg.append("g").selectAll("path").data(flows).enter().append("path")
      .attr("d", f => `M${xa},${f.ya}C${xm},${f.ya} ${xm},${f.yb} ${xb},${f.yb}L${xb},${f.yb + f.h}C${xm},${f.yb + f.h} ${xm},${f.ya + f.h} ${xa},${f.ya + f.h}Z`)
      .attr("fill", f => right[f.ri].c).attr("opacity", 0).style("mix-blend-mode", "screen").style("cursor", "pointer");
    const base = f => right[f.ri].rest ? .2 : .5;
    links.transition().duration(1100).delay(f => 200 + f.li * 70).attr("opacity", base);
    tip(links, f => `<b style="text-transform:capitalize">${esc(left[f.li].name)} → ${esc(right[f.ri].name)}</b>${tr("Clicks / mo", fmt(f.v), right[f.ri].c)}${tr("Share of this topic", pc(f.v / sum(left[f.li].ts, t => t.clicks)))}`);
    const hl = (fn) => links.attr("opacity", f => fn(f) ? .9 : .05), reset = () => links.attr("opacity", base);
    links.on("pointerenter", (e, f) => hl(z => z === f)).on("pointerleave.r", () => { reset(); tipOff(); });
    left.forEach((L, i) => {
      const g = svg.append("g").style("cursor", "pointer").on("pointerenter", () => hl(f => f.li === i)).on("pointerleave", reset);
      g.append("rect").attr("x", x0).attr("y", L.y0).attr("width", nw).attr("height", L.h).attr("rx", 3).attr("fill", L.c).style("filter", glow(L.c));
      T(g, x0 - 8, L.y0 + L.h / 2 + 1, cut(L.name, mob ? 13 : 22), { c: "#e6e8ff", fs: mob ? 10 : 11.5, fw: 600, a: "end" }).style("text-transform", "capitalize");
      T(g, x0 - 8, L.y0 + L.h / 2 + 13, short(L.v), { c: L.c, fs: 9.5, fw: 700, a: "end" });
    });
    right.forEach((Rn, i) => {
      const g = svg.append("g").style("cursor", "pointer").on("pointerenter", () => hl(f => f.ri === i)).on("pointerleave", reset);
      g.append("rect").attr("x", x1).attr("y", Rn.y0).attr("width", nw).attr("height", Rn.h).attr("rx", 3).attr("fill", Rn.c).style("filter", glow(Rn.c));
      T(g, x1 + nw + 8, Rn.y0 + Rn.h / 2 + 1, cut(Rn.name, mob ? 12 : 22) + (Rn.me && !mob ? " (you)" : ""), { c: Rn.me ? P.green : "#e6e8ff", fs: mob ? 10 : 11.5, fw: Rn.me ? 800 : 600 });
      T(g, x1 + nw + 8, Rn.y0 + Rn.h / 2 + 13, short(Rn.v) + " · " + pc(Rn.v / total), { c: Rn.c, fs: 9.5, fw: 700 });
    });
    document.querySelectorAll("#skMode button").forEach(b => { b.classList.toggle("on", (b.dataset.v === "all") === SK_ALL); b.onclick = () => { SK_ALL = b.dataset.v === "all"; drawSankey(); }; });
  }
  function storySankey() {
    const { left, right, flows } = sankeyData(); if (!flows.length) return null;
    const tot = sum(flows, f => f.v), named = flows.filter(f => !right[f.ri].rest), nt = sum(named, f => f.v);
    const big = named.slice().sort((a, b) => b.v - a.v)[0];
    const reach = right.filter(r => !r.rest && !r.me).map((r, j) => ({ r, n: new Set(named.filter(f => right[f.ri] === r).map(f => f.li)).size })).sort((a, b) => b.n - a.n)[0];
    const youF = named.filter(f => right[f.ri].me).sort((a, b) => b.v - a.v);
    return {
      c: P.purple,
      read: `This is the market as a river. On the left are the topic groups, sized by the clicks people make; on the right are the sites those clicks flow to. Each ribbon is one topic feeding one site, and its thickness is the number of clicks. Hover a topic or a site to isolate its ribbons. By default the chart shows only the named sites; switch to "all clicks" to include the long tail of everyone else.`,
      say: [
        `Of the ${fmt(tot)} clicks a month flowing through these topics, the six named sites (you plus the five biggest competitors) collect ${B(pc(nt / (tot || 1)), P.purple)}. ${nt / (tot || 1) < .35 ? "The rest scatters across dozens of smaller sites, which is another sign that this market is still up for grabs." : "That's a concentrated market: a few sites are catching most of the traffic."}`,
        big ? `The single thickest ribbon is ${B(esc(left[big.li].name), left[big.li].c)} → ${B(esc(right[big.ri].name), right[big.ri].c)}, worth ${fmt(big.v)} clicks a month.` : null,
        reach && reach.n ? `${B(esc(reach.r.name), reach.r.c)} has the widest reach, collecting clicks from ${plural(reach.n, "topic")} on the left. Wide reach like that usually comes from a big library of interlinked content.` : null,
        youF.length ? `Your biggest stream is ${B(esc(left[youF[0].li].name), P.green)}, at ${fmt(youF[0].v)} clicks a month. ${youF.length < left.length / 2 ? `You draw from only ${plural(youF.length, "topic")}, so most rivers bypass you entirely.` : ""}` : `No ribbon reaches ${D.dom} yet. Every one of these flows is a stream you could divert.`,
      ],
      move: `Pick one thick ribbon that flows to a competitor and study the page receiving it: what it covers, how deep it goes, who links to it. Then build the better version.`,
    };
  }

  /* =====================================================================
     13. Treemap: topics → searches, colored by your ranking
     ===================================================================== */
  let TM = null;
  function drawTree() {
    const box = byId("vzTree"), { topics, it, hasVal } = D, val = x => hasVal ? x.mkVal : x.mk;
    const T0 = topics.map(t => ({ t, v: sum(t.idx.map(i => it[i]), val) })).filter(o => o.v > 0).sort((a, b) => b.v - a.v).slice(0, 12);
    const kids = t => t.idx.map(i => ({ x: it[i], v: val(it[i]) })).filter(c => c.v > 0);
    const focus = TM && topics.find(t => t.name === TM);
    const data = focus ? { children: [{ name: focus.name, j: Math.max(0, T0.findIndex(o => o.t === focus)), children: kids(focus) }] } : { children: T0.map((o, j) => ({ name: o.t.name, j, children: kids(o.t) })) };
    const W0 = box.clientWidth || 700, H = W0 < 700 ? 440 : 500, { svg, W } = svgIn("vzTree", H);
    const root = d3.hierarchy(data).sum(d => d.v || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H]).paddingOuter(2).paddingTop(d => d.depth === 1 ? 22 : 2).paddingInner(2).round(true)(root);
    const tc = d => RAINBOW[d.data.j % RAINBOW.length];
    root.children && root.children.forEach(g1 => {
      const c = tc(g1), w = g1.x1 - g1.x0;
      svg.append("rect").attr("x", g1.x0).attr("y", g1.y0).attr("width", w).attr("height", g1.y1 - g1.y0).attr("rx", 6).attr("fill", c).attr("fill-opacity", .1).attr("stroke", c).attr("stroke-opacity", .7).style("cursor", focus ? "default" : "zoom-in").on("click", () => { if (!focus) { TM = g1.data.name; drawTree(); } });
      if (w > 46) T(svg, g1.x0 + 7, g1.y0 + 15, cut(g1.data.name.toUpperCase(), Math.floor((w - 14) / 7.4)), { c, fs: 10.5, fw: 800 });
      if (w > 170) T(svg, g1.x1 - 7, g1.y0 + 15, hasVal ? money(g1.value) : short(g1.value) + " clicks", { c: "#d6d9ff", fs: 10, a: "end" });
    });
    const lv = svg.append("g").selectAll("g").data(root.leaves()).enter().append("g").attr("transform", d => `translate(${d.x0},${d.y0})`).style("cursor", focus ? "default" : "zoom-in");
    lv.append("rect").attr("width", d => Math.max(0, d.x1 - d.x0)).attr("height", d => Math.max(0, d.y1 - d.y0)).attr("rx", 3).attr("fill", d => ST[d.data.x.st]).attr("opacity", 0)
      .transition().duration(700).delay((d, i) => Math.min(i, 200) * 4).attr("opacity", d => d.data.x.st === "none" ? .62 : .92);
    lv.each(function (d) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0; if (w < 64 || h < 26) return;
      const g = d3.select(this), x = d.data.x;
      T(g, 5, 14, cut(x.k, Math.floor((w - 8) / 6.3)), { c: "#0b0a1f", fs: 10.5, fw: 700, ff: SANS });
      if (h > 38) T(g, 5, 27, (hasVal ? money(val(x)) : fmt(x.mk) + " clicks") + (x.p ? " · #" + x.p : ""), { c: "#0b0a1f", fs: 9.5, fw: 600 }).attr("opacity", .8);
    });
    tip(lv, d => { const x = d.data.x; return `<b>${esc(x.k)}</b>${tr("Topic", esc(x.topic || ""))}${tr("Searches / mo", fmt(x.v))}${tr("Market clicks / mo", fmt(x.mk))}${hasVal ? tr("Click value / mo", money(x.mkVal)) : ""}${tr("You", x.p ? "#" + x.p : "not ranking", ST[x.st])}${x.pot ? tr("On the table", "+" + fmt(x.pot) + " visits", P.gold) : ""}`; });
    lv.on("click", (e, d) => { if (!focus) { TM = d.parent.data.name; drawTree(); } });
    const cr = byId("tmCrumb");
    cr.innerHTML = focus ? `<button class="btn sm" id="tmBack">← All topics</button><span>Zoomed into <b style="text-transform:capitalize">${esc(focus.name)}</b> · ${plural(kids(focus).length, "search", "searches")}</span>` : `<span>Tap a topic to zoom in · tile size = ${hasVal ? "click value" : "market clicks"} · color = your ranking</span>`;
    const bk = byId("tmBack"); if (bk) bk.onclick = () => { TM = null; drawTree(); };
  }
  function storyTree() {
    const { topics, it, hasVal } = D, val = x => hasVal ? x.mkVal : x.mk, tot = sum(it, val) || 1;
    const ts = topics.map(t => { const xs = t.idx.map(i => it[i]); const v = sum(xs, val); return { t, v, pink: sum(xs.filter(x => x.st === "none"), val) / (v || 1), green: sum(xs.filter(x => x.st === "top" || x.st === "page1"), val) / (v || 1) }; }).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
    if (!ts.length) return null;
    const big = ts[0], pinkest = ts.slice(0, 8).sort((a, b) => b.pink * b.v - a.pink * a.v)[0], greenest = ts.slice().sort((a, b) => b.green - a.green)[0], allPink = sum(it.filter(x => x.st === "none"), val) / tot;
    return {
      c: P.teal,
      read: `The whole market as a map. Each outlined block is a topic group and each tile inside it is one search, sized by ${hasVal ? "what its clicks are worth at ad prices" : "the clicks it gets each month"}. Tile color shows where you rank, using the same colors as the rest of the report: green and cyan are yours, gold is page two, violet is deeper, and pink is searches where you don't appear. Tap any block to zoom into that topic.`,
      say: [
        `The biggest block is ${B(esc(big.t.name), P.teal)}, holding ${B(pc(big.v / tot), P.teal)} of the market's ${hasVal ? "value" : "clicks"} on its own.`,
        `Overall, ${B(pc(allPink), P.pink)} of the map is pink. ${allPink > .7 ? "That's a lot of territory nobody has claimed for you yet, and it's the clearest picture of how much room there is to grow." : allPink > .4 ? "There's a healthy mix: you have a foothold, with plenty of unclaimed ground around it." : "Most of the map already has your color on it, so growth now means climbing higher, not spreading wider."}`,
        pinkest && pinkest.pink > .5 ? `${B(esc(pinkest.t.name), P.pink)} is the biggest mostly-pink block (${pc(pinkest.pink)} untapped), which makes it a strong candidate for your next content cluster.` : null,
        greenest && greenest.green > .1 ? `Your best-covered topic is ${B(esc(greenest.t.name), P.green)}, where ${pc(greenest.green)} of the value sits on page one for you. Use it as a hub to link out into the neighbouring pink blocks.` : null,
      ],
      move: pinkest ? `Zoom into ${q(pinkest.t.name)} and list its five biggest pink tiles. That list is your next month of content.` : "",
    };
  }

  /* =====================================================================
     Stories for the charts that were already in the report
     ===================================================================== */
  function storyExec() {
    const { Rr, S, ex, full, lead, n, strike, untapped, hasVal } = D, share = Rr.market.clicks ? Rr.you.clicks / Rr.market.clicks : 0;
    const qw = D.it.filter(x => D.quad(x) === "qw" && x.pot > 0).length;
    return {
      cls: "exec", c: P.lime, k: "The story in 60 seconds",
      say: [
        `Here's the short version for ${D.dom}. People run about ${B(fmt(Rr.searches), P.cyan)} searches a month across the ${B(fmt(n))} distinct searches in this market${S.keyword ? ` around ${q(S.keyword)}` : ""}${S.location.region ? ` in ${esc(S.location.region)}` : ""}. Together they send roughly ${B(fmt(Rr.market.clicks), P.cyan)} organic clicks a month to the websites Google ranks${hasVal ? `, traffic that would cost ${B(money(Rr.market.value), P.gold)} a month to buy as ads` : ""}.`,
        `${D.dom} earns about ${B(fmt(Rr.you.clicks), P.green)} of those clicks, or ${B(pc(share), P.green)} of the market. ${lead ? `The biggest winner is ${B(esc(lead.d), P.pink)}, with ${pc(lead.share)} of the clicks we measured.` : ""} ${Rr.you.clicks < 1 ? "Right now you're effectively invisible here, so everything in this report is upside." : share < .02 ? "In practical terms you're a bit player: the demand is real, it's just going to other sites." : share < .1 ? "You're in the game, but not yet one of the names people see first." : "You're already one of the names people see, so the job is defending and extending that lead."}`,
        `The good news is in the detail. ${strike.length ? `${B(plural(strike.length, "search", "searches"), P.gold)} already rank between #4 and #20, close enough that better content and a few links can lift them into the top 3. ` : ""}${B(plural(untapped.length, "search", "searches"), P.pink)} have no meaningful ranking from you at all${qw ? `, and ${B(fmt(qw), P.lime)} of those are quick wins: decent volume, low difficulty` : ""}. Put it together and the expected 12-month plan adds ${B("+" + fmt(ex.gain) + " visits a month", P.gold)}${hasVal && ex.gainVal ? ` (about ${money(ex.gainVal)} a month in click value)` : ""}, with a ceiling of roughly ${B(fmt(full), P.purple)} visits a month if you reached the top 3 everywhere.`,
      ],
      mk: "Start here",
      move: strike.length >= 3 ? `The striking-distance list in the opportunity map. Those ${plural(Math.min(12, strike.length), "page")} are the fastest, cheapest wins in this report.` : qw ? `The quick wins in the opportunity matrix: real volume, low difficulty, and no giant to dislodge.` : `The biggest untapped topic in the treemap. Build the best page on the internet for it, then support it with smaller pages.`,
    };
  }
  function storyLadder() {
    const { Rr, ex, full, bp } = D, base = Rr.you.clicks, e12 = ex.months[12].clicks, L = Rr.comps.find(c => c.type === "direct") || Rr.comps[0], lc = L ? L.clicks / bp : 0;
    return {
      c: P.gold,
      read: `Four bars on one scale. Green is the traffic you get from this market today. Gold is where the expected plan puts you after a year. Red is the current market leader. The striped bar is the ceiling: what you'd get from an average top-3 position on every single search.`,
      say: [
        L ? `${B(esc(L.d), P.red)} pulls in about ${B(fmt(lc), P.red)} visits a month from these searches${base >= 1 && times(lc / base) ? `, ${B(times(lc / base), P.red)} what you get today` : base < 1 ? ", while you're starting from close to zero" : ""}. That's the benchmark to measure yourself against.` : null,
        L ? (e12 >= lc ? `The good news: twelve months on the expected plan (${B(fmt(e12), P.gold)} visits a month) would put you level with or ahead of today's leader. Of course, they won't stand still, which is why the plan needs to keep moving after month 12.` : `Twelve months on the expected plan gets you to ${B(fmt(e12), P.gold)} visits a month, closing ${pc(Math.max(0, (e12 - base) / Math.max(1, lc - base)))} of the gap to the leader. Catching them fully is a two to three year project, not a quarter.`) : null,
        `The striped bar (${B(fmt(full), P.gold)}) is much longer for a reason. Reaching the top 3 on every search is the theoretical ceiling, not a forecast; it's the honest size of the prize.`,
      ],
    };
  }
  function storyShare() {
    const { Rr, comps } = D, top5 = comps.slice(0, 5), t5 = sum(top5, c => c.share), lead = comps[0], plat = top5.filter(c => c.platform || c.type === "directory" || c.type === "media");
    return {
      c: P.red,
      read: `One bar equals 100% of the organic clicks in this market${Rr.basis.local ? ` (measured on the ${Rr.basis.n} most valuable searches, checked live from ${D.where}, including the map pack)` : ""}. Green is your slice, the warm colors are the five biggest competitors, and the dark slate at the end is everyone else combined.`,
      say: [
        lead ? (t5 < .3 ? `This is a ${B("fragmented", P.lime)} market. The five biggest sites together take only ${B(pc(t5), P.red)} of the clicks, so nobody owns it. Fragmented markets are the easiest to break into: there's no giant to dislodge, just a crowd to outwork.` : lead.share > .25 ? `One site dominates. ${B(esc(lead.d), P.red)} alone takes ${B(pc(lead.share), P.red)} of the clicks. Taking share from a dominant player means beating their best pages head to head, so pick your battles in the topics where they're weakest.` : `A handful of sites share the top. The five biggest take ${B(pc(t5), P.red)} together, with ${esc(lead.d)} leading at ${pc(lead.share)}. That's a competitive market, but not a locked one.`) : null,
        plat.length ? `${B(plural(plat.length, "of the top five is", "of the top five are"), P.orange)} directories, platforms or media sites (${and(plat.map(c => esc(c.d)))}). You won't outrank them on every search, but you can usually beat them when the searcher wants a specific provider rather than a list.` : null,
        `Your own slice is ${B(pc(Rr.you.share), P.green)}. ${Rr.you.share < .01 ? "It's barely a sliver today; the charts below show exactly where to start widening it." : ""}`,
      ],
    };
  }
  function ctrGain(t) { let g = 0, v = 0, n = 0; D.it.forEach(x => { const d = x.v * x.f * (ctr(t) - ctr(x.p)); if (d > 0) { g += d; v += d * (x.c || 0); n++; } }); return { g, v, n }; }
  function storyProj() {
    const { SC, Rr } = D, s = SC.exp, base = Rr.you.clicks, m3 = s.months[3].clicks - base, m6 = s.months[6].clicks - base;
    return {
      c: P.gold,
      read: `The gold line is your monthly traffic over the next year on the chosen scenario, starting from today's level (the dotted green line). The two faint dashed lines are the other scenarios, so you can see the range. Switch scenarios above the chart; hover or tap the line for any month's numbers.`,
      say: [
        `The three scenarios bracket what's realistic. ${SC.cons.gain < 1 ? `${B("Conservative", P.cyan)} adds nothing here, because it only nudges pages already ranking #4 to #20 and you don't have any yet.` : `${B("Conservative", P.cyan)} adds ${B("+" + fmt(SC.cons.gain), P.cyan)} visits a month by only nudging pages you already rank.`} ${B("Expected", P.gold)} adds ${B("+" + fmt(SC.exp.gain), P.gold)} by getting striking-distance pages into the top 3 and winning the easier untapped searches. ${B("Aggressive", P.pink)} adds ${B("+" + fmt(SC.agg.gain), P.pink)}, which assumes strong execution and a fair amount of luck.`,
        `Notice the shape: flat at first, steep in the middle, then levelling off. SEO doesn't move in a straight line. Improved pages take weeks to be recrawled and re-evaluated, so on the expected plan month three only shows about ${B("+" + fmt(m3), P.gold)}, month six about ${B("+" + fmt(m6), P.gold)}, and most of the gain lands in the second half of the year. Knowing that up front stops good work from being abandoned too early.`,
      ],
      move: `Judge progress at the six-month mark against the expected line, not week to week. Rankings for individual pages are a better early signal than total traffic.`,
    };
  }
  function storyCtr() {
    const g1 = ctrGain(1), g3 = ctrGain(3), g5 = ctrGain(5), g10 = ctrGain(10);
    return {
      c: P.gold, k: "Why position matters so much",
      read: `The bars on the left are the share of searchers who click each organic position on page one. Drag the slider to imagine you reached that position on every search in this market; the numbers underneath show the extra traffic. The panel on the right breaks the selected 12-month scenario into where its growth comes from.`,
      say: [
        `The curve is brutally steep. The #1 result gets about ${B("22%", P.gold)} of clicks, #3 gets 9%, and #10 gets 1.5%. Page two gets well under 1% per spot. Moving from #8 to #3 roughly quadruples a page's traffic without a single extra searcher.`,
        `For this market, reaching #10 everywhere would add ${B("+" + fmt(g10.g), P.cyan)} visits a month, #5 would add ${B("+" + fmt(g5.g), P.cyan)}, #3 would add ${B("+" + fmt(g3.g), P.gold)}, and #1 would add ${B("+" + fmt(g1.g), P.gold)}${g1.v ? ` (${money(g1.v)} a month in click value)` : ""}. Every step up the page is worth more than the last.`,
      ],
      move: `When choosing between "rank somewhere for a new search" and "move an existing page from #6 to #2", the second is often worth more. Check both columns before you plan the month.`,
    };
  }
  function storyUni() {
    const it = D.it, cnt = s => it.filter(x => x.st === s).length, mine = cnt("top") + cnt("page1");
    const bigMiss = it.filter(x => x.st === "none").sort((a, b) => b.mk - a.mk)[0], tops = {}; it.filter(x => x.st === "none").forEach(x => tops[x.topic] = (tops[x.topic] || 0) + 1);
    const tt = Object.entries(tops).sort((a, b) => b[1] - a[1])[0];
    return {
      c: P.cyan,
      read: `Every bubble is one real search, grouped into topic clusters and sized by ${"visits or click value (toggle above)"}. Bright filled bubbles are searches you rank for; the dark ones with a gold rim are searches where you don't appear. Use the filters to show only untapped searches or only yours, and hover any bubble for details.`,
      say: [
        `Of ${fmt(it.length)} searches, ${B(fmt(mine), P.green)} put you on page one, ${B(fmt(cnt("close")), P.gold)} sit on page two, ${B(fmt(cnt("far")), P.violet)} are deeper, and ${B(fmt(cnt("none")), P.pink)} are untapped. Flip the filter to "Untapped" and watch how much of the universe lights up: that's the territory still available.`,
        bigMiss ? `The largest dark bubble is ${q(bigMiss.k)}, with about ${fmt(bigMiss.mk)} clicks a month going entirely to other sites. ${tt ? `The cluster with the most untapped bubbles is ${B(esc(tt[0]), P.cyan)} (${plural(tt[1], "search", "searches")}).` : ""}` : null,
      ],
    };
  }
  function storyComp() {
    const { comps, Rr } = D, ty = c => c.type || (c.platform ? "directory" : null), top = comps.slice(0, 10);
    const direct = top.filter(c => ty(c) === "direct").length, dirs = top.filter(c => ty(c) === "directory").length, media = top.filter(c => ty(c) === "media").length;
    const thief = comps.slice(0, 10).sort((a, b) => b.ownClicks - a.ownClicks)[0];
    return {
      c: P.red,
      read: `The list ranks the sites taking clicks in this market, with you slotted in at your actual position. The bar shows each site's monthly visits from these searches; the right-hand column shows their share of clicks and how many searches they hold on page one where you don't. The donut shows the same split visually, with your share in the center.`,
      say: [
        `${Rr.you.bClicks > 0 ? `You rank ${B("#" + Rr.you.rank, P.green)} by clicks among the sites we found.` : `You don't register among these sites yet.`} ${direct || dirs || media ? `Of the top ten, ${and([direct && plural(direct, "is a direct competitor", "are direct competitors"), dirs && plural(dirs, "is a directory or platform", "are directories or platforms"), media && plural(media, "is a media site", "are media sites")].filter(Boolean))}.` : ""}`,
        thief && thief.own ? `${B(esc(thief.d), P.pink)} holds the most ground you don't: ${B(plural(thief.own, "search", "searches"), P.pink)} where it's on page one and you aren't, worth about ${fmt(thief.ownClicks)} clicks a month. That's the site to study first.` : null,
      ],
      move: thief && thief.own ? `Open ${esc(thief.d)} and look at the pages ranking for those searches. Note their length, structure and the questions they answer, then build something more useful.` : "",
    };
  }
  function storySerp() {
    const S = SCAN.serps || []; if (!S.length) return null;
    const lp = S.filter(s => s.lp && s.lp.length).length, ai = S.filter(s => s.ai).length, ads = sum(S, s => s.ads || 0), you10 = S.filter(s => s.you && s.you <= 10).length, youLp = S.filter(s => s.youLp).length;
    return {
      c: P.cyan,
      read: `These are real Google results, checked live from ${D.where}, for the most valuable searches in this market. Each card lists the map pack (if one shows) and the top organic results, with your position at the bottom.`,
      say: [
        `Of the ${S.length} searches checked, ${B(plural(lp, "shows", "show"), P.cyan)} a local map pack${youLp ? ` and you appear in ${plural(youLp, "of them", "of them")}` : ", and you're not in any of them yet"}. ${ai ? `${B(plural(ai, "shows", "show"), P.purple)} an AI Overview at the top of the page, which pushes organic results further down.` : ""} ${ads ? `Advertisers are paying for ${plural(ads, "ad slot")} across these searches, which is a good sign the traffic converts.` : ""}`,
        `You're on page one for ${B(fmt(you10), P.green)} of them. ${lp && !youLp ? "When a map pack shows, it takes a big share of clicks before anyone reaches the organic results, so your Google Business Profile matters as much as your website here." : ""}`,
      ],
      move: lp && !youLp ? `Tighten your Google Business Profile: primary category, service list, photos, and a steady flow of reviews that mention the service and the town.` : "",
    };
  }
  function storyTopics() {
    const { topics } = D, top = topics.slice(0, 3), leaderless = topics.filter(t => !t.lead || t.leadShare < .1).length;
    return {
      c: P.teal,
      read: `Each card is a cluster of related searches. The big gold number is the extra traffic a month you'd get reaching the top 3 across that cluster. The bar underneath shows your share of the topic's clicks (green) against the current leader's (red).`,
      say: [
        top.length ? `The three richest topics are ${and(top.map(t => B(esc(t.name), P.teal) + ` (+${fmt(t.pot)})`))}. Topics are the right unit for planning content: one strong hub page plus a handful of supporting pages beats a pile of disconnected posts.` : null,
        leaderless ? `${B(plural(leaderless, "topic has", "topics have"), P.lime)} no clear leader (no site above 10% of the clicks). Those are the easiest places to become the default answer.` : null,
      ],
    };
  }
  function storyTable() {
    const it = D.it, all = it.filter(x => x.pot > 0).length, close = it.filter(x => x.p && x.p > 3 && x.p <= 20).length, none = it.filter(x => !x.p || x.p > 20).length, mine = it.filter(x => x.p && x.p <= 3).length;
    return {
      c: P.lime, k: "How to use this list",
      read: `This is the working list behind every chart above. Click any column header to sort. "You" is your current position, "#1 right now" is the site to beat, and the last two columns are what reaching the top 3 would add. Difficulty runs from 0 (easy) to 100 (very hard), and CPC is what advertisers pay per click, a good proxy for how commercially valuable a search is.`,
      say: [
        `The tabs slice it four ways: ${B(fmt(all), P.gold)} searches with traffic still on the table, ${B(fmt(close), P.gold)} in striking distance, ${B(fmt(none), P.pink)} you don't rank for yet, and ${B(fmt(mine), P.green)} where you're already top 3 and need to defend.`,
      ],
      move: `Sort "Striking distance" by "+ Visits/mo" and take the top ten. That's a complete, prioritised to-do list for the next 60 days.`,
    };
  }
  function storyOvr() {
    const { Rr, SC, topics } = D, now = simulate(Rr), e = simulate(Rr, SC.exp.pos, SC.exp.pk);
    return {
      c: P.pink, k: "The bottom line",
      say: [
        `Today ${D.dom} has ${B(fmt(now.kw3), P.green)} searches in the top 3 and leads ${B(fmt(now.led), P.green)} of ${fmt(topics.length)} topic groups. On the expected plan that becomes ${B(fmt(e.kw3), P.gold)} top-3 searches and ${B(fmt(e.led), P.gold)} topics led, lifting your market share from ${pc(now.share)} to ${B(pc(e.share), P.gold)}.`,
        `Every number in this report comes from the same simple model: real search volumes, your real rankings, and how often people click each position. It isn't a guarantee, but it's an honest, consistent way to size the opportunity and to measure progress against it. Rerun the scan in three months and compare.`,
      ],
    };
  }

  /* ---------- registry ---------- */
  const CH = [
    ["vzGauges", drawGauges, "st-gauges", storyGauges], ["vzLorenz", drawLorenz, "st-lorenz", storyLorenz], ["vzSun", drawSun, "st-sun", storySun], ["vzTail", drawTail, "st-tail", storyTail],
    ["vzHist", drawHist, "st-hist", storyHist], ["vzPages", drawPages, "st-pages", storyPages], ["vzMatrix", drawMatrix, "st-matrix", storyMatrix], ["vzLaunch", drawLaunch, "st-launch", storyLaunch],
    ["vzWater", drawWaterfall, "st-water", storyWater], ["vzRadar", drawRadar, "st-radar", storyRadar], ["vzHeat", drawHeat, "st-heat", storyHeat], ["vzSankey", drawSankey, "st-sankey", storySankey], ["vzTree", drawTree, "st-tree", storyTree],
  ];
  const TEXT = [["st-exec", storyExec], ["st-ladder", storyLadder], ["st-share", storyShare], ["st-proj", storyProj], ["st-ctr", storyCtr], ["st-uni", storyUni], ["st-comp", storyComp], ["st-serp", storySerp], ["st-topics", storyTopics], ["st-table", storyTable], ["st-ovr", storyOvr]];
  let IO, drawn = new Set();
  function drawOne(id) {
    const c = CH.find(z => z[0] === id); if (!c || !byId(id)) return;
    try { c[1](); } catch (e) { console.error("chart " + id, e); byId(id).innerHTML = `<div class="vz-empty">This chart couldn't be drawn for this scan.</div>`; }
  }
  function writeStories() {
    [...CH.map(c => [c[2], c[3]]), ...TEXT].forEach(([id, fn]) => { try { story(id, fn()); } catch (e) { console.error("story " + id, e); story(id, null); } });
  }
  function render() {
    if (!SCAN || !R) return;
    D = derive(); drawn = new Set(); QF = null; TM = null; RHIDE = new Set(); SK_ALL = false;
    byId("rowPages").style.display = pageData().length ? "" : "none";
    writeStories();
    if (IO) IO.disconnect();
    if (!("IntersectionObserver" in window)) { CH.forEach(c => { drawn.add(c[0]); drawOne(c[0]); }); return; }
    IO = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting || drawn.has(e.target.id)) return; drawn.add(e.target.id); drawOne(e.target.id); IO.unobserve(e.target); }), { rootMargin: "0px 0px -6% 0px", threshold: .08 });
    CH.forEach(c => { const el = byId(c[0]); if (el) { el.innerHTML = ""; IO.observe(el); } });
    chapNav();
  }
  function drawAll() { if (!D) return; CH.forEach(c => { if (!drawn.has(c[0])) { drawn.add(c[0]); drawOne(c[0]); } }); }

  /* ---------- chapter nav ---------- */
  let NIO;
  function chapNav() {
    const links = [...document.querySelectorAll("#chapnav a")];
    links.forEach(a => { const t = byId(a.getAttribute("href").slice(1)); a.style.display = t && t.offsetParent !== null ? "" : "none"; a.onclick = e => { e.preventDefault(); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }; });
    if (NIO) NIO.disconnect();
    if (!("IntersectionObserver" in window)) return;
    NIO = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); const on = links.find(a => a.classList.contains("on")); if (on && on.parentElement.scrollTo) on.parentElement.scrollTo({ left: on.offsetLeft - 20, behavior: "smooth" }); }), { rootMargin: "-30% 0px -60% 0px" });
    links.forEach(a => { const t = byId(a.getAttribute("href").slice(1)); if (t) NIO.observe(t); });
  }

  /* ---------- hooks ---------- */
  const _show = window.showResults;
  window.showResults = function (instant) { _show(instant); setTimeout(() => { try { render(); } catch (e) { console.error("insights", e); } }, 90); };
  let lastW = innerWidth, rT;
  addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) < 40) return; lastW = innerWidth; clearTimeout(rT); rT = setTimeout(() => { if (!D || !$("#results").classList.contains("on")) return; drawn.forEach(id => drawOne(id)); }, 260); });
  addEventListener("beforeprint", drawAll);
  window.INSIGHTS = { render, drawAll };
})();
