import { emptyBets, SPOTS, settle, totalBets, validateBets, dealRound } from '../game/engine.js';
import { Ledger } from '../game/ledger.js';
export const STORAGE_KEY = 'queen-entertainment:session:v1';
function record(value) { if (typeof value !== 'object' || !value || Array.isArray(value))
    throw new Error('记录格式错误'); return value; }
function text(value) { if (typeof value !== 'string' || value.length > 160 || value.length === 0)
    throw new Error('记录标识错误'); return value; }
function integer(value, minimum = 0) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
    throw new Error('记录数值错误'); return value; }
function array(value, maximum) { if (!Array.isArray(value) || value.length > maximum)
    throw new Error('记录长度错误'); return value; }
function mode(value) { if (value !== 'commission' && value !== 'super-six')
    throw new Error('记录规则错误'); return value; }
function card(value) { const o = record(value); const rank = integer(o.rank, 1); if (rank > 13 || !['spades', 'hearts', 'clubs', 'diamonds'].includes(String(o.suit)))
    throw new Error('记录牌面错误'); return { id: text(o.id), rank, suit: o.suit }; }
function bets(value) { const o = record(value), b = emptyBets(); for (const spot of SPOTS)
    b[spot] = integer(o[spot]); validateBets(b); return b; }
function result(value) {
    const o = record(value), player = array(o.player, 3).map(card), banker = array(o.banker, 3).map(card);
    const computed = settle(text(o.id), integer(o.number, 1), player, banker, bets(o.bets), mode(o.rule), integer(o.timestamp));
    if (o.gross !== computed.gross || o.net !== computed.net || o.winner !== computed.winner)
        throw new Error('记录结算不一致');
    return computed;
}
export function parseSnapshot(raw) {
    const o = record(JSON.parse(raw));
    if (o.version !== 1)
        throw new Error('存档版本不支持');
    const l = record(o.ledger), s = record(o.shoe);
    const entries = array(l.entries, 2000).map(value => {
        const e = record(value);
        if (!['BET', 'UNDO', 'CLEAR', 'DOUBLE', 'REBET', 'PAYOUT'].includes(String(e.reason)))
            throw new Error('账本类型错误');
        return { id: text(e.id), amount: integer(e.amount, -Number.MAX_SAFE_INTEGER), before: integer(e.before), after: integer(e.after), timestamp: integer(e.timestamp), gameId: text(e.gameId), reason: e.reason };
    });
    const ledger = { opening: integer(l.opening), balance: integer(l.balance), entries, appliedIds: array(l.appliedIds, 200000).map(text) };
    new Ledger(ledger);
    const shoe = { number: integer(s.number, 1), cut: integer(s.cut, 60), cards: array(s.cards, 416).map(card) };
    if (shoe.cut > 75 || new Set(shoe.cards.map(c => c.id)).size !== shoe.cards.length)
        throw new Error('牌靴记录异常');
    const currentBets = bets(o.bets), number = integer(o.number, 1);
    let pending = null;
    if (o.pending !== null) {
        const p = record(o.pending), r = result(p.result), rawDeals = array(p.deals, 6);
        const deals = rawDeals.map(value => { const d = record(value); if (d.side !== 'player' && d.side !== 'banker')
            throw new Error('发牌顺序错误'); return { side: d.side, index: integer(d.index), card: card(d.card) }; });
        let i = 0;
        const expected = dealRound(() => { const deal = deals[i++]; if (!deal)
            throw new Error('发牌缺失'); return deal.card; }, r.id, r.number, r.bets, r.rule);
        if (i !== deals.length || expected.deals.some((d, j) => d.side !== deals[j]?.side || d.index !== deals[j]?.index) || expected.result.gross !== r.gross || expected.result.playerScore !== r.playerScore || expected.result.bankerScore !== r.bankerScore || r.number !== number || SPOTS.some(spot => r.bets[spot] !== currentBets[spot]))
            throw new Error('待结算牌局不一致');
        if (new Set([...shoe.cards, ...deals.map(d => d.card)].map(c => c.id)).size !== shoe.cards.length + deals.length)
            throw new Error('牌靴重复牌记录');
        for (const side of ['player', 'banker']) {
            if (r[side].length !== expected.result[side].length || r[side].some((card, index) => {
                const other = expected.result[side][index];
                return !other || card.id !== other.id || card.rank !== other.rank || card.suit !== other.suit;
            }))
                throw new Error('待结算牌面与发牌序列不一致');
        }
        pending = { deals, result: r, shuffled: Boolean(p.shuffled) };
    }
    const history = array(o.history, 1200).map(result);
    if (new Set(history.map(r => r.id)).size !== history.length || history.some(r => r.number >= number))
        throw new Error('牌局历史顺序异常');
    if (history.some((r, index) => index > 0 && r.number <= history[index - 1].number))
        throw new Error('历史牌局顺序异常');
    if (!Number.isSafeInteger(ledger.balance + totalBets(currentBets)))
        throw new Error('余额记录异常');
    return { version: 1, revision: integer(o.revision), rule: mode(o.rule), number, shoe, ledger, bets: currentBets, lastBets: bets(o.lastBets), history, pending };
}
export class LocalStore {
    expectedRevision = 0;
    owned = false;
    async acquire() {
        if (!navigator.locks)
            return false;
        return new Promise(resolve => {
            void navigator.locks.request('queen-entertainment:single-table', { ifAvailable: true }, async (lock) => {
                if (!lock) {
                    resolve(false);
                    return;
                }
                this.owned = true;
                resolve(true);
                await new Promise(release => { window.addEventListener('pagehide', () => { this.owned = false; release(); }, { once: true }); });
            }).catch(() => resolve(false));
        });
    }
    load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return undefined;
        const parsed = parseSnapshot(raw);
        this.expectedRevision = parsed.revision;
        return parsed;
    }
    save = (snapshot) => {
        if (!this.owned)
            throw new Error('此标签页没有牌桌控制权，请重新打开。');
        const raw = localStorage.getItem(STORAGE_KEY);
        const latest = raw ? JSON.parse(raw) : null;
        const revision = latest ? integer(record(latest).revision) : 0;
        if (revision !== this.expectedRevision)
            throw new Error('存档已被其他页面更新，请刷新后继续。');
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        }
        catch {
            throw new Error('设备无法保存进度，当前操作未记账。请释放浏览器存储空间后重试。');
        }
        this.expectedRevision = snapshot.revision;
    };
}
