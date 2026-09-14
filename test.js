import { Team, CoincheStatus, calculateScore, parseInput } from "./logic.js"

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || "assertion failed")
}

const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + " - " : "") + `expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`)
}

Deno.test("rejects contract-only without points/chute", () => {
  const res = parseInput("Nous 120")
  assert(res && typeof res === "object", "expected object")
  assert("error" in res, "expected error")
})

Deno.test("contract-only with dedans is accepted (points=0)", () => {
  const r = parseInput("Nous 120 dedans", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 120)
  eq(r.pointsScored, 0)
  eq(r.isSuccess, false)
  eq(r.winner, Team.EUX)
  eq(r.deltaEux, 282) // 162 + 120
})

Deno.test("basic success scoring", () => {
  const r = parseInput("Nous 100 120", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 100)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 220)
  eq(r.deltaEux, 42)
})

Deno.test("chute/dedans makes taker fail", () => {
  const r = parseInput("Nous 90 chute", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.isSuccess, false)
  eq(r.winner, Team.EUX)
  eq(r.deltaEux, 252)
  eq(r.deltaNous, 0)
})

Deno.test("coinche doubles contract points", () => {
  const r = parseInput("Nous 80 coinche 120", 0, 0)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 280)
  eq(r.deltaEux, 42)
})

Deno.test("surcoinche quadruples contract points", () => {
  const r = parseInput("Eux 80 sur 120", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.isSuccess, true)
  eq(r.deltaEux, 440)
  eq(r.deltaNous, 42)
})

Deno.test("belote defaults to taker", () => {
  const r = parseInput("Eux 100 120 belote", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.isSuccess, true)
  eq(r.deltaEux, 240)
  eq(r.deltaNous, 42)
})

Deno.test("belote can be attributed to defense", () => {
  const r = parseInput("Eux 100 120 belote nous", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.isSuccess, true)
  eq(r.deltaEux, 220)
  eq(r.deltaNous, 62)
})

Deno.test("taker detection: first team keyword wins (Eux ... belote nous)", () => {
  const r = parseInput("Eux 100 120 belote nous", 0, 0)
  eq(r.taker, Team.EUX)
})

Deno.test("taker detection: first team keyword wins (Nous ... belote eux)", () => {
  const r = parseInput("Nous 100 120 belote eux", 0, 0)
  eq(r.taker, Team.NOUS)
})

Deno.test("example: Nous 100 65 => other number treated as defense points (<82), so taker likely fails", () => {
  const r = parseInput("Nous 100 65", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 100)
  eq(r.pointsScored, 97) // 162 - 65
  eq(r.isSuccess, false)
  eq(r.winner, Team.EUX)
  eq(r.deltaEux, 262) // 162 + 100
})

Deno.test("example: Eux 120 90 belote => belote defaults to taker; still can fail", () => {
  const r = parseInput("Eux 120 90 belote", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.contract, 120)
  eq(r.pointsScored, 90)
  eq(r.isSuccess, false) // 90 + 20 < 120
  eq(r.winner, Team.NOUS)
  eq(r.deltaNous, 302) // 162 + 120 + 20
})

Deno.test("capot via numeric contract (250) without points is accepted", () => {
  const r = parseInput("Nous 250", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 250)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 500)
  eq(r.deltaEux, 0)
})

Deno.test("capot via 270 without points is accepted", () => {
  const r = parseInput("Eux 270", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.contract, 270)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
  eq(r.deltaEux, 520) // 250 + 270
  eq(r.deltaNous, 0)
})

Deno.test("coinche fail with chute: defense gets (162 + contract*2)", () => {
  const r = parseInput("Eux 80 coinche chute", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.contract, 80)
  eq(r.isSuccess, false)
  eq(r.winner, Team.NOUS)
  eq(r.deltaNous, 322) // 162 + 80*2
})

