const $ = (id) => document.getElementById(id);

function tablePlayers(data) {
  const raw = data.players && data.players.length
    ? data.players
    : [data.you, data.opponent].filter(Boolean);
  const seen = new Set();
  const list = [];
  for (const p of raw) {
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    list.push(p);
  }
  return list;
}

function teamColor(p) {
  return p && p.color ? p.color : "blue";
}

function accountName(p) {
  if (p && p.name && p.name !== "You" && !/^Player \d+$/.test(p.name)) return p.name;
  return "";
}

function displayName(p, fallback) {
  if (p && p.corporation && p.corporation !== "Unknown") return p.corporation;
  const name = accountName(p);
  if (name) return name;
  return (p && p.name && p.name !== "You" && p.name) || fallback || "Player";
}

function boardTitle(p) {
  return displayName(p, "Player");
}

function boardSubtitle(p) {
  if (!p) return "";
  const name = accountName(p);
  if (name && name !== boardTitle(p)) return name;
  return "";
}

function resMark(rawKey) {
  const key = resKey(rawKey);
  return `<span class="res-sym res-${key}"><span class="res-box">${resIcon(key)}</span></span>`;
}

function renderCubes(p) {
  const rows = [
    ["M€", "mc", p.megaCredits, p.megaCreditProd],
    ["Steel", "steel", p.steel, p.steelProd],
    ["Titanium", "ti", p.titanium, p.titaniumProd],
    ["Plant", "plant", p.plants, p.plantProd],
    ["Energy", "energy", p.energy, p.energyProd],
    ["Heat", "heat", p.heat, p.heatProd],
  ];
  return `<div class="board-cubes"><table class="cubes">
    <tr><th>Resource</th><th class="num">Prod</th><th class="num">Qty</th></tr>
    ${rows.map(([n, key, q, pr]) => `<tr><td><span class="res-name">${resMark(key)}<span>${n}</span></span></td><td class="num prod">${pr ?? 0}</td><td class="num">${q ?? 0}</td></tr>`).join("")}
  </table></div>`;
}

function renderTrLine(p) {
  return `<p class="board-tr">TR ${p.tr ?? 20} · Cities on Mars ${p.citiesOnMars ?? 0} · Greeneries ${p.greeneries ?? 0} · Oceans ${p.oceans ?? 0}</p>`;
}

function renderTags(tags) {
  const cells = tags
    ? Object.entries(tags).map(([k, v]) =>
      `<span class="tag-count${v ? "" : " zero"}" title="${escapeHtml(k)} ${v}">${tagIcon(k)}<span class="n">${v}</span></span>`)
    : [];
  return `<div class="tags">${cells.join("")}</div>`;
}

function extra(text) {
  return (text || "").replace(/\n/g, " · ").replace(/\s+/g, " ").trim();
}

function corpRuleText(raw) {
  if (!raw) return "";
  let text = String(raw).replace(/\s+/g, " ").trim();
  text = text.replace(/\s*-{2,}\s*Ed\. note:.*$/i, "").trim();
  const bits = [...text.matchAll(/\((?:Effect|Action):[^)]+\)/gi)]
    .map((m) => m[0].slice(1, -1).trim())
    .filter(Boolean);
  if (bits.length) return bits.join(" ");
  return extra(text);
}

function tokenChip(c) {
  if (!c.tokenType && !(c.tokens > 0)) return "";
  const kind = c.tokenType || "token";
  const n = c.tokens ?? 0;
  const label = n === 1 ? kind : kind + "s";
  return `<span class="token token-${kind}${n ? "" : " zero"}" title="${n} ${label} on this card">${n}</span>`;
}

/** A player's card section; its header opens or closes that section on every player's board at once. */
function renderCards(title, cards, cls, generation) {
  if (!cards || !cards.length) return "";
  const key = cls;
  const open = !collapsedCardSections.has(key);
  // Blue cards: actions first (what can I still do this generation?), effects after; play order within each.
  const shown = cls === "blue" ? [...cards].sort((a, b) => hasAction(b) - hasAction(a)) : cards;
  return `<h3 class="section-title cards-title">
      <button type="button" class="cards-toggle" data-cards="${key}" aria-expanded="${open}">
        <span>${title}</span><span class="cards-count">${cards.length}</span>${chevron()}
      </button>
    </h3>
    <div class="cards"${open ? "" : " hidden"}>${shown.map((c) => {
      const used = hasAction(c) && generation != null && c.actionUsedGen === generation;
      return `
      <div class="card ${cls}${used ? " used" : ""}"${used ? ` title="Action already used this generation"` : ""}>
        <div class="card-head">
          <h3>${c.name}</h3>
          <span class="card-head-tags">${(c.tags || []).map(tagIcon).join("")}</span>
          ${used ? `<span class="card-used">Used</span>` : ""}
          ${tokenChip(c)}
        </div>
        ${cardGainsLine(c)}
        ${c.extra ? `<p>${extra(c.extra)}</p>` : ""}
      </div>`;
    }).join("")}</div>`;
}

/** Blue cards with an activated ability; the rest are ongoing effects. */
function hasAction(card) {
  return /\bAction\s*:/i.test(card.extra || "");
}

/** Production, resources, tiles, and printed VP; for many cards this is everything they do. */
function cardGainsLine(card) {
  const { gains, places } = cardEffects(card);
  const bits = [...gains];
  if (card.printedVp) bits.push(resSym("vp", card.printedVp, false));
  if (!bits.length && !places.length) return "";
  return `<p class="card-gains">${bits.join("")}${places.length ? `<span class="card-places">${places.join(" · ")}</span>` : ""}</p>`;
}

function helpMark() {
  return `<span class="corp-help" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">?</text></svg></span>`;
}

function chevron() {
  return `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6 1.4 1.4-6 6-6-6z"/></svg></span>`;
}

const GLOSSARY = {
  terraformer: "Requires 35 TR",
  mayor: "Requires 3 city tiles",
  gardener: "Requires 3 greenery tiles",
  builder: "Requires 8 building tags",
  planner: "Requires 16 cards in hand",
  diversifier: "Requires 8 different tags",
  tactician: "Requires 5 cards with requirements",
  polarexplorer: "Requires 3 tiles on the two southernmost rows",
  energizer: "Requires 6 energy production",
  rimsettler: "Requires 3 Jovian tags",
  generalist: "Requires at least 1 production in each of the 6 types",
  specialist: "Requires 10 production in a single type",
  ecologist: "Requires 4 plant, microbe, or animal tags",
  tycoon: "Requires 15 green or blue project cards",
  legend: "Requires 5 events played",
  landlord: "Most tiles in play at the end of the game.",
  banker: "Highest M€ production at the end of the game.",
  scientist: "Most science tags at the end of the game.",
  thermalist: "Most heat at the end of the game.",
  miner: "Most steel and titanium at the end of the game.",
  cultivator: "Most greenery tiles at the end of the game.",
  magnate: "Most green cards at the end of the game.",
  spacebaron: "Most space tags at the end of the game.",
  excentric: "Most resources on cards at the end of the game.",
  contractor: "Most building tags at the end of the game.",
  celebrity: "Most cards costing 20 M€ or more at the end of the game.",
  industrialist: "Most steel and energy resources at the end of the game.",
  desertsettler: "Most tiles on the four southernmost rows at the end of the game.",
  estatedealer: "Most tiles adjacent to ocean at the end of the game.",
  benefactor: "Highest TR at the end of the game.",
  venuphile: "Most Venus tags at the end of the game.",
  venusphile: "Most Venus tags at the end of the game.",
};

function glossaryKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z]/g, "");
}

function glossaryText(name) {
  return GLOSSARY[glossaryKey(name)] || "";
}

