"use strict";
/* Left on the Table · SEO market gap scanner
   Live mode: page served by server.py (credentials stay on your machine).
   Key mode: your own DataForSEO key, calls go straight from the browser.
   Demo mode: replay saved scans. */

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.round(n || 0).toLocaleString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function short(n) { n = n || 0; const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(1) + "B"; if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M"; if (a >= 1e4) return Math.round(n / 1e3) + "K"; if (a >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(Math.round(n)); }
const money = n => "$" + short(n);
const API = "https://api.dataforseo.com/v3/";
const LANG = "en";
const EP = {
  overview: "dataforseo_labs/google/domain_rank_overview/live",
  ranked: "dataforseo_labs/google/ranked_keywords/live",
  forSite: "dataforseo_labs/google/keywords_for_site/live",
  related: "dataforseo_labs/google/related_keywords/live",
  suggest: "dataforseo_labs/google/keyword_suggestions/live",
  serpComp: "dataforseo_labs/google/serp_competitors/live",
  ads: "keywords_data/google_ads/search_volume/live",
  serp: "serp/google/organic/live/advanced",
};

/* ---------- geography ---------- */
const COUNTRIES = { us: { code: 2840, name: "United States" }, uk: { code: 2826, name: "United Kingdom" }, ca: { code: 2124, name: "Canada" }, au: { code: 2036, name: "Australia" } };
const STATES = [["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"], ["District of Columbia", "DC"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"]];
const CITIES = { "new york city": "NY", "nyc": "NY", "brooklyn": "NY", "manhattan": "NY", "queens": "NY", "bronx": "NY", "long island": "NY", "buffalo": "NY", "rochester": "NY", "albany": "NY", "los angeles": "CA", "san diego": "CA", "san francisco": "CA", "san jose": "CA", "sacramento": "CA", "fresno": "CA", "oakland": "CA", "riverside": "CA", "chicago": "IL", "houston": "TX", "dallas": "TX", "austin": "TX", "san antonio": "TX", "fort worth": "TX", "el paso": "TX", "phoenix": "AZ", "tucson": "AZ", "mesa": "AZ", "philadelphia": "PA", "pittsburgh": "PA", "jacksonville": "FL", "miami": "FL", "tampa": "FL", "orlando": "FL", "fort lauderdale": "FL", "columbus": "OH", "cleveland": "OH", "cincinnati": "OH", "indianapolis": "IN", "charlotte": "NC", "raleigh": "NC", "seattle": "WA", "spokane": "WA", "denver": "CO", "boston": "MA", "nashville": "TN", "memphis": "TN", "detroit": "MI", "portland": "OR", "las vegas": "NV", "louisville": "KY", "baltimore": "MD", "milwaukee": "WI", "albuquerque": "NM", "kansas city": "MO", "st louis": "MO", "atlanta": "GA", "omaha": "NE", "minneapolis": "MN", "new orleans": "LA", "tulsa": "OK", "oklahoma city": "OK", "salt lake city": "UT", "honolulu": "HI", "birmingham": "AL", "richmond": "VA", "virginia beach": "VA", "hartford": "CT", "providence": "RI", "newark": "NJ", "orange county": "CA", "daytona": "FL", "calgary": "AB", "edmonton": "AB", "alberta": "AB", "toronto": "ON", "ottawa": "ON", "montreal": "QC", "quebec": "QC", "winnipeg": "MB", "manitoba": "MB", "saskatchewan": "SK", "british columbia": "BC", "nova scotia": "NS", "london": "UK", "manchester uk": "UK", "sydney": "AU", "melbourne": "AU", "brisbane": "AU", "perth": "AU", "philly": "PA", "phila": "PA", "jersey city": "NJ", "paterson": "NJ", "trenton": "NJ", "camden": "NJ", "hoboken": "NJ", "wilmington": "DE", "charleston": "SC", "boise": "ID", "anchorage": "AK", "des moines": "IA", "little rock": "AR", "wichita": "KS", "jackson": "MS", "billings": "MT", "manchester": "NH", "fargo": "ND", "sioux falls": "SD", "burlington": "VT", "cheyenne": "WY", "washington dc": "DC" };
const STATE_CITY = { AL: "Birmingham", AK: "Anchorage", AZ: "Phoenix", AR: "Little Rock", CA: "Los Angeles", CO: "Denver", CT: "Hartford", DE: "Wilmington", DC: "Washington", FL: "Miami", GA: "Atlanta", HI: "Honolulu", ID: "Boise", IL: "Chicago", IN: "Indianapolis", IA: "Des Moines", KS: "Wichita", KY: "Louisville", LA: "New Orleans", ME: "Portland", MD: "Baltimore", MA: "Boston", MI: "Detroit", MN: "Minneapolis", MS: "Jackson", MO: "Kansas City", MT: "Billings", NE: "Omaha", NV: "Las Vegas", NH: "Manchester", NJ: "Newark", NM: "Albuquerque", NY: "New York", NC: "Charlotte", ND: "Fargo", OH: "Columbus", OK: "Oklahoma City", OR: "Portland", PA: "Philadelphia", RI: "Providence", SC: "Columbia", SD: "Sioux Falls", TN: "Nashville", TX: "Houston", UT: "Salt Lake City", VT: "Burlington", VA: "Virginia Beach", WA: "Seattle", WV: "Charleston", WI: "Milwaukee", WY: "Cheyenne" };
const AMBIGUOUS_ABBR = new Set(["in", "or", "me", "hi", "ok", "de", "id"]);
"new york:NY,los angeles:CA,chicago:IL,houston:TX,phoenix:AZ,philadelphia:PA,san antonio:TX,san diego:CA,dallas:TX,austin:TX,jacksonville:FL,fort worth:TX,columbus:OH,charlotte:NC,indianapolis:IN,san francisco:CA,seattle:WA,denver:CO,oklahoma city:OK,nashville:TN,el paso:TX,washington:DC,boston:MA,las vegas:NV,portland:OR,louisville:KY,memphis:TN,detroit:MI,baltimore:MD,milwaukee:WI,albuquerque:NM,tucson:AZ,fresno:CA,sacramento:CA,mesa:AZ,kansas city:MO,atlanta:GA,omaha:NE,colorado springs:CO,raleigh:NC,long beach:CA,virginia beach:VA,miami:FL,oakland:CA,minneapolis:MN,tulsa:OK,bakersfield:CA,wichita:KS,arlington:TX,aurora:CO,tampa:FL,new orleans:LA,cleveland:OH,honolulu:HI,anaheim:CA,lexington:KY,stockton:CA,corpus christi:TX,henderson:NV,riverside:CA,saint paul:MN,st paul:MN,santa ana:CA,cincinnati:OH,irvine:CA,orlando:FL,pittsburgh:PA,st louis:MO,saint louis:MO,greensboro:NC,lincoln:NE,anchorage:AK,plano:TX,durham:NC,buffalo:NY,chandler:AZ,chula vista:CA,toledo:OH,madison:WI,gilbert:AZ,reno:NV,fort wayne:IN,north las vegas:NV,st petersburg:FL,lubbock:TX,irving:TX,laredo:TX,winston salem:NC,chesapeake:VA,glendale:AZ,garland:TX,scottsdale:AZ,norfolk:VA,boise:ID,fremont:CA,spokane:WA,santa clarita:CA,baton rouge:LA,richmond:VA,hialeah:FL,san bernardino:CA,tacoma:WA,modesto:CA,huntsville:AL,des moines:IA,yonkers:NY,rochester:NY,moreno valley:CA,fayetteville:NC,fontana:CA,columbus ga:GA,worcester:MA,port st lucie:FL,little rock:AR,augusta:GA,oxnard:CA,birmingham:AL,montgomery:AL,frisco:TX,amarillo:TX,salt lake city:UT,grand rapids:MI,huntington beach:CA,overland park:KS,glendale ca:CA,tallahassee:FL,grand prairie:TX,mckinney:TX,cape coral:FL,sioux falls:SD,peoria:AZ,providence:RI,vancouver:WA,knoxville:TN,akron:OH,shreveport:LA,mobile:AL,brownsville:TX,newport news:VA,fort lauderdale:FL,chattanooga:TN,tempe:AZ,ontario:CA,cary:NC,eugene:OR,elk grove:CA,salem:OR,santa rosa:CA,clarksville:TN,rancho cucamonga:CA,springfield:MO,pembroke pines:FL,murfreesboro:TN,fort collins:CO,lancaster:CA,palmdale:CA,corona:CA,salinas:CA,killeen:TX,hayward:CA,alexandria:VA,hollywood:FL,macon:GA,kansas city ks:KS,lakewood co:CO,sunnyvale:CA,pasadena:CA,escondido:CA,joliet:IL,naperville:IL,rockford:IL,savannah:GA,bridgeport:CT,mesquite:TX,syracuse:NY,midland:TX,mcallen:TX,dayton:OH,orange:CA,olathe:KS,fullerton:CA,torrance:CA,denton:TX,thornton:CO,waco:TX,surprise:AZ,charleston:SC,west valley city:UT,visalia:CA,warren:MI,gainesville:FL,coral springs:FL,stamford:CT,cedar rapids:IA,sterling heights:MI,new haven:CT,columbia:SC,carrollton:TX,thousand oaks:CA,elizabeth:NJ,concord:CA,simi valley:CA,topeka:KS,victorville:CA,lafayette:LA,round rock:TX,abilene:TX,athens:GA,vallejo:CA,allentown:PA,evansville:IN,beaumont:TX,independence:MO,ann arbor:MI,provo:UT,lansing:MI,peoria il:IL,downey:CA,berkeley:CA,miami gardens:FL,costa mesa:CA,inglewood:CA,manchester:NH,elgin:IL,miramar:FL,odessa:TX,wilmington nc:NC,arvada:CO,westminster:CO,fairfield:CA,rochester mn:MN,carlsbad:CA,clearwater:FL,gresham:OR,pueblo:CO,high point:NC,west palm beach:FL,murrieta:CA,richardson:TX,temecula:CA,billings:MT,lowell:MA,antioch:CA,college station:TX,pompano beach:FL,boulder:CO,palm bay:FL,norman:OK,broken arrow:OK,green bay:WI,davenport:IA,wichita falls:TX,burbank:CA,ventura:CA,south bend:IN,lakeland:FL,el monte:CA,rialto:CA,las cruces:NM,league city:TX,tyler:TX,sugar land:TX,kent:WA,everett:WA,jurupa valley:CA,san mateo:CA,daly city:CA,gastonia:NC,kennesaw:GA,marietta:GA,sandy springs:GA,roswell:GA,boca raton:FL,delray beach:FL,naples:FL,sarasota:FL,ocala:FL,daytona beach:FL,kissimmee:FL,fort myers:FL,pensacola:FL,san jose:CA,long island:NY,brooklyn:NY,queens:NY,bronx:NY,staten island:NY,manhattan:NY,albany:NY,white plains:NY,scranton:PA,harrisburg:PA,reading:PA,bethlehem:PA,erie:PA,lancaster pa:PA,wilmington:DE,dover:DE,hartford:CT,stamford ct:CT,waterbury:CT,springfield ma:MA,cambridge:MA,quincy:MA,baltimore md:MD,silver spring:MD,rockville:MD,annapolis:MD,frederick:MD,norfolk va:VA,roanoke:VA,lynchburg:VA,greenville:SC,myrtle beach:SC,asheville:NC,knoxville tn:TN,jackson:MS,gulfport:MS,biloxi:MS,baton rouge la:LA,lake charles:LA,little rock ar:AR,tulsa ok:OK,kenner:LA,metairie:LA,san marcos:TX,the woodlands:TX,katy:TX,conroe:TX,pearland:TX,pasadena tx:TX,bakersfield ca:CA,long beach ca:CA,san bernardino ca:CA,palm springs:CA,santa monica:CA,beverly hills:CA,santa barbara:CA,san luis obispo:CA,redding:CA,chico:CA,eureka:CA,flagstaff:AZ,yuma:AZ,prescott:AZ,st george:UT,ogden:UT,orem:UT,boise id:ID,idaho falls:ID,missoula:MT,bozeman:MT,cheyenne:WY,casper:WY,fargo:ND,bismarck:ND,rapid city:SD,duluth:MN,bloomington:IN,carmel:IN,lafayette in:IN,toledo oh:OH,youngstown:OH,canton:OH,flint:MI,kalamazoo:MI,traverse city:MI,dearborn:MI,madison wi:WI,kenosha:WI,racine:WI,appleton:WI,des moines ia:IA,iowa city:IA,sioux city:IA,springfield il:IL,champaign:IL,aurora il:IL,schaumburg:IL,evanston:IL,st charles:MO,columbia mo:MO,lincoln ne:NE,lawrence:KS,manhattan ks:KS,albuquerque nm:NM,santa fe:NM,reno nv:NV,carson city:NV,tacoma wa:WA,bellevue:WA,olympia:WA,yakima:WA,bend:OR,medford:OR,juneau:AK,fairbanks:AK,hilo:HI,maui:HI,burlington vt:VT,portland me:ME,bangor:ME,nashua:NH,concord nh:NH,providence ri:RI,warwick:RI,charleston wv:WV,morgantown:WV,huntington:WV".split(",").forEach(x => { const [c, a] = x.split(":"); if (!(c in CITIES)) CITIES[c] = a; });
function geoFilter(loc, seeds) {
  if (!loc.region) {
    // nationwide market: leave out searches tied to a specific city or state, unless the seed itself names one
    if (loc.country !== "us" || !(seeds && seeds.length)) return () => true;
    const sd = seeds.join(" ");
    const names = [...STATES.map(s => s[0].toLowerCase()), ...Object.entries(CITIES).filter(([c, a]) => a.length === 2 && !["UK", "AU"].includes(a)).map(([c]) => c)].filter(n => !sd.includes(n) && !["washington", "orange", "mobile", "reading", "independence", "surprise", "bend", "kent", "normal", "columbia", "warren", "concord", "salem", "jackson", "springfield", "athens", "lafayette", "dover", "huntington", "lancaster", "glendale", "pasadena", "aurora", "arlington", "fairfield", "carmel", "quincy", "cambridge", "frederick", "greenville", "naples", "richmond", "columbus", "manhattan", "lincoln", "henderson", "independence", "midland", "orange county"].includes(n));
    const res = names.map(b => new RegExp("(^|\\s)" + b.replace(/\s+/g, "\\s+") + "($|\\s)"));
    return k => !res.some(r => r.test(k));
  }
  const mine = loc.abbr;
  const bad = [];
  STATES.forEach(([n, a]) => { if (a !== mine) { bad.push(n.toLowerCase()); if (!AMBIGUOUS_ABBR.has(a.toLowerCase())) bad.push(a.toLowerCase()); } });
  const COMMON = new Set(["orange", "mobile", "reading", "independence", "surprise", "bend", "kent", "normal", "columbia", "warren", "concord", "salem", "jackson", "springfield", "athens", "lafayette", "dover", "huntington", "lancaster", "ontario", "glendale", "pasadena", "aurora", "arlington", "lakewood", "fairfield", "carmel", "quincy", "cambridge", "frederick", "greenville", "roswell", "naples", "victorville", "provo", "lowell", "elgin", "manchester", "burlington", "richmond", "columbus"]);
  Object.entries(CITIES).forEach(([c, a]) => { if (a !== mine && !COMMON.has(c)) bad.push(c); });
  const mineName = loc.region.toLowerCase();
  const res = bad.filter(b => !mineName.includes(b)).map(b => new RegExp("(^|\\s)" + b.replace(/\s+/g, "\\s+") + "($|\\s)"));
  const own = new RegExp("(^|\\s)(" + [mineName, mine.toLowerCase()].join("|") + ")($|\\s)");
  return k => own.test(k) || !res.some(r => r.test(k));
}
const GEO_TOKENS = new Set();
STATES.forEach(([n, a]) => { n.toLowerCase().split(" ").forEach(t => GEO_TOKENS.add(t)); GEO_TOKENS.add(a.toLowerCase()); });
Object.keys(CITIES).forEach(c => c.split(" ").forEach(t => GEO_TOKENS.add(t)));
["usa", "us", "united", "states", "america", "uk", "canada", "australia", "near", "me", "nearby", "area", "local", "county", "city"].forEach(t => GEO_TOKENS.add(t));

const PLATFORMS = ["youtube.com", "reddit.com", "wikipedia.org", "yelp.com", "facebook.com", "linkedin.com", "instagram.com", "pinterest.com", "quora.com", "amazon.com", "tiktok.com", "x.com", "twitter.com", "forbes.com", "nolo.com", "findlaw.com", "justia.com", "avvo.com", "lawyers.com", "martindale.com", "superlawyers.com", "bbb.org", "yellowpages.com", "thumbtack.com", "angi.com", "homeadvisor.com", "indeed.com", "glassdoor.com", "etsy.com", "ebay.com", "medium.com", "healthline.com", "webmd.com", "mayoclinic.org", "nih.gov", "clevelandclinic.org", "tripadvisor.com", "expertise.com", "usnews.com", "nerdwallet.com", "investopedia.com", "walmart.com", "target.com", "homedepot.com", "lowes.com", "bing.com", "apple.com", "spotify.com"];
const isPlatform = d => PLATFORMS.some(p => d === p || d.endsWith("." + p)) || /\.gov$/.test(d);
const normDomain = d => String(d || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[\/?#].*$/, "");

/* ---------- click model ---------- */
const CTR = [0, .22, .13, .09, .06, .045, .035, .028, .022, .018, .015];
const SUM10 = CTR.reduce((a, b) => a + b, 0);
const TOP3 = (CTR[1] + CTR[2] + CTR[3]) / 3;
const ctr = p => !p ? 0 : p <= 10 ? CTR[p] : p <= 20 ? .006 : 0;
const status = p => !p ? "none" : p <= 3 ? "top" : p <= 10 ? "page1" : p <= 20 ? "close" : "far";
const COLORS = { top: "#3ee08f", page1: "#2bb5a0", close: "#fbbf24", far: "#a78bfa", none: "#16202f" };

/* ---------- mode / transport ---------- */
let MODE = "demo";
function getKey() { try { return JSON.parse(sessionStorage.getItem("ltt_key") || localStorage.getItem("ltt_key") || "null"); } catch (e) { return null; } }
async function detectMode() {
  if (location.protocol.startsWith("http")) {
    try { const r = await fetch("/api/health", { cache: "no-store" }); if (r.ok) { const j = await r.json(); if (j.mode === "local") MODE = "local"; } } catch (e) { }
  }
  if (MODE !== "local" && getKey()) MODE = "key";
  renderMode();
}
function renderMode() {
  const m = $("#mode");
  m.className = "chip " + (MODE === "demo" ? "demo" : "live");
  m.lastElementChild.textContent = MODE === "local" ? "live · local server" : MODE === "key" ? "live · your API key" : "demo · saved scans";
  $("#keyBtn").style.display = MODE === "local" ? "none" : "";
  $("#keyBtn").textContent = MODE === "key" ? "Key ✓" : "Add API key";
  if (MODE === "local") fetch("/api/balance").then(r => r.json()).then(j => { if (j.balance != null) { $("#bal").style.display = ""; $("#bal").textContent = "balance $" + j.balance.toFixed(2); } }).catch(() => { });
  updateEstimate();
  loadLists();
}
function openKey() { const k = getKey() || {}; $("#kLogin").value = k.login || ""; $("#kPw").value = k.pw || ""; $("#keyModal").classList.add("on"); }
function closeKey() { $("#keyModal").classList.remove("on"); }
function saveKey() {
  const k = { login: $("#kLogin").value.trim(), pw: $("#kPw").value };
  if (!k.login || !k.pw) return;
  try { sessionStorage.setItem("ltt_key", JSON.stringify(k)); if ($("#kRem").checked) localStorage.setItem("ltt_key", JSON.stringify(k)); } catch (e) { }
  closeKey(); if (MODE !== "local") { MODE = "key"; renderMode(); }
}
function clearKey() { try { sessionStorage.removeItem("ltt_key"); localStorage.removeItem("ltt_key"); } catch (e) { } closeKey(); if (MODE === "key") { MODE = "demo"; renderMode(); } }

let SCAN = null, R = null, REPLAY = false, SPEED = 1, SKIP = false, STEP = null;
async function call(endpoint, task, label) {
  const t0 = performance.now();
  let r;
  try {
    if (MODE === "local") {
      r = await (await fetch("/api/dfs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint, task }) })).json();
    } else if (MODE === "key") {
      const k = getKey();
      const res = await fetch(API + endpoint, { method: "POST", headers: { Authorization: "Basic " + btoa(k.login + ":" + k.pw), "Content-Type": "application/json" }, body: JSON.stringify([task]) });
      const j = await res.json(); const t = (j.tasks || [{}])[0];
      r = { status_code: t.status_code || j.status_code, status_message: t.status_message || j.status_message, cost: t.cost || 0, result: t.result };
    } else throw new Error("No live connection");
  } catch (e) { r = { status_code: 0, status_message: e.message, cost: 0, result: null }; }
  const secs = (performance.now() - t0) / 1000;
  SCAN.cost += r.cost || 0;
  SCAN.calls.push({ label, endpoint, cost: r.cost || 0, secs: +secs.toFixed(2), cached: !!r.cached, ok: r.status_code === 20000 });
  log("→ " + label + "  " + (r.cached ? "cached" : "$" + (r.cost || 0).toFixed(4)) + " · " + secs.toFixed(1) + "s", "c");
  $("#scCost").textContent = "$" + SCAN.cost.toFixed(3);
  if (r.status_code !== 20000) { log("  " + (r.status_message || "error"), "e"); return null; }
  return r.result;
}

/* ---------- log ---------- */
function log(text, cls, record = true) {
  const d = document.createElement("div"); d.className = cls || ""; d.textContent = text;
  const L = $("#log"); L.appendChild(d); while (L.children.length > 60) L.removeChild(L.firstChild);
  if (record && SCAN && !REPLAY) SCAN.log.push([STEP, cls || "", text]);
}

/* ---------- form ---------- */
function initForm() {
  const c = $("#inCountry"); c.innerHTML = Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
  const r = $("#inRegion"); r.innerHTML = `<option value="">Nationwide</option>` + STATES.map(([n, a]) => `<option value="${a}">${n}</option>`).join("");
  ["#inDomain", "#inKw", "#inRegion", "#inCountry"].forEach(s => $(s).addEventListener("input", updateEstimate));
}
function syncRegion() { $("#regionBox").style.visibility = $("#inCountry").value === "us" ? "visible" : "hidden"; if ($("#inCountry").value !== "us") $("#inRegion").value = ""; updateEstimate(); }
function readLocation() {
  const cc = $("#inCountry").value, a = $("#inRegion").value;
  const st = STATES.find(s => s[1] === a);
  const loc = { country: cc, code: COUNTRIES[cc].code, region: st ? st[0] : null, abbr: st ? st[1] : null };
  loc.label = st ? st[0] : COUNTRIES[cc].name;
  loc.ads = st ? `${st[0]},United States` : null;
  loc.city = st && STATE_CITY[st[1]] ? STATE_CITY[st[1]] + ", " + st[1] : null;
  loc.serp = st && STATE_CITY[st[1]] ? `${STATE_CITY[st[1]]},${st[0]},United States` : null;
  return loc;
}
function updateEstimate() {
  const kw = $("#inKw").value.trim(), loc = readLocation();
  const seeds = kw ? kw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) : [];
  let c = 0.012 + 0.082 + 0.08;
  c += seeds.length ? seeds.length * (0.042 + 0.042 + (loc.region ? 0.05 : 0)) : 0.082;
  if (loc.region) c += 0.09 + 0.03;
  const live = MODE !== "demo";
  $("#est").innerHTML = `<span>⏱ <b>about ${loc.region ? 60 : 40} seconds</b></span><span>≈ <b>$${c.toFixed(2)}</b> in DataForSEO credits</span><span>${seeds.length ? `market: <b>${esc(seeds.join(", "))}</b>` : "market: <b>keywords related to the site</b>"}${loc.region ? ` · volumes for <b>${esc(loc.region)}</b>` : ""}</span>` + (live ? "" : `<span style="color:var(--gold)">Live scans need the local server or your API key. Try an example below.</span>`);
}

/* ---------- lists ---------- */
async function loadLists() {
  try {
    const ex = await (await fetch("examples/index.json", { cache: "no-store" })).json();
    $("#examples").innerHTML = ex.length ? ex.map(rowHTML).join("") : `<div class="empty">No examples yet.</div>`;
  } catch (e) { $("#examples").innerHTML = `<div class="empty">No examples found.</div>`; }
  if (MODE === "local") {
    try {
      const rs = await (await fetch("/api/scans", { cache: "no-store" })).json();
      $("#recent").innerHTML = rs.length ? rs.map(rowHTML).join("") : `<div class="empty">Scans you run are saved here.</div>`;
    } catch (e) { }
  } else { const h = localHistory(); $("#recent").innerHTML = h.length ? h.map(rowHTML).join("") : `<div class="empty">${MODE === "key" ? "Scans you run on this device are saved here." : "Connect your API key to run live scans."}</div>`; }
  document.querySelectorAll(".scanrow").forEach(el => el.onclick = () => openFile(el.dataset.file, true));
}
function rowHTML(s) { return `<div class="scanrow" data-file="${esc(s.file)}"><div><b>${esc(s.domain)}</b><span>${esc(s.keyword || "site keywords")} · ${esc(s.location || "")}${s.date ? " · " + esc(s.date.slice(0, 10)) : ""}</span></div><div class="pl">${s.headline ? esc(s.headline) : "▶ replay"}</div></div>`; }
async function openFile(file, animate) {
  try {
    const d = file.startsWith("local:") ? JSON.parse(localStorage.getItem(file.slice(6))) : await (await fetch(file, { cache: "no-store" })).json();
    location.hash = (animate ? "open=" : "show=") + file;
    if (animate) replay(d); else { SCAN = d; R = compute(SCAN); showResults(true); }
  } catch (e) { showErr("Couldn't open " + file); }
}
function showErr(m) { const e = $("#err"); e.textContent = m; e.style.display = m ? "block" : "none"; }

/* ---------- pipeline ---------- */
const STEPS = [
  { id: "foot", label: "Your footprint", head: () => "Measuring your current search footprint" },
  { id: "market", label: "Market map", head: () => "Mapping every search in your market" },
  { id: "local", label: "Local demand", head: () => `Sizing local demand in ${SCAN.location.region}` },
  { id: "comp", label: "Competitors", head: () => "Finding who owns the market" },
  { id: "serp", label: "Live results", head: () => `Checking live Google results in ${SCAN.location.city || SCAN.location.region}` },
  { id: "table", label: "On the table", head: () => "Counting what's left on the table" },
];
function activeSteps() { return STEPS.filter(s => SCAN.location.region || (s.id !== "local" && s.id !== "serp")); }
function stepUI(id) {
  STEP = id;
  const st = activeSteps(), i = st.findIndex(s => s.id === id);
  $("#scSteps").innerHTML = st.map((s, j) => `<div class="${j < i ? "done" : j === i ? "on" : ""}">${String(j + 1).padStart(2, "0")} · ${s.label}</div>`).join("");
  $("#scEye").textContent = `step ${i + 1} of ${st.length}`;
  $("#scHead").textContent = st[i].head();
  log(st[i].head(), "s", false);
}

const GENERIC = new Set("a an the of for in on to and or is are was be my me near nearby best top cheap cheapest affordable local free how what who when where why which can do does should i you your vs versus with without from by at about lawyer lawyers attorney attorneys law firm firms company companies service services online cost costs price prices pricing 2023 2024 2025 2026 2027 good great reviews review rated number phone open now hours".split(" "));
const TOPIC_OK = new Set(["company", "companies", "service", "services", "local", "online", "agency", "agencies"]);
const toks = k => k.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
const SYN = { attorney: "lawyer", attorneys: "lawyer", lawyers: "lawyer", firms: "firm" };
const STOPW = new Set(["for", "a", "an", "the", "of", "in", "to", "and", "by", "with", "on", "at", "from", "is"]);
const sig = k => [...new Set(toks(k.replace(/-/g, " ")).map(t => SYN[t] || (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)).filter(t => !STOPW.has(t)))].sort().join(" ");
const JUNK = /\b(salary|salaries|jobs?|hiring|career|school|degree|course|memes?|movies?|tv show|cast|song|lyrics|game|wiki|definition|meaning|reddit|pdf|template|crossword|tiktok|cartoon|jokes?|net worth|collections?|website|login|phone number|wikipedia|lawsuit against)\b|\b(do|does|did) .*\bmake\b|\bmake (per|a year|an hour)\b/;
// Low-volume searches often have no CPC. Use the market's median CPC for them and mark it as an estimate.
function fillCpc(U) {
  const cs = U.filter(u => u.c > 0 && !u.ce).map(u => u.c).sort((a, b) => a - b);
  const med = cs.length ? cs[Math.floor(cs.length / 2)] : 0;
  U.forEach(u => { if (!(u.c > 0)) { u.c = med; u.ce = med > 0; } });
}
// Google reports one volume for a cluster of close variants. Count each cluster once.
function mergeClusters(U, minV) {
  const by = {}, out = [];
  U.slice().sort((a, b) => b.v - a.v || a.k.length - b.k.length).forEach(u => {
    const key = u.v >= minV ? u.v + "|" + u.c : null;
    const ks = "s|" + sig(u.k);
    const hit = (key && by[key]) || by[ks];
    if (hit) { hit.vars = (hit.vars || 0) + 1; (hit.alt = hit.alt || []).push(u.k); return; }
    if (key) by[key] = u; by[ks] = u; out.push(u);
  });
  return out;
}

async function startScan() {
  showErr("");
  const domain = normDomain($("#inDomain").value);
  if (!domain || !domain.includes(".")) return showErr("Enter a domain like example.com");
  if (MODE === "demo") { openKey(); return showErr("Live scans need the local server (python3 server.py) or your DataForSEO API key."); }
  const kw = $("#inKw").value.trim().toLowerCase();
  const seeds = kw ? kw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) : [];
  SCAN = { v: 1, domain, keyword: seeds.join(", "), seeds, location: readLocation(), date: new Date().toISOString(), cost: 0, calls: [], log: [], durations: {}, overview: null, ranked: [], universe: [], comps: [], youPos: {}, serps: [] };
  REPLAY = false; SKIP = false; SPEED = 1;
  openOverlay();
  const t0 = performance.now();
  try {
    for (const s of activeSteps()) {
      const ts = performance.now();
      stepUI(s.id);
      await RUN[s.id]();
      SCAN.durations[s.id] = +((performance.now() - ts) / 1000).toFixed(2);
      if (s.id === "foot" && !SCAN.ranked.length && !SCAN.overview) throw new Error("No data came back for " + domain + ". Check the domain and your API connection.");
      if (s.id === "market" && !SCAN.universe.length) throw new Error("Couldn't find keywords for this market. Try adding a target keyword.");
    }
  } catch (e) { log("✗ " + e.message, "e"); await sleep(1800); closeOverlay(); showErr(e.message); return; }
  SCAN.runtime = +((performance.now() - t0) / 1000).toFixed(1);
  SCAN.headline = money(R.table.value) + "/mo on the table";
  if (MODE === "key") saveLocal(SCAN);
  if (MODE === "local") { try { const j = await (await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(SCAN) })).json(); location.hash = "show=" + j.file; } catch (e) { } }
  finishOverlay();
}

const RUN = {
  async foot() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG };
    const [ov, rk] = await Promise.all([
      call(EP.overview, { target: S.domain, ...L }, "Domain overview"),
      call(EP.ranked, { target: S.domain, ...L, limit: 700, order_by: ["ranked_serp_element.serp_item.etv,desc"] }, "Ranked keywords (top 700 by traffic)")]);
    const m = ov?.[0]?.items?.[0]?.metrics?.organic || {};
    S.overview = { etv: m.etv || 0, count: m.count || 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), p10: m.pos_4_10 || 0, p20: m.pos_11_20 || 0, value: m.estimated_paid_traffic_cost || 0 };
    const map = {};
    (rk?.[0]?.items || []).forEach(it => {
      const kd = it.keyword_data || {}, info = kd.keyword_info || {}, se = it.ranked_serp_element?.serp_item || {};
      const k = (kd.keyword || "").toLowerCase(); if (!k || !se.rank_group) return;
      if (!map[k] || se.rank_group < map[k].p) map[k] = { k, p: se.rank_group, v: info.search_volume || 0, c: +(info.cpc || 0).toFixed(2), d: kd.keyword_properties?.keyword_difficulty ?? null, u: se.relative_url || se.url || "" };
    });
    S.ranked = Object.values(map);
    log(`✓ ${fmt(S.overview.count)} keywords ranking · ~${fmt(S.overview.etv)} visits/mo · ${S.overview.top3} in the top 3`, "ok");
    VIZ.foot();
  },
  async market() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG }, jobs = [];
    const sugg = (kw, limit, lab) => call(EP.suggest, { keyword: kw, ...L, limit, include_seed_keyword: true, ignore_synonyms: true, order_by: ["keyword_info.search_volume,desc"], filters: [["keyword_info.search_volume", ">", 0]] }, lab);
    if (S.seeds.length) {
      S.seeds.forEach(s => {
        jobs.push(sugg(s, 300, "Keyword suggestions: " + s));
        jobs.push(call(EP.related, { keyword: s, ...L, depth: 3, limit: 400, ignore_synonyms: true, filters: [["keyword_data.keyword_info.search_volume", ">", 0]] }, "Related searches: " + s));
        if (S.location.region) {
          jobs.push(sugg(s + " " + S.location.region.toLowerCase(), 150, `Suggestions: ${s} ${S.location.region.toLowerCase()}`));
          jobs.push(sugg(s + " " + S.location.abbr.toLowerCase(), 100, `Suggestions: ${s} ${S.location.abbr.toLowerCase()}`));
        }
      });
    } else jobs.push(call(EP.forSite, { target: S.domain, ...L, limit: 700, filters: [["keyword_info.search_volume", ">", 10]] }, "Keywords relevant to the site"));
    const res = await Promise.all(jobs);
    const map = {};
    const add = (k, info, props, intent) => {
      k = (k || "").toLowerCase().trim(); if (!k || !info || JUNK.test(k) || intent === "navigational") return;
      const v = info.search_volume || 0; if (v < 10) return;
      if (!map[k] || v > map[k].v) map[k] = { k, v, c: +(info.cpc || 0).toFixed(2), d: props?.keyword_difficulty ?? null, i: intent || null };
    };
    res.forEach(r => {
      const r0 = r?.[0]; if (!r0) return;
      if (r0.seed_keyword_data) add(r0.seed_keyword_data.keyword, r0.seed_keyword_data.keyword_info, r0.seed_keyword_data.keyword_properties, r0.seed_keyword_data.search_intent_info?.main_intent);
      (r0.items || []).forEach(it => {
        const x = it.keyword_data || it;
        add(x.keyword, x.keyword_info, x.keyword_properties, x.search_intent_info?.main_intent);
      });
    });
    const core = new Set(S.seeds.flatMap(toks).filter(t => !GENERIC.has(t) && !GEO_TOKENS.has(t)));
    S.ranked.forEach(r => {
      if (r.v < 10) return;
      if (S.seeds.length && !toks(r.k).some(t => core.has(t))) return;
      if (!map[r.k]) map[r.k] = { k: r.k, v: r.v, c: r.c, d: r.d, i: null };
    });
    const geo = geoFilter(S.location, S.seeds);
    let U = Object.values(map).filter(u => geo(u.k));
    const before = U.length;
    U = mergeClusters(U, S.location.region ? 1e12 : 200);
    S.merged = before - U.length;
    U.sort((a, b) => b.v - a.v);
    S.universe = U.slice(0, 900);
    S.geoDropped = Object.keys(map).length - U.length;
    fillCpc(S.universe);
    log(`✓ ${fmt(S.universe.length)} distinct searches · ${fmt(S.universe.reduce((a, u) => a + u.v, 0))} searches/mo` + (S.merged ? ` · ${S.merged} duplicate variants merged` : "") + (S.geoDropped ? ` · ${S.geoDropped} other-location searches removed` : ""), "ok");
    VIZ.market();
  },
  async local() {
    const S = SCAN;
    const ok = k => /^[a-z0-9 '&.\-]+$/.test(k) && k.length <= 80 && k.split(" ").length <= 10;
    const kws = S.universe.map(u => u.k).filter(ok).slice(0, 1000);
    const res = await call(EP.ads, { location_name: S.location.ads, language_code: LANG, keywords: kws }, "Google Ads volumes: " + S.location.region);
    if (!res) { log("  kept national volumes", "w"); S.localFailed = true; return; }
    const loc = {}; res.forEach(x => { if (x && x.keyword) loc[x.keyword.toLowerCase()] = x; });
    const ratios = [];
    S.universe.forEach(u => { const x = loc[u.k]; if (x && x.search_volume && u.v) ratios.push(x.search_volume / u.v); });
    ratios.sort((a, b) => a - b);
    const ratio = ratios.length ? ratios[Math.floor(ratios.length * 0.25)] : 0.03;
    S.universe.forEach(u => {
      const x = loc[u.k]; u.nv = u.v;
      if (x && x.search_volume != null) { u.v = x.search_volume; if (x.cpc) { u.c = +x.cpc.toFixed(2); u.ce = false; } }
      else { u.v = Math.round(u.v * ratio); u.ve = true; }
    });
    const n0 = S.universe.length;
    S.universe = mergeClusters(S.universe.filter(u => u.v > 0), 100).sort((a, b) => b.v - a.v);
    S.merged = (S.merged || 0) + (n0 - S.universe.length);
    S.localRatio = +ratio.toFixed(4);
    fillCpc(S.universe);
    log(`✓ local volumes for ${fmt(Object.keys(loc).length)} searches · ${S.location.region} ≈ ${(ratio * 100).toFixed(1)}% of US demand · ${fmt(S.universe.length)} distinct searches after merging variants`, "ok");
    VIZ.local();
  },
  async comp() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG };
    const idx = {}; S.universe.forEach((u, i) => idx[u.k] = i);
    const core = S.universe.map((u, i) => ({ u, i })).sort((a, b) => b.u.v * Math.max(b.u.c, .5) - a.u.v * Math.max(a.u.c, .5)).slice(0, 800);
    const batches = []; for (let i = 0; i < core.length; i += 200) batches.push(core.slice(i, i + 200));
    const res = await Promise.all(batches.map((b, j) => call(EP.serpComp, { keywords: b.map(x => x.u.k), ...L, limit: 100, item_types: ["organic"], include_subdomains: true }, `Who ranks: batch ${j + 1} of ${batches.length} (${b.length} searches)`)));
    const doms = {};
    res.forEach(r => (r?.[0]?.items || []).forEach(it => {
      const d = normDomain(it.domain); if (!d || d === "google.com") return;
      const o = doms[d] || (doms[d] = { d, etv: 0, pos: {} });
      o.etv += it.etv || 0;
      Object.entries(it.keywords_positions || {}).forEach(([k, arr]) => {
        const i = idx[k.toLowerCase()]; if (i == null) return;
        const p = Math.min(...(arr || []).filter(Number.isFinite)); if (!Number.isFinite(p)) return;
        if (!o.pos[i] || p < o.pos[i]) o.pos[i] = p;
      });
    }));
    const mine = d => d === S.domain || d.endsWith("." + S.domain);
    Object.values(doms).filter(o => mine(o.d)).forEach(o => Object.entries(o.pos).forEach(([i, p]) => { if (!S.youPos[i] || p < S.youPos[i]) S.youPos[i] = p; }));
    S.comps = Object.values(doms).filter(o => !mine(o.d)).sort((a, b) => b.etv - a.etv).slice(0, 40).map(o => ({ d: o.d, pos: o.pos }));
    log(`✓ ${Object.keys(doms).length} domains compete · leaders: ${S.comps.slice(0, 3).map(c => c.d).join(", ")}`, "ok");
    VIZ.comp();
  },
  async serp() {
    const S = SCAN;
    const top = S.universe.map((u, i) => ({ u, i })).filter(x => x.u.v > 0).sort((a, b) => b.u.v * Math.max(b.u.c, .5) - a.u.v * Math.max(a.u.c, .5)).slice(0, 20);
    const res = await Promise.all(top.map(x => call(EP.serp, { keyword: x.u.k, location_name: S.location.serp || S.location.ads, language_code: LANG, depth: 20, device: "desktop" }, "Live Google: " + x.u.k)));
    const mine = d => d === S.domain || d.endsWith("." + S.domain);
    res.forEach((r, j) => {
      const items = r?.[0]?.items; if (!items) return;
      const org = [], lp = []; let ads = 0, ai = false;
      items.forEach(it => {
        if (it.type === "organic" && org.length < 20) org.push([normDomain(it.domain), it.rank_group]);
        else if (it.type === "local_pack") lp.push([it.title || "", normDomain(it.domain || it.url || "")]);
        else if (it.type === "paid") ads++;
        else if (it.type === "ai_overview") ai = true;
      });
      const you = org.find(o => mine(o[0]));
      S.serps.push({ i: top[j].i, k: top[j].u.k, org, lp: lp.slice(0, 3), ads, ai, you: you ? you[1] : null, youLp: lp.some(l => mine(l[1])) });
      VIZ.serpTile(S.serps[S.serps.length - 1]);
      log(`  ${top[j].u.k}: ${you ? "you're #" + you[1] : "you're not in the top 20"} · #1 ${org[0] ? org[0][0] : "–"}${lp.length ? " · map pack" : ""}`, you && you[1] <= 3 ? "ok" : "w");
    });
  },
  async table() {
    R = compute(SCAN);
    log(`✓ market: ${fmt(R.market.clicks)} organic clicks/mo worth ${money(R.market.value)}`, "ok");
    log(`✓ you capture ${(R.you.share * 100).toFixed(1)}% · ${fmt(R.you.clicks)} visits/mo worth ${money(R.you.value)}`, "ok");
    log(`$ left on the table: +${fmt(R.table.clicks)} visits/mo · ${money(R.table.value)}/mo`, "w");
    await VIZ.table();
  },
};