Deno.test("explicit preneur synonyms: on/ils/adv", () => {
  const a = parseInput("on 100 120", 0, 0)
  eq(a.taker, Team.NOUS)
  const b = parseInput("ils 100 120", 0, 0)
  eq(b.taker, Team.EUX)
  const c = parseInput("adv 100 120", 0, 0)
  eq(c.taker, Team.EUX)
})

Deno.test("belote owner parsing: 'nous belote' and 'belote eux'", () => {
  const a = parseInput("Nous 100 120 nous belote", 0, 0)
  eq(a.beloteOwner, Team.NOUS)
  const b = parseInput("Nous 100 120 belote eux", 0, 0)
  eq(b.beloteOwner, Team.EUX)
})

Deno.test("surcoinche beats coinche if both present", () => {
  const r = parseInput("Nous 80 cc sur 120", 0, 0)
  eq(r.coinche, CoincheStatus.SURCOINCHE)
  eq(r.deltaNous, 440) // 120 + 80*4
})

Deno.test("explicit defense points: Nous 100 Eux 40 => taker points = 162-40", () => {
  const r = parseInput("Nous 100 Eux 40", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 100)
  eq(r.pointsScored, 122)
})

Deno.test("explicit defense points: Eux 100 Nous 40 => taker points = 162-40", () => {
  const r = parseInput("Eux 100 Nous 40", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.contract, 100)
  eq(r.pointsScored, 122)
})

Deno.test("multiple numbers: contract + first non-contract number used", () => {
  const r = parseInput("Nous 100 120 10", 0, 0)
  eq(r.contract, 100)
  eq(r.pointsScored, 120)
  eq(r.isSuccess, true)
})

Deno.test("explicit points equal to contract are ignored, other side used", () => {
  const r = parseInput("Nous 100 nous 100 eux 62", 0, 0)
  eq(r.contract, 100)
  eq(r.pointsScored, 100) // 162 - 62
})

Deno.test("coinche/surcoinche abbreviations: cc/sc", () => {
  const a = parseInput("Nous 80 cc 120", 0, 0)
  eq(a.coinche, CoincheStatus.COINCHE)
  eq(a.deltaNous, 280)
  const b = parseInput("Eux 80 sc 120", 0, 0)
  eq(b.coinche, CoincheStatus.SURCOINCHE)
  eq(b.deltaEux, 440)
})

Deno.test("capot keyword implies contract 250", () => {
  const r = parseInput("Eux capot", 0, 0)
  eq(r.taker, Team.EUX)
  eq(r.contract, 250)
  eq(r.isCapot, true)
})

Deno.test("invalid: no valid contract present", () => {
  const res = parseInput("Nous 75 65", 0, 0)
  assert("error" in res, "expected error")
})

Deno.test("invalid: contract 70 test", () => {
  const r = parseInput("nous 70 50")
  assert(r.error, "Should error on invalid contract 70")
})

Deno.test("capot scores as capot", () => {
  const r = parseInput("Nous capot", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 500)
  eq(r.deltaEux, 0)
})

Deno.test("implicit taker defaults to NOUS", () => {
  const r = parseInput("80 100")
  eq(r.taker, Team.NOUS)
  eq(r.pointsScored, 100)
})

Deno.test("coinche but also capot", () => {
  const r = parseInput("nous capot coinche", 0, 0)
  eq(r.contract, 250)
  eq(r.coinche, CoincheStatus.COINCHE)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 750) // 250 + 250*2
})

Deno.test("defense point explicit exact string test", () => {
  const r = parseInput("nous avons pris 80, ils ont fait 60")
  eq(r.pointsScored, 102) // 162 - 60
  eq(r.isSuccess, true)
})

Deno.test("multiple contracts matched but first is used", () => {
  const r = parseInput("nous 80 90 100")
  eq(r.contract, 80)
  eq(r.pointsScored, 90)
})

Deno.test("chute and points together should default to chute", () => {
  const r = parseInput("nous 80 120 chute")
  eq(r.isSuccess, false)
  eq(r.pointsScored, 0)
})