function tipWrap(name, inner, extraClass, extraHtml, extraPlain) {
  const base = glossaryText(name).replace(/\.$/, "");
  const cls = ["tip", extraClass].filter(Boolean).join(" ");
  if (!base && !extraHtml) {
    return `<span class="${cls}">${inner}</span>`;
  }
  const plain = extraPlain ? (base ? base + "\n" + extraPlain : extraPlain) : base;
  const body = (base ? `<span class="tip-def">${escapeHtml(base)}</span>` : "") + (extraHtml || "");
  return `<span class="${cls}" tabindex="0" data-tip-key="${escapeHtml(glossaryKey(name))}" title="${escapeHtml(plain)}">${inner}<span class="tip-pop" role="tooltip">${body}</span></span>`;
}

let openTipKey = null;
let tipUiBound = false;

function applyOpenTip() {
  document.querySelectorAll(".tip").forEach((el) => {
    el.classList.toggle("open", !!openTipKey && el.dataset.tipKey === openTipKey);
  });
}

function bindTipUi() {
  if (tipUiBound) return;
  tipUiBound = true;
  document.addEventListener("click", (ev) => {
    const tip = ev.target.closest(".tip");
    if (tip && tip.dataset.tipKey) {
      openTipKey = openTipKey === tip.dataset.tipKey ? null : tip.dataset.tipKey;
      applyOpenTip();
      ev.stopPropagation();
      return;
    }
    if (openTipKey) {
      openTipKey = null;
      applyOpenTip();
    }
  });
}

function renderPlayer(p, generation) {
  const color = teamColor(p);
  const you = !!p.human;
  const subtitle = boardSubtitle(p);
  const title = escapeHtml(boardTitle(p));
  const rules = corpRuleText(p.corpRules);
  const rulesOpen = corpRulesOpen;
  const collapsed = collapsedBoardIds.has(p.id);
  const info = rules
    ? `<button type="button" class="corp-info" data-corp="${p.id}" aria-expanded="${rulesOpen ? "true" : "false"}" aria-controls="corp-rules-${p.id}" aria-label="${title} corporation rules">
        <span class="corp-name">${title}</span>${helpMark()}
      </button>`
    : `<h2 class="corp-name">${title}</h2>`;
  const rulesBlock = rules
    ? `<p class="corp-rules" id="corp-rules-${p.id}"${rulesOpen && !collapsed ? "" : " hidden"}>${escapeHtml(rules)}</p>`
    : "";
  return `<article class="board color-${color}${you ? " you" : ""}${collapsed ? " collapsed" : ""}">
    <div class="board-head">
      ${info}
      <button type="button" class="board-toggle" data-corp="${p.id}" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="board-body-${p.id}" aria-label="${collapsed ? "Expand" : "Collapse"} ${title}">
        ${chevron()}
      </button>
    </div>
    <div class="board-body" id="board-body-${p.id}"${collapsed ? " hidden" : ""}>
      <div class="board-intro">
        ${subtitle ? `<p class="corp">${escapeHtml(subtitle)}</p>` : ""}
        ${rulesBlock}
      </div>
      ${renderCubes(p)}
      ${renderTrLine(p)}
      ${renderTags(p.tags)}
      <p class="board-awards"></p>
      <div class="board-blues">${renderCards("Blue cards", p.blueCards, "blue", generation)}</div>
      <div class="board-rest">
        ${renderCards("Automated", p.greenCards, "green", generation)}
        ${renderCards("Events", p.events, "red", generation)}
      </div>
    </div>
  </article>`;
}

