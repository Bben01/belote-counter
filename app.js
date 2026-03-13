import { Team, parseInput } from "./logic.js"

const STORAGE_KEY = "belote-game-state"
const HINT_KEY = "belote-hint-index"

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

const state = {
  rounds: [],
  totalNous: 0,
  totalEux: 0,
  targetScore: 2000,
  winner: null,
}

const els = {
  scoreNous: document.getElementById("scoreNous"),
  scoreEux: document.getElementById("scoreEux"),
  fillNous: document.getElementById("fillNous"),
  fillEux: document.getElementById("fillEux"),
  objectiveText: document.getElementById("objectiveText"),
  objectiveView: document.getElementById("objectiveView"),
  objectiveEdit: document.getElementById("objectiveEdit"),
  objectiveInput: document.getElementById("objectiveInput"),
  editObjectiveBtn: document.getElementById("editObjectiveBtn"),
  saveObjectiveBtn: document.getElementById("saveObjectiveBtn"),
  cancelObjectiveBtn: document.getElementById("cancelObjectiveBtn"),
  restartBtn: document.getElementById("restartBtn"),
  roundInput: document.getElementById("roundInput"),
  addBtn: document.getElementById("addBtn"),
  errorBox: document.getElementById("errorBox"),
  errorText: document.getElementById("errorText"),
  roundsCard: document.getElementById("roundsCard"),
  emptyCard: document.getElementById("emptyCard"),
  roundsTbody: document.getElementById("roundsTbody"),
  winOverlay: document.getElementById("winOverlay"),
  winTitle: document.getElementById("winTitle"),
  winScores: document.getElementById("winScores"),
  winRestartBtn: document.getElementById("winRestartBtn"),
  confetti: document.getElementById("confetti"),
  hintLine: document.getElementById("hintLine"),
  controls: document.getElementById("controls"),
  headerRow: document.querySelector(".header-row"),
  mobileFooter: document.getElementById("mobileFooter"),
}

const hints = [
  { text: "belote: ajoutez 'belote' (ou 'belote nous' / 'belote eux')" },
  { text: "coinche: 'coinche' ou 'cc' (surcoinche: 'sur' ou 'sc')" },
  { text: "chute: ajoutez 'chute' ou 'dedans' pour une chute" },
  { text: "capot: 'capot' (ou contrat 250 / 270)" },
  { text: "preneur: 'nous'/'on' ou 'eux'/'ils'/'adv'" },
]

let hintIndex = 0
let currentHint = hints[0]

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
  currentHint = h
  if (!els.hintLine) return
  els.hintLine.textContent = `Tip: ${h.text}`
}

const nextHint = () => {
  const h = hints[hintIndex % hints.length]
  hintIndex++
  saveHintIndex()
  setHint(h)
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
  } catch {
    // ignore
  }
}

