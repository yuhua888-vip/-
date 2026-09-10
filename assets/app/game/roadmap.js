export function bigRoad(winners) {
    const cells = [], occupied = new Set();
    let column = 0, row = 0, startColumn = -1, last = null, dragon = false, leadingTies = 0;
    for (const [sequence, outcome] of winners.entries()) {
        if (outcome === 'tie') {
            const cell = cells.at(-1);
            if (cell)
                cell.ties++;
            else
                leadingTies++;
            continue;
        }
        if (outcome !== last) {
            startColumn++;
            while (occupied.has(`${startColumn}:0`))
                startColumn++;
            column = startColumn;
            row = 0;
            dragon = false;
        }
        else if (!dragon && row < 5 && !occupied.has(`${column}:${row + 1}`))
            row++;
        else {
            dragon = true;
            do {
                column++;
            } while (occupied.has(`${column}:${row}`));
        }
        const cell = { column, row, winner: outcome, ties: last === null ? leadingTies : 0, sequence };
        cells.push(cell);
        occupied.add(`${column}:${row}`);
        last = outcome;
    }
    return { cells, columns: Math.max(1, ...cells.map(cell => cell.column + 1)), leadingTies };
}
/** Derived roads compare the occupied cells of the big road at the time each result arrives. */
export function derivedRoad(winners, distance) {
    const main = bigRoad(winners), occupied = new Set(), colors = [];
    for (const cell of main.cells) {
        const { column, row } = cell;
        if (row === 0 && column >= distance + 1) {
            const height = (col) => Array.from({ length: 6 }, (_, r) => occupied.has(`${col}:${r}`)).filter(Boolean).length;
            colors.push(height(column - 1) === height(column - distance - 1) ? 'banker' : 'player');
        }
        else if (row > 0 && column >= distance) {
            colors.push(occupied.has(`${column - distance}:${row}`) === occupied.has(`${column - distance}:${row - 1}`) ? 'banker' : 'player');
        }
        occupied.add(`${column}:${row}`);
    }
    return bigRoad(colors);
}
export function beadRoad(winners) {
    return { cells: winners.map((outcome, index) => ({ column: Math.floor(index / 6), row: index % 6, winner: outcome, ties: 0, sequence: index })), columns: Math.max(1, Math.ceil(winners.length / 6)), leadingTies: 0 };
}