function renderMilestones(data) {
  const panel = $("milestone-panel");
  const ms = data.milestones || {};
  const funded = data.fundedAwards || (data.score && data.score.fundedAwards) || [];
  if (!panel || (!data.gameId && !(ms.claimed || []).length && !funded.length)) {
    if (panel) panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const claimed = ms.claimed || [];
  const grab = ms.grab || [];
  const close = ms.close || [];
  const left = ms.left ?? Math.max(0, 3 - claimed.length);
  $("ms-claimed-kicker").textContent = "Claimed";
  $("ms-left").textContent = left === 0 ? "All 3 taken" : `${left} still open`;
  setHtml($("ms-claimed"), claimed.length
    ? claimed.map((c) => tipWrap(c.name,
      `<span class="name">${escapeHtml(c.name)}</span>` +
      `<span class="who">${escapeHtml(c.playerName || "")}</span>`,
      `ms-chip color-${escapeHtml(c.color || "blue")}`)).join("")
    : `<p class="ms-empty">None claimed yet</p>`);

  const awardBlock = $("award-block");
  awardBlock.hidden = funded.length === 0;
  setHtml($("ms-awards"), funded.map(awardChip).join(""));

  const grabBox = $("ms-grab");
  const closeBox = $("ms-close");
  grabBox.hidden = grab.length === 0;
  closeBox.hidden = close.length === 0;
  setHtml($("ms-grab-list"), grab.map((row) => milestoneItem(row, true)).join(""));
  setHtml($("ms-close-list"), close.map((row) => milestoneItem(row, false)).join(""));
  applyOpenTip();
}

function awardChip(row) {
  const leaders = row.leaders || [];
  const tied = !!row.tied || leaders.length > 1;
  const color = !tied && (row.color || (leaders[0] && leaders[0].color));
  const dots = tied
    ? `<span class="ms-dots">${leaders.map((p) =>
      `<span class="ms-dot color-${escapeHtml(p.color || "blue")}" title="${escapeHtml(p.name || "")}"></span>`
    ).join("")}</span>`
    : "";
  const cls = ["ms-chip", color ? `color-${color}` : "", tied ? "tied" : ""].filter(Boolean).join(" ");
  return tipWrap(row.name, `<span class="name">${escapeHtml(row.name)}</span>${dots}`, cls, awardLeadHtml(row), awardLeadText(row));
}

function awardLeadText(row) {
  const standings = row.standings || [];
  if (!standings.length) {
    return "";
  }
  return standings.map((p) => `${p.name} ${p.value ?? 0}`).join("  ");
}

function awardLeadHtml(row) {
  const standings = row.standings || [];
  if (!standings.length) {
    return "";
  }
  return `<span class="tip-standings">${standings.map((p) =>
    `<span class="tip-who color-${escapeHtml(p.color || "blue")}"><span class="nm">${escapeHtml(p.name)}</span> ${p.value ?? 0}</span>`
  ).join("")}</span>`;
}

function milestoneItem(row, urgent) {
  const pay = urgent
    ? (row.canPay
      ? `<span class="ms-pay">${row.cost ?? 8} M€</span>`
      : `<span class="ms-pay short">need ${row.cost ?? 8} M€</span>`)
    : "";
  return tipWrap(row.name,
    `<span class="name">${escapeHtml(row.name)}</span>` +
    `<span class="detail">${escapeHtml(row.detail || "")}</span>${pay}`,
    "ms-item");
}

function setLiveStatus(mode) {
  const el = $("live");
  el.classList.toggle("on", mode === "live");
  el.classList.toggle("bad", mode === "disconnected");
  el.textContent = mode === "live" ? "live" : mode === "disconnected" ? "disconnected" : "idle";
}

function placingLabel(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/[_-]+/g, " ").trim();
  const lower = s.toLowerCase();
  if (lower.includes("ocean") || lower === "aquifer") return "Ocean";
  if (lower.includes("greenery") || lower.includes("forest")) return "Greenery";
  if (lower.includes("city") || lower === "capital") return "City";
  if (lower.includes("generic") || lower.includes("special")) return "Special tile";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

const PLANT_LEAF = '<g transform="translate(12 12) rotate(45) scale(.86) translate(-12 -14.1)" fill="#185102"><path d="M12 1.6 20 13.4H4z"/><circle cx="8.1" cy="15.5" r="4.5"/><circle cx="15.9" cy="15.5" r="4.5"/><path d="M11.2 18.1 9.6 26.6h4.8L12.8 18.1z"/></g>';
const TAG_GLYPH = {
  building: '<path fill="#c07340" d="M4 20V9l8-5 8 5v11h-6v-6H10v6z"/>',
  space: '<g fill="#f2d020"><path d="M22.2 12 14.4 10.85 14.4 13.15z"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(45 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(90 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(135 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(180 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(225 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(270 12 12)"/><path d="M22.2 12 14.4 10.85 14.4 13.15z" transform="rotate(315 12 12)"/><circle cx="12" cy="12" r="2.15"/></g>',
  science: '<g fill="none" stroke="#967b65" stroke-width="1.45"><ellipse cx="12" cy="12" rx="8.4" ry="3.15"/><ellipse cx="12" cy="12" rx="8.4" ry="3.15" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.4" ry="3.15" transform="rotate(-60 12 12)"/></g><circle cx="12" cy="12" r="2.15" fill="#967b65"/>',
  power: '<path fill="#a855f7" d="M13 2 4 14h7l-1 8 10-14h-7z"/>',
  earth: '<g style="clip-path:circle(34.4% at 50% 50%)"><rect width="24" height="24" fill="none"/><g transform="translate(12 12) scale(1.28) translate(-12 -12)" fill="#00d0a0"><path d="M2.3 9.1 4 9.1 7.4 10.7 9.1 12.4 8.2 14.1 9.1 16.6 10.7 19.1 9.9 20 6.5 19.1 4 16.6 2.3 14.1 2.3 10.7Z"/><path d="M11.6 4 13.3 4 14.9 4.9 16.6 6.5 17.5 8.2 18.3 9.9 18.3 11.6 18.3 13.3 17.5 14.9 16.6 16.6 14.9 18.3 15.8 16.6 15.8 14.9 14.1 13.3 13.3 11.6 11.6 10.7 9.9 10.7 10.7 9.1 12.4 9.1 13.3 7.4 13.3 6.5 14.1 4.9 12.4 4Z"/></g></g><circle cx="12" cy="12" r="8.8" fill="none" stroke="#00d0a0" stroke-width="1.15"/>',
  jovian: '<g transform="rotate(-8 12 12)"><circle cx="12" cy="12" r="10.4" fill="#c09000"/><rect x="-2" y="6.8" width="28" height="1.7" fill="#080604"/><rect x="-2" y="15.2" width="28" height="3.4" fill="#080604"/></g>',
  plant: '<g transform="translate(12 12) rotate(45) scale(.86) translate(-12 -14.1)" fill="#8ced05"><path d="M12 1.6 20 13.4H4z"/><circle cx="8.1" cy="15.5" r="4.5"/><circle cx="15.9" cy="15.5" r="4.5"/><path d="M11.2 18.1 9.6 26.6h4.8L12.8 18.1z"/></g>',
  microbe: '<circle cx="9.6" cy="12" r="4" fill="#98c828"/><path d="M13.6 6.2 18.2 10.2" fill="none" stroke="#98c828" stroke-width="2.5" stroke-linecap="round"/><path d="M17.5 13.5 11.4 18.8" fill="none" stroke="#98c828" stroke-width="2.6" stroke-linecap="round"/>',
  animal: '<g fill="#00e040"><circle cx="6.6" cy="6.8" r="1.85"/><circle cx="10.2" cy="4.7" r="1.85"/><circle cx="14.2" cy="4.7" r="1.85"/><circle cx="17.6" cy="7" r="1.75"/><rect x="6.3" y="11.6" width="11.6" height="6.4" rx="3.2"/></g>',
  city: '<g fill="#b2d8d6"><path d="M1.2 10.8A10.8 10.6 0 0 0 22.8 10.8Z"/><rect x="4.8" y="8" width="2.6" height="3.2"/><rect x="10.2" y="2" width="3.6" height="9.2"/><rect x="16.2" y="5.2" width="2.8" height="6"/></g>',
  event: '<path fill="#f2d020" d="M8 3h8v8.5h4L12 22 4 11.5h4z"/>',
  venus: '<circle cx="12" cy="10" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 15v6M9 19h6"/>',
  wild: '<path fill="currentColor" d="M12 3 14 9h6l-5 3.6L17 19l-5-3.4L7 19l2-6.4L4 9h6z"/>',
  mars: '<circle cx="10" cy="13" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M14 9 20 3M15 3h5v5"/>',
  moon: '<path fill="currentColor" d="M14 4a8 8 0 1 0 6 12 7 7 0 0 1-6-12z"/>',
};

function tagIcon(tag) {
  const key = String(tag || "").toLowerCase();
  const glyph = TAG_GLYPH[key];
  const cls = TAG_GLYPH[key] ? key : "unknown";
  const inner = glyph || `<text x="12" y="16" text-anchor="middle" font-size="11" fill="currentColor">${escapeHtml(key.slice(0, 1).toUpperCase())}</text>`;
  return `<span class="sym tag-sym tag-${cls}" title="${escapeHtml(key)}"><svg viewBox="0 0 24 24">${inner}</svg></span>`;
}

function costSym(n) {
  return `<span class="sym cost-sym" title="Cost ${n} M€">${n}</span>`;
}

function resKey(raw) {
  const k = String(raw || "").toLowerCase();
  if (k === "titanium" || k === "ti") return "ti";
  if (k === "megacredit" || k === "mc" || k === "mé" || k === "m€") return "mc";
  return k;
}

function resLabel(key) {
  return ({
    mc: "M€",
    steel: "steel",
    ti: "titanium",
    plant: "plant",
    energy: "energy",
    heat: "heat",
    tr: "TR",
    o2: "O₂",
    temp: "temp",
    ocean: "ocean",
    card: "card",
    vp: "VP",
  })[key] || key;
}

const TI_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2 14.7 8.6h6.8l-5.5 4.1 2.1 6.7L12 15.8 5.9 19.4l2.1-6.7L2.5 8.6h6.8z"/></svg>';
const RES_ICONS = {
  mc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M7.2 16V8h1.5l3.3 5.2L15.3 8H16.8v8h-1.6v-5.1L12 14.2l-3.2-4.3V16z"/></svg>',
  steel: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(12 12) rotate(-30) translate(-9 -12.3)"><path fill="currentColor" d="M2.2 3.6h13.6v4.8H12v12.6H6.4V8.4H2.2z"/></g></svg>',
  ti: TI_STAR,
  plant: '<svg viewBox="0 0 24 24" aria-hidden="true">' + PLANT_LEAF + '</svg>',
  energy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M13 2 4 14h7l-1 8 10-14h-7z"/></svg>',
  heat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#ffe08a" stroke-width="1.7" stroke-linecap="round" d="M5 2.5c2.6 2.2 2.6 3.8 0 6s-2.6 3.8 0 6 2.6 3.8 0 6M12 2.5c2.6 2.2 2.6 3.8 0 6s-2.6 3.8 0 6 2.6 3.8 0 6M19 2.5c2.6 2.2 2.6 3.8 0 6s-2.6 3.8 0 6 2.6 3.8 0 6"/></svg>',
};

function resIcon(key) {
  return RES_ICONS[key] || "";
}

function resSym(rawKey, value, prod) {
  const key = resKey(rawKey);
  const n = Number(value);
  const shown = Number.isFinite(n) ? (n > 0 ? "+" + n : String(n)) : String(value);
  const mark = resIcon(key);
  return `<span class="res-sym res-${key}${prod ? " prod" : ""}" title="${prod ? "Production " : ""}${shown} ${resLabel(key)}"><span class="res-box">${mark}</span>${shown}</span>`;
}

function benefitHtml(play) {
  const bits = [];
  for (const [k, v] of Object.entries(play.resources || {})) {
    if (v != null && v !== 0) bits.push(resSym(k, v, false));
  }
  for (const [k, v] of Object.entries(play.production || {})) {
    if (v != null && v !== 0) bits.push(resSym(k, v, true));
  }
  if (play.vp) bits.push(resSym("vp", play.vp, false));
  if (bits.length) return bits.join("");
  if (play.effect) {
    const text = play.effect.length > 110 ? play.effect.slice(0, 107) + "…" : play.effect;
    return `<span class="banner-benefit-text">${escapeHtml(text)}</span>`;
  }
  return "";
}

function applyBannerOpen() {
  $("banner-details").hidden = !bannerOpen;
  $("banner-toggle").setAttribute("aria-expanded", bannerOpen ? "true" : "false");
  const benefit = $("banner-benefit");
  const has = benefit.innerHTML.trim().length > 0;
  benefit.hidden = bannerOpen || !has;
}

function bindBannerUi() {
  if (bannerUiBound) return;
  bannerUiBound = true;
  $("banner-toggle").addEventListener("click", (ev) => {
    if ($("banner-toggle").disabled) return;
    if (ev.target.closest(".tip")) return;
    bannerOpen = !bannerOpen;
    applyBannerOpen();
  });
  $("game-log").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-log-filter]");
    if (!btn) return;
    logFilter = btn.dataset.logFilter === "" ? null : Number(btn.dataset.logFilter);
    if (lastLogData) renderGameLog(lastLogData);
  });
}