Deno.test("dedans keyword instead of chute", () => {
  const r = parseInput("nous 90 dedans")
  eq(r.isSuccess, false)
  eq(r.pointsScored, 0)
})

Deno.test("belote à nous", () => {
  const r = parseInput("eux 80 100 belote à nous")
  eq(r.taker, Team.EUX)
  eq(r.beloteOwner, Team.NOUS)
  eq(r.deltaEux, 180)
  eq(r.deltaNous, 82)
})

Deno.test("extreme case: everything is mentioned", () => {
  const r = parseInput("nous 160 on a fait 170 il belote pour eux coinche chute", 0, 0)
  eq(r.taker, Team.NOUS)
  eq(r.contract, 160)
  eq(r.pointsScored, 0, "chute overrides everything")
  eq(r.coinche, CoincheStatus.COINCHE)
  eq(r.beloteOwner, Team.EUX)
  eq(r.isSuccess, false)
  eq(r.deltaEux, 502) // 162 + 160*2 + 20
})

Deno.test("surcoinche overrides coinche even if both mentioned", () => {
  const r = parseInput("nous 80 coinche puis surcoinche capot 0", 0, 0)
  eq(r.coinche, CoincheStatus.SURCOINCHE)
  eq(r.contract, 80)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 570)
})

Deno.test("capot with chute explicit points to a 0 score", () => {
  const r = parseInput("capot demandé par nous, mais on a chuté")
  eq(r.contract, 250)
  eq(r.taker, Team.NOUS)
  eq(r.isSuccess, false)
  eq(r.deltaNous, 0)
  eq(r.deltaEux, 412) // 162 + 250
})

Deno.test("explicit NOUS points detected even if number < 82", () => {
  const r = parseInput("on gagne 80, on gagne 80")
  eq(r.contract, 80)
  eq(r.pointsScored, 80)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 160) // 80 + 80
})

Deno.test("different spelling for chute equivalent", () => {
  const r = parseInput("eux 120 ont eté dedans complètement")
  eq(r.contract, 120)
  eq(r.pointsScored, 0)
  eq(r.isSuccess, false)
  eq(r.deltaNous, 282) // 162 + 120
})

Deno.test("points given for defense equal to half", () => {
  const r = parseInput("nous 80 ils ont fait 81")
  eq(r.contract, 80)
  eq(r.pointsScored, 81) // 162 - 81 = 81
  eq(r.isSuccess, true)
  eq(r.deltaNous, 161)
  eq(r.deltaEux, 81) 
})

Deno.test("negative sign / hyphen handling", () => {
  const r = parseInput("nous 120 - 162")
  // The hyphen shouldn't break the regex
  eq(r.contract, 120)
  eq(r.pointsScored, 162)
})

Deno.test("points specified with adv", () => {
  const r = parseInput("nous 100 adv a eu 62")
  eq(r.contract, 100)
  eq(r.pointsScored, 100) // 162 - 62 = 100
  eq(r.isSuccess, true)
})

Deno.test("capot keyword preserves the announced contract", () => {
  const r = parseInput("nous 80 capot 120", 0, 0)
  eq(r.contract, 80)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
  eq(r.deltaNous, 330)
})

Deno.test("capot points of 250 do not replace the contract", () => {
  const r = parseInput("nous 80 capot 250", 0, 0)
  eq(r.contract, 80)
  eq(r.isCapot, true)
})

Deno.test("capot keeps the first contract even when 270 follows", () => {
  const r = parseInput("eux 80 capot 270 120", 0, 0)
  eq(r.contract, 80)
  eq(r.isCapot, true)
})

