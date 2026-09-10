import type { BigRoad, RoadCell, Settlement, Winner } from './types.js';

/** Six-row Big Road. A streak keeps moving right once its dragon tail begins. */
export function generateBigRoad(history: readonly Pick<Settlement, 'winner'>[]): BigRoad {
  if (!Array.isArray(history)) throw new TypeError('Road history must be an array.');
  const columns: Array<Array<RoadCell | null>> = [];
  let leadingTies = 0;
  let lastWinner: Winner | null = null;
  let streakStart = -1;
  let col = 0;
  let row = 0;
  let tail = false;

  const occupied = (column: number, line: number): boolean => columns[column]?.[line] != null;
  const put = (winner: Exclude<Winner, 'tie'>, tieCount: number): void => {
    while (columns.length <= col) columns.push(Array<RoadCell | null>(6).fill(null));
    const column = columns[col]!;
    if (column[row] != null) throw new Error('Road placement would overwrite an existing result.');
    column[row] = { winner, tieCount };
  };

  for (const round of history) {
    if (!round || (round.winner !== 'player' && round.winner !== 'banker' && round.winner !== 'tie')) {
      throw new TypeError('Road history contains an invalid winner.');
    }
    if (round.winner === 'tie') {
      if (lastWinner === null) leadingTies += 1;
      else columns[col]![row]!.tieCount += 1;
      continue;
    }

    if (lastWinner === null) {
      streakStart = 0;
      put(round.winner, leadingTies);
      leadingTies = 0;
    } else if (round.winner !== lastWinner) {
      // Start alongside the previous streak's origin, even when its tail extends much farther.
      streakStart += 1;
      col = streakStart;
      row = 0;
      tail = false;
      while (occupied(col, row)) { col += 1; streakStart = col; }
      put(round.winner, 0);
    } else {
      if (!tail && row < 5 && !occupied(col, row + 1)) row += 1;
      else {
        tail = true;
        col += 1;
        while (occupied(col, row)) col += 1;
      }
      put(round.winner, 0);
    }
    lastWinner = round.winner;
  }
  return { columns, leadingTies };
}