function formatReq(req) {
  if (!req || typeof req !== "object") return "";
  const parts = [];
  if (req.temp != null) parts.push(`${req.temp} °C`);
  if (req.o2 != null) parts.push(`${req.o2}% oxygen`);
  if (req.ocean != null) parts.push(`${req.ocean} ocean${Number(req.ocean) === 1 ? "" : "s"}`);
  if (req.venus != null) parts.push(`${req.venus}% Venus`);
  if (req.tr != null) parts.push(`${req.tr} TR`);
  for (const [k, v] of Object.entries(req)) {
    if (["temp", "o2", "ocean", "venus", "tr"].includes(k) || v == null || v === "") continue;
    parts.push(`${k} ${v}`);
  }
  return parts.length ? "Requires " + parts.join(", ") : "";
}

function drawnGainsText(c) {
  const bits = [];
  for (const [k, v] of Object.entries(c.production || {})) {
    if (v != null && v !== 0) bits.push(`${Number(v) > 0 ? "+" : ""}${v} ${resLabel(resKey(k))} prod`);
  }
  for (const [k, v] of Object.entries(c.resources || {})) {
    if (v != null && v !== 0) bits.push(`${Number(v) > 0 ? "+" : ""}${v} ${resLabel(resKey(k))}`);
  }
  if (c.vp != null) bits.push(`${c.vp} VP`);
  return bits.join(" · ");
}

function drawnTipText(c) {
  const extraText = (c.extra || "").replace(/\s+$/g, "").trim();
  if (extraText) return extraText;
  return [formatReq(c.req), drawnGainsText(c)].filter(Boolean).join("\n");
}

function renderDrawn(play) {
  const drawn = play && play.drawn ? play.drawn : [];
  if (!drawn.length) return "";
  return `<span class="banner-drawn"><span class="drawn-label">Drew</span>${drawn.map((c) => {
    const inner = `<span class="drawn-name">${escapeHtml(c.name)}</span>
      <span class="drawn-meta">${c.cost != null ? costSym(c.cost) : ""}${(c.tags || []).map(tagIcon).join("")}</span>`;
    const cls = `drawn-card ${escapeHtml((c.color || "").toLowerCase())}`;
    const text = drawnTipText(c);
    if (!text) {
      return `<span class="${cls}">${inner}</span>`;
    }
    return tipWrap("drawn-" + c.name, inner, cls, `<span class="tip-def">${escapeHtml(text)}</span>`, text);
  }).join("")}</span>`;
}

function renderBanner(data) {
  const play = data.activePlay;
  const banner = $("banner");
  banner.classList.remove("yours", "color-blue", "color-green", "color-purple", "color-yellow", "color-red", "color-black");
  const drawnKey = play && play.drawn ? play.drawn.map((c) => c.name).join(",") : "";
  const key = play && play.cardName ? `${play.playerId}:${play.cardName}:${drawnKey}` : "";
  if (key !== bannerKey) {
    bannerKey = key;
    bannerOpen = !!key;
  }

  const placing = placingLabel(play && play.placing);
  const placingEl = $("banner-placing");
  if (placing) {
    placingEl.hidden = false;
    placingEl.textContent = "Placing " + placing;
  } else {
    placingEl.hidden = true;
    placingEl.textContent = "";
  }

  if (play && play.cardName) {
    const playColor = play.playerColor || (play.yours ? teamColor(data.you) : teamColor((data.opponents || [])[0]));
    banner.classList.add("color-" + (playColor || "blue"));
    if (play.yours) banner.classList.add("yours");
    $("banner-toggle").disabled = false;
    $("banner-chevron").hidden = false;
    const who = (play.yours && accountName(data.you)) || play.playerLabel;
    $("banner-kicker").textContent = `${who}${play.colorLabel ? " · " + play.colorLabel : ""}`;
    setHtml($("banner-line"), `<span class="banner-name">${escapeHtml(play.cardName)}</span>${
      play.cost != null ? costSym(play.cost) : ""
    }${(play.tags || []).map(tagIcon).join("")}${renderDrawn(play)}`);
    setHtml($("banner-benefit"), benefitHtml(play));
    $("banner-effect").textContent = play.effect || "";
    setHtml($("banner-tips"), (play.remember || []).map((t) => `<li>${escapeHtml(t)}</li>`).join(""));
    $("game-log").hidden = true;
  } else {
    // Between plays the banner opens onto the game log instead.
    const log = data.log || [];
    $("banner-toggle").disabled = log.length === 0;
    $("banner-chevron").hidden = log.length === 0;
    $("banner-kicker").textContent = "No card in flight";
    setHtml($("banner-line"), log.length
      ? `<span class="banner-log-summary">Game log · ${log.length} move${log.length === 1 ? "" : "s"}</span>`
      : "");
    setHtml($("banner-benefit"), "");
    $("banner-effect").textContent = "";
    setHtml($("banner-tips"), "");
    $("game-log").hidden = log.length === 0;
    lastLogData = data;
    renderGameLog(data);
  }
  applyBannerOpen();
}

let logFilter = null;
let lastLogData = null;