/* ---------- metrics ---------- */
const PACK = [.16, .11, .08], PACK_SUM = .35, ORG_LP = .65;
function compute(S) {
  const U = S.universe, rk = {}; S.ranked.forEach(r => { rk[r.k] = r.p; const g = "s|" + sig(r.k); if (!rk[g] || r.p < rk[g]) rk[g] = r.p; });
  const serpBy = {}; (S.serps || []).forEach(s => serpBy[s.i] = s);
  const local = !!(S.location.region && S.serps && S.serps.length);
  const mineD = d => d === S.domain || d.endsWith("." + S.domain);
  const yourPos = U.map((u, i) => {
    if (serpBy[i]) return serpBy[i].you || null;
    const a = [u.k, ...(u.alt || [])].reduce((m, k) => { const q = rk[k] || rk["s|" + sig(k)]; return q && (!m || q < m) ? q : m; }, null), b = S.youPos?.[i];
    return a && b ? Math.min(a, b) : (a || b || null);
  });
  // competitors: national (Labs) or local (live SERPs incl. map pack)
  let comps;
  if (local) {
    const m = {};
    S.serps.forEach(s => {
      s.org.forEach(([d, r]) => { if (!d || mineD(d)) return; const o = m[d] || (m[d] = { d, pos: {}, pack: {} }); if (!o.pos[s.i] || r < o.pos[s.i]) o.pos[s.i] = r; });
      s.lp.forEach(([t, d], j) => { if (!d || mineD(d)) return; const o = m[d] || (m[d] = { d, pos: {}, pack: {} }); o.pack[s.i] = j + 1; o.name = o.name || t; });
    });
    comps = Object.values(m);
  } else comps = S.comps.map(c => ({ d: c.d, pos: { ...c.pos }, pack: {} }));
  comps.forEach(c => c.platform = isPlatform(c.d));
  let mClicks = 0, mValue = 0, yClicks = 0, yValue = 0, tClicks = 0, tValue = 0, searches = 0, bClicks = 0, bValue = 0, yb = 0, ybv = 0;
  const items = U.map((u, i) => {
    const p = yourPos[i], c = u.c || 0, s = serpBy[i], lp = s && s.lp.length;
    const f = lp ? ORG_LP : 1;
    const pk = s ? (s.lp.findIndex(l => mineD(l[1])) + 1) || null : null;
    const now = u.v * (ctr(p) * f + (pk ? PACK[pk - 1] : 0));
    const mk = u.v * (SUM10 * f + (lp ? PACK_SUM : 0));
    const target = u.v * (TOP3 * f + (lp ? PACK_SUM / 3 : 0));
    const pot = Math.max(0, target - now);
    let lead = null;
    if (s) { if (s.org[0]) lead = { d: s.org[0][0], p: s.org[0][1], me: mineD(s.org[0][0]) }; else if (s.lp[0]) lead = { d: s.lp[0][1] || s.lp[0][0], p: 1, map: true }; }
    else { comps.forEach(cp => { const q = cp.pos[i]; if (q && (!lead || q < lead.p)) lead = { d: cp.d, p: q }; }); if (p && (!lead || p < lead.p)) lead = { d: S.domain, p, me: true }; if (lead && lead.p > 10) lead = null; }
    searches += u.v; mClicks += mk; mValue += mk * c; yClicks += now; yValue += now * c; tClicks += pot; tValue += pot * c;
    if (!local || s) { bClicks += mk; bValue += mk * c; yb += now; ybv += now * c; }
    return { ...u, i, p, pk, f, live: !!s, lp: !!lp, st: pk ? "top" : status(p), now, nowVal: now * c, mk, mkVal: mk * c, pot, potVal: pot * c, lead };
  });
  comps.forEach(cp => {
    let cl = 0, val = 0, n = 0, n3 = 0, sp = 0, np = 0;
    const idx = new Set([...Object.keys(cp.pos), ...Object.keys(cp.pack)]);
    idx.forEach(i => {
      const u = U[i], it = items[i]; if (!u) return;
      const p = cp.pos[i], k = cp.pack[i];
      const x = u.v * ((p ? ctr(p) * it.f : 0) + (k ? PACK[k - 1] : 0)); cl += x; val += x * (u.c || 0);
      if (p && p <= 10) { n++; sp += p; } if (p && p <= 3) n3++; if (k) np++;
    });
    Object.assign(cp, { clicks: cl, value: val, kw10: n, kw3: n3, packs: np, avg: n ? sp / n : null, share: bClicks ? cl / bClicks : 0 });
  });
  comps.sort((a, b) => b.clicks - a.clicks);
  const you = { d: S.domain, clicks: yClicks, value: yValue, bClicks: yb, share: bClicks ? yb / bClicks : 0, kw10: items.filter(x => x.p && x.p <= 10).length, kw3: items.filter(x => x.p && x.p <= 3).length, packs: items.filter(x => x.pk).length, me: true };
  you.rank = comps.filter(c => c.clicks > yb).length + 1;
  if (yb <= 0) you.rank = comps.length + 1;
  const ps = items.filter(x => x.p && x.p <= 10); you.avg = ps.length ? ps.reduce((a, x) => a + x.p, 0) / ps.length : null;
  const topics = clusterTopics(items, S, comps);
  const rest = Math.max(0, bClicks - yb - comps.slice(0, 5).reduce((a, c) => a + c.clicks, 0));
  const nLive = local ? S.serps.length : 0;
  const basis = local ? { local: true, clicks: bClicks, value: bValue, n: nLive, pct: mValue ? bValue / mValue : (mClicks ? bClicks / mClicks : 0), where: S.location.city || S.location.region } : { local: false, clicks: mClicks, value: mValue, n: items.length, pct: 1 };
  return { items, comps, you, topics, searches, basis, market: { clicks: mClicks, value: mValue }, table: { clicks: tClicks, value: tValue }, rest };
}

