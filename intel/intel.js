"use strict";
/* Site Intel layer (v4)
   Adds the data steps and charts that turn the traffic-gap scan into a full site intel report:
   ranking history and momentum, backlink profile, technology stack, domain age (Whois),
   SERP features, AI visibility (ChatGPT and Claude), an AI SWOT brief, an optional site crawl,
   and an intel scorecard. Loads after app.js and insights.js. */
(() => {
  const H = INSIGHTS.H;
  const { P, sum, pc, cut, B, q, and, times, plural, byId, tipOn, tipOff, tr, tip, svgIn, T, grad, glow, story, tc, MONO, SANS } = H;

  /* =====================================================================
     DATA STEPS (added to the scan pipeline in app.js)
     ===================================================================== */
  const EPX = {
    hist: "dataforseo_labs/google/historical_rank_overview/live", bl: "backlinks/summary/live",
    tech: "domain_analytics/technologies/domain_technologies/live", whois: "domain_analytics/whois/overview/live",
    crawlPost: "on_page/task_post", crawlSum: "on_page/summary/", crawlPages: "on_page/pages",
  };
  const CRAWL_PAGES = 100;

  RUN.crawlq = async () => {
    const S = SCAN;
    await call(EPX.crawlPost, { target: S.domain, max_crawl_pages: CRAWL_PAGES, load_resources: false, enable_javascript: false, store_raw_html: false }, `Site crawl queued (up to ${CRAWL_PAGES} pages)`);
    const id = call.lastId;
    S.crawl = { id: id || null, max: CRAWL_PAGES };
    if (id) log("✓ crawler is on its way · it keeps working while the rest of the scan runs", "ok");
    else log("  the crawler couldn't start, so site health will be skipped", "w");
  };

  RUN.intel = async () => {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG };
    const d = new Date(); d.setMonth(d.getMonth() - 24);
    const [h, bl, te, wh] = await Promise.all([
      call(EPX.hist, { target: S.domain, ...L, date_from: d.toISOString().slice(0, 10) }, "Ranking history (24 months)"),
      call(EPX.bl, { target: S.domain, include_subdomains: true, internal_list_limit: 12, backlinks_status_type: "live" }, "Backlink profile"),
      call(EPX.tech, { target: S.domain }, "Technology stack"),
      call(EPX.whois, { filters: [["domain", "=", S.domain]], limit: 1 }, "Domain Whois")]);
    const I = S.intel = {};
    const hi = (h?.[0]?.items || []).map(x => { const m = x.metrics?.organic || {}; return { y: x.year, m: x.month, etv: Math.round(m.etv || 0), n: m.count || 0, p1: m.pos_1 || 0, p3: m.pos_2_3 || 0, p10: m.pos_4_10 || 0, p20: m.pos_11_20 || 0, nw: m.is_new || 0, up: m.is_up || 0, dn: m.is_down || 0, lo: m.is_lost || 0 }; }).filter(x => x.y).sort((a, b) => a.y - b.y || a.m - b.m);
    if (hi.length) { I.hist = hi; log(`✓ ${hi.length} months of ranking history`, "ok"); }
    const b = bl?.[0];
    if (b && b.backlinks != null) {
      I.bl = { rank: b.rank ?? null, bl: b.backlinks || 0, rd: b.referring_domains || 0, rdn: b.referring_domains_nofollow || 0, rmd: b.referring_main_domains || 0, ips: b.referring_ips || 0, sub: b.referring_subnets || 0, bb: b.broken_backlinks || 0, bp: b.broken_pages || 0, spam: b.backlinks_spam_score ?? null, first: b.first_seen || null, ext: b.external_links_count || 0, int: b.internal_links_count || 0, tld: b.referring_links_tld || {}, types: b.referring_links_types || {}, attrs: b.referring_links_attributes || {}, plat: b.referring_links_platform_types || {}, sem: b.referring_links_semantic_locations || {}, ctry: b.referring_links_countries || {} };
      log(`✓ ${fmt(I.bl.rd)} referring domains · ${fmt(I.bl.bl)} backlinks`, "ok");
    }
    const t = te?.[0];
    if (t) { I.tech = { tech: t.technologies || {}, title: t.title || "", desc: t.description || "", dr: t.domain_rank ?? null, country: t.country_iso_code || "", lang: t.language_code || "", social: (t.social_graph_urls || []).length, phones: (t.phone_numbers || []).length, emails: (t.emails || []).length }; log(`✓ ${techCount(I.tech.tech)} technologies detected`, "ok"); }
    const w = wh?.[0]?.items?.[0];
    if (w) { I.whois = { created: w.created_datetime || null, updated: w.updated_datetime || w.changed_datetime || null, expires: w.expiration_datetime || null, registrar: w.registrar || "", first: w.first_seen || null, epp: (w.epp_status_codes || []).slice(0, 4) }; if (I.whois.created) log(`✓ domain registered ${String(I.whois.created).slice(0, 10)}`, "ok"); }
  };

  RUN.aivis = async () => {
    const S = SCAN, svc = [...(S.ai?.services || []), ...(S.seeds || [])].filter(Boolean);
    const where = S.location.region ? " in " + (S.location.city || S.location.region) : "";
    let qs = null;
    const j = await aiTask("questions", { domain: S.domain, business: S.ai?.biz || "", services: svc.slice(0, 5), serves: S.location.label }, "Claude: questions buyers ask AI assistants");
    if (j && Array.isArray(j.questions)) qs = j.questions.map(x => String(x).trim()).filter(Boolean);
    const topic = svc[0] || S.keyword || (S.ranked.slice().sort((a, b) => b.v - a.v)[0] || {}).k || S.domain.split(".")[0];
    if (!qs || qs.length < 2) qs = [`What are the best ${topic} options${where}? Name specific companies or websites.`, `Who would you recommend for ${topic}${where}?`, `Which websites are the most trusted sources about ${topic}?`];
    qs = qs.slice(0, 3);
    const models = [["ChatGPT", AI_EP2, AI_MODEL2], ["Claude", AI_EP, AI_MODEL]];
    const sys = "Answer like a helpful assistant. Recommend specific companies, brands or websites by name where that fits the question, with their website domain.";
    const jobs = [];
    models.forEach(([nm, ep, md]) => qs.forEach(qq => jobs.push(async () => {
      const r = await call(ep, { system_message: sys, user_prompt: qq.slice(0, 480), model_name: md, web_search: false }, `${nm}: “${cut(qq, 46)}”`);
      let txt = ""; (r?.[0]?.items || []).forEach(it => (it.sections || []).forEach(s => { if (s.type === "text") txt += s.text || ""; }));
      return { m: nm, q: qq, txt };
    })));
    const out = (await pool(jobs, 3)).filter(o => o && o.txt);
    if (!out.length) { log("  the AI assistants didn't answer, so AI visibility is skipped", "w"); return; }
    const brand = brandOf(S);
    const ans = out.map(o => parseAnswer(o, S.domain, brand));
    S.aivis = { qs, brand: brand.label, ans };
    const hits = ans.filter(a => a.hit).length;
    log(`✓ ${S.domain} is named in ${hits} of ${ans.length} AI answers`, hits ? "ok" : "w");
  };

  RUN.crawl = async () => {
    const S = SCAN, C = S.crawl; if (!C || !C.id) return;
    let s = null; const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      const r = await call(EPX.crawlSum + C.id, {}, "Crawl progress", true);
      s = r?.[0] || null; const cs = s?.crawl_status || {};
      log(`  crawled ${fmt(cs.pages_crawled || 0)} of up to ${C.max} pages${s?.crawl_progress === "finished" ? " · finished" : "…"}`, "c");
      if (!s || s.crawl_progress === "finished") break;
      await sleep(6000);
    }
    if (!s) { log("  crawl results aren't available yet", "w"); return; }
    C.done = s.crawl_progress === "finished";
    const di = s.domain_info || {}, pm = s.page_metrics || {};
    C.sum = { progress: s.crawl_progress, crawled: s.crawl_status?.pages_crawled || 0, total: di.total_pages || 0, cms: di.cms || "", server: di.server || "", ip: di.ip || "", ssl: di.ssl_info?.valid_certificate ?? null, sslExp: di.ssl_info?.certificate_expiration || null, checks: di.checks || {}, score: pm.onpage_score ?? null, pm: Object.fromEntries(Object.entries(pm).filter(([k, v]) => typeof v === "number")), issues: pm.checks || {} };
    const pg = await call(EPX.crawlPages, { id: C.id, limit: 100, order_by: ["onpage_score,asc"] }, "Crawled pages, worst first");
    C.pages = (pg?.[0]?.items || []).map(p => { const m = p.meta || {}, ck = p.checks || {}; return { u: p.url, s: p.status_code, sc: p.onpage_score ?? null, t: p.page_timing?.duration_time ?? null, w: m.content?.plain_text_word_count ?? null, dp: p.click_depth ?? null, il: m.internal_links_count ?? null, el: m.external_links_count ?? null, sz: p.size ?? null, ti: m.title || "", iss: Object.keys(ck).filter(k => ck[k] === true && ISS[k]) }; });
    log(`✓ site crawl: on-page score ${C.sum.score != null ? Math.round(C.sum.score) : "–"} · ${fmt(C.sum.crawled)} pages checked`, "ok");
  };

  RUN.swot = async () => {
    const S = SCAN, I = S.intel || {}, sc = scenarios(R).exp, lead = R.comps[0], A = S.aivis;
    const data = {
      site: S.domain, business: S.ai?.biz || "", market: S.keyword || "searches related to the site", location: S.location.label,
      visits_now: Math.round(R.you.clicks), market_visits: Math.round(R.market.clicks), market_share_pct: +(R.you.share * 100).toFixed(1),
      top3_searches: R.you.kw3, page_one_searches: R.items.filter(x => x.p && x.p <= 10).length, searches_in_market: R.items.length,
      striking_distance: R.items.filter(x => x.p > 3 && x.p <= 20).length, untapped: R.items.filter(x => !x.p || x.p > 20).length, realistic_gain_12mo: Math.round(sc.gain),
      leader: lead ? { domain: lead.d, share_pct: +(lead.share * 100).toFixed(1) } : null, top_topics_open: R.topics.slice(0, 4).map(t => t.name),
      referring_domains: I.bl?.rd ?? null, backlinks: I.bl?.bl ?? null, domain_age_years: I.whois?.created ? +ageYears(I.whois.created).toFixed(1) : null,
      traffic_trend_pct: trendPct(I.hist), ai_answers_naming_site: A ? `${A.ans.filter(a => a.hit).length} of ${A.ans.length}` : null,
      onpage_score: S.crawl?.sum?.score ?? null, crawl_issue_pages: S.crawl?.sum ? Object.entries(S.crawl.sum.issues).filter(([k, v]) => (ISS[k]?.[1] || 0) >= 2).reduce((a, [, v]) => a + (v || 0), 0) : null,
    };
    let j = await aiTask("intel", data, "Claude: write the intel brief");
    if (!j) {
      const sys = 'You are an SEO analyst. Write a SWOT for this website from its metrics. Plain words, no em dashes. Reply ONLY JSON: {"verdict":"one sentence","s":["3 items, 9 words max"],"w":["3 items"],"o":["3 items"],"t":["3 items"]}';
      const u = Object.entries(data).filter(([k, v]) => v != null && typeof v !== "object").map(([k, v]) => `${k}: ${v}`).join("; ").slice(0, 470) + (lead ? `; leader: ${lead.d}` : "");
      j = await ai(sys, u.slice(0, 498), "AI: write the intel brief");
    }
    const arr = x => (Array.isArray(x) ? x : []).map(v => String(v).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 4).map(v => v.slice(0, 140));
    if (j && (j.s || j.w || j.o || j.t)) { S.swot = { verdict: String(j.verdict || "").slice(0, 260), s: arr(j.s), w: arr(j.w), o: arr(j.o), t: arr(j.t), model: S.aiModel || "" }; log("✓ AI intel brief written", "ok"); }
    else log("  the AI brief didn't come back; the report will skip it", "w");
  };

  /* ---------- parsing helpers ---------- */
  function techCount(t) { let n = 0; Object.values(t || {}).forEach(g => Object.values(g || {}).forEach(c => n += (c || []).length)); return n; }
  function ageYears(d) { const t = Date.parse(String(d).replace(" +00:00", "Z").replace(" ", "T")); return isFinite(t) ? (Date.now() - t) / 31557600000 : 0; }
  function parseDate(d) { const t = Date.parse(String(d || "").replace(" +00:00", "Z").replace(" ", "T")); return isFinite(t) ? new Date(t) : null; }
  function trendPct(h) { if (!h || h.length < 4) return null; const k = Math.min(3, Math.floor(h.length / 2)); const a = sum(h.slice(-k), x => x.etv) / k, b = sum(h.slice(0, k), x => x.etv) / k; return b > 0 ? Math.round(100 * (a - b) / b) : null; }
  function brandOf(S) {
    const sld = S.domain.split(".")[0].toLowerCase(), tt = (S.intel?.tech?.title || "").split(/[|\-–—:·•]/)[0].trim();
    const label = tt && tt.length <= 40 && tt.length >= 3 ? tt : sld;
    return { sld, label, tokens: [...new Set([sld, label.toLowerCase(), label.toLowerCase().replace(/\s+/g, "")])].filter(x => x.length >= 4) };
  }
  const DOM_RE = /\b((?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ai|app|us|uk|ca|au|info|biz|agency|dev|me|es|ac|edu|gov|tv|news|shop|store|site|online))\b/gi;
  function parseAnswer(o, domain, brand) {
    const txt = o.txt, low = txt.toLowerCase();
    const hit = low.includes(domain.toLowerCase()) || brand.tokens.some(t => low.includes(t));
    const names = []; const seen = new Set();
    txt.split(/\n/).forEach(line => {
      const m = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(?:\*\*)?([^*:\n(–—]{2,60}?)(?:\*\*|:|\s[–—-]\s|\(|$)/);
      if (m) { const n = m[1].replace(/[*#_`]/g, "").trim().replace(/[.,;]$/, ""); const k = n.toLowerCase(); if (n.length >= 2 && n.split(" ").length <= 7 && !seen.has(k)) { seen.add(k); names.push(n); } }
    });
    (txt.match(/\*\*([^*\n]{2,50})\*\*/g) || []).forEach(b => { const n = b.replace(/\*/g, "").trim().replace(/[:.,;]$/, ""); const k = n.toLowerCase(); if (!seen.has(k) && n.split(" ").length <= 6) { seen.add(k); names.push(n); } });
    const doms = [...new Set((txt.match(DOM_RE) || []).map(d => d.toLowerCase().replace(/^www\./, "")))].slice(0, 12);
    let pos = null; names.some((n, i) => { const l = n.toLowerCase(); if (l.includes(brand.sld) || brand.tokens.some(t => l.includes(t))) { pos = i + 1; return true; } return false; });
    return { m: o.m, q: o.q, hit, pos, names: names.slice(0, 10), doms, snip: txt.replace(/\*\*/g, "").replace(/#+\s/g, "").slice(0, 900) };
  }

  /* =====================================================================
     DERIVED: the intel scorecard
     ===================================================================== */
  const ISS = {
    is_4xx_code: ["4xx error pages", 3], is_5xx_code: ["5xx server errors", 3], is_broken: ["Broken pages", 3], is_http: ["Pages served over HTTP", 3], no_title: ["Missing title tag", 3],
    redirect_loop: ["Redirect loops", 3], broken_links: ["Broken links", 3],
    no_description: ["Missing meta description", 2], no_h1_tag: ["Missing H1 heading", 2], high_loading_time: ["Slow page loads", 2], high_waiting_time: ["Slow server response", 2],
    redirect_chain: ["Redirect chains", 2], canonical_chain: ["Canonical chains", 2], recursive_canonical: ["Recursive canonicals", 2], https_to_http_links: ["HTTPS pages linking to HTTP", 2],
    lorem_ipsum: ["Placeholder text left on page", 2], size_greater_than_3mb: ["Pages over 3 MB", 2], duplicate_title: ["Duplicate titles", 2], duplicate_content: ["Duplicate content", 2], broken_resources: ["Broken images or files", 2],
    title_too_long: ["Title too long", 1], title_too_short: ["Title too short", 1], no_image_alt: ["Images missing alt text", 1], low_content_rate: ["Thin content", 1], large_page_size: ["Heavy pages", 1],
    is_redirect: ["Redirecting URLs", 1], has_render_blocking_resources: ["Render-blocking resources", 1], duplicate_meta_tags: ["Duplicate meta tags", 1], irrelevant_title: ["Title doesn't match content", 1],
    has_meta_refresh_redirect: ["Meta refresh redirects", 1], is_orphan_page: ["Orphan pages", 1], no_content_encoding: ["No compression", 1], duplicate_description: ["Duplicate descriptions", 1], non_indexable: ["Non-indexable pages", 1], no_doctype: ["Missing doctype", 1],
    low_readability_rate: ["Hard-to-read text", 0], no_favicon: ["Missing favicon", 0], deprecated_html_tags: ["Deprecated HTML tags", 0], irrelevant_description: ["Description doesn't match content", 0], no_image_title: ["Images missing title", 0], small_page_size: ["Very small pages", 0], has_frame: ["Frames", 0],
  };
  const SEV = [["minor", P.slate], ["notice", P.blue], ["warning", P.orange], ["critical", P.red]];
  const DIM = [
    { k: "vis", sh: "Search", n: "Search visibility", c: P.blue, ic: "◉" }, { k: "auth", sh: "Authority", n: "Authority", c: P.violet, ic: "⬢" }, { k: "breadth", sh: "Breadth", n: "Content breadth", c: P.teal, ic: "▤" },
    { k: "tech", sh: "Tech health", n: "Technical health", c: P.orange, ic: "⚙" }, { k: "ai", sh: "AI", n: "AI visibility", c: P.pink, ic: "✦" }, { k: "mom", sh: "Momentum", n: "Momentum", c: P.green, ic: "➚" },
  ];
  const grade = s => s == null ? "–" : s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";
  const gcol = s => s == null ? P.slate : s >= 85 ? P.green : s >= 70 ? "#7CB518" : s >= 55 ? P.gold : s >= 40 ? P.orange : P.red;
  let SC = null;
  function scores() {
    const S = SCAN, Rr = R, I = S.intel || {}, n = Rr.items.length, kw10 = Rr.items.filter(x => x.p && x.p <= 10).length, m = S.overview?.m || {};
    const o = {}, why = {};
    o.vis = Math.round(Math.min(100, 100 * Math.sqrt(Math.min(1, Rr.you.share / 0.2)) * 0.6 + Math.min(100, 250 * kw10 / Math.max(1, n)) * 0.4));
    why.vis = `${pc(Rr.you.share)} of market clicks · page one for ${fmt(kw10)} of ${fmt(n)} searches`;
    if (I.bl) { o.auth = Math.round(Math.min(100, 0.55 * Math.min(100, (I.bl.rank || 0) / 10) + 0.45 * Math.min(100, 100 * Math.log10((I.bl.rd || 0) + 1) / 4))); why.auth = `${fmt(I.bl.rd)} referring domains · link rank ${I.bl.rank ?? "–"}`; }
    else if (I.tech && I.tech.dr != null) { o.auth = Math.round(Math.min(100, I.tech.dr / 10)); why.auth = `domain rank ${I.tech.dr} of 1,000`; }
    else { o.auth = null; why.auth = "no backlink data returned"; }
    const cnt = S.overview?.count || S.ranked.length;
    o.breadth = Math.round(Math.min(100, 100 * Math.log10(cnt + 1) / Math.log10(50000))); why.breadth = `${fmt(cnt)} keywords ranking in Google`;
    const cs = S.crawl?.sum;
    if (cs && cs.score != null) { o.tech = Math.round(cs.score); why.tech = `on-page score ${Math.round(cs.score)} across ${fmt(cs.crawled)} crawled pages`; }
    else { o.tech = null; why.tech = S.crawlOn ? "crawl didn't finish in time" : "tick “Crawl the site” to grade this"; }
    const A = S.aivis;
    if (A && A.ans.length) { const h = A.ans.filter(a => a.hit).length; o.ai = Math.round(100 * h / A.ans.length); why.ai = `named in ${h} of ${A.ans.length} AI answers`; }
    else { o.ai = null; why.ai = "AI check not run"; }
    const g = (m.is_new || 0) + (m.is_up || 0), l = (m.is_down || 0) + (m.is_lost || 0), tp = trendPct(I.hist);
    if (g + l > 0) { o.mom = Math.round(Math.max(0, Math.min(100, 100 * g / (g + l) * 0.7 + (tp == null ? 50 : Math.max(0, Math.min(100, 50 + tp / 2))) * 0.3))); why.mom = `${fmt(g)} keywords gained or rising vs ${fmt(l)} falling or lost${tp != null ? ` · traffic ${tp >= 0 ? "+" : ""}${tp}% vs ${(I.hist.length >= 6 ? "a year or two" : "earlier")} ago` : ""}`; }
    else if (tp != null) { o.mom = Math.max(0, Math.min(100, 50 + tp / 2)); why.mom = `traffic ${tp >= 0 ? "+" : ""}${tp}% over the period`; }
    else { o.mom = null; why.mom = "no movement data"; }
    const vals = DIM.map(d => o[d.k]).filter(v => v != null);
    const overall = vals.length ? Math.round(sum(vals, v => v) / vals.length) : null;
    return { o, why, overall };
  }

  /* =====================================================================
     SECTION VISIBILITY (called by insights.js render)
     ===================================================================== */
  function show(id, on) { const e = byId(id); if (e) e.style.display = on ? "" : "none"; }
  function prepare() {
    const S = SCAN, I = S.intel || {};
    SC = scores();
    show("rowAge", !!(I.whois && I.whois.created) || !!I.tech);
    show("rowTech", !!(I.tech && techCount(I.tech.tech)));
    show("rowLinks", !!I.bl); show("rowLinks2", !!I.bl);
    show("c-profile", !!(I.whois || I.tech || I.bl));
    show("rowTrend", !!(I.hist && I.hist.length > 1)); show("rowMomentum", !!(I.hist && I.hist.length > 1) || !!S.overview?.m?.is_new);
    show("rowFunnel", !!(S.overview?.m && S.overview.m.pos_1 != null));
    show("c-traj", !!(I.hist && I.hist.length > 1) || !!(S.overview?.m && S.overview.m.pos_1 != null));
    show("rowAI", !!S.aivis); show("rowSwot", !!S.swot);
    const nf = S.ranked.filter(r => r.f && r.f.length).length; show("rowFeat", nf >= 5);
    show("c-ai", !!S.aivis || !!S.swot || nf >= 5);
    const C = S.crawl?.sum;
    show("crawlOn", !!C); show("crawlOff", !C);
    const cta = byId("crawlOff");
    if (cta) cta.innerHTML = S.crawlOn ? `<b>The crawl didn't finish in time for this report.</b><br>Big sites can take longer than the scan window; run the scan again and the finished crawl is picked up from cache.` : `<b>No site crawl in this report.</b><br>Tick <em>“Also crawl the site for errors”</em> on the scan form to add a technical health check: broken pages, missing titles and headings, slow pages, redirects and more, for up to ${CRAWL_PAGES} pages.`;
    const sc = byId("scoreOverall"); if (sc) sc.innerHTML = SC.overall == null ? "" : `<b style="color:${gcol(SC.overall)}">${grade(SC.overall)}</b><span>${SC.overall}/100 overall</span>`;
  }

  /* =====================================================================
     CHARTS
     ===================================================================== */
  // ---- 1. Intel scorecard: polar petal chart + grade cards
  function drawScore() {
    const box = byId("vzScore"); box.innerHTML = "";
    const W = Math.max(280, box.clientWidth || 500), Sz = Math.min(W, 420), nar = Sz < 380, Ro = Sz / 2 - (nar ? 64 : 46), Ri = Sz * 0.15;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${Sz} ${Sz}`).attr("width", Sz).attr("height", Sz).style("display", "block").style("margin", "0 auto").style("overflow", "visible");
    const g = svg.append("g").attr("transform", `translate(${Sz / 2},${Sz / 2})`), N = DIM.length, a = 2 * Math.PI / N;
    [25, 50, 75, 100].forEach(t => g.append("circle").attr("r", Ri + (Ro - Ri) * t / 100).attr("fill", "none").attr("stroke", "#E3EAF2").attr("stroke-dasharray", t === 100 ? null : "3 4"));
    DIM.forEach((d, i) => {
      const s = SC.o[d.k], a0 = i * a + 0.03, a1 = (i + 1) * a - 0.03, arc = d3.arc().innerRadius(Ri).startAngle(a0).endAngle(a1).cornerRadius(6);
      g.append("path").attr("d", arc.outerRadius(Ro)()).attr("fill", d.c).attr("opacity", .07);
      const path = g.append("path").attr("fill", grad(svg, "sp" + i, [d.c, [d.c, .65]], true)).style("filter", glow(d.c)).style("cursor", "help");
      if (s != null) path.transition().duration(1200).delay(i * 140).ease(d3.easeElasticOut.amplitude(1).period(.55)).attrTween("d", () => { const it = d3.interpolate(Ri, Ri + (Ro - Ri) * Math.max(4, s) / 100); return t => arc.outerRadius(it(t))(); });
      else g.append("path").attr("d", arc.outerRadius(Ri + (Ro - Ri) * .35)()).attr("fill", "none").attr("stroke", d.c).attr("stroke-dasharray", "4 4");
      tip(path, () => `<b>${d.n}</b>${tr("Score", s == null ? "not measured" : s + "/100", tc(gcol(s)))}${tr("Grade", grade(s))}<div style="color:#5D6B79;font-size:12px;margin-top:4px">${esc(SC.why[d.k])}</div>`);
      const am = (a0 + a1) / 2, lr = Ro + 22, lx = Math.sin(am) * lr, ly = -Math.cos(am) * lr;
      T(g, lx, ly - 2, (nar ? d.sh : d.n).toUpperCase(), { c: d.c, fs: nar ? 8.5 : 9.5, fw: 800, a: Math.abs(lx) < 20 ? "middle" : lx > 0 ? "start" : "end" });
      T(g, lx, ly + 12, s == null ? "n/a" : grade(s) + " · " + s, { c: "#0B2545", fs: 11, fw: 800, ff: SANS, a: Math.abs(lx) < 20 ? "middle" : lx > 0 ? "start" : "end" });
    });
    g.append("circle").attr("r", Ri - 6).attr("fill", "#fff").style("filter", "drop-shadow(0 4px 12px rgba(11,37,69,.12))");
    T(g, 0, 8, grade(SC.overall), { c: gcol(SC.overall), fs: Ri * 0.85, fw: 900, ff: SANS, a: "middle" }).attr("opacity", 0).transition().delay(900).duration(600).attr("opacity", 1);
    T(g, 0, 8 + Ri * 0.38, SC.overall == null ? "" : SC.overall + "/100", { c: "#5D6B79", fs: 11, fw: 700, a: "middle" });
    const cards = byId("vzScoreCards");
    if (cards) cards.innerHTML = DIM.map((d, i) => { const s = SC.o[d.k]; return `<div class="gcard" style="--c:${d.c};animation-delay:${i * 90}ms"><div class="gc-top"><span class="gc-ic">${d.ic}</span><span class="gc-n">${d.n}</span><b style="color:${tc(gcol(s))}">${grade(s)}</b></div><div class="gc-bar"><i style="width:${s == null ? 0 : Math.max(3, s)}%"></i></div><div class="gc-why">${esc(SC.why[d.k])}</div></div>`; }).join("");
  }
  function storyScore() {
    const o = SC.o, ok = DIM.filter(d => o[d.k] != null), best = ok.slice().sort((a, b) => o[b.k] - o[a.k])[0], worst = ok.slice().sort((a, b) => o[a.k] - o[b.k])[0], miss = DIM.filter(d => o[d.k] == null);
    return {
      c: P.blue, k: "The intel scorecard",
      read: `Six petals, one per dimension of a site's search presence. The longer and fuller a petal, the stronger the site on that dimension (0 at the center, 100 at the outer ring). The letter in the middle is the overall grade: the average of every dimension we could measure. Hover any petal for the numbers behind it.`,
      say: [
        SC.overall != null ? `${D().dom} scores ${B(SC.overall + "/100", gcol(SC.overall))} overall, a grade ${B(grade(SC.overall), gcol(SC.overall))}. ${SC.overall >= 70 ? "That's a strong, well-rounded search presence; the job is mostly defending it and widening the lead." : SC.overall >= 50 ? "That's a site with real foundations and clear gaps, which is the most common profile and usually the most fixable." : "That's an early-stage or under-invested search presence, which means most of the upside is still ahead."}` : null,
        best && worst && best !== worst ? `Its strongest dimension is ${B(best.n.toLowerCase(), best.c)} (${o[best.k]}/100: ${esc(SC.why[best.k])}). Its weakest is ${B(worst.n.toLowerCase(), worst.c)} (${o[worst.k]}/100: ${esc(SC.why[worst.k])}).` : null,
        miss.length ? `${and(miss.map(d => d.n.toLowerCase()))} ${miss.length === 1 ? "wasn't" : "weren't"} measured in this scan, so ${miss.length === 1 ? "it's" : "they're"} left out of the average rather than counted as zero.` : null,
      ],
      move: worst ? (worst.k === "tech" ? "Fix the technical issues in the site health section first; they hold back everything else." : worst.k === "auth" ? "Authority is the bottleneck: earn links from relevant sites before expecting the big head terms to move." : worst.k === "ai" ? "AI assistants don't name this site yet; the AI visibility section shows who they name instead and why." : worst.k === "mom" ? "Momentum is negative: protect the pages that are slipping before publishing anything new." : worst.k === "breadth" ? "The site simply doesn't cover enough searches; the topic map shows where to add pages." : "Visibility is the gap: the opportunity map shows the fastest searches to win.") : "",
    };
  }

  // ---- 2. Domain age timeline
  function drawAge() {
    const box = byId("vzAge"), I = SCAN.intel || {}, w = I.whois;
    const c = parseDate(w?.created), e = parseDate(w?.expires), now = new Date();
    if (!c) { box.innerHTML = `<div class="vz-empty">Whois didn't return a registration date for this domain.</div>`; return; }
    const { svg, W, H } = svgIn("vzAge", 190), m = { l: 30, r: 30 };
    const end = e && e > now ? e : new Date(now.getTime() + 31557600000);
    const x = d3.scaleTime().domain([c, end]).range([m.l, W - m.r]), y = 96;
    const yrs = ageYears(w.created);
    T(svg, m.l, 34, yrs >= 1 ? yrs.toFixed(yrs < 10 ? 1 : 0) + " years old" : Math.round(yrs * 12) + " months old", { c: "#0B2545", fs: 26, fw: 900, ff: SANS });
    T(svg, m.l, 54, `registered ${d3.timeFormat("%b %Y")(c)}${w.registrar ? " · " + cut(w.registrar, 40) : ""}`, { c: "#5D6B79", fs: 11 });
    svg.append("line").attr("x1", x(c)).attr("x2", x(end)).attr("y1", y).attr("y2", y).attr("stroke", "#E3EAF2").attr("stroke-width", 10).attr("stroke-linecap", "round");
    svg.append("rect").attr("x", x(c) - 5).attr("y", y - 5).attr("height", 10).attr("rx", 5).attr("width", 10).attr("fill", grad(svg, "agl", [P.violet, P.blue, P.teal])).transition().duration(1500).attr("width", Math.max(10, x(now) - x(c) + 10));
    x.ticks(W < 500 ? 4 : 8).forEach(t => { svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", y + 9).attr("y2", y + 15).attr("stroke", "#C5D1DE"); T(svg, x(t), y + 28, d3.timeFormat("%Y")(t), { c: "#7D8A9B", fs: 10, a: "middle" }); });
    const mk = (dt, lab, col, up) => { const g = svg.append("g").attr("opacity", 0); g.append("circle").attr("cx", x(dt)).attr("cy", y).attr("r", 8).attr("fill", "#fff").attr("stroke", col).attr("stroke-width", 3); T(g, x(dt), up ? y - 18 : y + 48, lab, { c: col, fs: 10.5, fw: 800, a: x(dt) < 80 ? "start" : x(dt) > W - 80 ? "end" : "middle" }); g.transition().delay(1200).attr("opacity", 1); };
    mk(c, "registered", P.violet, true); mk(now, "today", P.blue, true);
    if (e) mk(e, "renews " + d3.timeFormat("%b %Y")(e), e - now < 90 * 864e5 ? P.red : P.green, false);
    const f = parseDate(w.first); if (f && f > c) mk(f, "first seen by DataForSEO", P.teal, false);
  }
  function storyAge() {
    const I = SCAN.intel || {}, w = I.whois, t = I.tech; if (!w && !t) return null;
    const yrs = w?.created ? ageYears(w.created) : null, e = parseDate(w?.expires), days = e ? Math.round((e - Date.now()) / 864e5) : null;
    return {
      c: P.violet, k: "Who this site is",
      read: `The timeline runs from the day the domain was registered to its next renewal date, with today marked in blue. Below it is everything detectable about how the site is built.`,
      say: [
        yrs != null ? `${D().dom} has been registered for ${B(yrs >= 1 ? yrs.toFixed(1) + " years" : Math.round(yrs * 12) + " months", P.violet)}. ${yrs >= 10 ? "That's a mature domain: age alone isn't a ranking factor, but a decade of history usually comes with links and trust that newer competitors have to earn." : yrs >= 3 ? "That's old enough to have built a track record, so rankings should reflect content quality more than newness." : "That's a young domain, so it's normal for authority (and therefore rankings for competitive terms) to lag behind older competitors for a while."}` : null,
        days != null ? (days < 0 ? `The registration shows as expired, which is worth checking right away.` : days < 90 ? `It's due for renewal in ${B(days + " days", P.red)}. Make sure auto-renew is on; an expired domain is the fastest way to lose every ranking at once.` : `It's paid up until ${d3.timeFormat("%B %Y")(e)}.`) : null,
        t && t.title ? `The homepage presents itself as ${q(cut(t.title, 90))}${t.desc ? `, with the description ${q(cut(t.desc, 140))}` : ""}.` : null,
      ],
    };
  }

  // ---- 3. Technology wall
  const GROUP_C = [P.blue, P.pink, P.teal, P.orange, P.violet, P.green, P.gold, P.cyan, P.red, P.purple];
  function drawTech() {
    const box = byId("vzTech"), t = SCAN.intel?.tech?.tech || {};
    const groups = Object.entries(t).filter(([, g]) => g && Object.keys(g).length);
    if (!groups.length) { box.innerHTML = `<div class="vz-empty">No technologies were detected.</div>`; return; }
    let k = 0;
    box.innerHTML = `<div class="techwall">${groups.map(([gn, cats], gi) => `<div class="tgroup" style="--c:${GROUP_C[gi % GROUP_C.length]}"><div class="tg-h">${esc(gn.replace(/_/g, " "))}</div>${Object.entries(cats).map(([cn, list]) => `<div class="tcat"><span>${esc(cn.replace(/_/g, " "))}</span><div>${(list || []).map(x => `<i style="animation-delay:${(k++) * 45}ms">${esc(x)}</i>`).join("")}</div></div>`).join("")}</div>`).join("")}</div>`;
  }
  function storyTech() {
    const t = SCAN.intel?.tech; if (!t || !techCount(t.tech)) return null;
    const all = []; Object.values(t.tech).forEach(g => Object.entries(g || {}).forEach(([c, l]) => (l || []).forEach(x => all.push([c, x]))));
    const find = re => [...new Set(all.filter(([c, x]) => re.test(c + " " + x)).map(([, x]) => x))];
    const cms = find(/cms|wordpress|shopify|wix|squarespace|webflow|drupal|joomla/i), an = find(/analytic|tag manager|pixel/i), cdn = find(/cdn|cloudflare|fastly|akamai/i), seo = find(/seo|yoast|rank math|all in one/i);
    return {
      c: P.teal, k: "What it's built with",
      read: `Every technology DataForSEO detected on the site, grouped by what it does. Each chip is one tool, framework or service.`,
      say: [
        `We found ${B(plural(all.length, "technology", "technologies"), P.teal)}. ${cms.length ? `It runs on ${B(esc(and(cms.slice(0, 2))), P.blue)}.` : "No common CMS was detected, which usually means a custom build or a headless setup."} ${cdn.length ? `Pages are served through ${esc(and(cdn.slice(0, 2)))}, which helps speed.` : ""}`,
        an.length ? `Tracking in place: ${esc(and(an.slice(0, 4)))}. ${an.length >= 3 ? "That's a well-instrumented site; there's data to measure SEO work against." : ""}` : `No analytics tags were detected. If this is your site, that's the first thing to fix: you can't improve what you can't measure.`,
        seo.length ? `There's an SEO plugin installed (${esc(and(seo.slice(0, 2)))}), so titles, descriptions and sitemaps are easy to control.` : null,
      ],
    };
  }

  // ---- 4. Backlinks: tiles + TLD rose + link mix
  function drawLinks() {
    const box = byId("vzLinks"), b = SCAN.intel?.bl; if (!b) { box.innerHTML = ""; return; }
    const doF = b.rd ? 1 - (b.rdn || 0) / b.rd : null;
    const tiles = [["Link rank", b.rank != null ? fmt(b.rank) : "–", "of 1,000", P.violet], ["Referring domains", short(b.rd), `${short(b.rmd)} unique main sites`, P.blue], ["Backlinks", short(b.bl), `${short(b.ips)} IPs · ${short(b.sub)} subnets`, P.teal], ["Dofollow domains", doF == null ? "–" : pc(doF), "pass ranking value", P.green], ["Spam score", b.spam == null ? "–" : b.spam + "%", b.spam > 30 ? "high, worth auditing" : "low is good", b.spam > 30 ? P.red : P.gold], ["Broken backlinks", short(b.bb), `${short(b.bp)} broken pages`, P.orange]];
    box.innerHTML = `<div class="tiles">${tiles.map((x, i) => `<div class="tile" style="--c:${x[3]};animation-delay:${i * 80}ms"><span>${x[0]}</span><b>${x[1]}</b><em>${x[2]}</em></div>`).join("")}</div>`;
  }
  function drawRose() {
    const b = SCAN.intel?.bl, box = byId("vzRose"); if (!b) { box.innerHTML = ""; return; }
    const ent = Object.entries(b.tld || {}).filter(([, v]) => v > 0).sort((a, z) => z[1] - a[1]).slice(0, 10);
    if (!ent.length) { box.innerHTML = `<div class="vz-empty">No referring-link TLD data.</div>`; return; }
    box.innerHTML = ""; const W = Math.max(280, box.clientWidth || 400), Sz = Math.min(W - 10, 440), Ro = Sz / 2 - 34, Ri = 34;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${Sz} ${Sz}`).attr("width", Sz).attr("height", Sz).style("display", "block").style("margin", "0 auto").style("overflow", "visible");
    const g = svg.append("g").attr("transform", `translate(${Sz / 2},${Sz / 2})`), a = 2 * Math.PI / ent.length, mx = ent[0][1], tot = sum(Object.values(b.tld), v => v) || 1;
    const rs = d3.scaleSqrt().domain([0, mx]).range([Ri, Ro]);
    ent.forEach(([k, v], i) => {
      const c = H.RAINBOW[i % H.RAINBOW.length], arc = d3.arc().innerRadius(Ri).startAngle(i * a + .02).endAngle((i + 1) * a - .02).cornerRadius(4);
      const p = g.append("path").attr("fill", c).attr("opacity", .88).style("cursor", "pointer");
      p.transition().duration(1000).delay(i * 80).attrTween("d", () => { const it = d3.interpolate(Ri, rs(v)); return t => arc.outerRadius(it(t))(); });
      tip(p, () => `<b>.${esc(k)}</b>${tr("Referring links", fmt(v))}${tr("Share", pc(v / tot))}`);
      const am = (i + .5) * a, lr = rs(v) + 12;
      T(g, Math.sin(am) * lr, -Math.cos(am) * lr + 4, "." + k, { c, fs: 10.5, fw: 800, a: "middle" });
    });
    T(g, 0, 4, "TLDs", { c: "#5D6B79", fs: 10, fw: 700, a: "middle" });
  }
  function drawLinkMix() {
    const b = SCAN.intel?.bl, box = byId("vzMix"); if (!b) { box.innerHTML = ""; return; }
    const rows = [["Link type", b.types], ["Link attributes", b.attrs], ["Linking platforms", b.plat], ["Where links sit", b.sem]].map(([l, o]) => [l, Object.entries(o || {}).filter(([k, v]) => v > 0).map(([k, v]) => [k || "unspecified", v]).sort((a, z) => z[1] - a[1]).slice(0, 6)]).filter(r => r[1].length);
    if (!rows.length) { box.innerHTML = `<div class="vz-empty">No link mix data.</div>`; return; }
    const W0 = box.clientWidth || 600, rowH = 58, { svg, W } = svgIn("vzMix", rows.length * rowH + 6), lw = W < 520 ? 0 : 140;
    rows.forEach(([l, ent], i) => {
      const y = i * rowH + (lw ? 8 : 18), tot = sum(ent, e => e[1]) || 1, x = d3.scaleLinear().domain([0, tot]).range([lw, W - 4]);
      if (lw) T(svg, 0, y + 17, l, { c: "#0B2545", fs: 11.5, fw: 700 }); else T(svg, 0, y - 5, l, { c: "#0B2545", fs: 11, fw: 700 });
      let acc = 0;
      ent.forEach(([k, v], j) => {
        const c = H.RAINBOW[(i * 3 + j) % H.RAINBOW.length], x0 = x(acc); acc += v;
        const r = svg.append("rect").attr("x", x0).attr("y", y).attr("height", 26).attr("width", 0).attr("rx", 4).attr("fill", c).attr("stroke", "#fff").attr("stroke-width", 1.5);
        r.transition().duration(900).delay(i * 120 + j * 60).attr("width", Math.max(0, x(acc) - x0));
        tip(r, () => `<b>${esc(l)}: ${esc(k)}</b>${tr("Links", fmt(v))}${tr("Share", pc(v / tot))}`);
        if (x(acc) - x0 > 54) T(svg, x0 + 6, y + 17, cut(k, Math.floor((x(acc) - x0) / 7)), { c: "#fff", fs: 10.5, fw: 700 }).style("pointer-events", "none");
      });
    });
  }
  function storyLinks() {
    const b = SCAN.intel?.bl; if (!b) return null;
    const doF = b.rd ? 1 - (b.rdn || 0) / b.rd : null, top = Object.entries(b.tld || {}).sort((a, z) => z[1] - a[1])[0], tot = sum(Object.values(b.tld || {}), v => v) || 1;
    const lead = D().lead;
    return {
      c: P.violet, k: "The link profile",
      read: `The tiles are the headline backlink numbers. The rose chart shows which top-level domains the links come from (each petal's length is the number of links). The striped bars break the links down by type, attribute, the kind of site linking and where on the page the link sits.`,
      say: [
        `${D().dom} is linked from ${B(fmt(b.rd) + " referring domains", P.blue)} with ${B(fmt(b.bl) + " backlinks", P.teal)} in total${b.rank != null ? `, for a link rank of ${B(b.rank + "/1,000", P.violet)}` : ""}. ${b.rd < 50 ? "That's a thin link profile; most competitive searches need more independent sites vouching for you." : b.rd < 500 ? "That's a solid base for long-tail and local searches; the broad head terms usually need more." : "That's a strong link profile, which is why this site can compete for broad searches."} ${b.bl > b.rd * 50 ? "Note that backlinks far outnumber domains, which usually means sitewide links (footers, blogrolls) from a few sites." : ""}`,
        doF != null ? `${B(pc(doF), P.green)} of the linking domains pass ranking value (dofollow). ${doF < 0.6 ? "That's on the low side: lots of the links are nofollow, ugc or sponsored, which count for little." : "That's a healthy share."}` : null,
        top ? `The biggest source is ${B("." + esc(top[0]), P.pink)} sites (${pc(top[1] / tot)} of links). ${b.spam != null && b.spam > 30 ? `The spam score of ${b.spam}% is high enough to warrant a link audit.` : ""} ${b.bb ? `There are also ${fmt(b.bb)} broken backlinks: links pointing at pages that no longer exist. Redirecting those URLs recovers that value for free.` : ""}` : null,
      ],
      move: b.bb > 0 ? `Redirect the ${fmt(b.bp || b.bb)} broken target pages to their closest live equivalents; it's the cheapest link building there is.` : b.rd < 100 ? `Earn links from the sites that already link to competitors${lead ? ` like ${esc(lead.d)}` : ""}: local partners, suppliers, industry directories and genuinely useful resources.` : "",
    };
  }

  // ---- 5. Traffic history (combo) and momentum (diverging)
  const mlab = h => d3.timeFormat("%b ’%y")(new Date(h.y, h.m - 1, 1));
  function drawTrend() {
    const hs = SCAN.intel?.hist; const box = byId("vzTrend"); if (!hs || hs.length < 2) { box.innerHTML = ""; return; }
    const { svg, W, H } = svgIn("vzTrend", 320), m = { l: 48, r: 48, t: 24, b: 34 };
    const x = d3.scaleBand().domain(hs.map((h, i) => i)).range([m.l, W - m.r]).padding(.25);
    const yv = d3.scaleLinear().domain([0, d3.max(hs, h => h.etv) * 1.15 || 1]).nice().range([H - m.b, m.t]);
    const yk = d3.scaleLinear().domain([0, d3.max(hs, h => h.n) * 1.15 || 1]).nice().range([H - m.b, m.t]);
    yv.ticks(4).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", yv(t)).attr("y2", yv(t)).attr("stroke", "#E3EAF2"); T(svg, m.l - 6, yv(t) + 4, short(t), { c: P.blue, fs: 10, a: "end" }); });
    yk.ticks(4).forEach(t => T(svg, W - m.r + 6, yk(t) + 4, short(t), { c: P.teal, fs: 10 }));
    T(svg, 4, 12, "visits / mo", { c: P.blue, fs: 10.5, fw: 700 }); T(svg, W - 4, 12, "keywords", { c: P.teal, fs: 10.5, fw: 700, a: "end" });
    hs.forEach((h, i) => { const r = svg.append("rect").attr("x", x(i)).attr("width", x.bandwidth()).attr("y", yk(0)).attr("height", 0).attr("rx", 3).attr("fill", P.teal).attr("opacity", .22); r.transition().duration(700).delay(i * 25).attr("y", yk(h.n)).attr("height", yk(0) - yk(h.n)); });
    const cx = i => x(i) + x.bandwidth() / 2;
    const area = d3.area().x((h, i) => cx(i)).y0(yv(0)).y1(h => yv(h.etv)).curve(d3.curveMonotoneX), line = d3.line().x((h, i) => cx(i)).y(h => yv(h.etv)).curve(d3.curveMonotoneX);
    svg.append("path").attr("d", area(hs)).attr("fill", grad(svg, "trf", [[P.blue, .35], [P.pink, .02]], true)).attr("opacity", 0).transition().delay(300).duration(900).attr("opacity", 1);
    const lp = svg.append("path").attr("d", line(hs)).attr("fill", "none").attr("stroke", grad(svg, "trl", [P.violet, P.blue, P.pink])).attr("stroke-width", 3.5).attr("stroke-linecap", "round");
    const L = lp.node().getTotalLength(); lp.attr("stroke-dasharray", L).attr("stroke-dashoffset", L).transition().duration(1600).attr("stroke-dashoffset", 0);
    const pk = hs.reduce((b, h, i) => h.etv > hs[b].etv ? i : b, 0), last = hs.length - 1;
    const near = last - pk <= 2;
    [[pk, (near ? "peak " : "peak ") + short(hs[pk].etv), P.pink], [last, "now " + short(hs[last].etv), P.blue]].forEach(([i, l, c], j) => { if (j === 1 && (i === pk || near)) return; const g = svg.append("g").attr("opacity", 0); g.append("circle").attr("cx", cx(i)).attr("cy", yv(hs[i].etv)).attr("r", 5.5).attr("fill", c).attr("stroke", "#fff").attr("stroke-width", 2); T(g, cx(i), yv(hs[i].etv) - 11, l, { c, fs: 11, fw: 800, a: cx(i) > W - 70 ? "end" : cx(i) < 70 ? "start" : "middle" }); g.transition().delay(1500).attr("opacity", 1); });
    const step = Math.ceil(hs.length / (W < 520 ? 4 : 8));
    hs.forEach((h, i) => { if ((i % step === 0 && last - i >= step / 2) || i === last) T(svg, cx(i), H - m.b + 16, mlab(h), { c: "#7D8A9B", fs: 9.5, a: "middle" }); });
    const hv = svg.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#94A3B8").attr("stroke-dasharray", "3 3").style("display", "none");
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent").on("pointermove pointerdown", e => { const [mx] = d3.pointer(e, svg.node()); const i = Math.max(0, Math.min(last, Math.round((mx - m.l - x.bandwidth() / 2) / x.step()))); const h = hs[i]; hv.style("display", null).attr("x1", cx(i)).attr("x2", cx(i)); tipOn(e, `<b>${mlab(h)}</b>${tr("Est. visits / mo", fmt(h.etv), P.blue)}${tr("Keywords ranking", fmt(h.n), P.teal)}${tr("Top-3 keywords", fmt(h.p1 + h.p3), P.green)}${tr("New · lost", `+${fmt(h.nw)} · −${fmt(h.lo)}`)}`); }).on("pointerleave", () => { hv.style("display", "none"); tipOff(); });
  }
  function storyTrend() {
    const hs = SCAN.intel?.hist; if (!hs || hs.length < 2) return null;
    const f = hs[0], l = hs[hs.length - 1], pk = hs.reduce((b, h) => h.etv > b.etv ? h : b, hs[0]), lo = hs.reduce((b, h) => h.etv < b.etv ? h : b, hs[0]);
    const ch = f.etv ? (l.etv - f.etv) / f.etv : null, kch = f.n ? (l.n - f.n) / f.n : null;
    let bigJ = null; for (let i = 1; i < hs.length; i++) { const d = hs[i].etv - hs[i - 1].etv; if (!bigJ || Math.abs(d) > Math.abs(bigJ.d)) bigJ = { d, h: hs[i], p: hs[i - 1] }; }
    return {
      c: P.blue, k: "The trajectory",
      read: `The glowing line is estimated monthly organic visits over the last ${hs.length} months (left axis); the pale bars behind it are how many keywords the site ranked for each month (right axis). Hover anywhere for that month's numbers.`,
      say: [
        `Since ${mlab(f)}, estimated traffic has gone from ${B(fmt(f.etv), P.blue)} to ${B(fmt(l.etv), P.blue)} visits a month${ch != null ? ` (${B((ch >= 0 ? "+" : "") + Math.round(ch * 100) + "%", ch >= 0 ? P.green : P.red)})` : ""}, while the keyword count went from ${fmt(f.n)} to ${fmt(l.n)}${kch != null ? ` (${(kch >= 0 ? "+" : "") + Math.round(kch * 100)}%)` : ""}. ${ch != null && kch != null ? (kch > ch + 0.2 ? "Keywords grew faster than traffic, which means the new rankings are mostly low-volume or low-position: breadth without punch." : ch > kch + 0.2 ? "Traffic grew faster than keywords, so existing rankings climbed into higher-click positions: quality over quantity." : "Traffic and keywords moved together.") : ""}`,
        `The peak was ${B(mlab(pk), P.pink)} at ${fmt(pk.etv)} visits; the low point was ${mlab(lo)} at ${fmt(lo.etv)}. ${pk === l || l.etv >= pk.etv * 0.97 ? "The site is at or right next to its high point right now." : `It's currently ${pc(1 - l.etv / (pk.etv || 1))} below its peak.`}`,
        bigJ && Math.abs(bigJ.d) > (pk.etv || 1) * 0.15 ? `The sharpest single-month move was ${B((bigJ.d >= 0 ? "+" : "") + fmt(bigJ.d) + " visits", bigJ.d >= 0 ? P.green : P.red)} into ${mlab(bigJ.h)}. Moves that size usually line up with a Google core update, a site migration or a big content change, so it's worth checking what happened that month.` : null,
      ],
    };
  }
  function drawMomentum() {
    const box = byId("vzMomentum"), hs = SCAN.intel?.hist, m = SCAN.overview?.m || {};
    if (!hs || hs.length < 2) {
      const ent = [["New", m.is_new, P.green], ["Rising", m.is_up, P.blue], ["Falling", m.is_down, P.orange], ["Lost", m.is_lost, P.red]];
      if (!ent.some(e => e[1])) { box.innerHTML = `<div class="vz-empty">No ranking movement data.</div>`; return; }
      const { svg, W } = svgIn("vzMomentum", 200), x = d3.scaleLinear().domain([0, d3.max(ent, e => e[1] || 0) || 1]).range([0, W - 160]);
      ent.forEach(([l, v, c], i) => { T(svg, 0, 30 + i * 44, l, { c: "#0B2545", fs: 12, fw: 700 }); svg.append("rect").attr("x", 80).attr("y", 16 + i * 44).attr("height", 20).attr("rx", 6).attr("fill", c).attr("width", 0).transition().duration(900).delay(i * 100).attr("width", x(v || 0)); T(svg, 86 + x(v || 0), 31 + i * 44, fmt(v || 0), { c, fs: 12, fw: 800, ff: SANS }); });
      return;
    }
    const { svg, W, H } = svgIn("vzMomentum", 300), mg = { l: 44, r: 10, t: 16, b: 30 };
    const x = d3.scaleBand().domain(hs.map((h, i) => i)).range([mg.l, W - mg.r]).padding(.2);
    const mx = d3.max(hs, h => Math.max(h.nw + h.up, h.lo + h.dn)) || 1, y = d3.scaleLinear().domain([-mx, mx]).nice().range([H - mg.b, mg.t]);
    y.ticks(5).forEach(t => { svg.append("line").attr("x1", mg.l).attr("x2", W - mg.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", t === 0 ? "#94A3B8" : "#EEF3F9"); T(svg, mg.l - 6, y(t) + 4, (t > 0 ? "+" : "") + short(t), { c: "#7D8A9B", fs: 9.5, a: "end" }); });
    hs.forEach((h, i) => {
      const segs = [[0, h.nw, P.green], [h.nw, h.nw + h.up, P.blue], [0, -h.lo, P.red], [-h.lo, -(h.lo + h.dn), P.orange]];
      segs.forEach(([a, b, c], j) => { if (a === b) return; const r = svg.append("rect").attr("x", x(i)).attr("width", x.bandwidth()).attr("y", y(0)).attr("height", 0).attr("fill", c).attr("rx", 2); r.transition().duration(800).delay(i * 30 + j * 40).attr("y", y(Math.max(a, b))).attr("height", Math.abs(y(a) - y(b))); tip(r, () => `<b>${mlab(h)}</b>${tr("New keywords", "+" + fmt(h.nw), P.green)}${tr("Moved up", "+" + fmt(h.up), P.blue)}${tr("Moved down", "−" + fmt(h.dn), P.orange)}${tr("Lost", "−" + fmt(h.lo), P.red)}`); });
    });
    const step = Math.ceil(hs.length / (W < 520 ? 4 : 8));
    hs.forEach((h, i) => { if ((i % step === 0 && hs.length - 1 - i >= step / 2) || i === hs.length - 1) T(svg, x(i) + x.bandwidth() / 2, H - mg.b + 16, mlab(h), { c: "#7D8A9B", fs: 9.5, a: "middle" }); });
    const lg = document.createElement("div"); lg.className = "vlg"; box.appendChild(lg);
    lg.innerHTML = [["New", P.green], ["Moved up", P.blue], ["Moved down", P.orange], ["Lost", P.red]].map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
  }
  function storyMomentum() {
    const hs = SCAN.intel?.hist, m = SCAN.overview?.m || {};
    const g = (m.is_new || 0) + (m.is_up || 0), l = (m.is_down || 0) + (m.is_lost || 0);
    const rec = hs && hs.length > 2 ? hs.slice(-3) : null, rg = rec ? sum(rec, h => h.nw + h.up) : g, rl = rec ? sum(rec, h => h.lo + h.dn) : l;
    if (!rg && !rl) return null;
    return {
      c: P.green, k: "Momentum",
      read: hs && hs.length > 1 ? `Each column is a month. Above the line are keywords the site gained (green, new rankings) or improved (blue). Below the line are rankings it lost (red) or slipped on (orange). Tall columns either way mean a lot of churn.` : `Ranking movement in the latest month: new rankings, rankings that rose, rankings that fell and rankings that disappeared.`,
      say: [
        `${rec ? "Over the last three months" : "This month"}, ${D().dom} gained or improved ${B(fmt(rg) + " rankings", P.green)} and lost or slipped on ${B(fmt(rl), P.red)}. ${rg > rl * 1.3 ? "Net momentum is clearly positive: Google is rewarding what this site is doing." : rl > rg * 1.3 ? "Net momentum is negative, which is the earliest warning sign of a traffic decline. Find the pages that are slipping before the losses show up in traffic." : "Gains and losses roughly cancel out: the site is holding steady rather than growing."}`,
        m.is_lost ? `Right now ${fmt(m.is_lost)} keywords have dropped out of the rankings entirely. Some churn is normal on long-tail terms; a sudden spike usually points to a technical problem or a page that was removed or changed.` : null,
      ],
    };
  }
  function drawFunnel() {
    const m = SCAN.overview?.m || {}, box = byId("vzFunnel");
    const st = [["#1", m.pos_1], ["#2-3", m.pos_2_3], ["#4-10", m.pos_4_10], ["#11-20", m.pos_11_20], ["#21-50", (m.pos_21_30 || 0) + (m.pos_31_40 || 0) + (m.pos_41_50 || 0)], ["#51-100", (m.pos_51_60 || 0) + (m.pos_61_70 || 0) + (m.pos_71_80 || 0) + (m.pos_81_90 || 0) + (m.pos_91_100 || 0)]].map(([l, v]) => [l, v || 0]);
    if (!st.some(s => s[1])) { box.innerHTML = `<div class="vz-empty">No position data.</div>`; return; }
    const cols = [P.green, "#7CB518", P.blue, P.gold, P.orange, P.violet], rowH = 44, { svg, W } = svgIn("vzFunnel", st.length * rowH + 10);
    const mx = d3.max(st, s => s[1]) || 1, w = d3.scaleSqrt().domain([0, mx]).range([30, W - 160]), cxm = (W - 80) / 2 + 30;
    st.forEach(([l, v], i) => {
      const y = i * rowH + 4, ww = w(v), nw = i < st.length - 1 ? w(st[i + 1][1]) : ww * 0.8;
      const pth = `M${cxm - ww / 2},${y} L${cxm + ww / 2},${y} L${cxm + Math.max(nw, ww * .7) / 2},${y + rowH - 6} L${cxm - Math.max(nw, ww * .7) / 2},${y + rowH - 6} Z`;
      const p = svg.append("path").attr("d", pth).attr("fill", grad(svg, "fn" + i, [cols[i], [cols[i], .7]], true)).attr("opacity", 0).attr("transform", `translate(0,-8)`);
      p.transition().duration(600).delay(i * 120).attr("opacity", 1).attr("transform", "translate(0,0)");
      tip(p, () => `<b>Ranking ${l}</b>${tr("Keywords", fmt(v), cols[i])}${tr("Share of all rankings", pc(v / (sum(st, s => s[1]) || 1)))}`);
      T(svg, cxm, y + rowH / 2 + 2, fmt(v), { c: "#fff", fs: 13, fw: 900, ff: SANS, a: "middle" }).style("pointer-events", "none");
      T(svg, 0, y + rowH / 2 + 2, l, { c: tc(cols[i]), fs: 12, fw: 800 });
    });
  }
  function storyFunnel() {
    const m = SCAN.overview?.m || {}; if (m.pos_1 == null) return null;
    const top = (m.pos_1 || 0) + (m.pos_2_3 || 0), p1 = top + (m.pos_4_10 || 0), all = m.count || 0;
    return {
      c: P.gold, k: "The ranking funnel",
      read: `Every keyword the site ranks for anywhere in Google's top 100 (not just this market), sorted into position bands. A healthy site looks like an hourglass that's heavy at the top; most sites look like a funnel, wide at the bottom where clicks are rare.`,
      say: [
        `Of ${B(fmt(all) + " total rankings", P.gold)}, ${B(fmt(top), P.green)} are in the top 3 and ${fmt(p1)} are on page one (${pc(p1 / (all || 1))}). ${p1 / (all || 1) < 0.15 ? "Most rankings sit deep in the results where almost nobody clicks, so there's a big pool of pages Google already associates with useful searches but doesn't rate highly yet." : "That's a healthy share of page-one rankings."}`,
        m.pos_11_20 ? `The ${B(fmt(m.pos_11_20) + " rankings on page two", P.gold)} are the closest to paying off. Each one is a page that a modest improvement could move into view.` : null,
      ],
    };
  }

  // ---- 6. SERP features (lollipop)
  const FEAT = { organic: "Regular results", featured_snippet: "Featured snippet", people_also_ask: "People also ask", ai_overview: "AI Overview", local_pack: "Map pack", video: "Videos", images: "Images", top_stories: "Top stories", related_searches: "Related searches", shopping: "Shopping", knowledge_graph: "Knowledge panel", perspectives: "Perspectives", discussions_and_forums: "Discussions & forums", short_videos: "Short videos", paid: "Ads", twitter: "X posts", carousel: "Carousels", recipes: "Recipes", answer_box: "Answer box", popular_products: "Popular products", top_sights: "Top sights", jobs: "Jobs", hotels_pack: "Hotels", events: "Events", google_reviews: "Reviews", people_also_search: "People also search", math_solver: "Math solver", scholarly_articles: "Scholarly articles", things_to_do: "Things to do", visual_stories: "Visual stories", explore_brands: "Brands", map: "Map", stocks_box: "Stocks", find_results_on: "Find results on", refine_products: "Refine products", mention_carousel: "Mentions", knowledge_graph_expanded_item: "Knowledge items" };
  function featData() {
    const rk = SCAN.ranked.filter(r => r.f && r.f.length), n = rk.length, c = {};
    rk.forEach(r => new Set(r.f).forEach(f => { if (f !== "organic") c[f] = (c[f] || 0) + 1; }));
    return { n, list: Object.entries(c).map(([k, v]) => ({ k, v, s: v / (n || 1), l: FEAT[k] || k.replace(/_/g, " ") })).sort((a, b) => b.v - a.v).slice(0, 12) };
  }
  function drawFeat() {
    const { n, list } = featData(), box = byId("vzFeat");
    if (!list.length) { box.innerHTML = `<div class="vz-empty">No SERP feature data.</div>`; return; }
    const rowH = 30, { svg, W } = svgIn("vzFeat", list.length * rowH + 30), lw = Math.min(170, W * .4), x = d3.scaleLinear().domain([0, 1]).range([lw, W - 50]);
    [0, .25, .5, .75, 1].forEach(t => { svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 4).attr("y2", list.length * rowH + 6).attr("stroke", "#EEF3F9"); T(svg, x(t), list.length * rowH + 22, Math.round(t * 100) + "%", { c: "#7D8A9B", fs: 9.5, a: "middle" }); });
    list.forEach((d, i) => {
      const y = i * rowH + 18, c = d.k === "ai_overview" ? P.pink : d.k === "local_pack" ? P.teal : d.k === "featured_snippet" ? P.gold : H.RAINBOW[i % H.RAINBOW.length];
      T(svg, lw - 10, y + 4, cut(d.l, Math.floor((lw - 10) / 6.6)), { c: d.k === "ai_overview" ? P.pink : "#0B2545", fs: 11.5, fw: d.k === "ai_overview" ? 800 : 600, a: "end" });
      svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", y).attr("y2", y).attr("stroke", c).attr("stroke-width", 3).attr("stroke-linecap", "round").transition().duration(900).delay(i * 60).attr("x2", x(d.s));
      const dot = svg.append("circle").attr("cx", x(0)).attr("cy", y).attr("r", 7).attr("fill", c).attr("stroke", "#fff").attr("stroke-width", 2).style("filter", glow(c));
      dot.transition().duration(900).delay(i * 60).attr("cx", x(d.s));
      tip(dot, () => `<b>${esc(d.l)}</b>${tr("Keywords showing it", fmt(d.v) + " of " + fmt(n))}${tr("Share", pc(d.s), c)}`);
      T(svg, x(d.s) + 12, y + 4, pc(d.s), { c, fs: 11, fw: 800 }).attr("opacity", 0).transition().delay(800 + i * 60).attr("opacity", 1);
    });
  }
  function storyFeat() {
    const { n, list } = featData(); if (!list.length) return null;
    const g = k => list.find(d => d.k === k), ai = g("ai_overview"), paa = g("people_also_ask"), fs = g("featured_snippet"), lp = g("local_pack"), vid = g("video") || g("short_videos");
    return {
      c: P.pink, k: "What the results pages look like",
      read: `For the ${fmt(n)} keywords this site ranks for, how often Google shows something other than the ten blue links. Each dot is the share of those results pages that include that feature.`,
      say: [
        ai ? `${B(pc(ai.s) + " show an AI Overview", P.pink)}. On those searches Google answers the question itself above every organic result, so being cited inside the AI Overview matters as much as ranking. ${ai.s > 0.3 ? "That's a big slice of this site's footprint, which makes AI visibility (the answer board above) a priority, not a nice-to-have." : ""}` : `None of these results pages currently show an AI Overview, so classic rankings still decide who gets the click.`,
        paa ? `${pc(paa.s)} show "People also ask" boxes. Answering those exact questions in clear, short sections is one of the easiest ways to pick up extra visibility.` : null,
        [fs && `${pc(fs.s)} have a featured snippet`, lp && `${pc(lp.s)} show a map pack`, vid && `${pc(vid.s)} include videos`].filter(Boolean).length ? `Also: ${and([fs && `${pc(fs.s)} have a featured snippet`, lp && `${pc(lp.s)} show a map pack`, vid && `${pc(vid.s)} include videos`].filter(Boolean))}. Each of those is a separate way into the page beyond the organic list.` : null,
      ],
    };
  }

  // ---- 7. AI visibility: waffle + leaderboard + answer cards
  function aiBoard() {
    const A = SCAN.aivis; const c = {}, disp = {}, brand = brandOf(SCAN);
    A.ans.forEach(a => new Set(a.names.map(n => n.toLowerCase())).forEach(k => { c[k] = (c[k] || 0) + 1; disp[k] = disp[k] || a.names.find(n => n.toLowerCase() === k); }));
    return Object.entries(c).map(([k, v]) => ({ k, v, l: disp[k], me: k.includes(brand.sld) || brand.tokens.some(t => k.includes(t)) })).sort((a, b) => b.v - a.v).slice(0, 10);
  }
  function drawAI() {
    const A = SCAN.aivis, box = byId("vzAI"); if (!A) { box.innerHTML = ""; return; }
    box.innerHTML = "";
    const models = [...new Set(A.ans.map(a => a.m))], qs = A.qs, W = Math.max(280, box.clientWidth || 500), cell = Math.min(62, (W - 110) / qs.length), Hb = models.length * (cell + 10) + 40;
    const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${Hb}`).attr("width", "100%").attr("height", Hb).style("display", "block").style("overflow", "visible");
    qs.forEach((qq, j) => T(svg, 100 + j * (cell + 10) + cell / 2, 14, "Q" + (j + 1), { c: "#5D6B79", fs: 11, fw: 800, a: "middle" }));
    models.forEach((m, i) => {
      const y = 26 + i * (cell + 10);
      T(svg, 0, y + cell / 2 + 4, m, { c: m === "ChatGPT" ? P.teal : P.orange, fs: 13, fw: 800, ff: SANS });
      qs.forEach((qq, j) => {
        const a = A.ans.find(z => z.m === m && z.q === qq), x = 100 + j * (cell + 10), hit = a && a.hit;
        const g = svg.append("g").style("cursor", "pointer").attr("opacity", 0);
        g.append("rect").attr("x", x).attr("y", y).attr("width", cell).attr("height", cell).attr("rx", 12).attr("fill", !a ? "#EEF3F9" : hit ? P.green : "#FFE3EE").attr("stroke", !a ? "#E3EAF2" : hit ? P.green : P.pink).attr("stroke-width", 2);
        T(g, x + cell / 2, y + cell / 2 + 8, !a ? "–" : hit ? "✓" : "✗", { c: !a ? "#94A3B8" : hit ? "#fff" : P.pink, fs: cell * 0.42, fw: 900, ff: SANS, a: "middle" });
        if (hit && a.pos) T(g, x + cell - 6, y + 14, "#" + a.pos, { c: "#fff", fs: 10, fw: 800, a: "end" });
        g.transition().delay(200 + (i * qs.length + j) * 120).duration(400).attr("opacity", 1);
        tip(g, () => `<b>${esc(m)} · Q${j + 1}</b><div style="color:#5D6B79;font-size:12px;margin:2px 0 6px">${esc(qq)}</div>${tr("Names this site", hit ? "yes" + (a.pos ? " (#" + a.pos + ")" : "") : a ? "no" : "no answer", hit ? P.green : P.pink)}${a && a.names.length ? `<div style="font-size:12px;color:#33475B;margin-top:4px">${a.names.slice(0, 5).map(esc).join(" · ")}</div>` : ""}`);
      });
    });
    const board = aiBoard(), lb = byId("vzAIboard");
    if (lb) {
      if (!board.length) lb.innerHTML = `<div class="vz-empty">The assistants didn't name specific brands.</div>`;
      else {
        lb.innerHTML = ""; const rowH = 28, svg2 = d3.select(lb).append("svg").attr("viewBox", `0 0 ${W} ${board.length * rowH + 6}`).attr("width", "100%").attr("height", board.length * rowH + 6).style("display", "block");
        const lw = Math.min(190, W * .42), x = d3.scaleLinear().domain([0, A.ans.length]).range([0, W - lw - 40]);
        board.forEach((b, i) => {
          const y = i * rowH + 4, c = b.me ? P.green : H.RAINBOW[(i + 1) % H.RAINBOW.length];
          T(svg2, lw - 8, y + 15, cut(b.l, Math.floor(lw / 6.6)), { c: b.me ? P.green : "#0B2545", fs: 11.5, fw: b.me ? 900 : 600, a: "end" });
          svg2.append("rect").attr("x", lw).attr("y", y + 3).attr("height", 18).attr("rx", 6).attr("width", 0).attr("fill", c).transition().duration(800).delay(i * 70).attr("width", Math.max(4, x(b.v)));
          T(svg2, lw + x(b.v) + 6, y + 16, b.v + "×", { c: tc(c), fs: 11, fw: 800 });
        });
      }
    }
    const cards = byId("aiCards");
    if (cards) cards.innerHTML = A.ans.map((a, i) => `<details class="aicard ${a.hit ? "hit" : "miss"}" style="animation-delay:${i * 70}ms"><summary><span class="aim ${a.m === "ChatGPT" ? "gpt" : "cl"}">${esc(a.m)}</span><span class="aiq">${esc(a.q)}</span><b>${a.hit ? "✓ named" + (a.pos ? " #" + a.pos : "") : "✗ not named"}</b></summary><div class="ain">${a.names.length ? `<div class="ainames">${a.names.map(n => `<i>${esc(n)}</i>`).join("")}</div>` : ""}<p>${esc(a.snip)}${a.snip.length >= 900 ? "…" : ""}</p></div></details>`).join("");
  }
  function storyAI() {
    const A = SCAN.aivis; if (!A) return null;
    const hits = A.ans.filter(a => a.hit), board = aiBoard(), others = board.filter(b => !b.me).slice(0, 3);
    const byM = m => A.ans.filter(a => a.m === m), mh = m => byM(m).filter(a => a.hit).length;
    return {
      c: P.pink, k: "Does AI recommend this site?",
      read: `We asked ChatGPT and Claude the questions a real customer would ask (shown in the cards below). Each square is one answer: green with a tick means the assistant named this site or brand, pink with a cross means it didn't. The bar chart counts which brands the assistants named most often across all answers.`,
      say: [
        `${D().dom} was named in ${B(hits.length + " of " + A.ans.length + " AI answers", hits.length ? P.green : P.pink)} (ChatGPT ${mh("ChatGPT")} of ${byM("ChatGPT").length}, Claude ${mh("Claude")} of ${byM("Claude").length}). ${!hits.length ? "Right now, when someone asks an AI assistant for this kind of help, this site isn't part of the answer." : hits.length === A.ans.length ? "That's full AI visibility: both assistants consistently recommend this site." : "That's partial visibility: the site shows up for some questions and not others."}`,
        others.length ? `The names the assistants reach for most are ${and(others.map(b => B(esc(b.l), P.violet) + ` (${b.v}×)`))}. These are the brands AI models have learned to associate with this topic, usually because they're mentioned often across reviews, directories, news and forums, not just their own sites.` : null,
        `These answers come from the models' own knowledge (no live web search), which reflects how a brand is represented across the web over time. It's a slow-moving signal, which is exactly why it's worth starting on early.`,
      ],
      move: hits.length < A.ans.length ? `Get mentioned where AI models learn: industry directories, comparison and "best of" articles, Reddit and forum answers, podcasts and local news. Consistent name + topic mentions across many independent sites is what moves this.` : "Keep the brand mentions flowing and check again each quarter; competitors are working on this too.",
    };
  }

  // ---- 8. AI SWOT
  function drawSwot() {
    const W = SCAN.swot, box = byId("vzSwot"); if (!W) { box.innerHTML = ""; return; }
    const q4 = [["s", "Strengths", P.green, "▲"], ["w", "Weaknesses", P.pink, "▼"], ["o", "Opportunities", P.blue, "✦"], ["t", "Threats", P.orange, "⚠"]];
    box.innerHTML = `${W.verdict ? `<div class="verdict"><span>AI verdict</span>${esc(W.verdict)}</div>` : ""}<div class="swot">${q4.map(([k, l, c, ic], i) => `<div class="sq" style="--c:${c};animation-delay:${i * 120}ms"><div class="sq-h"><b>${ic}</b>${l}</div><ul>${(W[k] || []).map(x => `<li>${esc(x)}</li>`).join("") || "<li>–</li>"}</ul></div>`).join("")}</div>`;
  }

  // ---- 9. Site health (crawl)
  function issList() {
    const C = SCAN.crawl?.sum; if (!C) return [];
    const o = {}; Object.entries(C.issues || {}).forEach(([k, v]) => { if (ISS[k] && v > 0) o[k] = v; });
    ["broken_links", "duplicate_title", "duplicate_description", "duplicate_content", "non_indexable", "redirect_loop", "broken_resources"].forEach(k => { const v = C.pm?.[k]; if (v > 0 && ISS[k]) o[k] = Math.max(o[k] || 0, v); });
    return Object.entries(o).map(([k, v]) => ({ k, v, l: ISS[k][0], sev: ISS[k][1] })).sort((a, b) => b.sev - a.sev || b.v - a.v);
  }
  function drawHealth() {
    const C = SCAN.crawl?.sum, box = byId("vzHealth"); if (!C) { box.innerHTML = ""; return; }
    box.innerHTML = "";
    const W = Math.max(280, box.clientWidth || 600), Hh = 230, svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${Hh}`).attr("width", "100%").attr("height", Hh).style("display", "block").style("overflow", "visible");
    const s = C.score == null ? 0 : C.score, gx = W < 560 ? W / 2 : W * 0.27, g = svg.append("g").attr("transform", `translate(${gx},${Hh / 2 + 6})`), r = 88, a0 = -0.75 * Math.PI, a1 = 0.75 * Math.PI;
    const arc = d3.arc().innerRadius(r - 18).outerRadius(r).cornerRadius(9), sc = d3.scaleLinear().domain([0, 100]).range([a0, a1]);
    g.append("path").attr("d", arc({ startAngle: a0, endAngle: a1 })).attr("fill", "#EEF3F9");
    const col = gcol(s);
    g.append("path").attr("fill", grad(svg, "hg", [P.red, P.gold, P.green])).style("filter", glow(col)).transition().duration(1500).ease(d3.easeCubicOut).attrTween("d", () => { const it = d3.interpolate(a0, sc(Math.max(2, s))); return t => arc({ startAngle: a0, endAngle: it(t) }); });
    T(g, 0, 6, Math.round(s), { c: tc(col), fs: 46, fw: 900, ff: SANS, a: "middle" });
    T(g, 0, 28, "ON-PAGE SCORE", { c: "#5D6B79", fs: 10, fw: 800, a: "middle" });
    T(g, 0, r + 10, `${fmt(C.crawled)} pages crawled${C.total && C.total > C.crawled ? " of " + fmt(C.total) + " found" : ""}`, { c: "#7D8A9B", fs: 10.5, a: "middle" });
    const pages = SCAN.crawl.pages || [];
    if (pages.length && W >= 560) {
      const bins = [["2xx OK", p => p.s >= 200 && p.s < 300, P.green], ["3xx redirect", p => p.s >= 300 && p.s < 400, P.gold], ["4xx error", p => p.s >= 400 && p.s < 500, P.red], ["5xx error", p => p.s >= 500, P.purple]].map(([l, f, c]) => ({ l, c, v: pages.filter(f).length })).filter(b => b.v);
      const dg = svg.append("g").attr("transform", `translate(${W * 0.64},${Hh / 2})`), pie = d3.pie().sort(null).value(d => d.v)(bins), ar = d3.arc().innerRadius(52).outerRadius(86).padAngle(.02).cornerRadius(4);
      dg.selectAll("path").data(pie).enter().append("path").attr("fill", d => d.data.c).each(function (d) { tip(d3.select(this), () => `<b>${d.data.l}</b>${tr("Pages", fmt(d.data.v))}${tr("Share", pc(d.data.v / pages.length))}`); }).transition().duration(1200).delay((d, i) => i * 120).attrTween("d", d => { const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d); return t => ar(i(t)); });
      T(dg, 0, 2, fmt(pages.length), { c: "#0B2545", fs: 22, fw: 900, ff: SANS, a: "middle" }); T(dg, 0, 18, "pages by status", { c: "#5D6B79", fs: 10, a: "middle" });
      bins.forEach((b, i) => { const ly = -30 + i * 20; dg.append("rect").attr("x", 98).attr("y", ly - 9).attr("width", 10).attr("height", 10).attr("rx", 3).attr("fill", b.c); T(dg, 113, ly, `${b.l.slice(0, 3)} · ${fmt(b.v)}`, { c: tc(b.c), fs: 11, fw: 800 }); });
    }
    const ck = C.checks || {}, items = [["sitemap", "XML sitemap"], ["robots_txt", "robots.txt"], ["ssl", "Valid SSL"], ["http2", "HTTP/2"], ["test_https_redirect", "HTTP → HTTPS redirect"], ["test_www_redirect", "www redirect"], ["test_canonicalization", "Canonicalization"], ["test_page_not_found", "Proper 404 page"], ["test_hidden_server_signature", "Server signature hidden"], ["test_directory_browsing", "Directory browsing blocked"]].filter(([k]) => ck[k] != null);
    const cl = byId("vzChecks");
    if (cl) cl.innerHTML = items.length ? `<div class="checks">${items.map(([k, l], i) => { const v = !!ck[k], good = k === "test_directory_browsing" ? !v : v; return `<span class="${good ? "ok" : "no"}" style="animation-delay:${i * 60}ms"><b>${good ? "✓" : "✗"}</b>${l}</span>`; }).join("")}${C.cms ? `<span class="info"><b>⚙</b>${esc(C.cms)}</span>` : ""}${C.server ? `<span class="info"><b>⛁</b>${esc(cut(C.server, 24))}</span>` : ""}</div>` : "";
  }
  function drawIssues() {
    const L = issList().slice(0, 16), box = byId("vzIssues"), C = SCAN.crawl?.sum; if (!C) { box.innerHTML = ""; return; }
    if (!L.length) { box.innerHTML = `<div class="vz-empty"><b>No issues found.</b> Every crawled page passed the checks.</div>`; return; }
    const rowH = 28, { svg, W } = svgIn("vzIssues", L.length * rowH + 34), lw = Math.min(230, W * .42), tot = C.crawled || 1, x = d3.scaleLinear().domain([0, d3.max(L, d => d.v)]).range([0, W - lw - 70]);
    L.forEach((d, i) => {
      const y = i * rowH + 6, c = SEV[d.sev][1];
      svg.append("circle").attr("cx", 6).attr("cy", y + 11).attr("r", 4.5).attr("fill", c);
      T(svg, 16, y + 15, cut(d.l, Math.floor((lw - 20) / 6.4)), { c: "#0B2545", fs: 11.5, fw: d.sev >= 3 ? 800 : 600 });
      const r = svg.append("rect").attr("x", lw).attr("y", y + 2).attr("height", 18).attr("rx", 5).attr("width", 0).attr("fill", grad(svg, "is" + i, [c, [c, .55]]));
      r.transition().duration(800).delay(i * 50).attr("width", Math.max(4, x(d.v)));
      tip(r, () => `<b>${esc(d.l)}</b>${tr("Severity", SEV[d.sev][0], c)}${tr("Affected", fmt(d.v) + (d.v <= tot ? " of " + fmt(tot) + " pages" : ""))}`);
      T(svg, lw + Math.max(4, x(d.v)) + 6, y + 16, fmt(d.v), { c: tc(c), fs: 11.5, fw: 800 });
    });
    const ly = L.length * rowH + 22; let lx = 0;
    SEV.slice().reverse().forEach(([l, c]) => { svg.append("circle").attr("cx", lx + 5).attr("cy", ly - 4).attr("r", 4.5).attr("fill", c); T(svg, lx + 14, ly, l, { c: "#5D6B79", fs: 10.5 }); lx += 80; });
  }
  function drawSpeed() {
    const pages = (SCAN.crawl?.pages || []).filter(p => p.t != null && p.w != null && p.s < 400), box = byId("vzSpeed");
    if (pages.length < 3) { box.innerHTML = `<div class="vz-empty">Not enough page timing data.</div>`; return; }
    const { svg, W, H } = svgIn("vzSpeed", 320), m = { l: 50, r: 14, t: 14, b: 40 };
    const x = d3.scaleLog().domain([Math.max(50, d3.min(pages, p => p.t) * .8), d3.max(pages, p => p.t) * 1.2]).range([m.l, W - m.r]).nice();
    const y = d3.scaleSymlog().constant(50).domain([0, d3.max(pages, p => p.w) * 1.15]).range([H - m.b, m.t]).nice();
    const col = d3.scaleSequential(d3.interpolateRgbBasis([P.red, P.orange, P.gold, "#7CB518", P.green])).domain([40, 100]).clamp(true);
    const r = d3.scaleSqrt().domain([0, d3.max(pages, p => p.il || 0) || 1]).range([4, 13]);
    svg.append("rect").attr("x", x(3000)).attr("y", m.t).attr("width", Math.max(0, W - m.r - x(3000))).attr("height", H - m.t - m.b).attr("fill", P.red).attr("opacity", .05);
    T(svg, W - m.r - 6, m.t + 14, "slow (over 3s)", { c: P.red, fs: 10, fw: 800, a: "end" });
    [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(t => t >= x.domain()[0] && t <= x.domain()[1]).forEach(t => { svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#EEF3F9"); T(svg, x(t), H - m.b + 15, t >= 1000 ? (t / 1000) + "s" : t + "ms", { c: "#7D8A9B", fs: 9.5, a: "middle" }); });
    [0, 100, 250, 500, 1000, 2500, 5000, 10000, 25000].filter(t => t <= y.domain()[1]).forEach(t => T(svg, m.l - 6, y(t) + 4, short(t), { c: "#7D8A9B", fs: 9.5, a: "end" }));
    T(svg, (m.l + W - m.r) / 2, H - 5, "load time (log scale) →", { c: "#5D6B79", fs: 10.5, a: "middle" }); T(svg, 4, 10, "↑ words on page", { c: "#5D6B79", fs: 10.5 });
    const dots = svg.append("g").selectAll("circle").data(pages).enter().append("circle").attr("cx", p => x(Math.max(x.domain()[0], p.t))).attr("cy", p => y(p.w)).attr("r", 0).attr("fill", p => col(p.sc ?? 50)).attr("fill-opacity", .82).attr("stroke", "#fff").attr("stroke-width", 1.2).style("cursor", "pointer");
    dots.transition().duration(700).delay((p, i) => i * 8).attr("r", p => r(p.il || 0));
    tip(dots, p => `<b>${esc(cut(p.u.replace(/^https?:\/\/[^/]+/, "") || "/", 60))}</b>${tr("Load time", fmt(p.t) + " ms", p.t > 3000 ? P.red : null)}${tr("Words", fmt(p.w))}${tr("On-page score", p.sc != null ? Math.round(p.sc) : "–", tc(col(p.sc ?? 50)))}${tr("Internal links", fmt(p.il || 0))}${p.iss.length ? `<div style="font-size:12px;color:#B4232F;margin-top:4px">${p.iss.slice(0, 4).map(k => esc(ISS[k][0])).join(" · ")}</div>` : ""}`);
  }
  function drawCrawlTable() {
    const pages = (SCAN.crawl?.pages || []).slice().sort((a, b) => (b.iss.reduce((s, k) => s + ISS[k][1] ** 2, 0) - a.iss.reduce((s, k) => s + ISS[k][1] ** 2, 0)) || ((a.sc ?? 100) - (b.sc ?? 100))).slice(0, 25), box = byId("vzCrawlTable");
    if (!pages.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<table class="tbl ctab"><tr><th>Page</th><th class="n">Status</th><th class="n">Score</th><th class="n">Load</th><th class="n">Words</th><th>Issues</th></tr>${pages.map(p => { const path = p.u.replace(/^https?:\/\/[^/]+/, "") || "/"; return `<tr><td class="kw" title="${esc(p.u)}">${esc(cut(path, 52))}</td><td class="n"><span class="pos" style="background:${p.s >= 400 ? "rgba(229,57,75,.12)" : p.s >= 300 ? "rgba(245,164,0,.14)" : "rgba(31,180,98,.12)"};color:${p.s >= 400 ? "#B4232F" : p.s >= 300 ? "#A86A00" : "#138A4A"}">${p.s ?? "–"}</span></td><td class="n" style="color:${tc(gcol(p.sc))};font-weight:800">${p.sc != null ? Math.round(p.sc) : "–"}</td><td class="n">${p.t != null ? (p.t >= 1000 ? (p.t / 1000).toFixed(1) + "s" : p.t + "ms") : "–"}</td><td class="n">${p.w != null ? fmt(p.w) : "–"}</td><td>${p.iss.sort((a, b) => ISS[b][1] - ISS[a][1]).slice(0, 4).map(k => `<i class="ich s${ISS[k][1]}">${esc(ISS[k][0])}</i>`).join("") || '<i class="ich ok">clean</i>'}</td></tr>`; }).join("")}</table>`;
  }
  function storyHealth() {
    const C = SCAN.crawl?.sum; if (!C) return null;
    const L = issList(), crit = L.filter(d => d.sev >= 3), warn = L.filter(d => d.sev === 2), pages = SCAN.crawl.pages || [];
    const slow = pages.filter(p => p.t > 3000).length, thin = pages.filter(p => p.w != null && p.w < 250 && p.s < 300).length, s = C.score;
    return {
      c: P.orange, k: "Site health",
      read: `We crawled ${fmt(C.crawled)} pages of the site the way Google's crawler would. The dial is DataForSEO's on-page score (0 to 100, higher is healthier), the ring shows pages by HTTP status, and the bars list every issue found, colored by severity: red is critical, orange is a warning, blue is a notice. The scatter plots each page by load time and length, colored by its score.`,
      say: [
        s != null ? `The site scores ${B(Math.round(s) + "/100", gcol(s))}. ${s >= 90 ? "That's technically clean: nothing here is holding rankings back." : s >= 75 ? "That's decent, with a handful of fixable problems." : "That's low enough that technical problems are likely costing rankings right now."}` : null,
        crit.length ? `There ${crit.length === 1 ? "is" : "are"} ${B(plural(crit.length, "critical issue type"), P.red)}: ${and(crit.slice(0, 4).map(d => `${esc(d.l.toLowerCase())} (${fmt(d.v)})`))}. Critical issues stop pages from being crawled, indexed or trusted, so they come first.` : `No critical issues were found, which is a good sign.`,
        warn.length ? `Warnings include ${and(warn.slice(0, 4).map(d => `${esc(d.l.toLowerCase())} (${fmt(d.v)})`))}.` : null,
        slow || thin ? `${slow ? `${B(plural(slow, "page"), P.red)} take over three seconds to load. ` : ""}${thin ? `${plural(thin, "page")} have fewer than 250 words, which is usually too thin to rank for anything competitive.` : ""}` : null,
      ],
      move: crit.length ? `Fix the ${crit[0].l.toLowerCase()} first, then work down the table of worst pages below; most fixes are template-level and apply to many pages at once.` : warn.length ? `Clear the warnings starting with ${warn[0].l.toLowerCase()}, then re-crawl to confirm.` : "Keep it clean: re-crawl after every major site change.",
    };
  }

  /* ---------- registration ---------- */
  const D = () => INSIGHTS.D();
  INSIGHTS.add("vzScore", drawScore, "st-score", storyScore);
  INSIGHTS.add("vzAge", drawAge, "st-age", storyAge);
  INSIGHTS.add("vzTech", drawTech, "st-tech", storyTech);
  INSIGHTS.add("vzLinks", drawLinks, "st-links", storyLinks);
  INSIGHTS.add("vzRose", drawRose); INSIGHTS.add("vzMix", drawLinkMix);
  INSIGHTS.add("vzTrend", drawTrend, "st-trend", storyTrend);
  INSIGHTS.add("vzMomentum", drawMomentum, "st-momentum", storyMomentum);
  INSIGHTS.add("vzFunnel", drawFunnel, "st-funnel", storyFunnel);
  INSIGHTS.add("vzFeat", drawFeat, "st-feat", storyFeat);
  INSIGHTS.add("vzAI", drawAI, "st-ai", storyAI);
  INSIGHTS.add("vzSwot", drawSwot);
  INSIGHTS.add("vzHealth", drawHealth, "st-health", storyHealth);
  INSIGHTS.add("vzIssues", drawIssues); INSIGHTS.add("vzSpeed", drawSpeed); INSIGHTS.add("vzCrawlTable", drawCrawlTable);
  window.INTEL = { prepare, scores: () => SC };
})();