function prettyName(name) {
  return String(name).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function logWhat(e) {
  switch (e.kind) {
    case "card":
      return `played <span class="log-card ${escapeHtml(e.color)}"></span>${cardRef(e.name)}`;
    case "action":
      return `used ${cardRef(e.name)}`;
    case "corp-action":
      return `used ${escapeHtml(e.name)}`;
    case "project":
      return `standard project: ${escapeHtml(prettyName(e.name))}`;
    case "convert":
      return /heat/i.test(e.name) ? "converted heat into temperature" : "converted plants into a greenery";
    case "milestone":
      return `claimed <strong>${escapeHtml(e.name)}</strong>`;
    case "award":
      return `funded <strong>${escapeHtml(e.name)}</strong>`;
    default:
      return escapeHtml(e.name);
  }
}

/** Cards this move drew (yours only; opponents' draws would reveal their hand). */
function logDrew(e) {
  const drawn = e.drawn || [];
  if (!drawn.length) return "";
  return ` <span class="log-drew">· drew ${drawn.map((c) =>
    `<span class="log-drawn-card">${cardPopover(c, c.name)}</span>`).join(", ")}</span>`;
}

/** Every move so far, newest first, grouped by generation; filterable to one player. */
function renderGameLog(data) {
  const players = tablePlayers(data);
  const byId = new Map(players.map((p) => [p.id, p]));
  indexChartCards(players);
  beginCardRefs("logcard");
  const log = (data.log || []).filter((e) => logFilter == null || e.playerId === logFilter);
  const filters = [`<button type="button" class="log-filter${logFilter == null ? " on" : ""}" data-log-filter="">All</button>`]
    .concat(players.map((p) =>
      `<button type="button" class="log-filter color-${teamColor(p)}${logFilter === p.id ? " on" : ""}" data-log-filter="${p.id}">${escapeHtml(displayName(p, "P" + p.id))}</button>`));
  const groups = [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!groups.length || groups[groups.length - 1].gen !== e.generation) groups.push({ gen: e.generation, rows: [] });
    const p = byId.get(e.playerId);
    groups[groups.length - 1].rows.push(`<li class="log-entry color-${p ? teamColor(p) : "blue"}">
        <span class="log-who">${escapeHtml(p ? displayName(p, "P" + p.id) : "P" + e.playerId)}</span> ${logWhat(e)}${logDrew(e)}
      </li>`);
  }
  setHtml($("game-log"), `<div class="log-filters">${filters.join("")}</div>`
    + (groups.length
      ? groups.map((g) => `<h4 class="log-gen">Generation ${g.gen}</h4><ol class="log-list">${g.rows.join("")}</ol>`).join("")
      : `<p class="log-empty">No moves yet.</p>`));
}

function render(data) {
  if (data.gameId !== lastGameId) {
    lastGameId = data.gameId || "";
    corpRulesOpen = false;
    collapsedBoardIds = new Set();
    collapsedCardSections = new Set();
    logFilter = null;
    selectedGen = null;
    chartsOpen = false;
    cardsOpen = false;
  }
  $("meta").textContent = `Gen ${data.generation ?? "?"} · ${data.phase || ""} · ${data.board || ""} · ${data.gameId ? "Game " + data.gameId : "no game yet"}`;
  const update = $("update");
  if (data.updateAvailable) {
    update.hidden = false;
    update.textContent = "Update " + data.updateAvailable + " available";
  } else {
    update.hidden = true;
    update.textContent = "";
  }
  setLiveStatus(data.live ? "live" : "idle");
  if (data.url) {
    $("qr-link").href = data.url;
    $("qr-link").title = data.url;
    $("qr-url").textContent = data.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  renderPhoneAccess(data);

  renderBanner(data);
  renderMilestones(data);

  const players = tablePlayers(data);
  const boards = $("boards");
  boards.className = "boards players-" + Math.max(1, Math.min(5, players.length));
  setHtml(boards, players.map((p) => renderPlayer(p, data.generation)).join(""));
  renderScore(data, players);
  alignBoardSections();
  applyOpenTip();
}

/** Only this PC can raise the Windows admin prompt; a phone that got here doesn't need the button. */
function onThisPc() {
  return ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
}

function renderPhoneAccess(data) {
  const blocked = data.firewallOpen === false;
  $("qr-link").classList.toggle("blocked", blocked);
  $("phone-blocked").hidden = !blocked;
  $("phone-fix").hidden = !onThisPc();
}

function bindPhoneAccessUi() {
  const btn = $("phone-fix");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Answer the Windows prompt…";
    let open = false;
    try {
      const res = await fetch("/api/firewall/fix", { method: "POST" });
      open = res.ok && (await res.json()).open === true;
    } catch {
      open = false;
    }
    btn.disabled = false;
    btn.textContent = open ? "Allow phones" : "Still blocked — try again";
    lastStateText = "";
    tick();
  });
}

function scoreOf(data, p) {
  const byId = (data.score && data.score.byId) || {};
  return byId[p.id] || byId[String(p.id)] || (p.human ? data.score?.you : {}) || {};
}

function creditsOf(p, b) {
  return b.mc ?? p.megaCredits ?? 0;
}

