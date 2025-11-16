export const HAND_TYPES = [
    "Flush Five",
    "Flush House",
    "Five of a Kind",
    "Three of a Kind",
    "Pair",
    "Full House",
    "Flush",
    "Straight Flush",
    "Straight",
    "High Card",
    "Four of a Kind",
    "Two Pair",  
] as const;

export type HandType = (typeof HAND_TYPES)[number];