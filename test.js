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
  eq(r.contract, 250)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
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

Deno.test("capot keyword forces capot (defaults to 250)", () => {
  const r = parseInput("nous 80 capot 120", 0, 0)
  eq(r.contract, 250)
  eq(r.isCapot, true)
  eq(r.isSuccess, true)
})

Deno.test("capot keyword prefers 270 if present", () => {
  const r = parseInput("nous 80 capot 250", 0, 0)
  eq(r.contract, 250)
  eq(r.isCapot, true)
})

Deno.test("capot keyword prefers 270 if present (even with other contracts)", () => {
  const r = parseInput("eux 80 capot 270 120", 0, 0)
  eq(r.contract, 270)
  eq(r.isCapot, true)
})

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