function renderScore(data, players) {
  const box = $("scoreboard");
  const score = data.score;
  if (!score || !players.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  lastScoreData = data;
  lastScorePlayers = players;
  const ended = /endgame/i.test(data.phase || "");
  $("score-kicker").textContent = ended ? "Total VP" : "If the game ended now";
  const breakdowns = players
    .map((p) => ({ p, b: scoreOf(data, p) }))
    .sort((a, c) => (c.b.total ?? 0) - (a.b.total ?? 0)
      || creditsOf(c.p, c.b) - creditsOf(a.p, a.b)
      || a.p.id - c.p.id);
  const topVp = breakdowns[0]?.b.total ?? 0;
  const vpCounts = new Map();
  for (const { b } of breakdowns) vpCounts.set(b.total ?? 0, (vpCounts.get(b.total ?? 0) || 0) + 1);
  const isTied = (b) => vpCounts.get(b.total ?? 0) > 1;
  const winnerId = breakdowns[0]?.p.id;
  setHtml($("score-line"), breakdowns.map(({ p, b }, i) => {
    const name = displayName(p, "P" + p.id);
    const ahead = p.id === winnerId && topVp > 0;
    const sep = i === 0 ? "" : `<span class="score-vs">—</span>`;
    const credits = creditsOf(p, b);
    const mc = isTied(b) ? `<span class="sym cost-sym" title="${credits} M€ — most M€ wins a VP tie">${credits}</span>` : "";
    return `${sep}<span class="score-chip color-${teamColor(p)}${ahead ? " ahead" : ""}"><span class="name">${name}</span> <strong>${b.total ?? 0}</strong>${mc}</span>`;
  }).join("") + `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6 1.4 1.4-6 6-6-6z"/></svg></span>`);

  setHtml($("score-head"), `<tr><th></th>${breakdowns.map(({ p }) =>
    `<th class="team color-${teamColor(p)}">${displayName(p, "P" + p.id)}</th>`
  ).join("")}</tr>`);

  const history = score.history || [];
  const showCharts = (data.generation ?? 0) >= 3 || ended;
  const rows = [
    ["TR", (b) => b.tr, false],
    ["Milestones", (b) => b.milestones, false],
    ["Awards", (b) => b.awards, false],
    ["Greeneries", (b) => b.greeneries, false],
    ["Cities", (b) => b.cities, false],
    ["Cards + tokens", (b) => b.cards, true],
  ];
  setHtml($("score-lines"), rows.map(([n, pick, drill]) =>
    `<tr${drill ? ` class="clickable${cardsOpen ? " open" : ""}" data-drill="cards" title="Click for card VP"` : ""}><td>${n}</td>${
      breakdowns.map(({ b }) => `<td>${pick(b) ?? 0}</td>`).join("")
    }</tr>`
  ).join(""));

  indexChartCards(players);
  beginCardRefs("vpcard");
  setHtml($("score-cards"), breakdowns.map(({ p, b }) => `
    <div class="color-${teamColor(p)}">
      <h3 class="section-title">${displayName(p, "P" + p.id)} cards</h3>
      <ul>${(b.cardDetails || []).map(cardDetailItem).join("") || "<li>None</li>"}</ul>
    </div>`).join(""));
  renderScoreCharts(data, players, history, ended);
  const notes = [];
  if (score.note) notes.push(score.note);
  if (breakdowns.some(({ b }) => isTied(b) && (b.total ?? 0) > 0)) notes.push("VP tie — most M€ wins.");
  $("score-note").textContent = notes.join(" ");
  $("score-note").hidden = notes.length === 0;
  $("score-details").hidden = !scoreOpen;
  $("score-cards").hidden = !cardsOpen;
  $("score-chart-panel").hidden = !showCharts;
  $("score-charts").hidden = !chartsOpen || !showCharts;
  $("score-chart-toggle").setAttribute("aria-expanded", chartsOpen ? "true" : "false");
  $("score-toggle").setAttribute("aria-expanded", scoreOpen ? "true" : "false");
}

/** "+3 Birds" from the score breakdown, with the card name hoverable. */
function cardDetailItem(detail) {
  const m = String(detail).match(/^([+-]?\d+) (.+)$/);
  if (!m) return `<li>${escapeHtml(detail)}</li>`;
  return `<li><strong>${m[1]}</strong> ${cardRef(m[2])}</li>`;
}

const TEAM_HEX = { blue: "#3d7ec9", green: "#2f9e44", purple: "#9b59b6", yellow: "#d4b429", red: "#c44532" };

function historyValue(point, playerId, key) {
  const by = point.byId || {};
  const b = by[playerId] || by[String(playerId)] || {};
  return Number(b[key] ?? 0);
}

const PROD_RES = ["mc", "steel", "ti", "plant", "energy", "heat"];
const CHART_METRICS = [
  { id: "vp", key: "total", label: "VP" },
  { id: "tr", key: "tr", label: "TR", kind: "tr" },
  ...PROD_RES.map((r) => {
    const name = resLabel(r);
    return { id: "prod-" + r, key: "prod-" + r, res: r, kind: "prod-" + r,
      label: name.charAt(0).toUpperCase() + name.slice(1) + " production" };
  }),
];

function chartMetric() {
  return CHART_METRICS.find((m) => m.id === chartMetricId) || CHART_METRICS[0];
}

function chartMetricTitle(metric, ended) {
  if (metric.id === "vp") return ended ? "Total VP" : "VP if the game ended now";
  return metric.label;
}

function chartChip(metric) {
  const on = metric.id === chartMetricId ? " on" : "";
  const face = metric.res ? resMark(metric.res) : metric.label;
  return `<button type="button" class="chart-chip${on}${metric.res ? " icon" : ""}" data-metric="${metric.id}" title="${metric.label}" aria-label="${metric.label}" aria-pressed="${on ? "true" : "false"}">${face}</button>`;
}

function renderScoreCharts(data, players, history, ended) {
  const box = $("score-charts");
  if (!history || history.length < 2) {
    setHtml(box, `<p class="score-note">Not enough generations yet.</p>`);
    return;
  }
  const metric = chartMetric();
  const score = CHART_METRICS.filter((m) => !m.res);
  const prod = CHART_METRICS.filter((m) => m.res);
  setHtml(box, `
    <div class="chart-picker">
      <div class="chart-picker-row"><span class="chart-picker-label">Score</span>${score.map(chartChip).join("")}</div>
      <div class="chart-picker-row"><span class="chart-picker-label">Production</span>${prod.map(chartChip).join("")}</div>
    </div>
    <div class="score-chart-block">
      <h3 class="section-title">${chartMetricTitle(metric, ended)}</h3>
      ${lineChartSvg(history, players, metric.key, metric.label)}
    </div>
    <div class="score-gen" id="score-gen"></div>`);
  renderGenExplain(data, players, history);
}

function lineChartSvg(history, players, key, label) {
  const w = 320;
  const h = 108;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const n = history.length;
  const xs = history.map((_, i) => padL + (i * (w - padL - padR)) / Math.max(1, n - 1));
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const pt of history) {
    for (const p of players) {
      const v = historyValue(pt, p.id, key);
      ymin = Math.min(ymin, v);
      ymax = Math.max(ymax, v);
    }
  }
  if (!Number.isFinite(ymin) || ymin === ymax) {
    ymin = (ymin || 0) - 1;
    ymax = ymin + 2;
  }
  const yAt = (v) => padT + (1 - (v - ymin) / (ymax - ymin)) * (h - padT - padB);
  const cols = xs.map((x, i) => {
    const gen = history[i].generation;
    const x0 = i === 0 ? padL - 6 : (xs[i - 1] + x) / 2;
    const x1 = i === n - 1 ? w - padR + 6 : (x + xs[i + 1]) / 2;
    const sel = selectedGen === gen ? " selected" : "";
    return `<rect class="chart-col${sel}" data-gen="${gen}" x="${x0.toFixed(1)}" y="0" width="${Math.max(8, x1 - x0).toFixed(1)}" height="${h}"/>`;
  }).join("");
  const lines = players.map((p) => {
    const color = TEAM_HEX[teamColor(p)] || "#b89f88";
    const d = history.map((pt, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${yAt(historyValue(pt, p.id, key)).toFixed(1)}`).join(" ");
    const dots = history.map((pt, i) =>
      `<circle class="chart-dot" cx="${xs[i].toFixed(1)}" cy="${yAt(historyValue(pt, p.id, key)).toFixed(1)}" r="2.6" fill="${color}"/>`
    ).join("");
    return `<path class="chart-line" stroke="${color}" d="${d}"/>${dots}`;
  }).join("");
  const axis = `<text class="chart-axis" x="2" y="${yAt(ymax) + 3}">${Math.round(ymax)}</text>`
    + `<text class="chart-axis" x="2" y="${yAt(ymin) + 3}">${Math.round(ymin)}</text>`
    + xs.map((x, i) => {
      const pt = history[i];
      const tick = pt.now ? "now" : String(pt.generation);
      return `<text class="chart-axis" text-anchor="middle" x="${x.toFixed(1)}" y="${h - 4}">${tick}</text>`;
    }).join("");
  return `<svg class="score-chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label} by generation">${cols}${lines}${axis}</svg>`;
}

function signed(n) {
  if (n > 0) return "+" + n;
  return String(n);
}

function renderGenExplain(data, players, history) {
  const el = $("score-gen");
  if (!el) return;
  indexChartCards(players);
  beginCardRefs("gencard");
  if (selectedGen == null) {
    setHtml(el, `<p class="score-gen-kicker">Tap a generation to see what moved.</p>`);
    return;
  }
  const idx = history.findIndex((pt) => pt.generation === selectedGen);
  if (idx < 0) {
    setHtml(el, `<p class="score-gen-kicker">Tap a generation to see what moved.</p>`);
    return;
  }
  const cur = history[idx];
  const prev = idx > 0 ? history[idx - 1] : null;
  const metric = chartMetric();
  const title = `${cur.now ? `Now (gen ${selectedGen})` : `Generation ${selectedGen}`} · ${metric.label}`;
  if (metric.kind) {
    setHtml(el, `<p class="score-gen-kicker">${title}</p>`
      + players.map((p) => renderContributors(data, p, metric, cur, prev)).join(""));
    return;
  }
  const events = (data.score.events || []).filter((e) => e.generation === selectedGen && !e.kind.startsWith("prod-"));
  const buckets = [
    ["TR", "tr"],
    ["Milestones", "milestones"],
    ["Awards", "awards"],
    ["Greeneries", "greeneries"],
    ["Cities", "cities"],
    ["Cards", "cards"],
  ];
  setHtml(el, `<p class="score-gen-kicker">${title}</p>` + players.map((p) => {
    const total = historyValue(cur, p.id, "total") - (prev ? historyValue(prev, p.id, "total") : 0);
    const parts = buckets.map(([name, key]) => {
      const d = historyValue(cur, p.id, key) - (prev ? historyValue(prev, p.id, key) : 0);
      return d ? `${name} ${signed(d)}` : "";
    }).filter(Boolean);
    const named = vpSources(events.filter((e) => e.playerId === p.id)).join("");
    return `<div class="score-gen-player color-${teamColor(p)}">
      <strong>${escapeHtml(displayName(p, "P" + p.id))} ${historyValue(cur, p.id, "total")}</strong>${prev ? ` <span class="gen-moved">${signed(total)}</span>` : ""}
      ${parts.length ? `<span class="buckets">${parts.join(" · ")}</span>` : ""}
      ${named ? `<ul>${named}</ul>` : ""}
    </div>`;
  }).join(""));
}

let chartCards = new Map();
let cardRefScope = "card";
let cardRefSeq = 0;

/** Start numbering card popovers for one section, so tips in different sections never share a key. */
function beginCardRefs(scope) {
  cardRefScope = scope;
  cardRefSeq = 0;
}

/** Every played card (and corporation) at the table, by lower-case name. */
function indexChartCards(players) {
  chartCards = new Map();
  for (const p of players) {
    for (const c of [...(p.blueCards || []), ...(p.greenCards || []), ...(p.events || [])]) {
      chartCards.set(String(c.name).toLowerCase(), c);
    }
    if (p.corporation && p.corporation !== "Unknown") {
      chartCards.set(p.corporation.toLowerCase(), { name: p.corporation, tags: [], extra: corpRuleText(p.corpRules) });
    }
  }
}

/**
 * The printed effects the card catalog keeps as data rather than text (Power Plant's "+1 energy production"
 * is only a production value): requirement, gain chips as HTML, and tile placements not already in the gains.
 */
function cardEffects(card) {
  // Global parameters and TR have no icon; spell them out rather than show a bare colored box.
  const gain = (k, v, prod) => resIcon(resKey(k))
    ? resSym(k, v, prod)
    : `<span class="tip-card-gain">${escapeHtml(`${Number(v) > 0 ? "+" : ""}${v} ${resLabel(resKey(k))}`)}</span>`;
  const gains = [
    ...Object.entries(card.production || {}).filter(([, v]) => v != null && v !== 0).map(([k, v]) => gain(k, v, true)),
    ...Object.entries(card.resources || {}).filter(([, v]) => v != null && v !== 0).map(([k, v]) => gain(k, v, false)),
  ];
  const resourceKeys = Object.keys(card.resources || {});
  const places = (card.place || []).filter((k) => !resourceKeys.includes(k))
    .map((k) => `Place ${escapeHtml(k)} tile`);
  return { req: formatReq(card.req), gains, places };
}

/** A chart label, with a card popover when it names a played card ("X", "X action", "X (Player)"). */
function cardRef(label) {
  const m = String(label).match(/^(.*?)(?: action)?(?: \([^)]*\))?$/);
  const card = m && chartCards.get(m[1].toLowerCase());
  return card ? cardPopover(card, label) : escapeHtml(label);
}

/** `label` with a hover/tap popover describing `card` (a played card, or a drawn card from the server). */
function cardPopover(card, label) {
  const text = escapeHtml(label);
  const body = String(card.extra || "").split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^-+$/.test(line))
    .join("\n");
  const tags = (card.tags || []).map(tagIcon).join("");
  const cost = card.cost != null ? costSym(card.cost) : "";
  const { req, gains, places } = cardEffects(card);
  const printedVp = card.printedVp ?? card.vp; // played cards carry printedVp, drawn cards vp
  const vp = printedVp ? `<span class="tip-card-vp">${printedVp} VP</span>` : "";
  const tokens = card.tokens ? `<span class="tip-card-vp">${card.tokens} ${tokenWord(card.tokenType, card.tokens)} now</span>` : "";
  const pop = `<span class="tip-card-head"><strong>${escapeHtml(card.name)}</strong>${cost}${tags}</span>`
    + (req ? `<span class="tip-card-req">${escapeHtml(req)}</span>` : "")
    + (gains.length ? `<span class="tip-card-gains">${gains.join("")}</span>` : "")
    + (places.length ? `<span class="tip-def">${places.join(" · ")}</span>` : "")
    + (body ? `<span class="tip-def">${escapeHtml(body)}</span>` : "")
    + vp + tokens;
  return `<span class="tip card-ref" tabindex="0" data-tip-key="${cardRefScope}${++cardRefSeq}">${text}<span class="tip-pop" role="tooltip">${pop}</span></span>`;
}

function tokenWord(type, n) {
  const word = type || "resource";
  return Math.abs(n) === 1 ? word : word + "s";
}

/** Short name for what moved tokens on {@code card}: its own action reads as "action". */
function tokenCause(cause, card) {
  if (!cause || cause === "Other") return "";
  if (cause === card + " action") return "action";
  if (cause === card) return "when played";
  return cause;
}

/** One row per card or action: VP it earned this generation, with token and TR notes. */
function vpSources(events) {
  const bySource = new Map();
  for (const e of events) {
    const key = e.source || e.label;
    const row = bySource.get(key)
      || { source: key, vp: 0, tr: 0, tokens: 0, tokenType: "", funded: false, causes: new Map() };
    row.vp += e.delta;
    if (e.kind === "tr") row.tr += e.delta;
    if (e.kind === "award") row.funded = true;
    if (e.tokens) {
      row.tokens += e.tokens;
      row.tokenType = e.tokenType || row.tokenType;
      const cause = tokenCause(e.cause, key);
      row.causes.set(cause, (row.causes.get(cause) || 0) + e.tokens);
    }
    bySource.set(key, row);
  }
  return [...bySource.values()]
    .filter((r) => r.vp !== 0 || r.tokens !== 0 || r.funded)
    .sort((a, b) => b.vp - a.vp || a.source.localeCompare(b.source))
    .map((r) => {
      const notes = [];
      if (r.tr) notes.push(r.tr === r.vp ? "TR" : `${signed(r.tr)} TR`);
      const moves = [...r.causes].filter(([, n]) => n !== 0);
      for (const [cause, n] of moves) {
        notes.push(`${signed(n)} ${escapeHtml(tokenWord(r.tokenType, n))}${cause ? ` (${cardRef(cause)})` : ""}`);
      }
      const vp = r.vp || r.funded ? (r.vp ? ` <strong>${signed(r.vp)}</strong>` : "") : " <strong>0</strong>";
      return `<li>${cardRef(r.source)}${vp}${notes.length ? ` · ${notes.join(", ")}` : ""}</li>`;
    });
}

/** Everything that built one player's TR or production up to the selected generation. */
function renderContributors(data, p, metric, cur, prev) {
  const value = historyValue(cur, p.id, metric.key);
  const moved = prev ? value - historyValue(prev, p.id, metric.key) : 0;
  const bySource = new Map();
  for (const e of data.score.events || []) {
    if (e.kind !== metric.kind || e.playerId !== p.id || e.generation > selectedGen) continue;
    const row = bySource.get(e.label) || { label: e.label, total: 0, now: 0 };
    row.total += e.delta;
    if (e.generation === selectedGen) row.now += e.delta;
    bySource.set(e.label, row);
  }
  const rows = [...bySource.values()]
    .filter((r) => r.total !== 0 || r.now !== 0)
    .sort((a, b) => Math.abs(b.now) - Math.abs(a.now) || Math.abs(b.total) - Math.abs(a.total));
  const base = value - rows.reduce((sum, r) => sum + r.total, 0);
  const items = rows.map((r) => {
    const note = r.now === 0 ? "" : r.now === r.total ? " (new)" : ` (${signed(r.now)} this gen)`;
    return `<li${r.now ? ` class="moved"` : ""}>${cardRef(r.label)} <strong>${signed(r.total)}</strong>${note}</li>`;
  });
  if (base !== 0) items.push(`<li>${metric.kind === "tr" ? "Starting TR" : "Base"} <strong>${base}</strong></li>`);
  return `<div class="score-gen-player color-${teamColor(p)}">
    <strong>${escapeHtml(displayName(p, "P" + p.id))} ${value}</strong>${prev && moved ? ` <span class="gen-moved">${signed(moved)}</span>` : ""}
    ${items.length ? `<ul>${items.join("")}</ul>` : ""}
  </div>`;
}

function loadChartMetric() {
  try {
    return localStorage.getItem("chartMetric") || "vp";
  } catch {
    return "vp";
  }
}

let chartMetricId = loadChartMetric();
let scoreOpen = false;
let cardsOpen = false;
let chartsOpen = false;
let selectedGen = null;
let lastScoreData = null;
let lastScorePlayers = [];
let scoreUiBound = false;
// Closed until a card is in flight (which opens it) or the game log is opened by hand.
let bannerOpen = false;
let bannerKey = "";
let bannerUiBound = false;
let corpRulesOpen = false;
let collapsedBoardIds = new Set();
/** Collapsed card sections (blue, green, red); each applies to every player's board. */
let collapsedCardSections = new Set();
let corpUiBound = false;
let lastGameId = "";

function applyBoardUi() {
  document.querySelectorAll(".board").forEach((board) => {
    const toggle = board.querySelector(".board-toggle");
    const info = board.querySelector(".corp-info");
    const id = Number((toggle || info)?.dataset.corp);
    if (!id) return;
    const collapsed = collapsedBoardIds.has(id);
    const rulesOpen = corpRulesOpen;
    board.classList.toggle("collapsed", collapsed);
    const body = board.querySelector(".board-body");
    if (body) body.hidden = collapsed;
    if (toggle) {
      const title = board.querySelector(".corp-name")?.textContent || "board";
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${title}`);
    }
    if (info) info.setAttribute("aria-expanded", rulesOpen ? "true" : "false");
    const rules = board.querySelector(".corp-rules");
    if (rules) rules.hidden = collapsed || !rulesOpen;
  });
  alignBoardSections();
}