function clusterTopics(items, S, comps) {
  const seedT = new Set(S.seeds.flatMap(toks));
  const domT = new Set(toks(S.domain.split(".")[0]));
  const keep = t => t.length > 1 && (!GENERIC.has(t) || TOPIC_OK.has(t)) && !seedT.has(t) && !GEO_TOKENS.has(t) && !domT.has(t) && !/^\d+$/.test(t);
  const w = x => x.mkVal > 0 ? x.mkVal : x.mk * 0.5;
  const uni = {}, bi = {}, cnt = {};
  const kt = items.map(x => {
    const t = toks(x.k), f = t.filter(keep), bs = [];
    for (let j = 0; j < t.length - 1; j++) if (keep(t[j]) && keep(t[j + 1])) bs.push(t[j] + " " + t[j + 1]);
    new Set(f).forEach(a => { uni[a] = (uni[a] || 0) + w(x); cnt[a] = (cnt[a] || 0) + 1; });
    new Set(bs).forEach(b => { bi[b] = (bi[b] || 0) + w(x); });
    return { f: new Set(f), b: new Set(bs) };
  });
  const assigned = new Array(items.length).fill(-1), topics = [];
  const total = items.reduce((a, x) => a + w(x), 0) || 1;
  const stRe = S.location.region ? new RegExp("(^|\\s)(" + [S.location.region.toLowerCase(), S.location.abbr.toLowerCase(), "county", "township"].join("|") + ")($|\\s)") : null;
  const BUCKETS = [
    ["costs & fees", k => /\b(cost|costs|fee|fees|price|prices|percentage|percent|charge|charges|contingency|how much|settlement|settlements|calculator|worth|payout)\b/.test(k)],
    ["questions", k => /^(how|what|when|where|why|who|which|can|do|does|is|should|are|will)\b/.test(k)],
    ["free consultation", k => /\b(free|consultation|consult)\b/.test(k)],
    ["near me", k => /\bnear( me|by)?\b/.test(k)],
    ["best & top rated", k => /\b(best|top|rated|review|reviews|recommended|highest|leading|award)\b/.test(k)],
    ["firms & offices", k => /\b(firm|firms|office|offices|associates|practice)\b/.test(k)],
    ["towns & counties", (k, i) => stRe && (stRe.test(k) || /\bcounty\b/.test(k)) && kt[i].f.size > 0 && ![...kt[i].f].every(t => uni[t] > total * 0.02)],
    ["cities & towns", (k, i) => !!S.location.region && kt[i].f.size > 0 && items[i].nv > 0 && !items[i].ve && items[i].v / items[i].nv >= 0.5],
  ];
  // after the named groups, also split what's left by its most common modifiers
  BUCKETS.forEach(([name, test]) => {
    const idx = []; items.forEach((x, i) => { if (assigned[i] < 0 && test(x.k, i)) idx.push(i); });
    if (idx.length >= 3) { const ti = topics.length; topics.push({ name, idx }); idx.forEach(i => assigned[i] = ti); }
  });
  for (let round = 0; round < 16 && topics.length < 15; round++) {
    const sc = {}; const add = (lab, x, i, isBi) => { if (assigned[i] >= 0) return; sc[lab] = sc[lab] || { lab, w: 0, n: 0, bi: isBi }; sc[lab].w += w(x); sc[lab].n++; };
    items.forEach((x, i) => { kt[i].f.forEach(a => add(a, x, i, false)); kt[i].b.forEach(b => add(b, x, i, true)); });
    let cand = Object.values(sc).filter(c => c.n >= 3).sort((a, b) => b.w - a.w);
    if (!cand.length) break;
    let best = cand[0];
    if (!best.bi) { const b = cand.find(c => c.bi && c.lab.split(" ").includes(best.lab) && c.w >= best.w * 0.6); if (b) best = b; }
    if (best.w / total < 0.0015 && best.n < 5) break;
    const ti = topics.length; topics.push({ name: best.lab, idx: [] });
    items.forEach((x, i) => { if (assigned[i] < 0 && (best.bi ? kt[i].b.has(best.lab) : kt[i].f.has(best.lab))) { assigned[i] = ti; topics[ti].idx.push(i); } });
  }
  const restName = S.seeds.length ? S.seeds[0] : "other searches";
  const rest = { name: restName, idx: [], core: true };
  items.forEach((x, i) => { if (assigned[i] < 0) { rest.idx.push(i); assigned[i] = topics.length; } });
  if (rest.idx.length) topics.push(rest);
  topics.forEach(t => {
    const xs = t.idx.map(i => items[i]);
    t.searches = xs.reduce((a, x) => a + x.v, 0); t.value = xs.reduce((a, x) => a + x.mkVal, 0); t.clicks = xs.reduce((a, x) => a + x.mk, 0);
    t.yours = xs.reduce((a, x) => a + x.now, 0); t.yourVal = xs.reduce((a, x) => a + x.nowVal, 0);
    t.pot = xs.reduce((a, x) => a + x.pot, 0); t.potVal = xs.reduce((a, x) => a + x.potVal, 0);
    t.n = xs.length;
    let lead = null;
    comps.forEach(c => { let cl = 0; t.idx.forEach(i => { const p = c.pos[i], k = c.pack && c.pack[i]; if (p) cl += items[i].v * ctr(p) * items[i].f; if (k) cl += items[i].v * PACK[k - 1]; }); if (!lead || cl > lead.clicks) lead = { d: c.d, clicks: cl }; });
    t.lead = lead && lead.clicks > 0 ? lead : null;
    t.share = t.clicks ? t.yours / t.clicks : 0; t.leadShare = t.lead && t.clicks ? t.lead.clicks / t.clicks : 0;
    xs.forEach(x => x.topic = t.name);
  });
  topics.sort((a, b) => (b.potVal || b.pot) - (a.potVal || a.pot));
  return topics;
}

