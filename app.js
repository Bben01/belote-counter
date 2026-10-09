import { CoincheStatus, DEFAULT_RULES, Team, parseInput } from "./logic.js"

const STORAGE_KEY = "belote-game-state"
const HINT_KEY = "belote-hint-index"
const SETTINGS_KEY = "belote-settings"
const UNDO_MS = 5000
const SWIPE_OPEN = 168

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const finePointer = window.matchMedia("(pointer: fine)").matches
const darkMq = window.matchMedia("(prefers-color-scheme: dark)")
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const canVibrate = typeof navigator.vibrate === "function"

const state = {
  rounds: [],
  totalNous: 0,
  totalEux: 0,
  targetScore: 2000,
  winner: null,
  winDismissed: false,
}

const settings = {
  rules: { ...DEFAULT_RULES },
  haptics: true,
  theme: "auto",
}

let editingId = null
// Mobile round card currently swiped open.
let openItem = null

const els = {
  scoreNous: document.getElementById("scoreNous"),
  scoreEux: document.getElementById("scoreEux"),
  fillNous: document.getElementById("fillNous"),
  fillEux: document.getElementById("fillEux"),
  remainNous: document.getElementById("remainNous"),
  remainEux: document.getElementById("remainEux"),
  leadText: document.getElementById("leadText"),
  objectiveText: document.getElementById("objectiveText"),
  objectiveView: document.getElementById("objectiveView"),
  objectiveEdit: document.getElementById("objectiveEdit"),
  objectiveInput: document.getElementById("objectiveInput"),
  editObjectiveBtn: document.getElementById("editObjectiveBtn"),
  saveObjectiveBtn: document.getElementById("saveObjectiveBtn"),
  cancelObjectiveBtn: document.getElementById("cancelObjectiveBtn"),
  restartBtn: document.getElementById("restartBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  inputDock: document.getElementById("inputDock"),
  editBanner: document.getElementById("editBanner"),
  editBannerText: document.getElementById("editBannerText"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  quickChips: document.getElementById("quickChips"),
  roundInput: document.getElementById("roundInput"),
  addBtn: document.getElementById("addBtn"),
  addLabel: document.getElementById("addLabel"),
  preview: document.getElementById("preview"),
  errorBox: document.getElementById("errorBox"),
  errorText: document.getElementById("errorText"),
  roundsCard: document.getElementById("roundsCard"),
  emptyCard: document.getElementById("emptyCard"),
  roundsTbody: document.getElementById("roundsTbody"),
  roundList: document.getElementById("roundList"),
  winOverlay: document.getElementById("winOverlay"),
  winModal: document.getElementById("winModal"),
  winTitle: document.getElementById("winTitle"),
  winScores: document.getElementById("winScores"),
  winRestartBtn: document.getElementById("winRestartBtn"),
  winUndoBtn: document.getElementById("winUndoBtn"),
  winCloseBtn: document.getElementById("winCloseBtn"),
  toast: document.getElementById("toast"),
  toastText: document.getElementById("toastText"),
  toastUndoBtn: document.getElementById("toastUndoBtn"),
  main: document.getElementById("main"),
  confetti: document.getElementById("confetti"),
  hintLine: document.getElementById("hintLine"),
  settingsDialog: document.getElementById("settingsDialog"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  settingTarget: document.getElementById("settingTarget"),
  settingsRestartBtn: document.getElementById("settingsRestartBtn"),
  settingHaptics: document.getElementById("settingHaptics"),
  hapticsNote: document.getElementById("hapticsNote"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
}

const hints = [
  { text: "contrat réussi: 'Nous 120 fait' (sans points: minimum requis, belote comprise)" },
  { text: "belote: ajoutez 'belote' (ou 'belote nous' / 'belote eux')" },
  { text: "coinche: 'coinche' ou 'cc' (surcoinche: 'sur' ou 'sc')" },
  { text: "chute: 'chuté', 'dedans', 'perdu', 'raté' ou 'pas fait'" },
  { text: "points explicites: 'Nous 100 défense 62' ou 'Nous 100 fait 80'" },
  { text: "capot: 'Eux 120 capot' = 370 points, avec 'belote' = 390" },
  { text: "preneur: 'nous'/'on' ou 'eux'/'ils'/'adv'" },
  { text: "coinche réussie: 162 + contrat x2 + belote, ex. 'Eux 90 belote coinche fait' = 362" },
  { text: "score manuel: '= 120 42' (Nous puis Eux) ou '= eux 360', négatifs acceptés" },
  { text: "capot de la défense: 'Nous 100 eux capot' ou 'capot inversé' = 250 + contrat" },
]

let hintIndex = 0

const loadHintIndex = () => {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    const n = Number.parseInt(String(raw || "0"), 10)
    if (!Number.isNaN(n) && n >= 0) hintIndex = n
  } catch {
    // ignore
  }
}

const saveHintIndex = () => {
  try {
    localStorage.setItem(HINT_KEY, String(hintIndex))
  } catch {
    // ignore
  }
}

const setHint = (h) => {
  if (!els.hintLine) return
  els.hintLine.textContent = `Tip: ${h.text}`
}

const nextHint = () => {
  hintIndex = (hintIndex + 1) % hints.length
  saveHintIndex()
  setHint(hints[hintIndex])
}

const setError = (msg) => {
  if (!msg) {
    els.errorBox.style.display = "none"
    els.errorText.textContent = ""
    return
  }
  els.errorBox.style.display = "flex"
  els.errorText.textContent = msg
}

const saveState = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rounds: state.rounds,
        totalNous: state.totalNous,
        totalEux: state.totalEux,
        targetScore: state.targetScore,
        winDismissed: state.winDismissed,
      }),
    )
  } catch {
    // Ignore storage failures.
  }
}

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    if (Array.isArray(parsed.rounds)) state.rounds = parsed.rounds
    if (Number.isFinite(parsed.totalNous)) state.totalNous = parsed.totalNous
    if (Number.isFinite(parsed.totalEux)) state.totalEux = parsed.totalEux
    if (Number.isFinite(parsed.targetScore)) state.targetScore = parsed.targetScore
    state.winDismissed = parsed.winDismissed === true
  } catch {
    // ignore
  }
  // Re-score saved rounds so rule changes apply to games in progress.
  const r = recalcFromScratch(state.rounds)
  if (!r.error) {
    state.rounds = r.rounds
    state.totalNous = r.totalNous
    state.totalEux = r.totalEux
  }
}

