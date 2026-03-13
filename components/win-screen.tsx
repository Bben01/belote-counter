"use client"

import { Team } from "@/types"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"

interface WinScreenProps {
  winner: Team
  scoreNous: number
  scoreEux: number
  onRestart: () => void
}

export function WinScreen({ winner, scoreNous, scoreEux, onRestart }: WinScreenProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-card border-2 border-primary rounded-2xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="bg-primary/10 p-6 rounded-full">
            <Trophy className="h-16 w-16 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">
          {winner === Team.NOUS ? "Nous avons gagné!" : "Eux ont gagné!"}
        </h1>

        <div className="text-2xl md:text-3xl font-semibold mb-8 space-y-2">
          <p className="text-[var(--nous-team)]">
            Nous: <span className="font-bold">{scoreNous}</span> pts
          </p>
          <p className="text-[var(--eux-team)]">
            Eux: <span className="font-bold">{scoreEux}</span> pts
          </p>
        </div>

        <Button onClick={onRestart} size="lg" className="w-full text-lg h-14">
          Nouvelle Partie
        </Button>
      </div>
    </div>
  )
}