for (const [text, contract, deltaNous, deltaEux] of [
  ["Eux 120 capot", 120, 0, 370],
  ["Eux 120 capot belote", 120, 0, 390],
  ["Eux 120 capot avec belote", 120, 0, 390],
  ["Eux 120 capot belote nous", 120, 20, 370],
  ["Eux 120 capot sans belote", 120, 0, 370],
  ["Eux 120 capot belote et rebelote", 120, 0, 390],
  ["Nous 120 capot", 120, 370, 0],
  ["Nous 120 capot belote", 120, 390, 0],
  ["Eux 120 capot coinché belote", 120, 0, 510],
  ["Nous 120 capot surcoinché belote", 120, 750, 0],
  ["Eux capot 120 fait", 120, 0, 370],
  ["Eux contrat 120 capot belote", 120, 0, 390],
  ["Eux 80 contrat 120 capot", 120, 0, 370],
  ["Eux capot belote", 250, 0, 520],
  ["Eux 270 capot belote", 270, 0, 540],
  ["Eux 120 capot chute", 120, 282, 0],
  ["Eux 120 capot pas fait belote", 120, 302, 0],
]) {
  Deno.test(`capot adds 250 to the announced bid: ${text}`, () => {
    const r = parseInput(text, 10, 20)
    eq(r.error, undefined)
    eq(r.contract, contract)
    eq(r.isCapot, true)
    eq(r.deltaNous, deltaNous)
    eq(r.deltaEux, deltaEux)
    eq(r.totalNous, 10 + deltaNous)
    eq(r.totalEux, 20 + deltaEux)
  })
}

Deno.test("calculateScore returns totals consistent with deltas", () => {
  const r = calculateScore({
    taker: Team.NOUS,
    contract: 100,
    pointsScored: 90,
    beloteOwner: null,
    coinche: CoincheStatus.NONE,
    totalNous: 10,
    totalEux: 20,
    isCapot: false,
  })
  eq(r.totalNous, 10 + r.deltaNous)
  eq(r.totalEux, 20 + r.deltaEux)
})

// Table-driven language regressions: keep each phrase visible in test output.
for (const team of ["Nous", "Eux"]) {
  for (const phrase of ["fait", "faite", "faits", "faites", "réussi", "réussie", "réussis", "rempli", "réalisé", "gagné", "passé", "honoré", "accompli", "OK", "contrat fait", "pas chuté", "pas dedans", "sans chute"]) {
    Deno.test(`successful contract shorthand: ${team} 120 ${phrase}`, () => {
      const r = parseInput(`${team} 120 ${phrase}`, 15, 30)
      const taker = team === "Nous" ? Team.NOUS : Team.EUX
      eq(r.error, undefined)
      eq(r.taker, taker)
      eq(r.pointsScored, 120)
      eq(r.isSuccess, true)
      eq(r.winner, taker)
      eq(taker === Team.NOUS ? r.deltaNous : r.deltaEux, 240)
      eq(taker === Team.NOUS ? r.deltaEux : r.deltaNous, 42)
      eq(r.totalNous, 15 + r.deltaNous)
      eq(r.totalEux, 30 + r.deltaEux)
    })
  }
  for (const phrase of ["chuté", "chutée", "chutés", "chuter", "dedans", "perdu", "perdue", "raté", "ratée", "loupé", "tombé", "manqué", "échec", "pas fait", "non réussi", "pas rempli", "n’a pas fait", "n'ont pas réussi", "fait pas", "fait pas du tout"]) {
    Deno.test(`failed contract shorthand: ${team} 120 ${phrase}`, () => {
      const r = parseInput(`${team} 120 ${phrase}`)
      eq(r.error, undefined)
      eq(r.pointsScored, 0)
      eq(r.isSuccess, false)
      eq(team === "Nous" ? r.deltaEux : r.deltaNous, 282)
    })
  }
}