/* ---------- scan overlay visual ---------- */
const VIZ = (() => {
  let cv, ctx, W, H, CX, CY, RAD, D, raf, t0;
  let parts = [], comps = [], beams = [], tiles = [], center = "", sweep = 0, tablePhase = 0;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  function resize() { D = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; ctx.setTransform(D, 0, 0, D, 0, 0); const mob = W < 700; CX = W < 1000 ? W * 0.5 : W * 0.4; CY = mob ? H * 0.43 : H * 0.5; RAD = mob ? Math.min(W * 0.34, H * 0.23) : Math.min(W < 1000 ? W * 0.4 : W * 0.24, H * 0.34); }
  let wedges = null, labels = [];
  function setTopics() {
    const items = SCAN.universe.map((u, i) => ({ ...u, i, mk: u.v * SUM10, mkVal: u.v * SUM10 * (u.c || 0) }));
    const tp = clusterTopics(items, SCAN, []).slice(0, 10);
    const tot = tp.reduce((a, t) => a + Math.max(t.n, 6), 0) || 1;
    let a0 = -Math.PI / 2; wedges = {}; labels = [];
    tp.forEach((t, j) => { const span = Math.PI * 2 * Math.max(t.n, 6) / tot; wedges[t.name] = [a0, span]; labels.push({ name: t.name, a: a0 + span / 2, n: t.n, born: performance.now() + j * 160 }); a0 += span; });
    const byK = {}; items.forEach(x => byK[x.k] = x.topic);
    parts.forEach(p => { const tn = byK[p.k]; const w = wedges[tn]; if (!w) return; const pl = place(p.k, p.inner, w); p.tx = pl.tx; p.ty = pl.ty; p.topic = tn; });
    return byK;
  }
  function topicKey(k) { const f = toks(k).filter(t => !GENERIC.has(t) && !GEO_TOKENS.has(t) && !(SCAN.seeds.join(" ").includes(t))); return f[0] || k; }
  function place(k, inner, w) {
    const a = w ? w[0] + w[1] * (0.08 + 0.84 * hash(k + "a")) : hash(topicKey(k)) * Math.PI * 2 + (hash(k) - 0.5) * 0.5;
    const r = inner ? 0.1 + 0.28 * hash(k + "r") : 0.42 + 0.58 * Math.sqrt(hash(k + "r"));
    return { tx: CX + Math.cos(a) * r * RAD * 1.25, ty: CY + Math.sin(a) * r * RAD };
  }
  function sizeOf(v, c) { return 1.2 + Math.min(7, Math.sqrt((v * Math.max(c || 0, 0.4)) / 40)); }
  function start(domain) {
    cv = $("#radar"); ctx = cv.getContext("2d"); resize(); window.addEventListener("resize", resize);
    parts = []; comps = []; beams = []; tiles = []; labels = []; wedges = null; center = domain; tablePhase = 0; t0 = performance.now();
    cancelAnimationFrame(raf); loop();
  }
  function stop() { cancelAnimationFrame(raf); }
  function loop() {
    const t = performance.now();
    ctx.clearRect(0, 0, W, H);
    // rings
    ctx.strokeStyle = "rgba(91,140,255,.10)"; ctx.lineWidth = 1;
    [0.4, 0.7, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(CX, CY, RAD * k * 1.25, RAD * k, 0, 0, 7); ctx.stroke(); });
    // sweep
    sweep += 0.018;
    const g = ctx.createConicGradient ? ctx.createConicGradient(sweep, CX, CY) : null;
    if (g) { g.addColorStop(0, "rgba(251,191,36,.16)"); g.addColorStop(0.08, "rgba(251,191,36,0)"); g.addColorStop(1, "rgba(251,191,36,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(CX, CY, RAD * 1.25, RAD, 0, 0, 7); ctx.fill(); }
    // beams
    beams = beams.filter(b => t - b.t < 1400);
    beams.forEach(b => { const a = 1 - (t - b.t) / 1400; ctx.strokeStyle = `rgba(255,107,125,${0.35 * a})`; ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke(); });
    if (comps.length && Math.random() < 0.5) { const c = comps[Math.floor(Math.random() * comps.length)]; if (c.own.length) { const p = c.own[Math.floor(Math.random() * c.own.length)]; beams.push({ a: c, b: p, t }); } }
    // particles
    parts.forEach(p => {
      p.x += (p.tx - p.x) * 0.06; p.y += (p.ty - p.y) * 0.06; p.r += (p.tr - p.r) * 0.08;
      let col = p.mine ? COLORS[p.st] || COLORS.top : "rgba(120,140,170,.45)";
      if (tablePhase && !p.mine) col = `rgba(251,191,36,${0.35 + 0.35 * Math.sin(t / 300 + p.ph)})`;
      if (tablePhase && p.mine && p.st === "close") col = COLORS.close;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, p.r), 0, 7); ctx.fill();
      if (p.ping && t - p.ping < 900) { const a = 1 - (t - p.ping) / 900; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 14 * (1 - a) + 2, 0, 7); ctx.stroke(); }
    });
    // competitor planets
    comps.forEach((c, i) => {
      c.a += 0.0009; c.x = CX + Math.cos(c.a) * RAD * 1.36; c.y = CY + Math.sin(c.a) * RAD * 1.1;
      ctx.fillStyle = "rgba(255,107,125,.16)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 10, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff6b7d"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
      ctx.fillStyle = "#c6d2e2"; ctx.font = (W < 700 ? "600 9px" : "600 11px") + " JetBrains Mono"; ctx.textAlign = "center"; ctx.fillText(W < 700 && c.d.length > 16 ? c.d.slice(0, 15) + "…" : c.d, c.x, c.y - c.r - 8);
    });
    // topic titles around the radar
    labels.forEach(l => {
      const a = Math.min(1, Math.max(0, (t - l.born) / 600)); if (!a) return;
      const rx = RAD * 1.25 * 0.36, ry = RAD * 0.36;
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = "rgba(251,191,36,.35)"; ctx.beginPath(); ctx.moveTo(CX + Math.cos(l.a) * rx, CY + Math.sin(l.a) * ry); ctx.lineTo(CX + Math.cos(l.a) * RAD * 1.25 * 1.02, CY + Math.sin(l.a) * RAD * 1.02); ctx.stroke();
      ctx.globalAlpha = a; const lx = CX + Math.cos(l.a) * RAD * 1.25 * 1.06, ly = CY + Math.sin(l.a) * RAD * 1.06;
      const txt = l.name.toUpperCase(); ctx.font = (W < 700 ? "700 9px" : "700 11px") + " JetBrains Mono"; ctx.textAlign = Math.cos(l.a) > 0.25 ? "left" : Math.cos(l.a) < -0.25 ? "right" : "center";
      const tw = ctx.measureText(txt).width; const bx = ctx.textAlign === "left" ? lx - 6 : ctx.textAlign === "right" ? lx - tw - 6 : lx - tw / 2 - 6;
      ctx.fillStyle = "rgba(6,10,18,.85)"; ctx.fillRect(bx, ly - 11, tw + 12, 17); ctx.fillStyle = "#ffd76a"; ctx.fillText(txt, lx, ly + 2);
      ctx.globalAlpha = 1;
    });
    // center
    ctx.fillStyle = "rgba(62,224,143,.16)"; ctx.beginPath(); ctx.arc(CX, CY, 26 + 4 * Math.sin(t / 400), 0, 7); ctx.fill();
    ctx.fillStyle = "#3ee08f"; ctx.beginPath(); ctx.arc(CX, CY, 9, 0, 7); ctx.fill();
    ctx.fillStyle = "#ecf2fa"; ctx.font = "700 14px Inter"; ctx.textAlign = "center"; ctx.fillText(center, CX, CY + 44);
    // serp tiles
    tiles.forEach((s, j) => {
      const tw = 62, th = 112, gap = 10, x0 = 28 + j * (tw + gap), y0 = H - 300;
      if (W < 1000 || x0 + tw > CX - RAD * 0.9 && j > 3) return;
      const a = Math.min(1, (t - s.t) / 500);
      ctx.globalAlpha = a; ctx.fillStyle = "rgba(11,19,32,.92)"; ctx.strokeStyle = "rgba(38,52,76,1)"; ctx.fillRect(x0, y0, tw, th); ctx.strokeRect(x0, y0, tw, th);
      for (let r = 0; r < 10; r++) { const d = s.org[r]; const me = d && (d[0] === SCAN.domain || d[0].endsWith("." + SCAN.domain)); ctx.fillStyle = me ? "#3ee08f" : r === 0 ? "#ff6b7d" : "#26344c"; ctx.fillRect(x0 + 6, y0 + 20 + r * 8.6, tw - 12, 5.5); }
      ctx.fillStyle = "#8796ab"; ctx.font = "9px JetBrains Mono"; ctx.textAlign = "left"; ctx.fillText(s.k.slice(0, 11), x0 + 5, y0 + 12);
      ctx.globalAlpha = 1;
    });
    raf = requestAnimationFrame(loop);
  }
  function foot() {
    SCAN.ranked.slice(0, 220).forEach((r, j) => setTimeout(() => {
      const pl = place(r.k, true); parts.push({ k: r.k, inner: true, x: CX, y: CY, ...pl, r: 0, tr: sizeOf(r.v, r.c), mine: true, st: status(r.p), ph: Math.random() * 6, ping: performance.now() });
    }, j * (REPLAY ? 6 : 8)));
  }
  function market() {
    const have = new Set(parts.map(p => p.k)); const rk = {}; SCAN.ranked.forEach(r => rk[r.k] = r.p);
    let n = 0, val = 0;
    SCAN.universe.forEach((u, j) => {
      if (have.has(u.k)) return;
      setTimeout(() => {
        const pl = place(u.k, false); const ang = Math.random() * 7;
        const p = rk[u.k];
        parts.push({ k: u.k, x: CX + Math.cos(ang) * RAD * 2, y: CY + Math.sin(ang) * RAD * 2, ...pl, r: 0, tr: sizeOf(u.v, u.c), mine: !!(p && p <= 20), st: status(p), ph: Math.random() * 6 });
        n++; val += u.v * SUM10 * (u.c || 0);
        if (j % 7 === 0) { $("#cSearch").textContent = fmt(n + have.size); $("#cValue").textContent = money(val); }
      }, j * (REPLAY ? 2 : 3));
    });
    setTimeout(() => setTopics(), Math.min(1600, SCAN.universe.length * (REPLAY ? 2 : 3)) + 300);
    setTimeout(() => { $("#cSearch").textContent = fmt(SCAN.universe.length); $("#cValue").textContent = money(SCAN.universe.reduce((a, u) => a + u.v * SUM10 * (u.c || 0), 0)); }, SCAN.universe.length * 3 + 100);
  }
  function local() {
    const m = {}; SCAN.universe.forEach(u => m[u.k] = u);
    parts.forEach(p => { const u = m[p.k]; p.tr = u ? sizeOf(u.v * 20, u.c) : 0.4; });
    $("#cSearch").textContent = fmt(SCAN.universe.length);
    tween($("#cValue"), SCAN.universe.reduce((a, u) => a + u.v * SUM10 * (u.c || 0), 0), money);
  }
  function comp() {
    const byK = {}; parts.forEach(p => byK[p.k] = p);
    SCAN.comps.slice(0, 7).forEach((c, j) => setTimeout(() => {
      const own = Object.entries(c.pos).filter(([i, p]) => p <= 3).map(([i]) => byK[SCAN.universe[i]?.k]).filter(Boolean).slice(0, 60);
      comps.push({ d: c.d, a: (j / 7) * Math.PI * 2 - 1.2, r: 5 + Math.min(9, own.length / 6), own, x: CX, y: CY });
    }, j * 260));
  }
  function serpTile(s) {
    tiles.push({ ...s, t: performance.now() });
    const p = parts.find(q => q.k === s.k); if (p) p.ping = performance.now();
  }
  async function table() {
    tablePhase = 1;
    const mine = new Set(R.items.filter(x => x.p && x.p <= 20).map(x => x.k));
    const st = {}; R.items.forEach(x => st[x.k] = x.st);
    parts.forEach(p => { p.mine = mine.has(p.k); p.st = st[p.k] || p.st; });
    tween($("#cTable"), R.table.value || R.table.clicks, R.table.value ? money : fmt, 2200);
    await sleep(REPLAY ? 2000 / SPEED : 2400);
  }
  return { start, stop, foot, market, local, comp, serpTile, table };
})();

