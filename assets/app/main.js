import { GameSession } from './game/session.js';
import { GameRunner } from './game/runner.js';
import { isSpot } from './game/engine.js';
import { LocalStore } from './services/storage.js';
import { Motion } from './animations/motion.js';
import { AudioManager } from './audio/manager.js';
import { DealerController } from './dealer/controller.js';
import { PeekController } from './game/peek.js';
import { TableView, element } from './ui/table.js';
import { PHASE_LABELS } from './game/state.js';
const DEFAULTS = { autoReveal: false, quick: false, reduced: false, muted: false, master: .45, ambience: .2, music: .08, effects: .7 };
function readSettings() { try {
    const parsed = JSON.parse(localStorage.getItem('queen-entertainment:settings:v1') ?? 'null');
    if (!parsed || typeof parsed !== 'object')
        return { ...DEFAULTS };
    const source = parsed, settings = { ...DEFAULTS };
    for (const key of ['autoReveal', 'quick', 'reduced', 'muted'])
        if (typeof source[key] === 'boolean')
            settings[key] = source[key];
    for (const key of ['master', 'ambience', 'music', 'effects'])
        if (typeof source[key] === 'number' && Number.isFinite(source[key]))
            settings[key] = Math.max(0, Math.min(1, source[key]));
    return settings;
}
catch {
    return { ...DEFAULTS };
} }
function fatal(message) { element('error-message').textContent = message; const dialog = element('error-dialog'); if (!dialog.open)
    dialog.showModal(); }