for (const [text, expected] of [
  ["120 fait", { taker: Team.NOUS, pointsScored: 120, isSuccess: true }],
  ["  NOUS\t120\nRÉUSSI ! ", { pointsScored: 120, isSuccess: true }],
  ["nous 120 re\u0301ussi", { isSuccess: true }],
  ["Nous 120 fait belote", { pointsScored: 100, deltaNous: 240, deltaEux: 62 }],
  ["Nous 120 belote fait", { pointsScored: 100, isSuccess: true }],
  ["Nous 120 fait belote eux", { pointsScored: 120, deltaNous: 240, deltaEux: 62 }],
  ["120 fait belote pour eux", { taker: Team.NOUS, beloteOwner: Team.EUX, pointsScored: 120 }],
  ["Nous 180 fait belote", { pointsScored: 160, isSuccess: true, deltaNous: 360, deltaEux: 2 }],
  ["Eux 170 réussi belote", { pointsScored: 150, isSuccess: true, deltaEux: 340 }],
  ["Nous 80 fait belote", { pointsScored: 60, isSuccess: true, deltaNous: 160 }],
  ["Nous 120 130 fait", { pointsScored: 130, deltaNous: 250 }],
  ["Nous 120 nous 90 fait", { pointsScored: 90, isSuccess: false }],
  ["Nous 120 fait 90", { pointsScored: 90, isSuccess: false }],
  ["Nous 100 fait 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 fait: 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 ils ont fait 60", { pointsScored: 102, isSuccess: true }],
  ["Nous 100 eux 100", { pointsScored: 62, isSuccess: false }],
  ["Nous 100 défense 62", { pointsScored: 100, isSuccess: true }],
  ["Eux 100 défense: 62", { pointsScored: 100, isSuccess: true }],
  ["Nous 100 preneur 60", { pointsScored: 60, isSuccess: false }],
  ["Eux 100 points: 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 pts = 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 marqué 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 obtenu 60", { pointsScored: 60, isSuccess: false }],
  ["Nous 100 nous 0", { pointsScored: 0, isSuccess: false }],
  ["Nous 100 défense 0", { pointsScored: 162, isSuccess: true }],
  ["Nous 100 défense 162", { pointsScored: 0, isSuccess: false }],
  ["Nous 100 120 sur 162", { pointsScored: 120, coinche: CoincheStatus.NONE }],
  ["Nous contrat: 100, points: 120", { contract: 100, pointsScored: 120 }],
  ["Nous points 120, contrat 100", { contract: 100, pointsScored: 120 }],
  ["Nous points 100, contrat 100", { contract: 100, pointsScored: 100 }],
  ["Eux annonce de 120 réussi", { contract: 120, isSuccess: true }],
  ["Nous 120 fait mais chute", { pointsScored: 0, isSuccess: false }],
  ["Nous 120 150 raté", { pointsScored: 0, isSuccess: false }],
  ["Nous 120 coinche pas fait", { coinche: CoincheStatus.COINCHE, isSuccess: false, deltaEux: 402 }],
  ["Nous 120 surcoinché pas fait", { coinche: CoincheStatus.SURCOINCHE, isSuccess: false, deltaEux: 642 }],
  ["Nous 120 sans belote fait", { beloteOwner: null, pointsScored: 120, isSuccess: true }],
  ["Nous 120 pas de belote fait", { beloteOwner: null, pointsScored: 120, isSuccess: true }],
  ["Nous 120 belote pas fait", { beloteOwner: Team.NOUS, isSuccess: false, deltaEux: 302 }],
  ["Nous 120 belote et rebelote fait", { beloteOwner: Team.NOUS, pointsScored: 100, deltaNous: 240 }],
  ["Nous 120 belote-rebelote pour eux fait", { beloteOwner: Team.EUX, pointsScored: 120 }],
  ["Nous 120 belote eux et rebelote fait", { beloteOwner: Team.EUX, pointsScored: 120 }],
  ["Eux 120 nous avons la belote fait", { beloteOwner: Team.NOUS, isSuccess: true, pointsScored: 120 }],
  ["belote pour nous, eux 120 fait", { taker: Team.EUX, beloteOwner: Team.NOUS, pointsScored: 120 }],
  ["Nous 120 fait belote défense", { beloteOwner: Team.EUX, pointsScored: 120 }],
  ["Eux 120 fait belote preneur", { beloteOwner: Team.EUX, pointsScored: 100 }],
  ["Nous 120 fait rebelote", { beloteOwner: Team.NOUS, pointsScored: 100 }],
  ["Nous capot fait", { contract: 250, pointsScored: 250, isSuccess: true, deltaNous: 500 }],
  ["Eux capot raté", { contract: 250, pointsScored: 0, isSuccess: false, deltaNous: 412 }],
  ["Nous capot pas fait", { contract: 250, pointsScored: 0, isSuccess: false }],
  ["Nous capote réussi", { contract: 250, isSuccess: true }],
  ["Eux 270 fait", { contract: 270, isSuccess: true, deltaEux: 520 }],
  ["Nous 100 120 sans capot", { contract: 100, isCapot: false }],
  ["Nous 100 120 parfaitement", { pointsScored: 120, isSuccess: true }],
  ["Nous 100 120 surconfiants", { coinche: CoincheStatus.NONE }],
  ["Nous avons fait 62, eux ont pris 100", { taker: Team.EUX, contract: 100, pointsScored: 100 }],
]) {
  Deno.test(`natural-language parsing: ${text}`, () => {
    const r = parseInput(text)
    eq(r.error, undefined)
    eq(r.rawInput, text)
    for (const [key, value] of Object.entries(expected)) eq(r[key], value, key)
  })
}

