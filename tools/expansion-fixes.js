// Corrections for the scraped expansion cards (tools/expansions.json), applied when convert-cards.js merges them.
// The source list carries requirements only as text and drops VP fractions, so these are kept by hand.
//
// req keys follow cards.src.js: temp, o2, ocean, venus (the Venus track %), tr, and tag counts by tag name
// ("energy" is the power tag). "venus tag", "floater", "colony", "city" and "greenery" count things you have;
// "note" is shown as written for requirements that aren't a count.

const REQ = {
  "210": { science: 2 },
  "211": { ocean: 2 },
  "212": { ocean: 8 },
  "214": { floater: 5 },
  "216": { science: 3 },
  "217": { science: 3 },
  "220": { science: 4 },
  "224": { science: 2 },
  "225": { science: 2 },
  "227": { venus: 10 },
  "233": { venus: 8 },
  "239": { "venus tag": 1, earth: 1, jovian: 1 },
  "240": { venus: 10 },
  "241": { "venus tag": 1, earth: 1, jovian: 1 },
  "244": { "venus tag": 1, earth: 1 },
  "245": { "venus tag": 1, earth: 1, jovian: 1 },
  "249": { venus: 12 },
  "251": { venus: 6 },
  "252": { tr: 25 },
  "253": { venus: 6 },
  "255": { "venus tag": 2 },
  "256": { venus: 10 },
  "260": { venus: 12 },
  "261": { venus: 16 },
  C01: { floater: 3 },
  C05: { earth: 2 },
  C06: { science: 4 },
  C14: { earth: 2 },
  C16: { jovian: 2 },
  C19: { science: 3 },
  C20: { earth: 3 },
  C24: { note: "2 cities in play" },
  C29: { note: "no more than 1 colony" },
  C31: { science: 4 },
  C36: { earth: 2 },
  C39: { colony: 1 },
  C40: { colony: 1 },
  C42: { temp: -6 },
  C48: { city: 1, colony: 1 },
  C49: { science: 5 },
  X01: { science: 2 },
  X07: { science: 2 },
  X09: { note: "2 party leaders" },
  X17: { note: "a player removed another player's plants this generation" },
  X20: { note: "9 different resource types" },
  X24: { energy: 3 },
  X29: { science: 2 },
  X37: { greenery: 3 },
  X38: { note: "any city next to an ocean" },
  X45: { o2: 4 },
  X50: { note: "your city next to an ocean" },
  X62: { greenery: 2 },
  X63: { o2: 4 },
};

// VP per resource where the scrape wrote "1 per resource" for a card that scores per 2 or 3,
// or left out a VP that depends on the table (Space Port Colony).
const VP = {
  "224": "1/3 Microbe Resource",
  "225": "1/2 Floater Resource",
  "248": "1/3 Floater Resource",
  "260": "1/2 Microbe Resource",
  C18: "1/2 Floater Resource",
  C33: "1/Camp Resource",
  C42: "1/2 Animal Resource",
  X14: "1/Asteroid Resource",
  C40: "1/2 Colony in play",
};

function apply(cards) {
  for (const card of cards) {
    const n = card.number;
    if (REQ[n]) card.req = REQ[n];
    if (VP[n]) {
      card.extra = card.extra.replace(/\n?VP: .*$/, "") + "\nVP: " + VP[n];
      card.vp = null;
    }
  }
  return cards;
}

module.exports = { apply };