const BOARD_ALIGN = [".board-head", ".board-intro", ".board-cubes", ".board-tr", ".tags", ".board-awards"];

function alignBoardSections() {
  document.querySelectorAll(BOARD_ALIGN.join(",")).forEach((el) => {
    el.style.minHeight = "";
  });
  const root = $("boards");
  if (!root) return;
  const colCount = getComputedStyle(root).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
  if (colCount < 2) return;
  const groups = new Map();
  for (const board of root.querySelectorAll(".board:not(.collapsed)")) {
    const top = Math.round(board.offsetTop);
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(board);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const sel of BOARD_ALIGN) {
      const els = group.map((b) => b.querySelector(sel)).filter(Boolean);
      if (els.length < 2) continue;
      const h = Math.max(...els.map((el) => el.offsetHeight));
      els.forEach((el) => { el.style.minHeight = `${h}px`; });
    }
  }
}

function bindCorpUi() {
  if (corpUiBound) return;
  corpUiBound = true;
  window.addEventListener("resize", alignBoardSections);
  $("boards").addEventListener("click", (ev) => {
    const section = ev.target.closest(".cards-toggle");
    if (section) {
      // When boards stack (narrow screens, 4-5 players), sections above the clicked one change height too;
      // keep the clicked header where it was so the page doesn't jump out from under the pointer.
      const before = section.getBoundingClientRect().top;
      const key = section.dataset.cards;
      const open = collapsedCardSections.has(key);
      if (open) collapsedCardSections.delete(key);
      else collapsedCardSections.add(key);
      document.querySelectorAll(`.cards-toggle[data-cards="${key}"]`).forEach((btn) => {
        btn.setAttribute("aria-expanded", String(open));
        const cards = btn.closest(".cards-title")?.nextElementSibling;
        if (cards) cards.hidden = !open;
      });
      alignBoardSections();
      window.scrollBy(0, section.getBoundingClientRect().top - before);
      return;
    }
    const info = ev.target.closest(".corp-info");
    if (info) {
      corpRulesOpen = !corpRulesOpen;
      if (corpRulesOpen) collapsedBoardIds.clear();
      applyBoardUi();
      return;
    }
    const toggle = ev.target.closest(".board-toggle");
    if (!toggle) return;
    const id = Number(toggle.dataset.corp);
    if (collapsedBoardIds.has(id)) collapsedBoardIds.delete(id);
    else collapsedBoardIds.add(id);
    applyBoardUi();
  });
}