const computeWinner = () => {
  if (state.totalNous >= state.targetScore && state.totalNous > state.totalEux) return Team.NOUS
  if (state.totalEux >= state.targetScore && state.totalEux > state.totalNous) return Team.EUX
  return null
}

// =========================
// Settings
// =========================
const loadSettings = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    for (const key of Object.keys(DEFAULT_RULES)) {
      if (typeof parsed.rules?.[key] === "boolean") settings.rules[key] = parsed.rules[key]
    }
    if (typeof parsed.haptics === "boolean") settings.haptics = parsed.haptics
    if (["auto", "light", "dark"].includes(parsed.theme)) settings.theme = parsed.theme
  } catch {
    // ignore
  }
}

const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

const applyTheme = () => {
  const dark = settings.theme === "dark" || (settings.theme === "auto" && darkMq.matches)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
  els.themeColor?.setAttribute("content", dark ? "#1c1830" : "#5b21b6")
}

const buzz = (pattern) => {
  if (settings.haptics && canVibrate) navigator.vibrate(pattern)
}

const updateWinner = () => {
  const w = computeWinner()
  if (w !== state.winner) state.winDismissed = false
  state.winner = w
}

// =========================
// Confetti
// =========================
const confetti = (() => {
  const canvas = els.confetti
  const ctx = canvas.getContext("2d")
  let animationId = 0
  let particles = []

  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

  const setSize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  const start = () => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!ctx) return
    if (animationId) return

    setSize()
    particles = []
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        s: 6 + Math.random() * 6,
        c: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const tick = () => {
      animationId = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.vy += 0.01
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6)
        ctx.restore()
      }
      particles = particles.filter((p) => p.y < canvas.height + 30)
      if (particles.length === 0) stop()
    }
    canvas.classList.add("active")
    tick()
  }

  const stop = () => {
    if (!ctx) return
    if (animationId) cancelAnimationFrame(animationId)
    animationId = 0
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    canvas.classList.remove("active")
  }

  window.addEventListener("resize", () => {
    if (animationId) setSize()
  })

  return { start, stop }
})()

