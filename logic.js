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

const TEAM_WORD = "(?:nous|on|eux|ils|adv)"
const teamFromWord = (word) => /^(nous|on)$/.test(word) ? Team.NOUS : Team.EUX

function normalizeInput(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\bsur[\s-]+(coinch|contr)/g, "sur$1")
    .replace(/\b(?:notre equipe|notre camp)\b/g, "nous")
    .replace(/\b(?:l autre equipe|les autres|leur equipe|leur camp|adversaires?|elles)\b/g, "eux")
    .replace(/\b(?:capots|capote)\b/g, "capot")
    .replace(/\s+/g, " ")
    .trim()
}

function isNegated(text, match) {
  const before = text.slice(0, match.index)
  const after = text.slice(match.index + match[0].length)
  return /\b(?:pas|plus|jamais|sans|non|aucune?)\s+(?:(?:de|d|du|le|la|le contrat|notre contrat|leur contrat)\s+)?$/.test(before)
    || /^\s+(?:pas(?:\s+du\s+tout)?|non)\s*(?:[,;.!?]|$)/.test(after)
}

function hasPositiveWord(text, pattern) {
  return Array.from(text.matchAll(pattern)).some((match) => !isNegated(text, match))
}

function detectOutcome(text, taker) {
  let success = false
  let failure = false
  const words = /\b(?:(?:fait|reussi|rempli|realise|gagne|passe|honore|accompli|perdu|rate|loupe|tombe|manque)e?s?|chut(?:e|ee|es|ees|er)|ok|dedans|echec)\b/g
  for (const match of text.matchAll(words)) {
    const positive = /^(?:fait|reussi|rempli|realise|gagne|passe|honore|accompli|ok)/.test(match[0])
    // "Ils ont fait 60" describes card points, not a successful contract.
    if (positive && /^\s*[:=]?\s*\d/.test(text.slice(match.index + match[0].length))) continue
    const clause = text.slice(0, match.index).split(/[,;.!?]/).at(-1)
    const teams = Array.from(clause.matchAll(new RegExp(`\\b${TEAM_WORD}\\b`, "g")))
    if (teams.length && teamFromWord(teams.at(-1)[0]) !== taker) continue
    if (positive !== isNegated(text, match)) success = true
    else failure = true
  }
  // Preserve the established rule: an explicit failure overrides points/success.
  return { success, failure }
}