function tween(el, to, f = fmt, ms = 1400) {
  const s = performance.now();
  (function step() { const p = Math.min(1, (performance.now() - s) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = f(to * e); if (p < 1) requestAnimationFrame(step); })();
}

function openOverlay() {
  $("#scan").classList.add("on"); $("#scDone").classList.remove("on"); $("#log").innerHTML = "";
  $("#cSearch").textContent = "0"; $("#cValue").textContent = "$0"; $("#cTable").textContent = "–"; $("#scCost").textContent = "$0.000";
  $("#scDomain").textContent = SCAN.domain;
  $("#scMarket").textContent = (SCAN.keyword ? " · " + SCAN.keyword : "") + " · " + SCAN.location.label;
  $("#scSpeed").style.display = REPLAY ? "" : "none"; $("#scSkip").style.display = REPLAY ? "" : "none";
  $("#scSpeed").textContent = "Speed " + SPEED + "×";
  document.body.style.overflow = "hidden";
  VIZ.start(SCAN.domain);
  log(`❯ scan ${SCAN.domain}${SCAN.keyword ? ' --keyword "' + SCAN.keyword + '"' : ""} --location "${SCAN.location.label}"`, "", false);
}
function closeOverlay() { VIZ.stop(); $("#scan").classList.remove("on"); document.body.style.overflow = ""; }
function finishOverlay() {
  $("#scSteps").querySelectorAll("div").forEach(d => d.className = "done");
  $("#sdVal").textContent = R.table.value ? money(R.table.value) + "/mo" : "+" + fmt(R.table.clicks) + " visits/mo";
  $("#sdTxt").innerHTML = `left on the table for <b>${esc(SCAN.domain)}</b>: <b>+${fmt(R.table.clicks)}</b> visits a month you could win by reaching the top 3 across this market.`;
  $("#scDone").classList.add("on");
}
function toggleSpeed() { SPEED = SPEED === 1 ? 2 : SPEED === 2 ? 4 : 1; $("#scSpeed").textContent = "Speed " + SPEED + "×"; }
function skipScan() { SKIP = true; }

async function replay(scan) {
  SCAN = JSON.parse(JSON.stringify(scan)); REPLAY = true; SKIP = false;
  SCAN.serps = SCAN.serps || []; SCAN.youPos = SCAN.youPos || {};
  const serps = SCAN.serps; SCAN.serps = [];
  openOverlay();
  let cost = 0;
  for (const s of activeSteps()) {
    if (SKIP) break;
    stepUI(s.id);
    const lines = (SCAN.log || []).filter(l => l[0] === s.id);
    const calls = (SCAN.calls || []);
    const dur = Math.max(1.6, Math.min(4.2, (SCAN.durations?.[s.id] || 2))) * 1000 / SPEED;
    if (s.id === "foot") VIZ.foot(); if (s.id === "market") VIZ.market(); if (s.id === "local") VIZ.local(); if (s.id === "comp") VIZ.comp();
    if (s.id === "serp") { for (const x of serps) { if (SKIP) break; SCAN.serps.push(x); VIZ.serpTile(x); await sleep(dur / Math.max(1, serps.length)); } }
    if (s.id === "table") { R = compute(SCAN); VIZ.table(); }
    for (const l of lines) { if (SKIP) break; log(l[2], l[1], false); if (l[2].startsWith("→")) { const m = l[2].match(/\$([\d.]+)/); if (m) { cost += +m[1]; $("#scCost").textContent = "$" + cost.toFixed(3); } } await sleep(dur / Math.max(2, lines.length + 1)); }
    if (s.id !== "serp") await sleep(dur / 3);
  }
  SCAN.serps = serps;
  R = compute(SCAN);
  if (SKIP) { closeOverlay(); showResults(true); return; }
  finishOverlay();
}
function replayCurrent() { if (SCAN) replay(SCAN); }

/* ---------- results ---------- */
const fav = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
function showResults(instant) {
  closeOverlay();
  $("#start").style.display = "none"; $("#results").classList.add("on");
  window.scrollTo(0, 0);
  const S = SCAN, Rr = R;
  $("#rFav").src = fav(S.domain); $("#rDomain").textContent = S.domain;
  $("#rSub").textContent = `${S.keyword ? "Market: " + S.keyword : "Market: searches related to the site"} · ${S.location.label}${S.location.region && S.localFailed ? " (national volumes)" : ""} · scanned ${new Date(S.date).toLocaleDateString()}`;
  const pct = (Rr.you.share * 100);
  $("#rHeadline").innerHTML = `${esc(S.domain)} captures <span class="gr">${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</span> of the clicks in this market. Reaching the top 3 across it is worth <span class="gd">+${fmt(Rr.table.clicks)} visits</span>${Rr.table.value ? ` and <span class="gd">${money(Rr.table.value)}</span> in click value` : ""} a month.`;
  countUp("#kYou", Rr.you.clicks, fmt); $("#kYouS").innerHTML = `visits/mo from this market · worth <b>${money(Rr.you.value)}</b>/mo at ad prices · <b>${Rr.you.kw3}</b> searches in the top 3`;
  countUp("#kMarket", Rr.market.clicks, fmt); $("#kMarketS").innerHTML = `organic clicks/mo across <b>${fmt(Rr.items.length)}</b> searches (${fmt(Rr.searches)} searches/mo) · worth <b>${money(Rr.market.value)}</b>`;
  countUp("#kTable", Rr.table.value || Rr.table.clicks, Rr.table.value ? money : fmt); $("#kTableS").innerHTML = `<b>+${fmt(Rr.table.clicks)}</b> visits/mo if you reached the top 3 on every search here · ${Rr.items.filter(x => x.st === "close").length} already within striking distance`;
  // share bar
  const top5 = Rr.comps.slice(0, 5), tot = Rr.basis.clicks || 1;
  const segs = [{ l: "You", v: Rr.you.bClicks, c: "#3ee08f" }, ...top5.map((c, j) => ({ l: c.d, v: c.clicks, c: ["#ff6b7d", "#ff8a6b", "#f472b6", "#c084fc", "#818cf8"][j] })), { l: "Everyone else", v: Rr.rest, c: "#26344c" }];
  $("#bar3").innerHTML = segs.map(s => `<i style="background:${s.c}" data-w="${100 * s.v / tot}">${100 * s.v / tot > 7 ? `<span>${esc(s.l)} ${Math.round(100 * s.v / tot)}%</span>` : ""}</i>`).join("");
  $("#bar3l").innerHTML = segs.map(s => `<span><i style="background:${s.c}"></i>${esc(s.l)} · ${(100 * s.v / tot).toFixed(1)}%</span>`).join("");
  $("#pieTot").textContent = Rr.basis.local ? `${Rr.basis.n} top searches, live in ${SCAN.location.city || SCAN.location.region} · ${fmt(tot)} clicks/mo` : fmt(tot) + " organic clicks / month";
  setTimeout(() => document.querySelectorAll("#bar3 i").forEach(i => i.style.width = Math.max(0.4, +i.dataset.w) + "%"), 150);
  renderLadder();
  renderComps(); renderSerps(); renderTopics(); renderTable("all"); renderMethod(); setTimeout(renderProjection, 80);
  setTimeout(() => UNI.init(), 60);
}
function countUp(sel, to, f) { tween($(sel), to, f, 1600); }

function renderComps() {
  const Rr = R, list = Rr.comps.slice(0, 10);
  const max = Math.max(Rr.you.bClicks, ...list.map(c => c.clicks), 1);
  const rows = list.map((c, j) => ({ ...c, n: j + 1 }));
  const meRow = { ...Rr.you, clicks: Rr.you.bClicks }; if (Rr.you.rank <= 10) rows.splice(Rr.you.rank - 1, 0, meRow); else rows.push(meRow);
  rows.forEach((r, j) => { if (!r.me) r.n = j + 1 - (rows.slice(0, j).some(x => x.me) && Rr.you.rank <= 10 ? 0 : 0); });
  let n = 0;
  $("#compList").innerHTML = rows.slice(0, 11).map(r => {
    if (!r.me) n++;
    const rank = r.me ? (Rr.you.bClicks > 0 ? Rr.you.rank : null) : (Rr.you.bClicks > 0 && n >= Rr.you.rank ? n + 1 : n);
    return `<div class="crow ${r.me ? "me" : ""}"><div class="n">${rank ? "#" + rank : "–"}</div><div class="d"><b><img src="${fav(r.d)}" alt="">${esc(r.d)} ${r.me ? '<span class="tag you">you</span>' : r.platform ? '<span class="tag">platform</span>' : ""}</b><div class="track"><i data-w="${100 * r.clicks / max}"></i></div></div><div class="m">${fmt(r.clicks)}<span>visits/mo</span></div><div class="m">${(r.share * 100).toFixed(1)}%<span>${r.kw3} top-3${r.packs ? " · " + r.packs + " map" : " · " + r.kw10 + " pg 1"}</span></div></div>`;
  }).join("");
  setTimeout(() => document.querySelectorAll("#compList .track i").forEach(i => i.style.width = Math.max(0.5, +i.dataset.w) + "%"), 200);
  const lead = Rr.comps[0];
  const basisTxt = Rr.basis.local ? ` Measured on the ${Rr.basis.n} most valuable searches, checked live from ${esc(SCAN.location.city || SCAN.location.region)} including the map pack (${Math.round(Rr.basis.pct * 100)}% of the market's value).` : "";
  $("#compLd").innerHTML = (lead ? `<b>${esc(lead.d)}</b> leads this market with about ${fmt(lead.clicks)} visits a month (${(lead.share * 100).toFixed(1)}% of clicks). ${Rr.you.bClicks <= 0 ? "You don't show up in these results yet." : Rr.you.rank <= 10 ? `You're #${Rr.you.rank}.` : `You're #${Rr.you.rank} among the sites we found.`}` : "") + basisTxt;
  // donut
  const segs = [{ l: "You", v: Rr.you.bClicks, c: "#3ee08f" }, ...Rr.comps.slice(0, 5).map((c, j) => ({ l: c.d, v: c.clicks, c: ["#ff6b7d", "#ff8a6b", "#f472b6", "#c084fc", "#818cf8"][j] })), { l: "Everyone else", v: Rr.rest, c: "#26344c" }];
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  const svg = d3.select("#donut"); svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", "translate(130,130)");
  const arc = d3.arc().innerRadius(78).outerRadius(118).cornerRadius(3).padAngle(0.012);
  const pie = d3.pie().sort(null).value(d => d.v)(segs);
  g.selectAll("path").data(pie).enter().append("path").attr("fill", d => d.data.c).transition().duration(1400).delay((d, i) => i * 120).attrTween("d", d => { const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d); return t => arc(i(t)); });
  g.append("text").attr("text-anchor", "middle").attr("y", -4).attr("fill", "#3ee08f").attr("font-size", 32).attr("font-weight", 900).text(((Rr.you.share) * 100).toFixed(Rr.you.share < 0.1 ? 1 : 0) + "%");
  g.append("text").attr("text-anchor", "middle").attr("y", 18).attr("fill", "#8796ab").attr("font-size", 11).attr("font-family", "JetBrains Mono").text("your share of clicks");
  $("#donutL").innerHTML = segs.map(s => `<div><span><i style="background:${s.c}"></i>${esc(s.l)}</span><b>${(100 * s.v / tot).toFixed(1)}%</b></div>`).join("");
}

function renderSerps() {
  const S = SCAN;
  if (!S.serps || !S.serps.length) { $("#serpSec").style.display = "none"; return; }
  $("#serpSec").style.display = ""; $("#serpH").textContent = `What searchers in ${S.location.region} actually see`;
  const mine = d => d === S.domain || d.endsWith("." + S.domain);
  $("#serps").innerHTML = S.serps.slice(0, 10).map(s => `<div class="card serp"><h5 title="${esc(s.k)}">${esc(s.k)}</h5>${s.lp.length ? `<div class="rk" style="color:var(--cyan)"><i>map</i>${esc(s.lp.map(l => l[0]).join(" · ").slice(0, 60))}</div>` : ""}${s.org.slice(0, 6).map(o => `<div class="rk ${mine(o[0]) ? "me" : ""}"><i>${o[1]}</i>${esc(o[0])}</div>`).join("")}<div class="yp" style="color:${s.you && s.you <= 3 ? "var(--green2)" : s.you ? "var(--gold)" : "var(--red)"}">${s.you ? "you: #" + s.you : "you: not in top 20"}${s.youLp ? " · in map pack" : ""}${s.ads ? ` · ${s.ads} ads` : ""}</div></div>`).join("");
}

function renderTopics() {
  const Rr = R;
  $("#topics").innerHTML = Rr.topics.slice(0, 9).map(t => {
    const ys = Math.min(100, t.share * 100), ls = Math.min(100 - ys, t.leadShare * 100);
    return `<div class="card topic"><h4>${esc(t.name)}${t.core ? ' <span class="tag">core</span>' : ""}</h4><div class="meta">${fmt(t.n)} searches · ${fmt(t.searches)}/mo · ${money(t.value)} market</div>
    <div class="big"><b>${t.potVal ? money(t.potVal) : "+" + fmt(t.pot)}</b><span>${t.potVal ? "+" + fmt(t.pot) + " visits/mo on the table" : "visits/mo on the table"}</span></div>
    <div class="sbar"><i style="width:${ys}%;background:var(--green)"></i><i style="width:${ls}%;background:var(--red)"></i></div>
    <div class="own"><span>you ${ys.toFixed(ys < 1 ? 1 : 0)}%</span><b>${t.lead ? "leader: " + esc(t.lead.d) + " " + Math.round(ls) + "%" : "no clear leader"}</b></div></div>`;
  }).join("");
}

let SORT = { k: "potVal", dir: -1 }, TAB = "all", SHOWALL = false;
function renderTable(tab) {
  if (tab) TAB = tab;
  document.querySelectorAll("#oTabs button").forEach(b => b.classList.toggle("on", b.dataset.v === TAB));
  let xs = R.items.slice();
  if (TAB === "close") xs = xs.filter(x => x.p && x.p > 3 && x.p <= 20);
  else if (TAB === "none") xs = xs.filter(x => !x.p || x.p > 20);
  else if (TAB === "mine") xs = xs.filter(x => x.p && x.p <= 3);
  else xs = xs.filter(x => x.pot > 0);
  const anyVal = R.items.some(x => x.c > 0);
  const key = SORT.k === "potVal" && !anyVal ? "pot" : SORT.k;
  xs.sort((a, b) => { const d = (a[key] ?? -1) - (b[key] ?? -1); return SORT.dir < 0 ? -d : d; });
  const lim = innerWidth < 700 && !SHOWALL ? 15 : 80;
  const cols = [["k", "Search"], ["topic", "Topic"], ["v", "Searches/mo"], ["c", "CPC"], ["d", "Difficulty"], ["p", "You"], ["lead", "#1 right now"], ["pot", "+ Visits/mo"], ["potVal", "+ Value/mo"]];
  $("#oTable").innerHTML = `<tr>${cols.map(([k, l]) => `<th data-k="${k}" class="${["v", "c", "d", "pot", "potVal"].includes(k) ? "n" : ""}">${l}${SORT.k === k ? (SORT.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr>` +
    xs.slice(0, lim).map(x => `<tr><td class="kw">${esc(x.k)}</td><td class="hm" style="color:var(--muted);text-transform:capitalize">${esc(x.topic || "")}</td><td class="n" data-l="Searches" ${x.ve ? 'title="estimated from national volume"' : ""}>${x.ve ? "~" : ""}${fmt(x.v)}</td><td class="n" data-l="CPC" ${x.ce ? 'title="estimated from the market median"' : ""}>${x.c ? (x.ce ? "~" : "") + "$" + x.c.toFixed(2) : "–"}</td><td class="n hm">${x.d ?? "–"}</td><td data-l="You"><span class="pos ${x.st}">${x.p ? "#" + x.p : "–"}</span></td><td data-l="#1 now" style="font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis">${x.lead ? (x.lead.me ? '<span class="tag you">you</span>' : esc(x.lead.d)) + ` <span class="mono" style="color:var(--dim)">#${x.lead.p}</span>` : "–"}</td><td class="n gain" data-l="+ Visits">${x.pot ? "+" + fmt(x.pot) : "–"}</td><td class="n gain" data-l="+ Value">${x.potVal ? money(x.potVal) : "–"}</td></tr>`).join("") +
    (xs.length ? "" : `<tr><td colspan="9" style="color:var(--dim);padding:20px">Nothing here.</td></tr>`) + (xs.length > lim ? `<tr class="more"><td colspan="9"><button class="btn sm" onclick="SHOWALL=true;renderTable()">Show ${Math.min(80, xs.length) - lim} more</button></td></tr>` : "");
  document.querySelectorAll("#oTable th").forEach(th => th.onclick = () => { const k = th.dataset.k; if (k === "topic" || k === "lead" || k === "k") return; SORT = { k, dir: SORT.k === k ? -SORT.dir : -1 }; renderTable(); });
}

function renderMethod() {
  const S = SCAN;
  $("#method").innerHTML = `<b>How this is calculated.</b> The market is ${S.seeds.length ? `every search DataForSEO Labs relates to “${esc(S.keyword)}”` : "the searches DataForSEO Labs finds relevant to the site"}, plus the site's own matching rankings (${fmt(R.items.length)} searches). ${S.location.region && !S.localFailed ? `Search volumes and CPCs are Google Ads data for ${esc(S.location.region)}. Rankings come from DataForSEO's US index, except the ${S.serps.length} searches checked live in ${esc(S.location.region)}, which use those local results.` : `Search volumes, CPCs and rankings are for ${esc(S.location.label)}.`} Clicks use a standard organic click-through curve (about 22% for #1, 13% for #2, 9% for #3, falling to 1.5% at #10). “Left on the table” is the extra clicks you'd get at an average top-3 position on every search where you're below it. Click value is clicks × CPC, what the same traffic would cost in Google Ads. Competitor shares cover the ${Math.min(800, R.items.length)} most valuable searches. Estimates, not guarantees.<br>Scan cost $${(S.cost || 0).toFixed(2)} · ${S.calls.length} API calls · ${S.runtime || "–"}s · built with <a href="https://github.com/jourdanrombough/left-on-the-table">Left on the Table</a> by <a href="https://optimizationtheory.com/about-jourdan-rombough-seo-web-visibility-expert/">Jourdan Rombough</a>.`;
}

/* ---------- universe chart ---------- */
const UNI = (() => {
  let cv, ctx, W, H, D, nodes = [], groups = [], filt = "all", sizeBy = "value", raf, hover = null;
  function init() {
    cv = $("#uni"); ctx = cv.getContext("2d");
    document.querySelectorAll("#uFilter button").forEach(b => b.onclick = () => { filt = b.dataset.v; document.querySelectorAll("#uFilter button").forEach(x => x.classList.toggle("on", x === b)); });
    document.querySelectorAll("#uSize button").forEach(b => b.onclick = () => { sizeBy = b.dataset.v; document.querySelectorAll("#uSize button").forEach(x => x.classList.toggle("on", x === b)); layout(false); });
    cv.onmousemove = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; hover = null; for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; if ((x - n.x) ** 2 + (y - n.y) ** 2 <= Math.max(16, n.r * n.r)) { hover = n; break; } } tip(e, hover); };
    cv.onmouseleave = () => { hover = null; tip(null); };
    cv.addEventListener("touchstart", e => { const t = e.touches[0]; cv.onmousemove({ clientX: t.clientX, clientY: t.clientY }); setTimeout(() => { hover = null; tip(null); }, 2600); }, { passive: true });
    resize(); layout(true);
    cancelAnimationFrame(raf); draw();
    let lastW = innerWidth; window.addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) < 2) return; lastW = innerWidth; resize(); layout(false); });
  }
  function resize() { D = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; ctx.setTransform(D, 0, 0, D, 0, 0); }
  const GC = ["#5b8cff", "#4fd1e8", "#a78bfa", "#f472b6", "#ff8a6b", "#2dd4bf", "#818cf8", "#e879f9", "#60a5fa", "#fb7185", "#34d399", "#c084fc", "#38bdf8", "#f59e0b", "#a3e635", "#94a3b8"];
  function subText(g) { return `${g.n} searches · ${g.isVal ? money(g.pot) : "+" + fmt(g.pot)} open`; }
  function pillW(g) { ctx.font = "800 11.5px JetBrains Mono"; const a = ctx.measureText(g.name.toUpperCase()).width + 28; ctx.font = "500 10.5px JetBrains Mono"; return Math.max(a, ctx.measureText(subText(g)).width + 20); }
  function layout(first) {
    const xs = R.items.slice().sort((a, b) => b.mkVal - a.mkVal).slice(0, 750);
    const useVal = sizeBy === "value" && xs.some(x => x.mkVal > 0);
    const tops = R.topics.slice(0, 16).map(t => t.name);
    let gs = tops.map(n => ({ name: n, children: [] }));
    const other = { name: "other", children: [] };
    xs.forEach(x => { const g = gs.find(c => c.name === x.topic) || other; g.children.push({ x, raw: useVal ? x.mkVal : x.v }); });
    const mxRaw = Math.max(1, ...xs.map(x => useVal ? x.mkVal : x.v));
    if (other.children.length) gs.push(other);
    gs = gs.filter(c => c.children.length);
    gs.forEach(g => g.children.forEach(c => c.value = Math.pow(Math.max(c.raw, mxRaw * 0.0015), 0.5)));
    gs.forEach(g => g.sum = g.children.reduce((a, c) => a + c.value, 0));
    gs.sort((a, b) => b.sum - a.sum);
    groups = gs.map((c, j) => { const t = R.topics.find(q => q.name === c.name); return { name: c.name, col: GC[j % GC.length], n: c.children.length, val: t ? t.value : 0, pot: t ? (t.potVal || t.pot) : 0, isVal: !!(t && t.potVal), data: c }; });
    const prev = {}; nodes.forEach(n => prev[n.x0.k] = n);
    const leaves = [];
    if (true) {
      // each keyword group gets its own titled cluster; clusters flow in centered rows
      const mob = W < 700, maxSum = groups[0].data.sum, Dmax = mob ? W - 40 : Math.min(460, W * 0.42), Dmin = mob ? 96 : 120;
      const rows = []; let row = [], rw = 0;
      groups.forEach(g => {
        g.D = Math.max(Dmin, Dmax * Math.sqrt(g.data.sum / maxSum)); g.pw = pillW(g); g.cw = Math.max(g.D, g.pw) + (mob ? 14 : 30);
        if (rw + g.cw > W - 20 && row.length) { rows.push(row); row = []; rw = 0; }
        row.push(g); rw += g.cw;
      });
      if (row.length) rows.push(row);
      let y = mob ? 92 : 70;
      rows.forEach(rr => {
        const tot = rr.reduce((a, g) => a + g.cw, 0); let x = (W - tot) / 2; const rowH = Math.max(...rr.map(g => g.D)) + 58;
        rr.forEach(g => { g.cx = x + g.cw / 2; g.cy = y + 40 + (rowH - 58) / 2; g.r = g.D / 2; g.lab = { x: Math.max(4, Math.min(W - g.pw - 4, g.cx - g.pw / 2)), y: g.cy - g.r - 38, w: g.pw, h: 32 }; x += g.cw; });
        y += rowH;
      });
      const need = y + 64;
      if (Math.abs(cv.parentElement.clientHeight - need) > 2) { cv.parentElement.style.height = need + "px"; resize(); }
      groups.forEach(g => {
        const h = d3.hierarchy({ children: g.data.children }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
        d3.pack().size([g.r * 2, g.r * 2]).padding(1.2)(h);
        g.x = g.cx; g.y = g.cy;
        h.leaves().forEach(l => leaves.push({ l, ox: g.cx - g.r, oy: g.cy - g.r, g }));
      });
    } else {
      const TOP = 46, PAD = 38;
      const h = d3.hierarchy({ children: gs }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
      d3.pack().size([W - 20, H - TOP - 50]).padding(d => d.depth === 0 ? PAD : 1.2)(h);
      h.children.forEach(c => { const g = groups.find(q => q.data === c.data); g.x = c.x + 10; g.y = c.y + TOP; g.r = c.r; });
      h.leaves().forEach(l => leaves.push({ l, ox: 10, oy: TOP, g: groups.find(q => q.data === l.parent.data) }));
      const placed = [];
      groups.forEach(g => {
        const w = pillW(g), hh = 32;
        let y = g.y - g.r - hh - 2, x = Math.max(4, Math.min(W - w - 4, g.x - w / 2));
        const hit = r => placed.some(q => !(r.x + r.w < q.x || q.x + q.w < r.x || r.y + r.h < q.y || q.y + q.h < r.y));
        let tries = 0; while ((y < 2 || hit({ x, y, w, h: hh })) && tries++ < 14) y = y < 2 ? g.y - g.r + 4 : y + 12;
        g.lab = { x, y, w, h: hh }; placed.push(g.lab);
      });
    }
    nodes = leaves.map(({ l, ox, oy, g }, j) => { const p = prev[l.data.x.k]; return { x0: l.data.x, col: g.col, tx: l.x + ox, ty: l.y + oy, tr: l.r, x: p ? p.x : g.x, y: p ? p.y : g.y, r: p ? p.r : 0, delay: first ? j * 1.6 : 0, born: performance.now() }; });
    groups.forEach(g => g.born = performance.now());
  }
  function draw() {
    const t = performance.now();
    ctx.clearRect(0, 0, W, H);
    groups.forEach(g => { ctx.globalAlpha = .55; ctx.strokeStyle = g.col; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(g.x, g.y, g.r + 3, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = .05; ctx.fillStyle = g.col; ctx.fill(); ctx.globalAlpha = 1; });
    nodes.forEach(n => {
      if (t - n.born < n.delay) return;
      n.x += (n.tx - n.x) * 0.09; n.y += (n.ty - n.y) * 0.09; n.r += (n.tr - n.r) * 0.09;
      const x = n.x0, show = filt === "all" || (filt === "miss" ? (!x.p || x.p > 3) : (x.p && x.p <= 20));
      ctx.globalAlpha = show ? 1 : 0.08;
      if (x.st === "none") { ctx.fillStyle = "#0f1726"; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.5, n.r - 0.5), 0, 7); ctx.fill(); const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.28; ctx.fillStyle = n.col || "#26344c"; ctx.fill(); ctx.globalAlpha = ga; ctx.strokeStyle = filt === "miss" ? `rgba(251,191,36,${0.55 + 0.3 * Math.sin(t / 400 + n.tx)})` : "rgba(251,191,36,.32)"; ctx.lineWidth = 1; ctx.stroke(); }
      else { ctx.fillStyle = COLORS[x.st]; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.5, n.r - 0.5), 0, 7); ctx.fill(); }
      if (n === hover) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2, 0, 7); ctx.stroke(); }
      if (n.r > 22 && show && Math.abs(n.r - n.tr) < 2) { const fs = Math.min(12.5, Math.max(8.5, n.r / 3.6)); ctx.font = `600 ${fs}px Inter`; ctx.textAlign = "center"; ctx.fillStyle = x.st === "none" ? "#c6d2e2" : "#05080e"; let w = x.k; const maxW = n.r * 1.7; while (w.length > 4 && ctx.measureText(w).width > maxW) w = w.slice(0, -2); if (w !== x.k) w = w.slice(0, -1) + "…"; ctx.fillText(w, n.x, n.y + 2); ctx.font = `500 ${fs * 0.85}px JetBrains Mono`; ctx.globalAlpha *= .75; ctx.fillText(x.mkVal ? money(x.mkVal) : fmt(x.v), n.x, n.y + 2 + fs * 1.2); }
    });
    ctx.globalAlpha = 1;
    groups.forEach((g, j) => {
      const L = g.lab; if (!L) return; const a = Math.min(1, Math.max(0, (t - g.born - 300 - j * 90) / 500)); if (!a) return;
      ctx.globalAlpha = a; ctx.fillStyle = "rgba(6,10,18,.9)"; ctx.strokeStyle = g.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(L.x, L.y, L.w, L.h, 8) : ctx.rect(L.x, L.y, L.w, L.h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = g.col; ctx.fillRect(L.x + 8, L.y + 9, 6, 6);
      ctx.textAlign = "left"; ctx.font = "800 11.5px JetBrains Mono"; ctx.fillStyle = "#ecf2fa"; ctx.fillText(g.name.toUpperCase(), L.x + 19, L.y + 15);
      ctx.font = "500 10.5px JetBrains Mono"; ctx.fillStyle = "#8796ab"; ctx.fillText(subText(g), L.x + 9, L.y + 27);
      ctx.globalAlpha = 1;
    });
    raf = requestAnimationFrame(draw);
  }
  function tip(e, n) {
    const T = $("#tip");
    if (!n) { T.style.display = "none"; return; }
    const x = n.x0;
    T.innerHTML = `<b>${esc(x.k)}</b><div class="r"><span>Group</span><span style="text-transform:capitalize">${esc(x.topic || "")}</span></div><div class="r"><span>Searches / mo</span><span>${fmt(x.v)}</span></div><div class="r"><span>CPC</span><span>${x.c ? "$" + x.c.toFixed(2) : "–"}</span></div><div class="r"><span>You</span><span>${x.p ? "#" + x.p : "not ranking"}</span></div><div class="r"><span>#1 right now</span><span>${x.lead ? esc(x.lead.d) : "–"}</span></div><div class="r"><span>On the table</span><span style="color:var(--gold)">+${fmt(x.pot)} visits${x.potVal ? " · " + money(x.potVal) : ""}</span></div>`;
    T.style.display = "block"; T.style.left = Math.max(8, Math.min(innerWidth - T.offsetWidth - 8, e.clientX + 16)) + "px"; T.style.top = Math.min(innerHeight - T.offsetHeight - 8, e.clientY + 16) + "px";
  }
  return { init };
})();

