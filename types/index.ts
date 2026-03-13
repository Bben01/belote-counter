export enum Team {
  NOUS = "NOUS",
  EUX = "EUX",
}

export enum CoincheStatus {
  NONE = "NONE",
  COINCHE = "COINCHE",
  SURCOINCHE = "SURCOINCHE",
}

export interface RoundResult {
  id: string
  rawInput: string
  taker: Team
  contract: number
  isCapot: boolean
  pointsScored: number
  beloteOwner: Team | null
  coinche: CoincheStatus
  isSuccess: boolean
  deltaNous: number
  deltaEux: number
  totalNous: number
  totalEux: number
  winner: Team
}

export interface GameState {
  rounds: RoundResult[]
  totalNous: number
  totalEux: number
  targetScore: number
  winner: Team | null
}
