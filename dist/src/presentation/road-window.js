import { generateBigRoad } from '../game/roadmap.js';
const ROAD_COLUMNS = 60;
const FOCUS_CONTEXT = 20;
const BEAD_RESULTS = 120;
const BEAD_ROWS = 6;
/** Presentation window only. The game-domain road algorithm always receives complete history. */
export function getRoadWindow(history) {
    const road = generateBigRoad(history);
    const previous = generateBigRoad(history.slice(0, -1));
    let latestColumn = null;
    // A new result adds exactly one decisive marker or increments one marker's tie count.
    // Following the rightmost column would lose new streaks beside an earlier dragon tail.
    for (let column = 0; column < road.columns.length && latestColumn === null; column += 1) {
        const currentColumn = road.columns[column];
        for (let row = 0; row < currentColumn.length; row += 1) {
            const current = currentColumn[row];
            const prior = previous.columns[column]?.[row];
            if (current && (!prior || current.winner !== prior.winner || current.tieCount !== prior.tieCount)) {
                latestColumn = column;
                break;
            }
        }
    }
    const startColumn = latestColumn === null ? 0 : Math.min(Math.max(0, latestColumn - FOCUS_CONTEXT), Math.max(0, road.columns.length - ROAD_COLUMNS));
    const beadStart = Math.max(0, Math.floor((history.length - BEAD_RESULTS) / BEAD_ROWS) * BEAD_ROWS);
    return {
        columns: road.columns.slice(startColumn, startColumn + ROAD_COLUMNS),
        startColumn,
        focusColumn: latestColumn === null ? null : latestColumn - startColumn,
        leadingTies: road.leadingTies,
        beads: history.slice(beadStart).map(result => ({ ...result })),
    };
}