const computeWinner = () => {
  if (state.totalNous >= state.targetScore && state.totalNous > state.totalEux) return Team.NOUS
  if (state.totalEux >= state.targetScore && state.totalEux > state.totalNous) return Team.EUX
  return null
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
const render = () => {
  els.scoreNous.textContent = String(state.totalNous)
  els.scoreEux.textContent = String(state.totalEux)

  els.objectiveText.textContent = `${state.targetScore} pts`

  const max = Math.max(state.targetScore, 1)
  const pNous = clamp((state.totalNous / max) * 100, 0, 100)
  const pEux = clamp((state.totalEux / max) * 100, 0, 100)
  // Fill the score pill itself: left side for Nous, right side for Eux. Each caps at 50% of pill width.
  if (els.fillNous) els.fillNous.style.width = `${(pNous / 2).toFixed(2)}%`
  if (els.fillEux) els.fillEux.style.width = `${(pEux / 2).toFixed(2)}%`

  if (state.rounds.length === 0) {
    els.roundsCard.style.display = "none"
    els.emptyCard.style.display = "block"
  } else {
    els.roundsCard.style.display = "block"
    els.emptyCard.style.display = "none"
  }

  els.roundsTbody.innerHTML = ""
  for (let i = 0; i < state.rounds.length; i++) {
    const r = state.rounds[i]
    const tr = document.createElement("tr")

    const winnerText = r.winner === Team.NOUS ? "Nous" : "Eux"
    const contractText = r.isCapot ? "capot" : String(r.contract)

    tr.className = r.winner === Team.NOUS ? "row-nous" : "row-eux"
    tr.innerHTML = `
      <td class="mono">${i + 1}</td>
      <td>${escapeHtml(r.rawInput)}</td>
      <td class="center mono">${escapeHtml(contractText)}</td>
      <td class="center mono">${escapeHtml(winnerText)}</td>
      <td class="right mono ${r.deltaNous ? "team-nous" : ""}">${r.deltaNous ? r.deltaNous : ""}</td>
      <td class="right mono ${r.deltaEux ? "team-eux" : ""}">${r.deltaEux ? r.deltaEux : ""}</td>
      <td class="right mono">${r.totalNous}</td>
      <td class="right mono">${r.totalEux}</td>
      <td class="center td-actions">
        <button class="btn ghost icon table-action" type="button" aria-label="Supprimer">
          <svg class="icon" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M6 6l1 14h10l1-14" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M10 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </td>
    `
    const delBtn = tr.querySelector("button")
    delBtn.addEventListener("click", () => deleteRoundAt(i))
    els.roundsTbody.appendChild(tr)
  }

  if (state.winner) {
    els.winOverlay.classList.add("active")
    els.winTitle.textContent = state.winner === Team.NOUS ? "Nous avons gagne!" : "Eux ont gagne!"
    els.winScores.innerHTML = `
      <div><span class="team-nous">Nous</span>: <span class="mono">${state.totalNous}</span> pts</div>
      <div><span class="team-eux">Eux</span>: <span class="mono">${state.totalEux}</span> pts</div>
    `
    confetti.start()
  } else {
    els.winOverlay.classList.remove("active")
    els.winScores.textContent = ""
    confetti.stop()
  }
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

  for (const r of rounds) {
    const parsed = parseInput(r.rawInput, totalNous, totalEux)
    if (parsed.error) return { error: parsed.error }
    totalNous = parsed.totalNous
    totalEux = parsed.totalEux
    newRounds.push(parsed)
  }

  return { rounds: newRounds, totalNous, totalEux }
}

const handleAddRound = () => {
  const text = els.roundInput.value.trim()
  if (!text) return

  const result = parseInput(text, state.totalNous, state.totalEux)
  if (result.error) {
    setError(result.error)
    return
  }

  setError(null)
  state.rounds.push(result)
  state.totalNous = result.totalNous
  state.totalEux = result.totalEux
  state.winner = computeWinner()
  saveState()
  nextHint()

  els.roundInput.value = ""
  render()
  els.roundInput.focus()
}

const deleteRoundAt = (idx) => {
  const next = state.rounds.slice(0, idx).concat(state.rounds.slice(idx + 1))
  const r = recalcFromScratch(next)
  if (r.error) {
    setError(r.error)
    return
  }
  setError(null)
  state.rounds = r.rounds
  state.totalNous = r.totalNous
  state.totalEux = r.totalEux
  state.winner = computeWinner()
  saveState()
  render()
}

const handleRestart = () => {
  state.rounds = []
  state.totalNous = 0
  state.totalEux = 0
  state.winner = null
  saveState()
  render()
  els.roundInput.focus()
}

const startEditObjective = () => {
  els.objectiveView.style.display = "none"
  els.objectiveEdit.style.display = "flex"
  els.objectiveInput.value = String(state.targetScore)
  els.objectiveInput.focus()
  els.objectiveInput.select()
}

const commitObjective = () => {
  const newTarget = Number.parseInt(els.objectiveInput.value, 10)
  if (!Number.isNaN(newTarget) && newTarget > 0) {
    state.targetScore = newTarget
    state.winner = computeWinner()
    saveState()
  }
  els.objectiveEdit.style.display = "none"
  els.objectiveView.style.display = "flex"
  render()
}

const cancelObjective = () => {
  els.objectiveEdit.style.display = "none"
  els.objectiveView.style.display = "flex"
  els.roundInput.focus()
}

const wireExamples = () => {
  document.querySelectorAll("[data-example]").forEach((el) => {
    el.addEventListener("click", () => {
      const text = el.getAttribute("data-example") || ""
      els.roundInput.value = text
      setError(null)
      els.roundInput.focus()
    })
  })
}

const relocateControlsForMobile = () => {
  if (!els.controls || !els.headerRow || !els.mobileFooter) return
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 520px)").matches
  if (isMobile) {
    els.mobileFooter.setAttribute("aria-hidden", "false")
    if (els.controls.parentElement !== els.mobileFooter) {
      els.mobileFooter.appendChild(els.controls)
    }
  } else {
    els.mobileFooter.setAttribute("aria-hidden", "true")
    if (els.controls.parentElement !== els.headerRow) {
      els.headerRow.appendChild(els.controls)
    }
  }
}

// =========================
// Wire up
// =========================
els.addBtn.addEventListener("click", handleAddRound)
els.roundInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAddRound()
})
els.roundInput.addEventListener("input", () => setError(null))

els.restartBtn.addEventListener("click", handleRestart)
els.winRestartBtn.addEventListener("click", handleRestart)

els.editObjectiveBtn.addEventListener("click", startEditObjective)
els.objectiveView.addEventListener("click", (e) => {
  // Make the whole pill feel clickable, not just the pencil.
  if (e.target && e.target.closest && e.target.closest("button")) return
  startEditObjective()
})
els.saveObjectiveBtn.addEventListener("click", commitObjective)
els.cancelObjectiveBtn.addEventListener("click", cancelObjective)
els.objectiveInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") commitObjective()
  if (e.key === "Escape") {
    cancelObjective()
  }
})

// Init
loadState()
loadHintIndex()
setHint(hints[hintIndex % hints.length])
wireExamples()
relocateControlsForMobile()
window.addEventListener("resize", relocateControlsForMobile)
state.winner = computeWinner()
render()
els.roundInput.focus()

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures (e.g. unsupported environments).
    })
  })
}