for (const phrase of ["coinché", "coinchée", "coinchés", "coinchées", "coincher", "contré", "contrée", "cc"]) {
  Deno.test(`coinche variants: ${phrase}`, () => {
    const r = parseInput(`Nous 100 ${phrase} fait`)
    eq(r.coinche, CoincheStatus.COINCHE)
    eq(r.deltaNous, 300)
  })
}

for (const phrase of ["surcoinché", "surcoinchée", "sur-coinché", "sur coinchée", "surcontré", "sur-contré", "sc", "sur"]) {
  Deno.test(`surcoinche variants: ${phrase}`, () => {
    const r = parseInput(`Eux 100 ${phrase} fait`)
    eq(r.coinche, CoincheStatus.SURCOINCHE)
    eq(r.deltaEux, 500)
  })
}

for (const phrase of ["sans belote", "pas de belote", "aucune belote", "non coinché", "pas coinché", "sans coinche", "non surcoinché", "pas sur-coinché"]) {
  Deno.test(`negated modifiers: ${phrase}`, () => {
    const r = parseInput(`Nous 100 120 ${phrase}`)
    eq(r.beloteOwner, null)
    eq(r.coinche, CoincheStatus.NONE)
    eq(r.deltaNous, 220)
  })
}

for (const phrase of ["notre équipe", "notre camp", "on"]) {
  Deno.test(`our team alias: ${phrase}`, () => {
    eq(parseInput(`${phrase} 100 fait`).taker, Team.NOUS)
  })
}

for (const phrase of ["adversaire", "adversaires", "elles", "les autres", "l’autre équipe", "leur équipe", "leur camp", "adv"]) {
  Deno.test(`opponent alias and belote: ${phrase}`, () => {
    eq(parseInput(`${phrase} 100 fait`).taker, Team.EUX)
    eq(parseInput(`Nous 100 fait belote pour ${phrase}`).beloteOwner, Team.EUX)
    eq(parseInput(`Nous 100 ${phrase} 60`).pointsScored, 102)
  })
}

for (const text of ["", "fait", "Nous 120", "Nous 120 parfait", "Nous 120 défaite", "Nous 100 eux ont fait", "Nous 170 fait", "Nous 180 fait belote eux", "Nous 100 163", "Nous 100 défense 200", "Nous contrat 70 points 120", "Nous 100 120 belote nous belote eux"]) {
  Deno.test(`reject incomplete or impossible phrase: ${text}`, () => {
    assert(parseInput(text).error, `expected error for ${text}`)
  })
}
