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
export const CAPOT_POINTS = 250
export const BELOTE_POINTS = 20
export const MANUAL_PREFIX = "="

export const VALID_CONTRACTS = Object.freeze([80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 250, 270])
const CONTRACT_SET = new Set(VALID_CONTRACTS)

const nowId = () =>
  globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + "-" + String(Math.floor(Math.random() * 1e6))

export function calculateScore(data) {
  const { taker, contract, pointsScored, beloteOwner, coinche, totalNous, totalEux, isCapot, isDefenseCapot } = data

  let multiplier = 1
  if (coinche === CoincheStatus.COINCHE) multiplier = 2
  if (coinche === CoincheStatus.SURCOINCHE) multiplier = 4

  const isCoinched = multiplier > 1
  const takerBelote = beloteOwner === taker ? BELOTE_POINTS : 0

  let isSuccess
  if (isDefenseCapot) isSuccess = false
  else if (isCapot) isSuccess = pointsScored >= TOTAL_CARDS_POINTS
  else isSuccess = pointsScored + takerBelote >= contract

  let deltaNous = 0
  let deltaEux = 0
  let winner = taker

  if (isSuccess) {
    const cardTaker = isCapot ? CAPOT_POINTS : isCoinched ? TOTAL_CARDS_POINTS : pointsScored
    const cardDefense = isCapot || isCoinched ? 0 : TOTAL_CARDS_POINTS - pointsScored

    let takerPoints = cardTaker + contract * multiplier
    let defensePoints = cardDefense

    // In a coinche, the winning team takes the belote.
    if (beloteOwner === taker || (beloteOwner && isCoinched)) takerPoints += BELOTE_POINTS
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
    let defensePoints = (isDefenseCapot ? CAPOT_POINTS : TOTAL_CARDS_POINTS) + contract * multiplier
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
const resolveOwner = (word, taker, defense) =>
  word === "preneur" ? taker : word === "defense" ? defense : teamFromWord(word)

const RE = {
  negatedBefore: /\b(?:pas|plus|jamais|sans|non|aucune?)\s+(?:(?:de|d|du|le|la|le contrat|notre contrat|leur contrat)\s+)?$/,
  negatedAfter: /^\s+(?:pas(?:\s+du\s+tout)?|non)\s*(?:[,;.!?]|$)/,
  outcomeWords: /\b(?:(?:fait|reussi|rempli|realise|gagne|passe|honore|accompli|perdu|rate|loupe|tombe|manque)e?s?|chut(?:e|ee|es|ees|er)|ok|dedans|echec)\b/g,
  positiveOutcome: /^(?:fait|reussi|rempli|realise|gagne|passe|honore|accompli|ok)/,
  teamGlobal: new RegExp(`\\b${TEAM_WORD}\\b`, "g"),
  team: new RegExp(`\\b${TEAM_WORD}\\b`),
  manualLabeled: new RegExp(`\\b(${TEAM_WORD})\\b\\s*[:=]?\\s*(-?\\d+)\\b`, "g"),
  belote: new RegExp(`\\b(?:belote(?:[\\s-]+(?:et\\s+)?rebelote)?|rebelote)\\b(?:\\s+(?:(?:a|pour|chez|de)\\s+)?(${TEAM_WORD}|preneur|defense))?`, "g"),
  beloteOwnerBefore: new RegExp(`\\b(${TEAM_WORD}|preneur|defense)\\s+(?:(?:a|ont|avons)\\s+(?:la\\s+)?)?$`),
  takingTeam: new RegExp(`\\b(${TEAM_WORD})\\s+(?:(?:avons|avez|ont|a|sommes|sont)\\s+)?(?:pris|prend|prenons|prennent|partons|partent|part|preneurs?)\\b`),
  coinche: /\b(?:coinch(?:e|ee|es|ees|er)|cc|contree?s?(?![\s-]?capot))\b/g,
  // "sur" remains shorthand, but "sur 162" is a point denominator.
  surcoinche: /\b(?:surcoinch(?:e|ee|es|ees|er)|surcontree?s?|sc|sur(?!\s+162\b))\b/g,
  capot: /\bcapot\b/g,
  capotInverse: /^\s+(?:inverse|subi)\b/,
  contreCapot: /\bcontre[\s-]?$/,
  capotOwnerBefore: new RegExp(`\\b(${TEAM_WORD}|preneur|defense)\\s+(?:(?:a|ont|avons|font|fait|faisons|met|mettent|mettons)\\s+)?(?:(?:un|le)\\s+)?$`),
  capotOwnerAfter: new RegExp(`^\\s+(?:(?:pour|a|par|chez)\\s+)?(?:la\\s+)?(${TEAM_WORD}|preneur|defense)\\b`),
  labeledContract: /\b(?:contrat|annonce|mise|prise)\s*(?:(?:de|a)\s*)?[:=]?\s*(\d+)\b/,
  pointsLabel: new RegExp(`\\b(${TEAM_WORD}|preneur|defense)\\b`, "g"),
  explicitTakerPoints: /\b(?:fait|marque|score|obtenu|recolte|points?|pts)\s*[:=]?\s*$/,
}

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
  return RE.negatedBefore.test(before) || RE.negatedAfter.test(after)
}

function hasPositiveWord(text, pattern) {
  return Array.from(text.matchAll(pattern)).some((match) => !isNegated(text, match))
}

function detectOutcome(text, taker) {
  let success = false
  let failure = false
  for (const match of text.matchAll(RE.outcomeWords)) {
    const positive = RE.positiveOutcome.test(match[0])
    // "Ils ont fait 60" describes card points, not a successful contract.
    if (positive && /^\s*[:=]?\s*\d/.test(text.slice(match.index + match[0].length))) continue
    const clause = text.slice(0, match.index).split(/[,;.!?]/).at(-1)
    const teams = Array.from(clause.matchAll(RE.teamGlobal))
    if (teams.length && teamFromWord(teams.at(-1)[0]) !== taker) continue
    if (positive !== isNegated(text, match)) success = true
    else failure = true
  }
  // Preserve the established rule: an explicit failure overrides points/success.
  return { success, failure }
}

// "capot" belongs to the taker unless attributed to the defense ("eux capot" when Nous take, "capot inversé").
function classifyCapots(text, taker, defense) {
  let takerCapot = false
  let defenseCapot = false
  for (const match of text.matchAll(RE.capot)) {
    if (isNegated(text, match)) continue
    const before = text.slice(0, match.index)
    const after = text.slice(match.index + match[0].length)
    if (RE.contreCapot.test(before) || RE.capotInverse.test(after)) {
      defenseCapot = true
      continue
    }
    const owner = RE.capotOwnerBefore.exec(before)?.[1] ?? RE.capotOwnerAfter.exec(after)?.[1]
    if (owner && resolveOwner(owner, taker, defense) === defense) defenseCapot = true
    else takerCapot = true
  }
  return { takerCapot, defenseCapot }
}

// "= nous 120 eux 42" or "= 120 42" (Nous then Eux) bypasses the parser.
function parseManual(text, body, currentTotalNous, currentTotalEux) {
  const normalized = normalizeInput(body)
  const labeled = Array.from(normalized.matchAll(RE.manualLabeled))
  let deltaNous = 0
  let deltaEux = 0
  if (labeled.length) {
    const seen = new Set()
    for (const match of labeled) {
      const team = teamFromWord(match[1])
      if (seen.has(team)) return { error: "Score manuel : chaque équipe ne peut apparaître qu’une fois." }
      seen.add(team)
      if (team === Team.NOUS) deltaNous = Number(match[2])
      else deltaEux = Number(match[2])
    }
  } else {
    const numbers = normalized.match(/-?\d+/g) ?? []
    if (numbers.length !== 2) {
      return { error: 'Score manuel : utilisez "= 120 42" (Nous puis Eux) ou "= nous 120 eux 42".' }
    }
    ;[deltaNous, deltaEux] = numbers.map(Number)
  }

  return {
    id: nowId(),
    rawInput: text,
    manual: true,
    contract: null,
    isCapot: false,
    deltaNous,
    deltaEux,
    totalNous: currentTotalNous + deltaNous,
    totalEux: currentTotalEux + deltaEux,
    winner: deltaNous > deltaEux ? Team.NOUS : deltaEux > deltaNous ? Team.EUX : null,
  }
}

export function parseInput(text, currentTotalNous = 0, currentTotalEux = 0) {
  const trimmed = String(text ?? "").trim()
  if (trimmed.startsWith(MANUAL_PREFIX)) {
    return parseManual(text, trimmed.slice(MANUAL_PREFIX.length), currentTotalNous, currentTotalEux)
  }

  const normalized = normalizeInput(text)

  // Keep belote ownership separate from the taker and from card-point labels.
  const belotes = Array.from(normalized.matchAll(RE.belote))
  // Clause boundaries prevent a modifier's negation leaking into the outcome.
  const scoringText = normalized.replace(RE.belote, (match) => ".".repeat(match.length))

  // 1. Detect taker
  let taker = Team.NOUS
  const takingTeam = RE.takingTeam.exec(scoringText)
  const firstTeam = RE.team.exec(scoringText)
  if (takingTeam) taker = teamFromWord(takingTeam[1])
  else if (firstTeam) taker = teamFromWord(firstTeam[0])
  const defense = taker === Team.NOUS ? Team.EUX : Team.NOUS

  // 2. Accents, inflections and negations are supported for modifiers.
  const hasCoinche = hasPositiveWord(normalized, RE.coinche)
  const hasSurcoinche = hasPositiveWord(normalized, RE.surcoinche)

  // 3. Detect belote
  let beloteOwner = null
  for (const match of belotes) {
    if (isNegated(normalized, match)) continue
    const before = normalized.slice(0, match.index)
    const owner = match[1] || RE.beloteOwnerBefore.exec(before)?.[1]
    const team = owner ? resolveOwner(owner, taker, defense) : beloteOwner || taker
    if (beloteOwner && beloteOwner !== team) {
      return { error: "La belote ne peut appartenir qu’à une seule équipe." }
    }
    beloteOwner = team
  }

  // 4. Numbers and contract
  const numberMatches = Array.from(scoringText.matchAll(/\d+/g))
  const numbers = numberMatches.map((m) => Number.parseInt(m[0], 10))
  const { takerCapot, defenseCapot } = classifyCapots(scoringText, taker, defense)
  if (takerCapot && defenseCapot) {
    return { error: "Le capot ne peut être attribué qu’à une seule équipe." }
  }
  const labeledContract = RE.labeledContract.exec(scoringText)
  let foundContract = labeledContract ? Number(labeledContract[1]) : numbers.find((n) => CONTRACT_SET.has(n))
  // Capot describes the result, not a replacement for an announced contract.
  // Keep the historical 250 default only when no contract was supplied.
  if (takerCapot && foundContract === undefined) foundContract = CAPOT_POINTS

  if (!CONTRACT_SET.has(foundContract)) {
    return { error: 'Aucun contrat valide trouvé (attendu : 80–180, 250 ou 270, ou mot-clé "capot").' }
  }

  const contract = foundContract
  const isCapot = contract === 250 || contract === 270 || takerCapot
  const { success: hasSuccessWord, failure: hasChuteWord } = detectOutcome(scoringText, taker)
  if (defenseCapot && hasSuccessWord && !hasChuteWord) {
    return { error: "Contrat fait et capot de la défense sont incompatibles." }
  }

  // 5. Contract-only case
  if (numbers.length === 1 && !isCapot && !defenseCapot && !hasChuteWord && !hasSuccessWord) {
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
    const labels = Array.from(prefix.matchAll(RE.pointsLabel))
    const owner = labels.at(-1)?.[1]
    if (owner) pointsOwner = resolveOwner(owner, taker, defense)
    explicitTakerPoints = RE.explicitTakerPoints.test(prefix)
    break
  }

  // 8. Compute taker points
  let pointsScored = null
  if (defenseCapot) {
    pointsScored = 0
  } else if (isCapot) {
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
    isDefenseCapot: defenseCapot,
    pointsScored,
    beloteOwner,
    coinche,
    totalNous: currentTotalNous,
    totalEux: currentTotalEux,
  })
}