export function parseInput(text, currentTotalNous = 0, currentTotalEux = 0) {
  const normalized = normalizeInput(text)

  // Keep belote ownership separate from the taker and from card-point labels.
  const belotePattern = new RegExp(`\\b(?:belote(?:[\\s-]+(?:et\\s+)?rebelote)?|rebelote)\\b(?:\\s+(?:(?:a|pour|chez|de)\\s+)?(${TEAM_WORD}|preneur|defense))?`, "g")
  const belotes = Array.from(normalized.matchAll(belotePattern))
  // Clause boundaries prevent a modifier's negation leaking into the outcome.
  const scoringText = normalized.replace(belotePattern, (match) => ".".repeat(match.length))

  // 1. Detect taker
  let taker = Team.NOUS
  const teamPattern = new RegExp(`\\b${TEAM_WORD}\\b`)
  const takingTeam = new RegExp(`\\b(${TEAM_WORD})\\s+(?:(?:avons|avez|ont|a|sommes|sont)\\s+)?(?:pris|prend|prenons|prennent|partons|partent|part|preneurs?)\\b`).exec(scoringText)
  const firstTeam = teamPattern.exec(scoringText)
  if (takingTeam) taker = teamFromWord(takingTeam[1])
  else if (firstTeam) taker = teamFromWord(firstTeam[0])
  const defense = taker === Team.NOUS ? Team.EUX : Team.NOUS

  // 2. Accents, inflections and negations are supported for modifiers.
  const hasCoinche = hasPositiveWord(normalized, /\b(?:coinch(?:e|ee|es|ees|er)|cc|contree?s?)\b/g)
  // "sur" remains shorthand, but "sur 162" is a point denominator.
  const hasSurcoinche = hasPositiveWord(normalized, /\b(?:surcoinch(?:e|ee|es|ees|er)|surcontree?s?|sc|sur(?!\s+162\b))\b/g)

  // 3. Detect belote
  let beloteOwner = null
  for (const match of belotes) {
    if (isNegated(normalized, match)) continue
    const before = normalized.slice(0, match.index)
    const precedingOwner = new RegExp(`\\b(${TEAM_WORD}|preneur|defense)\\s+(?:(?:a|ont|avons)\\s+(?:la\\s+)?)?$`).exec(before)
    const owner = match[1] || precedingOwner?.[1]
    const team = owner === "defense" ? defense : !owner ? beloteOwner || taker : owner === "preneur" ? taker : teamFromWord(owner)
    if (beloteOwner && beloteOwner !== team) {
      return { error: "La belote ne peut appartenir qu’à une seule équipe." }
    }
    beloteOwner = team
  }

  // 4. Numbers and contract
  const numberMatches = Array.from(scoringText.matchAll(/\d+/g))
  const numbers = numberMatches.map((m) => Number.parseInt(m[0], 10))
  const hasCapotWord = hasPositiveWord(normalized, /\bcapot\b/g)
  const labeledContract = /\b(?:contrat|annonce|mise|prise)\s*(?:(?:de|a)\s*)?[:=]?\s*(\d+)\b/.exec(scoringText)
  let foundContract = labeledContract ? Number(labeledContract[1]) : numbers.find((n) => CONTRACT_SET.has(n))
  // Capot describes the result, not a replacement for an announced contract.
  // Keep the historical 250 default only when no contract was supplied.
  if (hasCapotWord && foundContract === undefined) foundContract = 250

  if (!CONTRACT_SET.has(foundContract)) {
    return { error: 'Aucun contrat valide trouvé (attendu : 80–180, 250 ou 270, ou mot-clé "capot").' }
  }

  const contract = foundContract
  const isCapot = contract === 250 || contract === 270 || hasCapotWord
  const { success: hasSuccessWord, failure: hasChuteWord } = detectOutcome(scoringText, taker)

  // 5. Contract-only case
  if (numbers.length === 1 && !isCapot && !hasChuteWord && !hasSuccessWord) {
    return { error: 'Contrat seul sans points. Précisez les points ou indiquez "fait", "chute" ou "dedans".' }
  }

  // 6. Non-contract number
  const contractIndex = labeledContract
    ? numberMatches.findIndex((m) => m.index === labeledContract.index + labeledContract[0].lastIndexOf(labeledContract[1]))
    : numbers.findIndex((n) => n === contract)
  let otherNum
  let pointsOwner = null
  let explicitTakerPoints = false
  for (let i = 0; i < numbers.length; i++) {
    if (i === contractIndex) continue
    const start = i === 0 ? 0 : numberMatches[i - 1].index + numberMatches[i - 1][0].length
    const prefix = scoringText.slice(start, numberMatches[i].index)
    if (/\bsur\s*$/.test(prefix) && numbers[i] === TOTAL_CARDS_POINTS) continue
    otherNum = numbers[i]
    const labels = Array.from(prefix.matchAll(new RegExp(`\\b(${TEAM_WORD}|preneur|defense)\\b`, "g")))
    const owner = labels.at(-1)?.[1]
    if (owner) pointsOwner = owner === "preneur" ? taker : owner === "defense" ? defense : teamFromWord(owner)
    explicitTakerPoints = /\b(?:fait|marque|score|obtenu|recolte|points?|pts)\s*[:=]?\s*$/.test(prefix)
    break
  }

  // 8. Compute taker points
  let pointsScored = null
  if (isCapot) {
    pointsScored = hasChuteWord ? 0 : 250
  } else if (hasChuteWord) {
    pointsScored = 0
  } else if (otherNum !== undefined) {
    if (otherNum > TOTAL_CARDS_POINTS) {
      return { error: "Les points de cartes doivent être compris entre 0 et 162 (hors belote)." }
    }
    if (pointsOwner === taker || (!pointsOwner && explicitTakerPoints)) pointsScored = otherNum
    else if (pointsOwner === defense) pointsScored = TOTAL_CARDS_POINTS - otherNum
    else pointsScored = otherNum < 82 ? TOTAL_CARDS_POINTS - otherNum : otherNum
  } else if (hasSuccessWord) {
    // With no exact score, assume the minimum cards needed, including belote.
    pointsScored = contract - (beloteOwner === taker ? BELOTE_POINTS : 0)
    if (pointsScored > TOTAL_CARDS_POINTS) {
      return { error: "Ce contrat nécessite la belote du preneur pour être fait. Précisez la belote ou les points." }
    }
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
