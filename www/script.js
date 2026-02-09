// --- 設定 ---
const API_BASE = "https://btc-api.soccer710a.workers.dev/api";
let btcChart;
let fullChartData = [];
let currentRange = "1H";
let lastCcPrice = null;

// 通知許可をリクエスト
if (Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}

function notify(msg) {
  if (Notification.permission === "granted") {
    new Notification("BTC Alert", { body: msg });
  }
}

// --- アラート機能 ---
let alertSettings = { pct: null, above: null, below: null };
let lastAlertTime = { pct: 0, above: 0, below: 0 };

function logAlert(msg) {
  const log = document.getElementById("alert-log");
  const div = document.createElement("div");
  div.className = "alert-item";
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.prepend(div);
}

document.getElementById("set-alert-percent").onclick = () => {
  alertSettings.pct = Number(document.getElementById("alert-percent").value);
  logAlert(`変動率アラートを ${alertSettings.pct}% に設定しました`);
};
document.getElementById("set-alert-above").onclick = () => {
  alertSettings.above = Number(document.getElementById("alert-above").value);
  logAlert(`上抜けアラートを ¥${alertSettings.above.toLocaleString()} に設定しました`);
};
document.getElementById("set-alert-below").onclick = () => {
  alertSettings.below = Number(document.getElementById("alert-below").value);
  logAlert(`下抜けアラートを ¥${alertSettings.below.toLocaleString()} に設定しました`);
};

function canAlert(type) {
  const now = Date.now();
  if (now - lastAlertTime[type] < 60000) return false;
  lastAlertTime[type] = now;
  return true;
}

function checkAlerts(price, pct) {
  const sound = document.getElementById("alert-sound");
  if (alertSettings.pct && Math.abs(pct) >= alertSettings.pct && canAlert("pct")) {
    const msg = `価格が ${pct.toFixed(2)}% 動きました（現在: ¥${price.toLocaleString()}）`;
    sound.play(); notify(msg); alert(msg); logAlert(msg);
    alertSettings.pct = null;
  }
  if (alertSettings.above && price >= alertSettings.above && canAlert("above")) {
    const msg = `上抜け: ¥${alertSettings.above.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    sound.play(); notify(msg); alert(msg); logAlert(msg);
    alertSettings.above = null;
  }
  if (alertSettings.below && price <= alertSettings.below && canAlert("below")) {
    const msg = `下抜け: ¥${alertSettings.below.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    sound.play(); notify(msg); alert(msg); logAlert(msg);
    alertSettings.below = null;
  }
}

// --- API取得 & チャート更新 ---

async function fetchCoincheck() {
  try {
    const res = await fetch(`${API_BASE}/coincheck`);
    const data = await res.json();
    const price = Number(data.last);
    const ts = Number(data.timestamp) * 1000;

    document.getElementById("cc-price").textContent = "¥ " + price.toLocaleString();
    document.getElementById("cc-bidask").textContent = `Bid: ¥${Number(data.bid).toLocaleString()} / Ask: ¥${Number(data.ask).toLocaleString()}`;
    document.getElementById("cc-lasttime").textContent = "最終更新: " + new Date(ts).toLocaleString();

    const badge = document.getElementById("cc-change-badge");
    if (lastCcPrice !== null) {
      const diff = price - lastCcPrice;
      const pct = (diff / lastCcPrice) * 100;
      badge.textContent = `変化率: ${pct.toFixed(2)}%`;
      badge.className = "badge " + (pct > 0 ? "up" : "down");
      checkAlerts(price, pct);
    }
    lastCcPrice = price;

    // データを履歴に蓄積
    fullChartData.push({ time: new Date(ts), price: price });
    // サイトを開いた直後にチャートが出るように
    if (btcChart) updateChart();

  } catch (e) { console.error("CC fetch error:", e); }
}

async function fetchOrderbook() {
  try {
    const res = await fetch(`${API_BASE}/orderbook`);
    const data = await res.json();
    const bidHtml = data.bids.slice(0, 5).map(b => `¥${Number(b[0]).toLocaleString()} (${b[1]})`).join("<br>");
    const askHtml = data.asks.slice(0, 5).map(a => `¥${Number(a[0]).toLocaleString()} (${a[1]})`).join("<br>");
    document.getElementById("orderbook-bids").innerHTML = `<b>Bids</b><br>${bidHtml}`;
    document.getElementById("orderbook-asks").innerHTML = `<b>Asks</b><br>${askHtml}`;
  } catch (e) { console.error("Orderbook error:", e); }
}

async function fetchHalving() {
  try {
    // Workerの /api/halving から最新を取得
    const res = await fetch(`${API_BASE}/halving`);
    const data = await res.json();
    const nextDate = new Date(data.nextHalving);

    document.getElementById("halving-date").textContent = "推定日時: " + nextDate.toLocaleDateString();

    const updateCounter = () => {
      const diff = nextDate - new Date();
      if (diff <= 0) return;
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      document.getElementById("halving-countdown").textContent = `${d}日 ${h}時間 ${m}分`;
    };
    updateCounter();
    setInterval(updateCounter, 60000);
  } catch (e) { console.error("Halving fetch error:", e); }
}

async function fetchAI() {
  const range = document.getElementById("predict-range").value;
  try {
    const res = await fetch(`${API_BASE}/ai-predict?range=${range}`);
    const data = await res.json();
    document.getElementById("ai-label").textContent = data.predictionLabel;
    document.getElementById("ai-label").className = "badge " + (data.predictionLabel === "上昇傾向" ? "ai-up" : data.predictionLabel === "下落傾向" ? "ai-down" : "");
    document.getElementById("ai-price-predict").textContent = "¥ " + data.futurePoints[4].price.toLocaleString();
    document.getElementById("ai-reason").textContent = `判定スコア: ${data.score} (${range}予測)`;
    return data.futurePoints;
  } catch (e) { return []; }
}

async function updateChart() {
  if (!btcChart || fullChartData.length === 0) return;

  const now = new Date();
  const futurePoints = await fetchAI();
  const history = fullChartData.filter(d => d.time > new Date(now - getCutoff(currentRange)));

  if (history.length === 0) return;

  // 実績データのセット
  btcChart.data.labels = history.map(d => formatLabel(d.time, currentRange));
  btcChart.data.datasets[0].data = history.map(d => d.price);

  // 予測データのセット（実績の末尾に接続）
  if (futurePoints && futurePoints.length > 0) {
    const lastPoint = history[history.length - 1];
    const predictData = new Array(history.length - 1).fill(null);
    predictData.push(lastPoint.price); // 接続点

    futurePoints.forEach(p => {
      predictData.push(p.price);
      btcChart.data.labels.push("予測");
    });
    btcChart.data.datasets[1].data = predictData;
  }
  btcChart.update('none');
}

function getCutoff(range) {
  const m = 60 * 1000;
  if (range === "1H") return 60 * m;
  if (range === "1D") return 24 * 60 * m;
  if (range === "1W") return 7 * 24 * 60 * m;
  if (range === "1M") return 30 * 24 * 60 * m;
  return 365 * 24 * 60 * m;
}

function formatLabel(date, range) {
  if (range === "1H") return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (date.getMonth() + 1) + "/" + date.getDate();
}

// --- 初期化 ---

document.querySelectorAll(".chart-range-buttons button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".chart-range-buttons button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.range;
    updateChart();
  };
});