// =========================
// Rendering
// =========================
let celebratedWinner = null
let winShown = false
const shownScores = { nous: null, eux: null }

const ICON_EDIT = `<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
</svg>`
const ICON_TRASH = `<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M3 6h18M8 6V4h8v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="M6 6l1 14h10l1-14" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>`

const fmtDelta = (n) => (n > 0 ? `+${n}` : String(n))

const contractLabel = (r) => {
  if (r.manual) return "manuel"
  if (r.isDefenseCapot) return `${r.contract} · capot déf.`
  if (r.isCapot) return `${r.contract} · capot`
  return String(r.contract)
}

const describeRound = (r) => {
  if (r.manual) return "score manuel"
  const parts = [contractLabel(r)]
  if (r.coinche === CoincheStatus.COINCHE) parts.push("coinché")
  if (r.coinche === CoincheStatus.SURCOINCHE) parts.push("surcoinché")
  if (r.beloteOwner) parts.push(`belote ${r.beloteOwner === Team.NOUS ? "nous" : "eux"}`)
  parts.push(r.isSuccess ? "fait" : "chuté")
  return parts.join(" · ")
}

const teamRowClass = (r) => (r.winner === Team.NOUS ? "row-nous" : r.winner === Team.EUX ? "row-eux" : "")

const animateScore = (el, key, to) => {
  const from = shownScores[key]
  shownScores[key] = to
  if (from === null || from === to || reducedMotion()) {
    el.textContent = String(to)
    return
  }
  const start = performance.now()
  const step = (now) => {
    // A newer animation for this score takes over.
    if (shownScores[key] !== to) return
    const t = Math.min(1, (now - start) / 450)
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 3)))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const flashDelta = (deltaNous, deltaEux) => {
  if (reducedMotion()) return
  for (const [delta, team] of [[deltaNous, "nous"], [deltaEux, "eux"]]) {
    if (!delta) continue
    const badge = document.createElement("span")
    badge.className = `delta-pop team-${team}`
    badge.textContent = fmtDelta(delta)
    badge.setAttribute("aria-hidden", "true")
    els.scoreNous.parentElement.appendChild(badge)
    badge.addEventListener("animationend", () => badge.remove())
  }
}

const renderScoreMeta = () => {
  const remaining = (total) => {
    const left = state.targetScore - total
    return left > 0 ? `reste ${left}` : "objectif atteint"
  }
  els.remainNous.textContent = remaining(state.totalNous)
  els.remainEux.textContent = remaining(state.totalEux)
  const diff = state.totalNous - state.totalEux
  els.leadText.className = `score-lead ${diff > 0 ? "team-nous" : diff < 0 ? "team-eux" : ""}`
  els.leadText.textContent = diff === 0
    ? state.rounds.length ? "égalité" : ""
    : diff > 0 ? `Nous menons de ${diff}` : `Eux mènent de ${-diff}`
}

