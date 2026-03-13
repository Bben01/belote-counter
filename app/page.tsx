"use client"

import { useState, useEffect } from "react"
import { Team, type GameState } from "@/types"
import { parseInput } from "@/lib/game-logic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { WinScreen } from "@/components/win-screen"
import { ConfettiCelebration } from "@/components/confetti-celebration"
import { Plus, RotateCcw, Edit2, Check, Trash2, AlertCircle } from "lucide-react"

const STORAGE_KEY = "belote-game-state"

export default function BelotePage() {
  const [gameState, setGameState] = useState<GameState>({
    rounds: [],
    totalNous: 0,
    totalEux: 0,
    targetScore: 2000,
    winner: null,
  })
  const [inputText, setInputText] = useState("")
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState("2000")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setGameState(parsed)
        setTargetInput(parsed.targetScore.toString())
      } catch (e) {
        console.error("Failed to load game state:", e)
      }
    }
  }, [])

  // Save to localStorage whenever game state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
  }, [gameState])

  const handleAddRound = () => {
    if (!inputText.trim()) return

    const result = parseInput(inputText, gameState.totalNous, gameState.totalEux)

    // Check if result is an error
    if ("error" in result) {
      setErrorMessage(result.error)
      return
    }

    // Clear any previous error
    setErrorMessage(null)

    const newRounds = [...gameState.rounds, result]
    const newTotalNous = result.totalNous
    const newTotalEux = result.totalEux

    // Check for winner
    let winner: Team | null = null
    if (newTotalNous >= gameState.targetScore && newTotalNous > newTotalEux) {
      winner = Team.NOUS
    } else if (newTotalEux >= gameState.targetScore && newTotalEux > newTotalNous) {
      winner = Team.EUX
    }

    setGameState({
      ...gameState,
      rounds: newRounds,
      totalNous: newTotalNous,
      totalEux: newTotalEux,
      winner,
    })
    setInputText("")
  }

  const handleRestart = () => {
    setGameState({
      rounds: [],
      totalNous: 0,
      totalEux: 0,
      targetScore: gameState.targetScore,
      winner: null,
    })
    setInputText("")
    setErrorMessage(null)
  }

  const handleUpdateTarget = () => {
    const newTarget = Number.parseInt(targetInput)
    if (!isNaN(newTarget) && newTarget > 0) {
      setGameState({
        ...gameState,
        targetScore: newTarget,
      })
    }
    setIsEditingTarget(false)
  }

  const handleDeleteRound = (roundId: string) => {
    const roundIndex = gameState.rounds.findIndex((r) => r.id === roundId)
    if (roundIndex === -1) return

    const newRounds = gameState.rounds.filter((r) => r.id !== roundId)

    // Recalculate totals from scratch
    let newTotalNous = 0
    let newTotalEux = 0

    const updatedRounds = newRounds.map((round) => {
      newTotalNous += round.deltaNous
      newTotalEux += round.deltaEux
      return {
        ...round,
        totalNous: newTotalNous,
        totalEux: newTotalEux,
      }
    })

    // Check for winner
    let winner: Team | null = null
    if (newTotalNous >= gameState.targetScore && newTotalNous > newTotalEux) {
      winner = Team.NOUS
    } else if (newTotalEux >= gameState.targetScore && newTotalEux > newTotalNous) {
      winner = Team.EUX
    }

    setGameState({
      ...gameState,
      rounds: updatedRounds,
      totalNous: newTotalNous,
      totalEux: newTotalEux,
      winner,
    })
  }

  const progressNous = Math.min((gameState.totalNous / gameState.targetScore) * 100, 100)
  const progressEux = Math.min((gameState.totalEux / gameState.targetScore) * 100, 100)

  return (
    <>
      <ConfettiCelebration isActive={gameState.winner !== null} />

      {gameState.winner && (
        <WinScreen
          winner={gameState.winner}
          scoreNous={gameState.totalNous}
          scoreEux={gameState.totalEux}
          onRestart={handleRestart}
        />
      )}

      <div className="min-h-screen bg-background p-2 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          {/* Header */}
          <Card className="border-2">
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 md:mb-6">
                <CardTitle className="text-2xl md:text-3xl font-bold">Compteur Belote</CardTitle>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-muted-foreground">Objectif:</span>
                    {isEditingTarget ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          className="w-20 sm:w-24 h-8"
                          onKeyDown={(e) => e.key === "Enter" && handleUpdateTarget()}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdateTarget}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base sm:text-lg">{gameState.targetScore} pts</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setIsEditingTarget(true)
                            setTargetInput(gameState.targetScore.toString())
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleRestart} className="gap-2 bg-transparent h-8 text-sm">
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouvelle Partie</span>
                  </Button>
                </div>
              </div>

              {/* Score Display */}
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xl md:text-2xl font-bold text-[var(--nous-team)]">Nous</h3>
                    <span className="text-2xl md:text-3xl font-bold text-[var(--nous-team)]">
                      {gameState.totalNous}
                    </span>
                  </div>
                  <Progress value={progressNous} className="h-2 md:h-3 [&>div]:bg-[var(--nous-team)]" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xl md:text-2xl font-bold text-[var(--eux-team)]">Eux</h3>
                    <span className="text-2xl md:text-3xl font-bold text-[var(--eux-team)]">{gameState.totalEux}</span>
                  </div>
                  <Progress value={progressEux} className="h-2 md:h-3 [&>div]:bg-[var(--eux-team)]" />
                </div>
              </div>
            </CardHeader>

            {/* Input Area */}
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder='Ex: "Nous 100 65", "Eux capot"'
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddRound()}
                  className="flex-1"
                />
                <Button onClick={handleAddRound} className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rounds Table */}
          {gameState.rounds.length > 0 && (
            <Card className="border-2">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-muted/50 border-b-2">
                      <tr>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold">#</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold">
                          Description
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold">
                          Contrat
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold">
                          Vainqueur
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-semibold">Nous</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-semibold">Eux</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-semibold bg-[var(--nous-team)]/10 text-[var(--nous-team)]">
                          Total Nous
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-semibold bg-[var(--eux-team)]/10 text-[var(--eux-team)]">
                          Total Eux
                        </th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm font-semibold w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameState.rounds.map((round, index) => {
                        const isNousWin = round.winner === Team.NOUS
                        return (
                          <tr key={round.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium">{index + 1}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm">{round.rawInput}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-mono">{round.contract}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm">
                              <span
                                className={`font-semibold ${isNousWin ? "text-[var(--nous-team)]" : "text-[var(--eux-team)]"}`}
                              >
                                {round.winner}
                              </span>
                            </td>
                            <td
                              className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-mono ${isNousWin ? "bg-[var(--nous-team)]/10 font-semibold text-[var(--nous-team)]" : ""}`}
                            >
                              +{round.deltaNous}
                            </td>
                            <td
                              className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-mono ${!isNousWin ? "bg-[var(--eux-team)]/10 font-semibold text-[var(--eux-team)]" : ""}`}
                            >
                              +{round.deltaEux}
                            </td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-bold bg-[var(--nous-team)]/10 text-[var(--nous-team)]">
                              {round.totalNous}
                            </td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-bold bg-[var(--eux-team)]/10 text-[var(--eux-team)]">
                              {round.totalEux}
                            </td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteRound(round.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {gameState.rounds.length === 0 && (
            <Card className="border-2 border-dashed">
              <CardContent className="py-8 md:py-12 text-center text-muted-foreground">
                <p className="text-base md:text-lg">Aucune donne enregistrée</p>
                <p className="text-xs md:text-sm mt-2">Ajoutez votre première donne ci-dessus</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
