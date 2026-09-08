<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROYALE BACCARAT · 皇家AI百家乐</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .felt-bg {
      background: radial-gradient(circle at 50% 40%, #0d3824 0%, #051a10 80%, #020b07 100%);
    }
    .card-face {
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      transform-style: preserve-3d;
    }
    .flipped {
      transform: rotateY(180deg);
    }
    .backface-hidden {
      backface-visibility: hidden;
    }
  </style>
</head>
<body class="felt-bg text-slate-100 min-h-screen flex flex-col font-sans select-none pb-8">

  <!-- 1. 顶部状态栏 -->
  <header class="w-full bg-black/60 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between backdrop-blur">
    <div class="flex items-center gap-3">
      <span class="w-8 h-8 rounded-lg bg-amber-500 text-black font-black flex items-center justify-center text-sm">B</span>
      <div>
        <div class="font-bold text-amber-400 tracking-wider text-sm sm:text-base">ROYALE BACCARAT VIP</div>
        <div class="text-[10px] text-slate-400">8副牌 · 国际标准 Punto Banco</div>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="bg-black/80 border border-amber-500/50 rounded-xl px-4 py-1.5 flex items-center gap-2">
        <span class="text-xs text-amber-400 font-medium">筹码余额:</span>
        <span id="bankroll-val" class="font-mono font-bold text-amber-300 sm:text-lg">$50,000</span>
      </div>
      <button onclick="resetBankroll()" class="text-xs text-slate-400 hover:text-amber-300 px-2 py-1 bg-white/5 rounded border border-white/10">重置</button>
      <button onclick="toggleAudio()" id="sound-btn" class="text-xs px-2.5 py-1 bg-white/5 rounded border border-white/10">🔊 音效</button>
    </div>
  </header>

  <!-- 2. AI 智能助手与走势建议 -->
  <section class="max-w-4xl w-full mx-auto px-4 mt-3">
    <div class="bg-slate-900/80 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-xl shadow">
          👩🏻‍💼
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-amber-300">Sophia · 智能荷官</span>
            <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">AI在线分析</span>
          </div>
          <p id="ai-msg" class="text-xs text-slate-300 mt-0.5">欢迎入座，靴牌已备好。大路理论推演已就绪。</p>
        </div>
      </div>
      <button onclick="applyAiBet()" class="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1.5 rounded-xl shadow transition active:scale-95 whitespace-nowrap">
        采纳AI推荐下注
      </button>
    </div>
  </section>

  <!-- 3. 台面与发牌展示区 -->
  <main class="max-w-4xl w-full mx-auto px-4 mt-3 flex-1 flex flex-col justify-between gap-4">
    <div class="relative bg-black/40 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-sm min-h-[220px] flex flex-col justify-center">
      <!-- 决胜结果横幅 -->
      <div id="result-banner" class="hidden absolute top-2 left-1/2 -translate-x-1/2 z-20 px-6 py-1.5 rounded-full text-sm font-black tracking-widest text-white shadow-xl"></div>

      <div class="grid grid-cols-2 gap-4">
        <!-- 闲家 -->
        <div class="flex flex-col items-center">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-bold text-blue-400">闲 (PLAYER)</span>
            <span id="player-score" class="w-6 h-6 rounded-full bg-blue-600/40 border border-blue-400 flex items-center justify-center font-mono font-bold text-xs text-blue-200">-</span>
          </div>
          <div id="player-cards" class="flex gap-2 min-h-[110px] items-center justify-center">
            <div class="w-16 h-24 border border-dashed border-blue-500/40 rounded-xl flex items-center justify-center text-blue-400/40 text-xs">空</div>
          </div>
        </div>

        <!-- 庄家 -->
        <div class="flex flex-col items-center">
          <div class="flex items-center gap-2 mb-2">
            <span id="banker-score" class="w-6 h-6 rounded-full bg-red-600/40 border border-red-400 flex items-center justify-center font-mono font-bold text-xs text-red-200">-</span>
            <span class="text-sm font-bold text-red-400">庄 (BANKER)</span>
          </div>
          <div id="banker-cards" class="flex gap-2 min-h-[110px] items-center justify-center">
            <div class="w-16 h-24 border border-dashed border-red-500/40 rounded-xl flex items-center justify-center text-red-400/40 text-xs">空</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 经典下注区域 -->
    <div class="grid grid-cols-3 gap-3">
      <!-- 闲 -->
      <div onclick="addBet('player')" class="cursor-pointer bg-blue-950/30 hover:bg-blue-900/40 border-2 border-blue-500/60 rounded-2xl p-4 text-center active:scale-95 transition flex flex-col items-center justify-between min-h-[100px]">
        <div class="text-sm font-bold text-blue-300">闲 (PLAYER)</div>
        <div class="text-xs font-mono text-amber-400 font-bold">1:1</div>
        <div id="bet-player" class="font-mono text-sm font-extrabold text-amber-300 h-5"></div>
      </div>

      <!-- 和 -->
      <div onclick="addBet('tie')" class="cursor-pointer bg-emerald-950/30 hover:bg-emerald-900/40 border-2 border-emerald-500/60 rounded-2xl p-4 text-center active:scale-95 transition flex flex-col items-center justify-between min-h-[100px]">
        <div class="text-sm font-bold text-emerald-300">和 (TIE)</div>
        <div class="text-xs font-mono text-amber-400 font-bold">1:8</div>
        <div id="bet-tie" class="font-mono text-sm font-extrabold text-amber-300 h-5"></div>
      </div>

      <!-- 庄 -->
      <div onclick="addBet('banker')" class="cursor-pointer bg-red-950/30 hover:bg-red-900/40 border-2 border-red-500/60 rounded-2xl p-4 text-center active:scale-95 transition flex flex-col items-center justify-between min-h-[100px]">
        <div class="text-sm font-bold text-red-300">庄 (BANKER)</div>
        <div class="text-xs font-mono text-amber-400 font-bold">1:0.95</div>
        <div id="bet-banker" class="font-mono text-sm font-extrabold text-amber-300 h-5"></div>
      </div>
    </div>

    <!-- 5. 珠盘路与大路走势展示 -->
    <div class="bg-black/50 border border-white/10 rounded-2xl p-3">
      <div class="flex items-center justify-between text-xs text-slate-400 mb-2 border-b border-white/5 pb-1 font-mono">
        <span>路单走势 (大路与珠盘)</span>
        <div class="flex gap-3">
          <span class="text-blue-400">闲: <b id="stat-p">0</b></span>
          <span class="text-red-400">庄: <b id="stat-b">0</b></span>
          <span class="text-emerald-400">和: <b id="stat-t">0</b></span>
        </div>
      </div>
      <div id="road-grid" class="flex gap-1.5 overflow-x-auto p-1 min-h-[44px] items-center">
        <span class="text-xs text-slate-500">等待开局形成路单...</span>
      </div>
    </div>
  </main>

  <!-- 6. 底部操作栏 -->
  <footer class="max-w-4xl w-full mx-auto px-4 mt-3">
    <div class="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
      <!-- 筹码 -->
      <div class="flex items-center gap-2">
        <button onclick="pickChip(50, this)" class="chip-btn w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-300 text-xs font-mono font-bold">50</button>
        <button onclick="pickChip(100, this)" class="chip-btn w-10 h-10 rounded-full bg-blue-700 border-2 border-blue-300 text-xs font-mono font-bold ring-2 ring-amber-400 scale-105">100</button>
        <button onclick="pickChip(500, this)" class="chip-btn w-10 h-10 rounded-full bg-purple-700 border-2 border-purple-300 text-xs font-mono font-bold">500</button>
        <button onclick="pickChip(1000, this)" class="chip-btn w-10 h-10 rounded-full bg-amber-600 border-2 border-amber-200 text-black text-xs font-mono font-black">1K</button>
      </div>

      <!-- 控制键 -->
      <div class="flex items-center gap-2">
        <button onclick="clearBets()" class="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl border border-white/10">清除</button>
        <button id="deal-btn" onclick="dealRound()" class="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl shadow-lg transition active:scale-95 disabled:opacity-40">发牌</button>
      </div>
    </div>
  </footer>

  <!-- 7. 纯原生逻辑与 Web Audio 音效系统 -->
  <script>
    // Web Audio 原生发声，无需任何外部音频链接
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let soundEnabled = true;

    function playTone(freq, duration, type = 'sine') {
      if (!soundEnabled) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }

    function toggleAudio() {
      soundEnabled = !soundEnabled;
      document.getElementById('sound-btn').innerText = soundEnabled ? '🔊 音效' : '🔇 静音';
    }

    // 核心状态
    const SUITS = ['♠', '♥', '♣', '♦'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let bankroll = 50000;
    let selectedChip = 100;
    let bets = { player: 0, banker: 0, tie: 0 };
    let history = [];
    let isDealing = false;

    // 洗 8 副扑克牌
    function createShoe() {
      const deck = [];
      for (let d = 0; d < 8; d++) {
        for (const s of SUITS) {
          for (const r of RANKS) {
            let val = 0;
            if (r === 'A') val = 1;
            else if (['10', 'J', 'Q', 'K'].includes(r)) val = 0;
            else val = parseInt(r);
            deck.push({ suit: s, rank: r, val, isRed: (s === '♥' || s === '♦') });
          }
        }
      }
      return deck.sort(() => Math.random() - 0.5);
    }
    let shoe = createShoe();

    function drawCard() {
      if (shoe.length < 50) shoe = createShoe();
      return shoe.pop();
    }

    function pickChip(val, btn) {
      selectedChip = val;
      playTone(600, 0.05);
      document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('ring-2', 'ring-amber-400', 'scale-105'));
      btn.classList.add('ring-2', 'ring-amber-400', 'scale-105');
    }

    function addBet(area) {
      if (isDealing) return;
      if (bankroll < selectedChip) {
        alert('筹码余额不足！');
        return;
      }
      bankroll -= selectedChip;
      bets[area] += selectedChip;
      playTone(800, 0.05);
      updateUI();
    }

    function clearBets() {
      if (isDealing) return;
      bankroll += (bets.player + bets.banker + bets.tie);
      bets = { player: 0, banker: 0, tie: 0 };
      playTone(400, 0.05);
      updateUI();
    }

    function resetBankroll() {
      if (confirm('是否重置为 $50,000 体验金？')) {
        clearBets();
        bankroll = 50000;
        updateUI();
      }
    }

    function applyAiBet() {
      if (isDealing) return;
      clearBets();
      const pick = Math.random() > 0.48 ? 'banker' : 'player';
      const amt = Math.min(bankroll, 500);
      bankroll -= amt;
      bets[pick] = amt;
      playTone(1000, 0.08);
      document.getElementById('ai-msg').innerText = `已为您在 [${pick === 'banker' ? '庄' : '闲'}] 部署 $${amt}。建议顺势而为。`;
      updateUI();
    }

    function calcHand(cards) {
      let sum = cards.reduce((acc, cur) => acc + cur.val, 0);
      return sum % 10;
    }

    function renderCard(card) {
      return `
        <div class="w-16 h-24 bg-white rounded-xl border border-slate-300 p-1 flex flex-col justify-between text-xs font-bold shadow-md ${card.isRed ? 'text-red-600' : 'text-slate-900'}">
          <div>${card.rank}${card.suit}</div>
          <div class="text-center text-xl">${card.suit}</div>
          <div class="text-right rotate-180">${card.rank}${card.suit}</div>
        </div>
      `;
    }

    // 严格百家乐 Punto Banco 补牌机制
    async function dealRound() {
      const totalBet = bets.player + bets.banker + bets.tie;
      if (totalBet === 0 || isDealing) return;

      isDealing = true;
      document.getElementById('deal-btn').disabled = true;
      const banner = document.getElementById('result-banner');
      banner.classList.add('hidden');

      const pCards = [drawCard(), drawCard()];
      const bCards = [drawCard(), drawCard()];

      // 逐步发牌动画
      playTone(400, 0.08);
      document.getElementById('player-cards').innerHTML = renderCard(pCards[0]);
      await new Promise(r => setTimeout(r, 300));

      playTone(400, 0.08);
      document.getElementById('banker-cards').innerHTML = renderCard(bCards[0]);
      await new Promise(r => setTimeout(r, 300));

      playTone(400, 0.08);
      document.getElementById('player-cards').innerHTML += renderCard(pCards[1]);
      await new Promise(r => setTimeout(r, 300));

      playTone(400, 0.08);
      document.getElementById('banker-cards').innerHTML += renderCard(bCards[1]);
      await new Promise(r => setTimeout(r, 400));

      let pScore = calcHand(pCards);
      let bScore = calcHand(bCards);
      document.getElementById('player-score').innerText = pScore;
      document.getElementById('banker-score').innerText = bScore;

      // 例牌判定 (Natural 8 / 9)
      const isNatural = (pScore >= 8 || bScore >= 8);
      if (!isNatural) {
        let p3 = null;
        if (pScore <= 5) {
          await new Promise(r => setTimeout(r, 400));
          p3 = drawCard();
          pCards.push(p3);
          playTone(500, 0.08);
          document.getElementById('player-cards').innerHTML += renderCard(p3);
          pScore = calcHand(pCards);
          document.getElementById('player-score').innerText = pScore;
        }

        let bDraw = false;
        if (p3 === null) {
          if (bScore <= 5) bDraw = true;
        } else {
          const v = p3.val;
          if (bScore <= 2) bDraw = true;
          else if (bScore === 3 && v !== 8) bDraw = true;
          else if (bScore === 4 && [2,3,4,5,6,7].includes(v)) bDraw = true;
          else if (bScore === 5 && [4,5,6,7].includes(v)) bDraw = true;
          else if (bScore === 6 && [6,7].includes(v)) bDraw = true;
        }

        if (bDraw) {
          await new Promise(r => setTimeout(r, 400));
          const b3 = drawCard();
          bCards.push(b3);
          playTone(500, 0.08);
          document.getElementById('banker-cards').innerHTML += renderCard(b3);
          bScore = calcHand(bCards);
          document.getElementById('banker-score').innerText = bScore;
        }
      }

      // 胜负与派彩结算
      let winner = 'tie';
      if (pScore > bScore) winner = 'player';
      else if (bScore > pScore) winner = 'banker';

      let winAmt = 0;
      if (winner === 'player') {
        winAmt += bets.player * 2;
      } else if (winner === 'banker') {
        winAmt += Math.floor(bets.banker * 1.95);
      } else {
        winAmt += bets.player + bets.banker + (bets.tie * 9);
      }

      bankroll += winAmt;
      history.push(winner);

      // 显示结果
      banner.classList.remove('hidden', 'bg-blue-600', 'bg-red-600', 'bg-emerald-600');
      if (winner === 'player') {
        banner.classList.add('bg-blue-600');
        banner.innerText = `闲赢 (Player ${pScore} vs Banker ${bScore})`;
        playTone(700, 0.3);
      } else if (winner === 'banker') {
        banner.classList.add('bg-red-600');
        banner.innerText = `庄赢 (Banker ${bScore} vs Player ${pScore})`;
        playTone(700, 0.3);
      } else {
        banner.classList.add('bg-emerald-600');
        banner.innerText = `和局 (Tie ${pScore} 点)`;
        playTone(500, 0.3);
      }

      bets = { player: 0, banker: 0, tie: 0 };
      updateRoad();
      updateUI();
      isDealing = false;
      document.getElementById('deal-btn').disabled = false;
    }

    function updateRoad() {
      const road = document.getElementById('road-grid');
      let p = 0, b = 0, t = 0;
      let html = '';
      history.forEach(win => {
        if (win === 'player') { p++; html += `<span class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">闲</span>`; }
        else if (win === 'banker') { b++; html += `<span class="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">庄</span>`; }
        else { t++; html += `<span class="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">和</span>`; }
      });
      road.innerHTML = html;
      document.getElementById('stat-p').innerText = p;
      document.getElementById('stat-b').innerText = b;
      document.getElementById('stat-t').innerText = t;
    }

    function updateUI() {
      document.getElementById('bankroll-val').innerText = '$' + bankroll.toLocaleString();
      document.getElementById('bet-player').innerText = bets.player ? '$' + bets.player : '';
      document.getElementById('bet-banker').innerText = bets.banker ? '$' + bets.banker : '';
      document.getElementById('bet-tie').innerText = bets.tie ? '$' + bets.tie : '';
    }

    updateUI();
  </script>
</body>
</html>
