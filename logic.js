// Pure scoring/parsing logic. No DOM, no storage.

export const Team = Object.freeze({
  NOUS: "NOUS",
  EUX: "EUX",
})

export const CoincheStatus = Object.freeze({
  NONE: "NONE",
  COINCHE: "COINCHE",
  SURCOINCHE: "SURCOINCHE",
})

export const TOTAL_CARDS_POINTS = 162
export const BELOTE_POINTS = 20

export const VALID_CONTRACTS = Object.freeze([80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 250, 270])
const CONTRACT_SET = new Set(VALID_CONTRACTS)

const nowId = () => String(Date.now()) + "-" + String(Math.floor(Math.random() * 1e6))

export function calculateScore(data) {
  const { taker, contract, pointsScored, beloteOwner, coinche, totalNous, totalEux, isCapot } = data

  let multiplier = 1
  if (coinche === CoincheStatus.COINCHE) multiplier = 2
  if (coinche === CoincheStatus.SURCOINCHE) multiplier = 4

  const takerBelote = beloteOwner === taker ? BELOTE_POINTS : 0

  let isSuccess
  if (isCapot) isSuccess = pointsScored >= TOTAL_CARDS_POINTS
  else isSuccess = pointsScored + takerBelote >= contract

  let deltaNous = 0
  let deltaEux = 0
  let winner = taker

  if (isSuccess) {
    const cardTaker = isCapot ? 250 : pointsScored
    const cardDefense = isCapot ? 0 : TOTAL_CARDS_POINTS - pointsScored

    let takerPoints = cardTaker + contract * multiplier
    let defensePoints = cardDefense

    if (beloteOwner === taker) takerPoints += BELOTE_POINTS
    else if (beloteOwner) defensePoints += BELOTE_POINTS

    if (taker === Team.NOUS) {
      deltaNous = takerPoints
      deltaEux = defensePoints
    } else {
      deltaEux = takerPoints
      deltaNous = defensePoints
    }
  } else {
    winner = taker === Team.NOUS ? Team.EUX : Team.NOUS
    let defensePoints = 162 + contract * multiplier
    if (beloteOwner) defensePoints += BELOTE_POINTS

    if (taker === Team.NOUS) deltaEux = defensePoints
    else deltaNous = defensePoints
  }

  return {
    ...data,
    isSuccess,
    deltaNous,
    deltaEux,
    totalNous: totalNous + deltaNous,
    totalEux: totalEux + deltaEux,
    winner,
  }
}

export function parseInput(text, currentTotalNous = 0, currentTotalEux = 0) {
  const normalized = String(text).toLowerCase().trim()

  // 1. Detect taker
  let taker = Team.NOUS
  const mEux = /\b(eux|ils|adv)\b/.exec(normalized)
  const mNous = /\b(nous|on)\b/.exec(normalized)
  if (mEux && mNous) taker = (mEux.index ?? 0) < (mNous.index ?? 0) ? Team.EUX : Team.NOUS
  else if (mEux) taker = Team.EUX
  else if (mNous) taker = Team.NOUS

  // 2. Detect coinche / surcoinche (strict)
  const hasCoinche = /\b(coinche|cc)\b/.test(normalized)
  const hasSurcoinche = /\b(surcoinche|sur|sc)\b/.test(normalized)

  // 3. Detect belote
  let beloteOwner = null
  if (/\bbelote\b/.test(normalized)) {
    if (/\bbelote\s+(nous|on)\b|\b(nous|on)\s+belote\b/.test(normalized)) beloteOwner = Team.NOUS
    else if (/\bbelote\s+(eux|ils|adv)\b|\b(eux|ils|adv)\s+belote\b/.test(normalized)) beloteOwner = Team.EUX
    else beloteOwner = taker
  }

  // 4. Numbers and contract
  const numbers = Array.from(normalized.matchAll(/\d+/g)).map((m) => Number.parseInt(m[0], 10))
  const hasCapotWord = /\bcapot\b/.test(normalized)
  let foundContract = numbers.find((n) => CONTRACT_SET.has(n))
  if (!foundContract && hasCapotWord) foundContract = 250

  if (!foundContract) {
    return { error: 'Aucun contrat valide trouvé (attendu : 80–180, 250 ou 270, ou mot-clé "capot").' }
  }

  // Coinche strict: contract required (kept for parity with original logic)
  if (hasCoinche && !foundContract) return { error: "Coinche indiquée mais aucun contrat explicite trouvé." }
  if (hasSurcoinche && !foundContract) return { error: "Surcoinche indiquée mais aucun contrat explicite trouvé." }

  const contract = foundContract
  const isCapot = contract === 250 || contract === 270 || hasCapotWord

  // 5. Contract-only case
  const hasChuteWord = /\b(chute|dedans)\b/.test(normalized)
  if (numbers.length === 1 && !isCapot && !hasChuteWord) {
    return { error: 'Contrat seul sans points. Précisez les points ou indiquez explicitement "chute" ou "dedans".' }
  }

  // 6. Explicit team points
  const allNous = Array.from(normalized.matchAll(/\b(nous|on)\D*?(\d{1,3})\b/g))
  const allEux = Array.from(normalized.matchAll(/\b(eux|ils|adv)\D*?(\d{1,3})\b/g))

  let explicitNousPoints = null
  for (const m of allNous) {
    const p = Number.parseInt(m[2], 10)
    if (explicitNousPoints === null || p !== contract) explicitNousPoints = p
  }

  let explicitEuxPoints = null
  for (const m of allEux) {
    const p = Number.parseInt(m[2], 10)
    if (explicitEuxPoints === null || p !== contract) explicitEuxPoints = p
  }

  // 7. Non-contract number
  const contractIndex = numbers.findIndex((n) => n === contract)
  let otherNum
  for (let i = 0; i < numbers.length; i++) {
    if (i !== contractIndex) {
      otherNum = numbers[i]
      break
    }
  }

  // 8. Compute taker points
  let pointsScored = null
  if (hasChuteWord) {
    pointsScored = 0
  } else if (taker === Team.NOUS) {
    if (explicitNousPoints !== null && explicitNousPoints !== contract) pointsScored = explicitNousPoints
    else if (explicitEuxPoints !== null && explicitEuxPoints !== contract) pointsScored = TOTAL_CARDS_POINTS - explicitEuxPoints
    else if (otherNum !== undefined) pointsScored = otherNum < 82 ? TOTAL_CARDS_POINTS - otherNum : otherNum
  } else {
    if (explicitEuxPoints !== null && explicitEuxPoints !== contract) pointsScored = explicitEuxPoints
    else if (explicitNousPoints !== null && explicitNousPoints !== contract) pointsScored = TOTAL_CARDS_POINTS - explicitNousPoints
    else if (otherNum !== undefined) pointsScored = otherNum < 82 ? TOTAL_CARDS_POINTS - otherNum : otherNum
  }

  if (pointsScored === null) {
    if (isCapot) pointsScored = 250
    else return { error: "Impossible de déterminer les points. Précisez les points du preneur ou de la défense." }
  }

  // 9. Final coinche status
  let coinche = CoincheStatus.NONE
  if (hasSurcoinche) coinche = CoincheStatus.SURCOINCHE
  else if (hasCoinche) coinche = CoincheStatus.COINCHE

  // 10. Score
  return calculateScore({
    id: nowId(),
    rawInput: text,
    taker,
    contract,
    isCapot,
    pointsScored,
    beloteOwner,
    coinche,
    totalNous: currentTotalNous,
    totalEux: currentTotalEux,
  })
}
