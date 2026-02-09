// 通知許可をリクエスト
if (Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}

function notify(msg) {
  if (Notification.permission === "granted") {
    new Notification("BTC Alert", { body: msg });
  }
}

let alertSettings = {
  pct: null,
  above: null,
  below: null,
};

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

let lastAlertTime = {
  pct: 0,
  above: 0,
  below: 0,
};

function canAlert(type) {
  const now = Date.now();
  if (now - lastAlertTime[type] < 60000) return false; // 60秒
  lastAlertTime[type] = now;
  return true;
}

const API_BASE = "https://btc-api.soccer710a.workers.dev/api";

let lastCcPrice = null;

function logAlert(msg) {
  const log = document.getElementById("alert-log");
  const div = document.createElement("div");
  div.className = "alert-item";
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.prepend(div);
}

async function fetchCoincheck() {
  try {
    const res = await fetch(`${API_BASE}/coincheck`);
    const data = await res.json();

    const price = Number(data.last);
    const bid = Number(data.bid);
    const ask = Number(data.ask);
    const ts = Number(data.timestamp) * 1000;

    document.getElementById("cc-price").textContent = "¥ " + price.toLocaleString();
    document.getElementById("cc-bidask").textContent =
      `Bid: ¥${bid.toLocaleString()} / Ask: ¥${ask.toLocaleString()}`;
    document.getElementById("cc-lasttime").textContent =
      "最終更新: " + new Date(ts).toLocaleString();

    const badge = document.getElementById("cc-change-badge");

    if (lastCcPrice !== null) {
      const diff = price - lastCcPrice;
      const pct = (diff / lastCcPrice) * 100;

      badge.textContent = `変化率: ${pct.toFixed(2)}%`;
      badge.classList.remove("up", "down");
      if (pct > 0) badge.classList.add("up");
      if (pct < 0) badge.classList.add("down");

      checkAlerts(price, pct);
    }

    lastCcPrice = price;

    // --- チャート更新（ここが重要） ---
    if (btcChart) {
      const t = new Date(ts);
      fullChartData.push({ time: t, price });
      updateChartRange(currentRange);
    }

  } catch (e) {
    document.getElementById("cc-price").textContent = "エラー";
  }
}

async function fetchOrderbook() {
  try {
    const res = await fetch(`${API_BASE}/orderbook`);
    const data = await res.json();

    const bids = data.bids.slice(0, 5)
      .map(b => `¥${Number(b[0]).toLocaleString()} (${b[1]})`)
      .join("<br>");

    const asks = data.asks.slice(0, 5)
      .map(a => `¥${Number(a[0]).toLocaleString()} (${a[1]})`)
      .join("<br>");

    document.getElementById("orderbook-bids").innerHTML = `<b>Bids</b><br>${bids}`;
    document.getElementById("orderbook-asks").innerHTML = `<b>Asks</b><br>${asks}`;

  } catch (e) {
    console.error("orderbook error:", e);
  }
}

async function fetchHalving() {
  try {
    // 固定値を返す想定（例: 2024/04/01）
    const next = new Date("2024-04-01T00:00:00Z");

    document.getElementById("halving-date").textContent =
      "推定日時: " + next.toLocaleString();

    function update() {
      const now = new Date();
      const diff = next - now;
      if (diff <= 0) return;

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);

      document.getElementById("halving-countdown").textContent =
        `${d}日 ${h}時間 ${m}分`;
    }

    update();
    setInterval(update, 60000);

  } catch (e) {
    console.error("Halving fetch error:", e);
  }
}

function checkAlerts(price, pct) {
  const sound = document.getElementById("alert-sound");

  // 変動率
  if (alertSettings.pct && Math.abs(pct) >= alertSettings.pct && canAlert("pct")) {
    const msg = `価格が ${pct.toFixed(2)}% 動きました（現在: ¥${price.toLocaleString()}）`;
    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);
    alertSettings.pct = null;
  }

  // 上抜け
  if (alertSettings.above && price >= alertSettings.above && canAlert("above")) {
    const msg = `上抜け: ¥${alertSettings.above.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);
    alertSettings.above = null;
  }

  // 下抜け
  if (alertSettings.below && price <= alertSettings.below && canAlert("below")) {
    const msg = `下抜け: ¥${alertSettings.below.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);
    alertSettings.below = null;
  }
}

let btcChart;
let chartLabels = [];
let chartPrices = [];
let fullChartData = [];
let currentRange = "1H";

document.querySelectorAll(".chart-range-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-range-buttons button")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
    updateChartRange(btn.dataset.range);
  });
});