element('reload-button').addEventListener('click', () => location.reload());
async function bootstrap() {
    const store = new LocalStore();
    if (!await store.acquire()) {
        fatal('此浏览器的另一张皇后牌桌可能正在使用中。请关闭其他标签页后重新打开；浏览器需要支持本地单桌保护。');
        return;
    }
    let loaded;
    try {
        loaded = store.load();
    }
    catch (error) {
        fatal(`已有进度暂时无法读取，原存档已保留。${error instanceof Error ? error.message : ''}`);
        return;
    }
    const settings = readSettings(), audio = new AudioManager(), motion = new Motion();
    const dealer = new DealerController(element('dealer'), element('announcement'));
    const session = new GameSession(store.save, loaded, phase => { dealer.set(phase); element('phase-code').textContent = phase === 'BETTING_OPEN' ? 'PLACE YOUR BETS' : phase === 'BETTING_CLOSED' ? 'NO MORE BETS' : phase.replaceAll('_', ' '); });
    if (!loaded)
        session.persist();
    const view = new TableView(session, audio, motion), peek = new PeekController(audio), runner = new GameRunner(session, view, peek, () => settings, fatal);
    const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const applySettings = () => {
        const lowPower = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2;
        view.setReduced(settings.reduced || reduceQuery.matches || lowPower, settings.quick);
        audio.settings = { master: settings.master, ambience: settings.ambience, music: settings.music, effects: settings.effects, muted: settings.muted };
        audio.update();
        element('sound-toggle').setAttribute('aria-pressed', String(settings.muted));
        element('sound-toggle').setAttribute('aria-label', settings.muted ? '开启声音' : '静音');
        element('peek-toggle').setAttribute('aria-pressed', String(!settings.autoReveal));
        element('auto-reveal').checked = settings.autoReveal;
        element('reduced-effects').checked = settings.reduced;
        element('pace-select').value = settings.quick ? 'quick' : 'normal';
        for (const key of ['master', 'ambience', 'music', 'effects'])
            element(`volume-${key}`).value = String(Math.round(settings[key] * 100));
    };
    const saveSettings = () => { applySettings(); try {
        localStorage.setItem('queen-entertainment:settings:v1', JSON.stringify(settings));
    }
    catch {
        view.toast('偏好本次生效，但设备暂时无法保存设置。');
    } };
    applySettings();
    reduceQuery.addEventListener('change', applySettings);
    dealer.set('BETTING_OPEN');
    if (session.history.length) {
        const last = session.history.at(-1);
        view.showFinalCards(last);
        view.showResult(last);
    }
    if (session.recovered)
        view.toast('已恢复上一局结算，虚拟筹码和记录已保存。');
    const unlock = () => { void audio.unlock(); };
    const act = (operation) => { if (runner.running)
        return; unlock(); const before = { ...session.bets }; try {
        operation();
        void view.betChanged(before);
    }
    catch (error) {
        view.toast(error instanceof Error ? error.message : '当前操作未完成。');
    } };
    element('chip-tray').addEventListener('click', event => { const target = event.target.closest('[data-value]'); if (target && !runner.running) {
        unlock();
        view.chooseChip(Number(target.dataset.value));
    } });
    for (const zone of document.querySelectorAll('[data-spot]'))
        zone.addEventListener('click', () => { const spot = zone.dataset.spot; if (isSpot(spot))
            act(() => session.place(spot, view.selected * 100)); });
    element('undo-button').addEventListener('click', () => act(() => session.undo()));
    element('clear-button').addEventListener('click', () => act(() => session.clear()));
    element('double-button').addEventListener('click', () => act(() => session.double()));
    element('rebet-button').addEventListener('click', () => act(() => session.rebet()));
    element('deal-button').addEventListener('click', () => { unlock(); void runner.start(); });
    const open = (id) => { unlock(); audio.play('button'); element(id).showModal(); };
    element('settings-open').addEventListener('click', () => { view.updateControls(); open('settings-dialog'); });
    element('rules-open').addEventListener('click', () => open('rules-dialog'));
    element('guide-open').addEventListener('click', () => open('rules-dialog'));
    element('history-open').addEventListener('click', () => { view.renderHistory(); open('history-dialog'); });
    for (const button of document.querySelectorAll('[data-close]'))
        button.addEventListener('click', () => button.closest('dialog')?.close());
    element('sound-toggle').addEventListener('click', () => { unlock(); settings.muted = !settings.muted; saveSettings(); });
    element('peek-toggle').addEventListener('click', () => { if (runner.running)
        return; settings.autoReveal = !settings.autoReveal; saveSettings(); view.toast(settings.autoReveal ? '已开启自动开牌' : '已开启四角咪牌'); });
    element('auto-reveal').addEventListener('change', () => { settings.autoReveal = element('auto-reveal').checked; saveSettings(); });
    element('reduced-effects').addEventListener('change', () => { settings.reduced = element('reduced-effects').checked; saveSettings(); });
    element('pace-select').addEventListener('change', () => { settings.quick = element('pace-select').value === 'quick'; saveSettings(); });
    element('rule-select').addEventListener('change', () => { try {
        session.setRule(element('rule-select').value);
        view.renderRule();
        view.toast(`已切换为${element('rule-name').textContent}`);
    }
    catch (error) {
        view.renderRule();
        view.toast(error instanceof Error ? error.message : '无法切换规则。');
    } });
    for (const key of ['master', 'ambience', 'music', 'effects'])
        element(`volume-${key}`).addEventListener('input', () => { unlock(); settings[key] = Number(element(`volume-${key}`).value) / 100; saveSettings(); });
    for (const tab of document.querySelectorAll('[data-road]'))
        tab.addEventListener('click', () => { view.road = tab.dataset.road; for (const other of document.querySelectorAll('[data-road]')) {
            other.classList.toggle('active', other === tab);
            other.setAttribute('aria-pressed', String(other === tab));
        } view.renderRoads(); });
    for (const tab of document.querySelectorAll('[data-road]'))
        tab.setAttribute('aria-pressed', String(tab.dataset.road === 'big'));
    if (matchMedia('(max-width:600px)').matches)
        element('roads-panel').open = false;
    window.addEventListener('resize', () => motion.finishAnimations());
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        runner.skip();
        audio.suspend();
    }
    else {
        unlock();
        if (!runner.running)
            element('announcement').textContent = PHASE_LABELS.BETTING_OPEN;
    } });
    window.addEventListener('pagehide', () => runner.skip());
    window.addEventListener('pageshow', event => { if (event.persisted)
        location.reload(); });
    window.addEventListener('unhandledrejection', event => { console.error('Unhandled application error', event.reason); view.toast('发生意外错误，已保存的牌局进度可刷新恢复。'); });
}
void bootstrap().catch(error => { console.error('Queen initialization failed', error); fatal(error instanceof Error ? error.message : '牌桌准备失败，请重新打开。'); });