const renderTable = () => {
  els.roundsTbody.innerHTML = ""
  state.rounds.forEach((r, i) => {
    const tr = document.createElement("tr")
    const winnerText = r.winner === Team.NOUS ? "Nous" : r.winner === Team.EUX ? "Eux" : "—"
    tr.className = `${teamRowClass(r)}${r.id === editingId ? " editing" : ""}`
    tr.dataset.id = r.id
    tr.innerHTML = `
      <td class="mono">${i + 1}</td>
      <td>${escapeHtml(r.rawInput)}</td>
      <td class="center mono">${escapeHtml(contractLabel(r))}</td>
      <td class="center mono">${escapeHtml(winnerText)}</td>
      <td class="right mono ${r.deltaNous ? "team-nous" : ""}">${r.deltaNous ? r.deltaNous : ""}</td>
      <td class="right mono ${r.deltaEux ? "team-eux" : ""}">${r.deltaEux ? r.deltaEux : ""}</td>
      <td class="right mono">${r.totalNous}</td>
      <td class="right mono">${r.totalEux}</td>
      <td class="center td-actions">
        <button class="btn ghost icon table-action" type="button" data-action="edit" aria-label="Modifier la donne ${i + 1}">${ICON_EDIT}</button>
        <button class="btn ghost icon table-action danger" type="button" data-action="delete" aria-label="Supprimer la donne ${i + 1}">${ICON_TRASH}</button>
      </td>
    `
    els.roundsTbody.appendChild(tr)
  })
}

// Newest first: on a phone the latest round sits right under the scoreboard.
const renderList = () => {
  openItem = null
  els.roundList.innerHTML = ""
  for (let i = state.rounds.length - 1; i >= 0; i--) {
    const r = state.rounds[i]
    const li = document.createElement("li")
    li.className = `round-item ${teamRowClass(r)}${r.id === editingId ? " editing" : ""}`
    li.dataset.id = r.id
    li.innerHTML = `
      <div class="round-actions" inert>
        <button class="round-action edit" type="button" data-action="edit">${ICON_EDIT}<span>Modifier</span></button>
        <button class="round-action delete" type="button" data-action="delete">${ICON_TRASH}<span>Supprimer</span></button>
      </div>
      <div class="round-card" tabindex="0" role="button" aria-expanded="false"
        aria-label="Donne ${i + 1} : ${escapeHtml(r.rawInput)}. Afficher les actions">
        <span class="round-num mono">${i + 1}</span>
        <div class="round-main">
          <div class="round-text">${escapeHtml(r.rawInput)}</div>
          <div class="round-meta">${escapeHtml(describeRound(r))}</div>
        </div>
        <div class="round-score mono">
          <div class="round-deltas">
            <span class="${r.deltaNous ? "team-nous" : "muted"}">${fmtDelta(r.deltaNous)}</span>
            <span class="${r.deltaEux ? "team-eux" : "muted"}">${fmtDelta(r.deltaEux)}</span>
          </div>
          <div class="round-totals">${r.totalNous} · ${r.totalEux}</div>
        </div>
      </div>
    `
    els.roundList.appendChild(li)
  }
}

const render = () => {
  animateScore(els.scoreNous, "nous", state.totalNous)
  animateScore(els.scoreEux, "eux", state.totalEux)
  renderScoreMeta()

  els.objectiveText.textContent = `${state.targetScore} pts`

  const max = Math.max(state.targetScore, 1)
  const pNous = clamp((state.totalNous / max) * 100, 0, 100)
  const pEux = clamp((state.totalEux / max) * 100, 0, 100)
  // Fill the score pill itself: left side for Nous, right side for Eux. Each caps at 50% of pill width.
  if (els.fillNous) els.fillNous.style.width = `${(pNous / 2).toFixed(2)}%`
  if (els.fillEux) els.fillEux.style.width = `${(pEux / 2).toFixed(2)}%`

  const hasRounds = state.rounds.length > 0
  els.roundsCard.style.display = hasRounds ? "block" : "none"
  els.emptyCard.style.display = hasRounds ? "none" : "block"

  renderTable()
  renderList()

  const showWin = Boolean(state.winner) && !state.winDismissed
  els.winOverlay.classList.toggle("active", showWin)
  els.main.inert = showWin
  if (showWin) {
    els.winTitle.textContent = state.winner === Team.NOUS ? "Nous avons gagné !" : "Ils ont gagné !"
    els.winScores.innerHTML = `
      <div><span class="team-nous">Nous</span> : <span class="mono">${state.totalNous}</span> pts</div>
      <div><span class="team-eux">Eux</span> : <span class="mono">${state.totalEux}</span> pts</div>
    `
    if (state.winner !== celebratedWinner) {
      confetti.start()
      buzz([30, 60, 30, 60, 80])
    }
    if (!winShown) els.winModal.focus()
  } else {
    els.winScores.textContent = ""
    confetti.stop()
    if (winShown && finePointer) els.roundInput.focus()
  }
  winShown = showWin
  celebratedWinner = state.winner
}

