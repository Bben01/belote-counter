import { Team, CoincheStatus, type RoundResult } from "../types"

const TOTAL_CARDS_POINTS = 162
const BELOTE_POINTS = 20

const VALID_CONTRACTS = [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 250, 270]
const CONTRACT_SET = new Set(VALID_CONTRACTS)

export type ParseResult = RoundResult | { error: string }

const nowId = () => Date.now().toString()

export const parseInput = (text: string, currentTotalNous = 0, currentTotalEux = 0): ParseResult => {
  const normalized = text.toLowerCase().trim()

  // -----------------------------
  // 1. Détection du preneur
  // -----------------------------
  let taker: Team = Team.NOUS

  if (/\b(eux|ils|adv)\b/.test(normalized)) taker = Team.EUX
  if (/\b(nous|on)\b/.test(normalized)) taker = Team.NOUS

  // -----------------------------
  // 2. Détection coinche / surcoinche (strict)
  // -----------------------------
  const hasCoinche = /\b(coinche|cc)\b/.test(normalized)
  const hasSurcoinche = /\b(surcoinche|sur|sc)\b/.test(normalized)

  // -----------------------------
  // 3. Détection belote
  // -----------------------------
  let beloteOwner: Team | null = null
  if (/\bbelote\b/.test(normalized)) {
    if (/\bbelote\s+(nous|on)\b|\b(nous|on)\s+belote\b/.test(normalized)) {
      beloteOwner = Team.NOUS
    } else if (/\bbelote\s+(eux|ils|adv)\b|\b(eux|ils|adv)\s+belote\b/.test(normalized)) {
      beloteOwner = Team.EUX
    } else {
      beloteOwner = taker
    }
  }

  // -----------------------------
  // 4. Extraction des nombres
  // -----------------------------
  const numbers = [...normalized.matchAll(/\d+/g)].map((m) => Number.parseInt(m[0], 10))

  const hasCapotWord = /\bcapot\b/.test(normalized)
  let foundContract = numbers.find((n) => CONTRACT_SET.has(n))

  if (!foundContract && hasCapotWord) {
    foundContract = 250
  }

  if (!foundContract) {
    return {
      error: 'Aucun contrat valide trouvé (attendu : 80–180, 250 ou 270, ou mot-clé "capot").',
    }
  }

  // Coinche strict : contrat obligatoire
  if (hasCoinche && !foundContract) {
    return { error: "Coinche indiquée mais aucun contrat explicite trouvé." }
  }
  if (hasSurcoinche && !foundContract) {
    return { error: "Surcoinche indiquée mais aucun contrat explicite trouvé." }
  }

  const contract = foundContract
  const isCapot = contract === 250 || contract === 270 || hasCapotWord

  // -----------------------------
  // 5. Cas : contrat seul
  // -----------------------------
  const hasChuteWord = /\b(chute|dedans)\b/.test(normalized)

  if (numbers.length === 1 && !isCapot && !hasChuteWord) {
    return {
      error: 'Contrat seul sans points. Précisez les points ou indiquez explicitement "chute" ou "dedans".',
    }
  }

  // -----------------------------
  // 6. Points explicitement attribués
  // -----------------------------
  const explicitNous = normalized.match(/\b(nous|on)\D*(\d{1,3})\b/)
  const explicitEux = normalized.match(/\b(eux|ils|adv)\D*(\d{1,3})\b/)

  const explicitNousPoints = explicitNous ? Number.parseInt(explicitNous[2], 10) : null
  const explicitEuxPoints = explicitEux ? Number.parseInt(explicitEux[2], 10) : null

  // -----------------------------
  // 7. Nombre "reste" (non-contrat)
  // -----------------------------
  const contractIndex = numbers.findIndex((n) => n === contract)
  let otherNum: number | undefined

  for (let i = 0; i < numbers.length; i++) {
    if (i !== contractIndex) {
      otherNum = numbers[i]
      break
    }
  }

  // -----------------------------
  // 8. Calcul des points preneur
  // -----------------------------
  let pointsScored: number | null = null

  if (hasChuteWord) {
    pointsScored = 0
  } else if (taker === Team.NOUS) {
    if (explicitNousPoints !== null && explicitNousPoints !== contract) {
      pointsScored = explicitNousPoints
    } else if (explicitEuxPoints !== null && explicitEuxPoints !== contract) {
      pointsScored = TOTAL_CARDS_POINTS - explicitEuxPoints
    } else if (otherNum !== undefined) {
      pointsScored = otherNum < 82 ? TOTAL_CARDS_POINTS - otherNum : otherNum
    }
  } else {
    if (explicitEuxPoints !== null && explicitEuxPoints !== contract) {
      pointsScored = explicitEuxPoints
    } else if (explicitNousPoints !== null && explicitNousPoints !== contract) {
      pointsScored = TOTAL_CARDS_POINTS - explicitNousPoints
    } else if (otherNum !== undefined) {
      pointsScored = otherNum < 82 ? TOTAL_CARDS_POINTS - otherNum : otherNum
    }
  }

  if (pointsScored === null) {
    if (isCapot) {
      pointsScored = 250
    } else {
      return {
        error: "Impossible de déterminer les points. Précisez les points du preneur ou de la défense.",
      }
    }
  }

  // -----------------------------
  // 9. Statut coinche final
  // -----------------------------
  let coinche = CoincheStatus.NONE
  if (hasSurcoinche) coinche = CoincheStatus.SURCOINCHE
  else if (hasCoinche) coinche = CoincheStatus.COINCHE

  // -----------------------------
  // 10. Calcul du score
  // -----------------------------
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

// ======================================================
// CALCUL DU SCORE
// ======================================================
const calculateScore = (
  data: Omit<RoundResult, "deltaNous" | "deltaEux" | "totalNous" | "totalEux" | "isSuccess" | "winner"> & {
    totalNous: number
    totalEux: number
  },
): RoundResult => {
  const { taker, contract, pointsScored, beloteOwner, coinche, totalNous, totalEux, isCapot } = data

  let multiplier = 1
  if (coinche === CoincheStatus.COINCHE) multiplier = 2
  if (coinche === CoincheStatus.SURCOINCHE) multiplier = 4

  const takerBelote = beloteOwner === taker ? BELOTE_POINTS : 0

  let isSuccess: boolean

  if (isCapot) {
    isSuccess = pointsScored >= TOTAL_CARDS_POINTS
  } else {
    isSuccess = pointsScored + takerBelote >= contract
  }

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

    if (taker === Team.NOUS) {
      deltaEux = defensePoints
    } else {
      deltaNous = defensePoints
    }
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