/* ---------- misc actions ---------- */
function goHome() { closeOverlay(); $("#results").classList.remove("on"); $("#start").style.display = ""; history.replaceState(null, "", location.pathname); loadLists(); window.scrollTo(0, 0); }
function copySummary() {
  const S = SCAN, Rr = R;
  const lines = [`${S.domain} · ${S.keyword || "site keywords"} · ${S.location.label}`,
  `You capture ${(Rr.you.share * 100).toFixed(1)}% of clicks in this market: ~${fmt(Rr.you.clicks)} visits/mo (${money(Rr.you.value)} in click value).`,
  `The market: ${fmt(Rr.items.length)} searches, ~${fmt(Rr.market.clicks)} organic clicks/mo worth ${money(Rr.market.value)}.`,
  `Left on the table: +${fmt(Rr.table.clicks)} visits/mo (${money(Rr.table.value)}/mo) by reaching the top 3.`,
  `Top competitors: ${Rr.comps.slice(0, 3).map(c => `${c.d} (${(c.share * 100).toFixed(1)}%)`).join(", ")}.`,
  `Biggest untapped topics: ${Rr.topics.slice(0, 3).map(t => `${t.name} (${t.potVal ? money(t.potVal) : "+" + fmt(t.pot) + " visits"})`).join(", ")}.`];
  navigator.clipboard?.writeText(lines.join("\n")).then(() => { $("#copyBtn").textContent = "Copied ✓"; setTimeout(() => $("#copyBtn").textContent = "Copy summary", 1600); });
}
function downloadScan() {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(SCAN)], { type: "application/json" }));
  a.download = `${SCAN.domain}-${(SCAN.keyword || "site").replace(/\W+/g, "-")}-${SCAN.location.label.replace(/\W+/g, "-")}.json`.toLowerCase(); a.click();
}