const escapeHtml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

// =========================
// Actions
// =========================
const recalcFromScratch = (rounds) => {
  let totalNous = 0
  let totalEux = 0
  const newRounds = []

  for (const [i, r] of rounds.entries()) {
    const parsed = parseInput(r.rawInput, totalNous, totalEux, settings.rules)
    if (parsed.error) return { error: `Donne ${i + 1} : ${parsed.error}` }
    totalNous = parsed.totalNous
    totalEux = parsed.totalEux
    newRounds.push({ ...parsed, id: r.id ?? parsed.id })
  }

  return { rounds: newRounds, totalNous, totalEux }
}

const applyRounds = (res) => {
  state.rounds = res.rounds
  state.totalNous = res.totalNous
  state.totalEux = res.totalEux
  updateWinner()
}

const roundIndex = (id) => state.rounds.findIndex((r) => r.id === id)

// =========================
// Undo toast
// =========================
let toastTimer = 0
let undoSnapshot = null

const snapshot = () => ({
  rounds: state.rounds.slice(),
  totalNous: state.totalNous,
  totalEux: state.totalEux,
  winner: state.winner,
  winDismissed: state.winDismissed,
})

const hideToast = () => {
  clearTimeout(toastTimer)
  els.toast.classList.remove("active")
  undoSnapshot = null
}

const showUndo = (message, snap) => {
  clearTimeout(toastTimer)
  undoSnapshot = snap
  els.toastText.textContent = message
  els.toast.classList.add("active")
  toastTimer = setTimeout(hideToast, UNDO_MS)
}

const undo = () => {
  if (!undoSnapshot) return
  Object.assign(state, undoSnapshot)
  // Restoring a previous win should not replay the celebration.
  celebratedWinner = state.winner
  hideToast()
  setError(null)
  saveState()
  render()
}

const updatePreview = () => {
  const text = els.roundInput.value.trim()
  const r = text ? parseInput(text, 0, 0, settings.rules) : null
  if (!r || r.error) {
    els.preview.textContent = ""
    return
  }
  els.preview.innerHTML = `→ <span class="team-nous">Nous ${fmtDelta(r.deltaNous)}</span> · ` +
    `<span class="team-eux">Eux ${fmtDelta(r.deltaEux)}</span>` +
    `<span class="preview-tag">${escapeHtml(describeRound(r))}</span>`
}

const setInput = (text) => {
  els.roundInput.value = text
  setError(null)
  updatePreview()
}

const startEdit = (id) => {
  const idx = roundIndex(id)
  if (idx < 0) return
  editingId = id
  els.editBannerText.textContent = `Modification de la donne ${idx + 1}`
  els.editBanner.hidden = false
  els.addLabel.textContent = "Modifier"
  setInput(state.rounds[idx].rawInput)
  render()
  els.roundInput.focus()
  els.roundInput.setSelectionRange(els.roundInput.value.length, els.roundInput.value.length)
}

const stopEdit = () => {
  editingId = null
  els.editBanner.hidden = true
  els.addLabel.textContent = "Ajouter"
  setInput("")
}

const cancelEdit = () => {
  stopEdit()
  render()
}