function bindScoreUi() {
  if (scoreUiBound) return;
  scoreUiBound = true;
  $("score-toggle").addEventListener("click", () => {
    scoreOpen = !scoreOpen;
    if (!scoreOpen) {
      cardsOpen = false;
      chartsOpen = false;
    }
    $("score-details").hidden = !scoreOpen;
    $("score-cards").hidden = !cardsOpen;
    $("score-charts").hidden = !chartsOpen;
    $("score-chart-toggle").setAttribute("aria-expanded", chartsOpen ? "true" : "false");
    $("score-toggle").setAttribute("aria-expanded", scoreOpen ? "true" : "false");
  });
  $("score-lines").addEventListener("click", (ev) => {
    const row = ev.target.closest("tr[data-drill='cards']");
    if (!row) return;
    cardsOpen = !cardsOpen;
    $("score-cards").hidden = !cardsOpen;
    row.classList.toggle("open", cardsOpen);
  });
  $("score-chart-toggle").addEventListener("click", () => {
    chartsOpen = !chartsOpen;
    $("score-charts").hidden = !chartsOpen;
    $("score-chart-toggle").setAttribute("aria-expanded", chartsOpen ? "true" : "false");
  });
  $("score-charts").addEventListener("click", (ev) => {
    const chip = ev.target.closest("[data-metric]");
    if (chip) {
      chartMetricId = chip.dataset.metric;
      try {
        localStorage.setItem("chartMetric", chartMetricId);
      } catch {
        // Private windows can refuse storage; the choice just won't persist.
      }
      const data = lastScoreData || {};
      const ended = /endgame/i.test(data.phase || "");
      renderScoreCharts(data, lastScorePlayers, data.score?.history || [], ended);
      return;
    }
    const col = ev.target.closest("[data-gen]");
    if (!col) return;
    const gen = Number(col.dataset.gen);
    selectedGen = selectedGen === gen ? null : gen;
    $("score-charts").querySelectorAll("[data-gen]").forEach((el) => {
      el.classList.toggle("selected", Number(el.dataset.gen) === selectedGen);
    });
    const history = lastScoreData?.score?.history || [];
    renderGenExplain(lastScoreData || {}, lastScorePlayers, history);
  });
}

let lastStateText = "";
let lastLive = false;

/** Replace an element's HTML only when it changed, so a click in progress isn't lost to a no-op rebuild. */
function setHtml(el, html) {
  if (!el || el._html === html) return;
  el.innerHTML = html;
  el._html = html;
}

async function tick() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    // Rebuilding the DOM between mousedown and mouseup swallows the click, so skip identical polls.
    if (text === lastStateText) {
      setLiveStatus(lastLive ? "live" : "idle");
      return;
    }
    lastStateText = text;
    const data = JSON.parse(text);
    lastLive = !!data.live;
    render(data);
  } catch (err) {
    setLiveStatus("disconnected");
  }
}

tick();
setInterval(tick, 500);
bindScoreUi();
bindBannerUi();
bindCorpUi();
bindTipUi();
bindPhoneAccessUi();