async function initChart() {
  const ctx = document.getElementById("btcChart").getContext("2d");
  btcChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "実績", data: [], borderColor: "#3ba7ff", borderWidth: 2, pointRadius: 0, tension: 0.1 },
        { label: "予測", data: [], borderColor: "#3ba7ff", borderWidth: 2, borderDash: [5, 5], pointRadius: 0, tension: 0.1 }
      ]
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } },
        y: { position: 'right', ticks: { font: { size: 10 }, callback: v => v.toLocaleString() } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// --- 追加：Workerから過去ログを取得する関数 ---
async function fetchHistory() {
  try {
    // Workerに「過去ログちょうだい」とリクエスト（エンドポイントは後でWorker側で作ります）
    const res = await fetch(`${API_BASE}/history`);
    const data = await res.json(); // [{time: 1234567, price: 11000000}, ...]

    if (data && data.length > 0) {
      // 取得したデータをチャート用の変数に流し込む
      fullChartData = data.map(d => ({
        time: new Date(d.time),
        price: Number(d.price)
      }));
      // 時間順に並び替え
      fullChartData.sort((a, b) => a.time - b.time);
    }
  } catch (e) {
    console.error("History fetch error:", e);
  }
}

// --- 修正：ページ読み込み時の処理 ---
window.addEventListener("load", async () => {
  await initChart();
  await fetchHistory(); // まず過去ログを読み込む ★追加
  await fetchCoincheck(); // その後、最新価格を取得
  fetchOrderbook();
  fetchHalving();

  setInterval(fetchCoincheck, 5000);
  setInterval(fetchOrderbook, 5000);
});