const commitEdit = (text) => {
  const idx = roundIndex(editingId)
  if (idx < 0) return cancelEdit()
  const snap = snapshot()
  const before = { nous: state.totalNous, eux: state.totalEux }
  const res = recalcFromScratch(state.rounds.map((r, i) => (i === idx ? { ...r, rawInput: text } : r)))
  if (res.error) {
    setError(res.error)
    return
  }
  applyRounds(res)
  stopEdit()
  saveState()
  render()
  flashDelta(state.totalNous - before.nous, state.totalEux - before.eux)
  buzz(12)
  showUndo(`Donne ${idx + 1} modifiée`, snap)
}

const handleSubmit = () => {
  const text = els.roundInput.value.trim()
  if (!text) return
  if (editingId) return commitEdit(text)

  const result = parseInput(text, state.totalNous, state.totalEux, settings.rules)
  if (result.error) {
    setError(result.error)
    buzz([20, 40, 20])
    return
  }

  setError(null)
  state.rounds.push(result)
  state.totalNous = result.totalNous
  state.totalEux = result.totalEux
  updateWinner()
  saveState()
  nextHint()

  setInput("")
  render()
  flashDelta(result.deltaNous, result.deltaEux)
  buzz(12)
  els.roundInput.focus()
}

const deleteRound = (id) => {
  const idx = roundIndex(id)
  if (idx < 0) return
  const snap = snapshot()
  const res = recalcFromScratch(state.rounds.filter((r) => r.id !== id))
  if (res.error) {
    setError(res.error)
    return
  }
  if (editingId === id) stopEdit()
  setError(null)
  applyRounds(res)
  saveState()
  render()
  buzz(12)
  showUndo(`Donne ${idx + 1} supprimée`, snap)
}

const handleRestart = () => {
  if (state.rounds.length === 0) return
  const snap = snapshot()
  if (editingId) stopEdit()
  state.rounds = []
  state.totalNous = 0
  state.totalEux = 0
  state.winner = null
  state.winDismissed = false
  saveState()
  render()
  showUndo("Nouvelle partie commencée", snap)
  if (finePointer) els.roundInput.focus()
}

const dismissWin = () => {
  state.winDismissed = true
  saveState()
  render()
}

const undoLastRound = () => {
  const last = state.rounds.at(-1)
  if (last) deleteRound(last.id)
}

let editingObjective = false

const closeObjectiveEditor = () => {
  editingObjective = false
  els.objectiveInput.classList.remove("invalid")
  els.objectiveEdit.style.display = "none"
  els.objectiveView.style.display = "flex"
}

const startEditObjective = () => {
  editingObjective = true
  els.objectiveView.style.display = "none"
  els.objectiveEdit.style.display = "flex"
  els.objectiveInput.value = String(state.targetScore)
  els.objectiveInput.focus()
  els.objectiveInput.select()
}

