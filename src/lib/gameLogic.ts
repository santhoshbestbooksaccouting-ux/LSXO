export const WINNING_COMBINATIONS = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Col 1
  [1, 4, 7], // Col 2
  [2, 5, 8], // Col 3
  [0, 4, 8], // Diagonal 1
  [2, 4, 6], // Diagonal 2
];

export function checkWinner(board: string[]): {
  winner: 'X' | 'O' | 'DRAW' | null;
  line: number[] | null;
} {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as 'X' | 'O',
        line: combo,
      };
    }
  }

  // Check draw
  const isFull = board.every((cell) => cell !== '');
  if (isFull) {
    return { winner: 'DRAW', line: null };
  }

  return { winner: null, line: null };
}