function updateChartRange(range) {
  currentRange = range;

  const now = Date.now();
  let cutoff = now;

  if (range === "1H") cutoff -= 1 * 60 * 60 * 1000;
  if (range === "1D") cutoff -= 24 * 60 * 60 * 1000;
  if (range === "1W") cutoff -= 7 * 24 * 60 * 60 * 1000;
  if (range === "1M") cutoff -= 30 * 24 * 60 * 60 * 1000;
  if (range === "1Y") cutoff -= 365 * 24 * 60 * 60 * 1000;

  const filtered = fullChartData.filter(d => d.time.getTime() >= cutoff);

  chartLabels.length = 0;
  chartPrices.length = 0;

  for (const d of filtered) {
    let label;

    if (range === "1H" || range === "1D") {
      label = d.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (range === "1W" || range === "1M") {
      label = `${d.time.getMonth() + 1}/${d.time.getDate()}`;
    } else if (range === "1Y") {
      label = `${d.time.getFullYear()}/${d.time.getMonth() + 1}`;
    }

    chartLabels.push(label);
    chartPrices.push(d.price);
  }

  btcChart.update();
}

async function fetchAI() {
  const range = document.getElementById("predict-range").value;
  try {
    const res = await fetch(`${API_BASE}/ai-predict?range=${range}`);
    const data = await res.json();

    // UI更新
    const labelEl = document.getElementById("ai-label");
    const priceEl = document.getElementById("ai-price-predict");
    const reasonEl = document.getElementById("ai-reason");

    labelEl.textContent = data.predictionLabel;
    labelEl.className = "badge " + (data.predictionLabel === "上昇傾向" ? "ai-up" : data.predictionLabel === "下落傾向" ? "ai-down" : "");
    priceEl.textContent = "¥ " + data.futurePoints[4].price.toLocaleString(); // 5ステップ先の価格
    reasonEl.textContent = `判定スコア: ${data.score} (${range}予測)`;

    return data.futurePoints;
  } catch (e) {
    console.error("AI fetch error:", e);
    return [];
  }
}

async function updateChart() {
  // 実績データの取得
  await fetchCoincheck();

  // AI予測データの取得
  const futurePoints = await fetchAI();

  // チャートデータの更新
  const now = new Date();
  const history = fullChartData.filter(d => d.time > new Date(now - getCutoff(currentRange)));

  // 実績データセット
  btcChart.data.labels = history.map(d => formatLabel(d.time, currentRange));
  btcChart.data.datasets[0].data = history.map(d => d.price);

  // 予測データセット（実績の最後から繋げる）
  if (futurePoints.length > 0) {
    const lastPoint = history[history.length - 1];
    const predictData = new Array(history.length - 1).fill(null);
    predictData.push(lastPoint ? lastPoint.price : null); // 接続点

    futurePoints.forEach(p => {
      predictData.push(p.price);
      btcChart.data.labels.push("予測"); // 未来のラベル
    });
    btcChart.data.datasets[1].data = predictData;
  }

  btcChart.update('none'); // アニメーションなしで更新
}

function getCutoff(range) {
  const m = 60 * 1000;
  if (range === "1H") return 60 * m;
  if (range === "1D") return 24 * 60 * m;
  if (range === "1W") return 7 * 24 * 60 * m;
  return 30 * 24 * 60 * m;
}

function formatLabel(date, range) {
  if (range === "1H") return date.toLocaleTimeString([], { minute: '2-digit' });
  return (date.getMonth() + 1) + "/" + date.getDate();
}

async function initChart() {
  const ctx = document.getElementById("btcChart").getContext("2d");

  btcChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "実績",
          data: [],
          borderColor: "#3ba7ff",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: "予測",
          data: [],
          borderColor: "#3ba7ff",
          borderWidth: 2,
          borderDash: [5, 5], // 点線設定
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      animation: false,
      maintainAspectRatio: false, // コンテナに合わせる
      responsive: true,
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } // ラベル重なり防止
        },
        y: {
          position: 'right', // 右側に価格
          ticks: { font: { size: 10 }, callback: v => v.toLocaleString() }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  // 初回実行
  await updateChart();

  // セレクトボックス連動
  document.getElementById("predict-range").onchange = updateChart;
}

window.addEventListener("load", async () => {
  await initChart();
  fetchCoincheck();
  fetchOrderbook();
  fetchHalving();

  setInterval(fetchCoincheck, 3000);
  setInterval(fetchOrderbook, 3000);
});