const parseObjective = () => {
  const n = Number(els.objectiveInput.value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const commitObjective = () => {
  if (!editingObjective) return
  const newTarget = parseObjective()
  if (newTarget === null) {
    const input = els.objectiveInput
    input.classList.remove("invalid")
    // Force reflow so the shake animation replays.
    void input.offsetWidth
    input.classList.add("invalid")
    input.focus()
    return
  }
  state.targetScore = newTarget
  updateWinner()
  saveState()
  closeObjectiveEditor()
  render()
}

const cancelObjective = () => {
  if (!editingObjective) return
  closeObjectiveEditor()
  if (finePointer) els.roundInput.focus()
}

const wireExamples = () => {
  document.querySelectorAll("[data-example]").forEach((el) => {
    el.addEventListener("click", () => {
      setInput(el.getAttribute("data-example") || "")
      els.roundInput.focus()
    })
  })
}

// =========================
// Mobile round cards: tap or swipe left to reveal actions
// =========================
const setOpen = (li, open) => {
  const card = li.querySelector(".round-card")
  card.style.transform = open ? `translateX(-${SWIPE_OPEN}px)` : ""
  card.setAttribute("aria-expanded", String(open))
  li.classList.toggle("open", open)
  li.querySelector(".round-actions").inert = !open
  if (open) {
    if (openItem && openItem !== li) setOpen(openItem, false)
    openItem = li
  } else if (openItem === li) {
    openItem = null
  }
}

let drag = null
let suppressClick = false

const wireSwipe = () => {
  const list = els.roundList

  list.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".round-card")
    if (!card || e.button !== 0) return
    const li = card.parentElement
    drag = {
      li,
      card,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: li.classList.contains("open") ? -SWIPE_OPEN : 0,
      dx: 0,
      active: false,
    }
  })

  list.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag = null
        return
      }
      if (Math.abs(dx) < 8) return
      drag.active = true
      drag.card.setPointerCapture(e.pointerId)
      drag.card.classList.add("dragging")
    }
    drag.dx = dx
    drag.card.style.transform = `translateX(${clamp(drag.base + dx, -SWIPE_OPEN - 24, 0)}px)`
  })

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (drag.active) {
      drag.card.classList.remove("dragging")
      setOpen(drag.li, drag.base + drag.dx < -SWIPE_OPEN / 2)
      suppressClick = true
      setTimeout(() => (suppressClick = false), 0)
    }
    drag = null
  }
  list.addEventListener("pointerup", endDrag)
  list.addEventListener("pointercancel", endDrag)

  list.addEventListener("click", (e) => {
    if (suppressClick) return
    const li = e.target.closest(".round-item")
    if (!li) return
    const action = e.target.closest("[data-action]")?.dataset.action
    if (action === "edit") startEdit(li.dataset.id)
    else if (action === "delete") deleteRound(li.dataset.id)
    else if (e.target.closest(".round-card")) setOpen(li, !li.classList.contains("open"))
  })

  list.addEventListener("keydown", (e) => {
    const card = e.target.closest(".round-card")
    if (!card || (e.key !== "Enter" && e.key !== " ")) return
    e.preventDefault()
    setOpen(card.parentElement, !card.parentElement.classList.contains("open"))
  })

  document.addEventListener("pointerdown", (e) => {
    if (openItem && !openItem.contains(e.target)) setOpen(openItem, false)
  })
}

// =========================
// Settings dialog
// =========================
const rescore = () => {
  const res = recalcFromScratch(state.rounds)
  if (res.error) {
    setError(res.error)
    return
  }
  applyRounds(res)
  saveState()
  render()
  updatePreview()
}

const openSettings = () => {
  els.settingTarget.value = String(state.targetScore)
  for (const input of document.querySelectorAll("[data-rule]")) input.checked = settings.rules[input.dataset.rule]
  for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === settings.theme
  els.settingHaptics.checked = settings.haptics && canVibrate
  els.settingHaptics.disabled = !canVibrate
  if (!canVibrate) els.hapticsNote.textContent = "Non disponible sur cet appareil"
  els.settingsDialog.showModal()
}

const wireSettings = () => {
  const dialog = els.settingsDialog
  els.settingsBtn.addEventListener("click", openSettings)
  els.closeSettingsBtn.addEventListener("click", () => dialog.close())
  // Tapping the backdrop closes the sheet.
  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect()
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
    if (!inside) dialog.close()
  })

  els.settingTarget.addEventListener("change", () => {
    const n = Number(els.settingTarget.value)
    if (!Number.isInteger(n) || n <= 0) {
      els.settingTarget.value = String(state.targetScore)
      return
    }
    state.targetScore = n
    updateWinner()
    saveState()
    render()
  })

  els.settingsRestartBtn.addEventListener("click", () => {
    dialog.close()
    handleRestart()
  })

  for (const input of document.querySelectorAll("[data-rule]")) {
    input.addEventListener("change", () => {
      settings.rules[input.dataset.rule] = input.checked
      saveSettings()
      rescore()
    })
  }

  for (const radio of document.querySelectorAll('input[name="theme"]')) {
    radio.addEventListener("change", () => {
      settings.theme = radio.value
      saveSettings()
      applyTheme()
    })
  }

  els.settingHaptics.addEventListener("change", () => {
    settings.haptics = els.settingHaptics.checked
    saveSettings()
    buzz(15)
  })
}