/* ---------- start-page starfield ---------- */
(function () {
  const cv = $("#starfield"), ctx = cv.getContext("2d"); let W, H;
  const rs = () => { W = cv.width = cv.clientWidth; H = cv.height = cv.clientHeight; }; rs(); addEventListener("resize", rs);
  const P = [...Array(160)].map(() => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .3, g: Math.random() < .12, ph: Math.random() * 6 }));
  (function f(t) { if ($("#start").style.display !== "none") { ctx.clearRect(0, 0, W, H); P.forEach(p => { ctx.fillStyle = p.g ? `rgba(251,191,36,${.35 + .35 * Math.sin(t / 700 + p.ph)})` : "rgba(140,160,190,.28)"; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, 7); ctx.fill(); }); } requestAnimationFrame(f); })(0);
})();

/* ---------- boot ---------- */
initForm(); syncRegion();
document.querySelectorAll("#oTabs button").forEach(b => b.onclick = () => renderTable(b.dataset.v));
detectMode().then(() => {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("open=")) openFile(h.slice(5), true);
  else if (h.startsWith("show=")) openFile(h.slice(5), false);
});

/* ---------- traffic projection ---------- */
let SCEN = "exp";
function scenarios(Rr) {
  const it = Rr.items;
  const untapped = it.filter(x => !x.p || x.p > 20).sort((a, b) => ((a.d ?? 50) - (b.d ?? 50)) || (b.mkVal - a.mkVal) || (b.v - a.v));
  const pick = f => new Set(untapped.slice(0, Math.round(untapped.length * f)).map(x => x.i));
  const defs = {
    cons: { name: "Conservative", note: "Pages already ranking 4–20 move about halfway up. No new rankings.", mid: 5, mv: p => p > 3 && p <= 20 ? Math.max(3, Math.round(p / 2)) : p, set: new Set(), np: 0 },
    exp: { name: "Expected", note: "Striking-distance pages (4–20) reach #3, and the easiest 30% of untapped searches reach page one at #7.", mid: 6, mv: p => p > 3 && p <= 20 ? 3 : p, set: pick(.3), np: 7 },
    agg: { name: "Aggressive", note: "Top-3 pages reach #1, everything else ranking 4–20 reaches #2, the easiest half of untapped searches reach #4" + (Rr.basis && Rr.basis.local ? ", and you win a map-pack spot on the live-checked searches." : "."), mid: 7, mv: p => p <= 3 ? 1 : p <= 20 ? 2 : p, set: pick(.5), np: 4 },
  };
  Object.values(defs).forEach(s => {
    let pc = 0, pv = 0, pn = 0, nc = 0, nv = 0, nn = 0;
    it.forEach(x => {
      if (x.p && x.p <= 20) { const g = x.v * x.f * (ctr(s.mv(x.p)) - ctr(x.p)); if (g > 0) { pc += g; pv += g * (x.c || 0); pn++; } }
      else if (s.set.has(x.i)) { const g = x.v * x.f * (ctr(s.np) - ctr(x.p)); if (g > 0) { nc += g; nv += g * (x.c || 0); nn++; } }
    });
    const L = m => 1 / (1 + Math.exp(-(m - s.mid) / 1.6)), r = m => (L(m) - L(0)) / (L(12) - L(0));
    let mc = 0, mv = 0, mn = 0;
    if (s.name === "Aggressive") it.forEach(x => { if (x.lp && !x.pk) { const g = x.v * PACK[2]; mc += g; mv += g * (x.c || 0); mn++; } });
    Object.assign(s, { push: { clicks: pc, value: pv, n: pn }, win: { clicks: nc, value: nv, n: nn }, map: { clicks: mc, value: mv, n: mn }, gain: pc + nc + mc, gainVal: pv + nv + mv });
    s.months = [...Array(13)].map((_, m) => ({ m, clicks: Rr.you.clicks + s.gain * r(m), value: Rr.you.value + s.gainVal * r(m) }));
  });
  return defs;
}
function renderProjection() {
  const SC = scenarios(R), s = SC[SCEN];
  document.querySelectorAll("#pScen button").forEach(b => { b.classList.toggle("on", b.dataset.v === SCEN); b.onclick = () => { SCEN = b.dataset.v; renderProjection(); }; });
  $("#pNote").textContent = s.note;
  const base = R.you.clicks, start = new Date(SCAN.date);
  const mlab = m => { const d = new Date(start.getFullYear(), start.getMonth() + m, 1); return m === 0 ? "Now" : d.toLocaleString("en", { month: "short" }) + (d.getMonth() === 0 ? " '" + String(d.getFullYear()).slice(2) : ""); };
  const pct = x => base > 0 ? ` (${x / base >= 10 ? Math.round(x / base) + "×" : "+" + Math.round(100 * x / base) + "%"})` : "";
  $("#pStats").innerHTML = [0, 3, 6, 12].map(m => { const v = s.months[m]; return `<div><span>${m === 0 ? "Today" : "Month " + m + " · " + mlab(m)}</span><b class="${m ? "gd" : ""}">${fmt(v.clicks)}</b><span>visits/mo${m ? pct(v.clicks - base) : ""}${v.value ? " · " + money(v.value) : ""}</span></div>`; }).join("");
  // chart
  const box = $("#projChart"), W = box.clientWidth || 600, H = box.clientHeight || 300, m = { l: 46, r: 64, t: 16, b: 28 };
  const svg = d3.select(box); svg.selectAll("*").remove(); svg.attr("viewBox", `0 0 ${W} ${H}`);
  const maxY = Math.max(base, ...Object.values(SC).map(q => q.months[12].clicks)) * 1.08 || 1;
  const x = d3.scaleLinear().domain([0, 12]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, maxY]).range([H - m.b, m.t]).nice();
  const defs = svg.append("defs"); const gr = defs.append("linearGradient").attr("id", "pg").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  gr.append("stop").attr("offset", "0%").attr("stop-color", "#fbbf24").attr("stop-opacity", .35); gr.append("stop").attr("offset", "100%").attr("stop-color", "#fbbf24").attr("stop-opacity", 0);
  y.ticks(4).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1a2537"); svg.append("text").attr("x", m.l - 8).attr("y", y(t) + 4).attr("text-anchor", "end").attr("fill", "#566580").attr("font-size", 10.5).attr("font-family", "JetBrains Mono").text(short(t)); });
  [0, 3, 6, 9, 12].forEach(t => svg.append("text").attr("x", x(t)).attr("y", H - 8).attr("text-anchor", "middle").attr("fill", "#566580").attr("font-size", 10.5).attr("font-family", "JetBrains Mono").text(mlab(t)));
  const line = d3.line().x(d => x(d.m)).y(d => y(d.clicks)).curve(d3.curveMonotoneX);
  Object.entries(SC).forEach(([k, q]) => { if (k !== SCEN) svg.append("path").attr("d", line(q.months)).attr("fill", "none").attr("stroke", "#3a4a66").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4"); });
  svg.append("path").attr("d", d3.area().x(d => x(d.m)).y0(y(base)).y1(d => y(d.clicks)).curve(d3.curveMonotoneX)(s.months)).attr("fill", "url(#pg)").attr("opacity", 0).transition().duration(1200).delay(500).attr("opacity", 1);
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(base)).attr("y2", y(base)).attr("stroke", "#3ee08f").attr("stroke-width", 1.5).attr("stroke-dasharray", "2 4");
  svg.append("text").attr("x", W - m.r + 6).attr("y", y(base) + 4).attr("fill", "#3ee08f").attr("font-size", 11).attr("font-family", "JetBrains Mono").text("today");
  const p = svg.append("path").attr("d", line(s.months)).attr("fill", "none").attr("stroke", "#fbbf24").attr("stroke-width", 3).attr("stroke-linecap", "round");
  const len = p.node().getTotalLength(); p.attr("stroke-dasharray", len).attr("stroke-dashoffset", len).transition().duration(1600).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
  const end = s.months[12];
  svg.append("circle").attr("cx", x(12)).attr("cy", y(end.clicks)).attr("r", 0).attr("fill", "#fbbf24").transition().delay(1500).duration(400).attr("r", 5);
  svg.append("text").attr("x", x(12) + 8).attr("y", y(end.clicks) + 4).attr("fill", "#fbbf24").attr("font-weight", 800).attr("font-size", 13).text(short(end.clicks)).attr("opacity", 0).transition().delay(1500).attr("opacity", 1);
  // hover / touch readout
  const g = svg.append("g").style("display", "none");
  g.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#566580").attr("stroke-dasharray", "3 3");
  g.append("circle").attr("r", 5).attr("fill", "#fbbf24").attr("stroke", "#05080e").attr("stroke-width", 2);
  const lab = g.append("text").attr("fill", "#ecf2fa").attr("font-size", 12).attr("font-weight", 700);
  const move = ev => { const [mx] = d3.pointer(ev, box); const mm = Math.max(0, Math.min(12, Math.round(x.invert(mx)))); const d = s.months[mm]; g.style("display", null); g.select("line").attr("x1", x(mm)).attr("x2", x(mm)); g.select("circle").attr("cx", x(mm)).attr("cy", y(d.clicks)); lab.attr("x", x(mm) + (mm > 8 ? -8 : 8)).attr("y", y(d.clicks) - 12).attr("text-anchor", mm > 8 ? "end" : "start").text(`${mlab(mm)}: ${fmt(d.clicks)} visits${d.value ? " · " + money(d.value) : ""}`); };
  svg.on("pointermove", move).on("pointerdown", move).on("pointerleave", () => g.style("display", "none"));
  // breakdown
  $("#brkScen").textContent = "· " + s.name.toLowerCase();
  const rows = [
    s.push.n && { h: "Push striking-distance pages", s: `${s.push.n} searches you already rank for move up`, c: s.push.clicks, v: s.push.value },
    s.win.n && { h: "Win new rankings", s: `${s.win.n} untapped searches, easiest first`, c: s.win.clicks, v: s.win.value },
    s.map.n && { h: "Get into the map pack", s: `${s.map.n} live-checked searches show a map pack you're not in`, c: s.map.clicks, v: s.map.value },
    { h: "Total in 12 months", s: `on top of today's ${fmt(base)} visits/mo`, c: s.gain, v: s.gainVal },
  ];
  const rr = rows.filter(Boolean), mx = Math.max(1, ...rr.map(r => r.c));
  $("#brk").innerHTML = rr.map(r => `<div class="brow"><div class="h"><span>${r.h}</span><b>+${fmt(r.c)}</b></div><div class="s">${r.s}${r.v ? " · " + money(r.v) + "/mo click value" : ""}</div><div class="t"><i data-w="${100 * r.c / mx}"></i></div></div>`).join("");
  setTimeout(() => document.querySelectorAll("#brk .t i").forEach(i => i.style.width = Math.max(1, +i.dataset.w) + "%"), 100);
  renderCtr();
}
function renderCtr() {
  const t = +$("#tRange").value; $("#tPos").textContent = "#" + t;
  $("#ctrBars").innerHTML = CTR.slice(1).map((c, j) => `<div><span>${(c * 100).toFixed(c < .02 ? 1 : 0)}%</span><i class="${j + 1 === t ? "on" : j + 1 < t ? "" : ""}" data-h="${100 * c / CTR[1]}" style="${j + 1 <= t ? "background:" + (j + 1 === t ? "" : "#3a4a66") : ""}"></i><em>#${j + 1}</em></div>`).join("");
  requestAnimationFrame(() => document.querySelectorAll("#ctrBars i").forEach(i => i.style.height = i.dataset.h + "%"));
  let g = 0, v = 0, n = 0;
  R.items.forEach(x => { const d = x.v * x.f * (ctr(t) - ctr(x.p)); if (d > 0) { g += d; v += d * (x.c || 0); n++; } });
  $("#tOut").innerHTML = `<div><b>+${fmt(g)}</b><span>visits / month</span></div>${v ? `<div><b>${money(v)}</b><span>click value / month</span></div>` : ""}<div><b>${fmt(n)}</b><span>searches improve</span></div>`;
}
$("#tRange").addEventListener("input", renderCtr);

