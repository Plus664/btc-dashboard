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

    console.log("coincheck data: ", data);

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
  } catch (e) {
    console.error("Coincheck Error: ", e)
    document.getElementById("cc-price").textContent = "エラー";
  }
}

async function fetchCoingecko() {
  try {
    const res = await fetch(`${API_BASE}/coingecko`);
    const data = await res.json();

    const priceUSD = data.market_data.current_price.usd;
    const priceJPY = data.market_data.current_price.jpy;
    const volume = data.market_data.total_volume.usd;

    document.getElementById("cg-price-jpy").textContent = "¥ " + priceJPY.toLocaleString();
    document.getElementById("cg-price-usd").textContent = "$ " + priceUSD.toLocaleString();
    document.getElementById("cg-volume").textContent =
      "24時間出来高: $" + volume.toLocaleString();
  } catch (e) {
    console.error("Coingecko Error", e)
    document.getElementById("cg-price-jpy").textContent = "エラー";
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

  if (pctTh && Math.abs(pct) >= pctTh) {
    const msg = `価格が ${pct.toFixed(2)}% 動きました（現在: ¥${price.toLocaleString()}）`;
    alert(msg);
    logAlert(msg);
    document.getElementById("alert-percent").value = "";
  }

  if (above && price >= above) {
    const msg = `上抜け: ¥${above.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    alert(msg);
    logAlert(msg);
    document.getElementById("alert-above").value = "";
  }

  if (below && price <= below) {
    const msg = `下抜け: ¥${below.toLocaleString()}（現在: ¥${price.toLocaleString()}）`;
    alert(msg);
    logAlert(msg);
    document.getElementById("alert-below").value = "";
  }
}

fetchCoincheck();
fetchCoingecko();
fetchHalving();
fetchFed();
fetchWhale();

setInterval(fetchCoincheck, 3000);

setInterval(fetchCoingecko, 3000);


