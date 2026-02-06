// 通知許可をリクエスト
if (Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}

function notify(msg) {
  if (Notification.permission === "granted") {
    new Notification("BTC Alert", { body: msg });
  }
}

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

const API_BASE = "/api";

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
    /*chartData.push({
      time: Math.floor(ts / 1000),
      value: price,
    });

    if (chartData.length > 100) chartData.shift();

    lineSeries.setData(chartData);*/
    if (chart && lineSeries) {
      chartData.push({
        time: Math.floor(ts / 1000),
        value: price,
      });

      if (chartData.length > 100) chartData.shift();

      lineSeries.setData(chartData);
    }

  } catch (e) {
    document.getElementById("cc-price").textContent = "エラー";
  }
}

async function fetchOrderbook() {
  try {
    const res = await fetch("/api/orderbook");
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
  const res = await fetch(`${API_BASE}/halving`);
  const data = await res.json();
  const next = new Date(data.nextHalving);

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
}

async function fetchFed() {
  const res = await fetch(`${API_BASE}/fed`);
  const data = await res.json();

  document.getElementById("fed-rate").textContent =
    data.rate == null ? "未接続" : data.rate + "%";

  if (data.note) {
    document.getElementById("fed-note").textContent = data.note;
  }
}

async function fetchWhale() {
  const res = await fetch(`${API_BASE}/whale`);
  const data = await res.json();
  document.getElementById("whale-info").textContent = data.info;
}

function checkAlerts(price, pct) {
  const pctTh = Number(document.getElementById("alert-percent").value);
  const above = Number(document.getElementById("alert-above").value);
  const below = Number(document.getElementById("alert-below").value);

  const sound = document.getElementById("alert-sound");

  // --- 変動率アラート ---
  if (pctTh && Math.abs(pct) >= pctTh && canAlert("pct")) {
    const msg = `価格が ${pct.toFixed(2)}% 動きました（現在: ¥${price.toLocaleString()}）`;

    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);

    document.getElementById("alert-percent").value = "";
  }

  // --- 上抜けアラート ---
  if (above && price >= above && canAlert("above")) {
    const msg = `上抜け: ¥${above.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;

    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);

    document.getElementById("alert-above").value = "";
  }

  // --- 下抜けアラート ---
  if (below && price <= below && canAlert("below")) {
    const msg = `下抜け: ¥${below.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;

    sound.play();
    notify(msg);
    alert(msg);
    logAlert(msg);

    document.getElementById("alert-below").value = "";
  }
}

// --- チャート初期化 ---
/*const chartContainer = document.getElementById("chart-container");
const chart = LightweightCharts.createChart(chartContainer, {
  layout: {
    background: { color: "#171720" },
    textColor: "#ffffff",
  },
  grid: {
    vertLines: { color: "rgba(255,255,255,0.05)" },
    horzLines: { color: "rgba(255,255,255,0.05)" },
  },
  timeScale: {
    borderColor: "rgba(255,255,255,0.1)",
  },
  rightPriceScale: {
    borderColor: "rgba(255,255,255,0.1)",
  },
});


const lineSeries = chart.addLineSeries({
  color: "#3ba7ff",
  lineWidth: 2,
});

// チャート用のデータ保持
let chartData = [];
*/
// --- チャート初期化（最小構成） ---
let chart, lineSeries, chartData = [];

window.addEventListener("load", () => {
  const container = document.getElementById("chart-container");
  console.log("LightweightCharts:", LightweightCharts);
  console.log("container:", container);

  chart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: "#171720" },
      textColor: "#ffffff",
    },
    grid: {
      vertLines: { color: "rgba(255,255,255,0.05)" },
      horzLines: { color: "rgba(255,255,255,0.05)" },
    },
    timeScale: {
      borderColor: "rgba(255,255,255,0.1)",
    },
    rightPriceScale: {
      borderColor: "rgba(255,255,255,0.1)",
    },
  });

  console.log("chart:", chart);

  lineSeries = chart.addLineSeries({
    color: "#3ba7ff",
    lineWidth: 2,
  });

  chartData = [];
});

fetchCoincheck();
fetchOrderbook();
fetchHalving();
fetchFed();
fetchWhale();

setInterval(fetchCoincheck, 3000);
setInterval(fetchOrderbook, 3000);