/* ---------- local history (key mode) + share ---------- */
function saveLocal(scan) {
  try {
    const list = JSON.parse(localStorage.getItem("ltt_hist") || "[]");
    const id = "ltt_scan_" + Date.now();
    list.unshift({ file: "local:" + id, domain: scan.domain, keyword: scan.keyword, location: scan.location.label, date: scan.date, headline: scan.headline });
    const slim = { ...scan, log: scan.log.slice(-80) };
    while (true) { try { localStorage.setItem(id, JSON.stringify(slim)); break; } catch (e) { const old = list.pop(); if (!old || old.file === "local:" + id) throw e; localStorage.removeItem(old.file.slice(6)); } }
    localStorage.setItem("ltt_hist", JSON.stringify(list.slice(0, 12)));
    list.slice(12).forEach(o => localStorage.removeItem(o.file.slice(6)));
  } catch (e) { }
}
function localHistory() { try { return JSON.parse(localStorage.getItem("ltt_hist") || "[]"); } catch (e) { return []; } }
function shareSummary() {
  const S = SCAN, Rr = R, sc = scenarios(Rr).exp;
  const text = [`${S.domain} · ${S.keyword || "search visibility"} · ${S.location.label}`,
  `Today: ~${fmt(Rr.you.clicks)} visits/mo from this market (${(Rr.you.share * 100).toFixed(1)}% of clicks).`,
  `Market: ~${fmt(Rr.market.clicks)} organic clicks/mo across ${fmt(Rr.items.length)} searches${Rr.market.value ? `, worth ${money(Rr.market.value)} at ad prices` : ""}.`,
  `12-month projection: +${fmt(sc.gain)} visits/mo${sc.gainVal ? ` (${money(sc.gainVal)}/mo)` : ""}.`,
  `Leaders: ${Rr.comps.slice(0, 3).map(c => `${c.d} ${(c.share * 100).toFixed(1)}%`).join(", ")}.`].join("\n");
  if (navigator.share) navigator.share({ title: "Search traffic left on the table", text }).catch(() => { });
  else navigator.clipboard?.writeText(text).then(() => { $("#copyBtn").textContent = "Copied ✓"; setTimeout(() => $("#copyBtn").textContent = "Share", 1600); });
}

function renderLadder() {
  const Rr = R, sc = scenarios(Rr).exp, lead = Rr.comps[0];
  const leadClicks = lead ? (Rr.basis.local ? lead.clicks / Math.max(.01, Rr.basis.pct) : lead.clicks) : 0;
  const potential = Rr.you.clicks + Rr.table.clicks;
  const rows = [
    { l: "You today", s: SCAN.domain, v: Rr.you.clicks, val: Rr.you.value, c: "linear-gradient(90deg,#3ee08f,#7cf29c)" },
    { l: "You in 12 months", s: "expected scenario", v: sc.months[12].clicks, val: sc.months[12].value, c: "linear-gradient(90deg,#d99b12,#fbbf24)" },
    lead && { l: "The market leader", s: lead.d, v: leadClicks, val: lead.value / (Rr.basis.local ? Math.max(.01, Rr.basis.pct) : 1), c: "linear-gradient(90deg,#e0566a,#ff8a96)" },
    { l: "Top 3 on every search", s: "your full potential", v: potential, val: Rr.you.value + Rr.table.value, c: "repeating-linear-gradient(135deg,#fbbf24 0 8px,#d99b12 8px 16px)" },
  ].filter(Boolean);
  const max = Math.max(...rows.map(r => r.v), 1);
  $("#ladder").innerHTML = rows.map(r => `<div class="lrow"><div class="lb">${r.l}<span>${esc(r.s)}</span></div><div class="tr2"><i style="background:${r.c}" data-w="${Math.max(0.6, 100 * r.v / max)}"></i></div><div class="vv">${fmt(r.v)}<span>${r.val ? money(r.val) + "/mo" : "visits/mo"}</span></div></div>`).join("");
  setTimeout(() => document.querySelectorAll("#ladder i").forEach((i, j) => setTimeout(() => i.style.width = i.dataset.w + "%", j * 250)), 200);
}