// =========================
// Mobile dock: reserve its height and keep it above the on-screen keyboard
// =========================
const wireDock = () => {
  const root = document.documentElement.style
  new ResizeObserver(([entry]) => {
    root.setProperty("--dock-h", `${Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)}px`)
  }).observe(els.inputDock)

  // Keep the keyboard open while tapping quick words.
  els.quickChips.addEventListener("pointerdown", (e) => {
    if (e.target.closest("[data-word]")) e.preventDefault()
  })
  els.quickChips.addEventListener("click", (e) => {
    const word = e.target.closest("[data-word]")?.dataset.word
    if (!word) return
    setInput(`${els.roundInput.value.trimEnd()} ${word} `.trimStart())
    els.roundInput.focus()
    buzz(5)
  })

  const vv = window.visualViewport
  if (!vv) return
  const sync = () => root.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
  vv.addEventListener("resize", sync)
  vv.addEventListener("scroll", sync)
}

// =========================
// Wire up
// =========================
els.addBtn.addEventListener("click", handleSubmit)
els.roundInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault()
    handleSubmit()
  }
  if (e.key === "Escape") {
    if (editingId) cancelEdit()
    else setInput("")
  }
})
els.roundInput.addEventListener("input", () => {
  setError(null)
  updatePreview()
})
els.cancelEditBtn.addEventListener("click", cancelEdit)
els.roundsTbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]")
  const id = btn?.closest("tr")?.dataset.id
  if (!id) return
  if (btn.dataset.action === "edit") startEdit(id)
  else deleteRound(id)
})

els.restartBtn.addEventListener("click", handleRestart)
els.winRestartBtn.addEventListener("click", handleRestart)
els.winUndoBtn.addEventListener("click", undoLastRound)
els.winCloseBtn.addEventListener("click", dismissWin)
els.toastUndoBtn.addEventListener("click", undo)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.winOverlay.classList.contains("active")) dismissWin()
})

els.editObjectiveBtn.addEventListener("click", startEditObjective)
els.objectiveView.addEventListener("click", (e) => {
  // Make the whole pill feel clickable, not just the pencil.
  if (e.target && e.target.closest && e.target.closest("button")) return
  startEditObjective()
})
els.saveObjectiveBtn.addEventListener("click", commitObjective)
els.cancelObjectiveBtn.addEventListener("click", cancelObjective)
// Keep focus in the input so tapping save/cancel doesn't trigger the blur commit first (iOS).
for (const btn of [els.saveObjectiveBtn, els.cancelObjectiveBtn]) {
  btn.addEventListener("pointerdown", (e) => e.preventDefault())
}
els.objectiveEdit.addEventListener("focusout", (e) => {
  if (els.objectiveEdit.contains(e.relatedTarget)) return
  if (parseObjective() === null) cancelObjective()
  else commitObjective()
})
els.objectiveInput.addEventListener("input", () => els.objectiveInput.classList.remove("invalid"))
els.objectiveInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault()
    commitObjective()
  }
  if (e.key === "Escape") {
    cancelObjective()
  }
})

// Init
loadSettings()
applyTheme()
darkMq.addEventListener("change", applyTheme)
loadState()
loadHintIndex()
setHint(hints[hintIndex % hints.length])
wireExamples()
wireSwipe()
wireSettings()
wireDock()
// Keep the persisted dismissal; a game already won should not replay the confetti.
state.winner = computeWinner()
celebratedWinner = state.winner
render()
if (finePointer) els.roundInput.focus()

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures (e.g. unsupported environments).
    })
  })
}
