const API_COINCHECK = 'https://coincheck.com/api/ticker';
const API_ORDERBOOK = 'https://coincheck.com/api/order_books';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key !== "secsecsecsecsec") {
      return new Response('Forbidden', { status: 403 });
    }
    const path = url.pathname;

    if (path === '/robots.txt') {
      return new Response("User-agent:*\nDisallow: /", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    // --- 最新価格取得 ---
    if (path === '/api/coincheck') {
      const res = await fetch(API_COINCHECK);
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }

    // --- 板情報取得 ---
    if (path === '/api/orderbook') {
      const res = await fetch(API_ORDERBOOK);
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }

    // --- 履歴取得（ここを大幅軽量化） ---
    if (path === '/api/history') {
      const history = await env.BTC_KV.get("full_history");
      // データがない場合は空配列を返す
      return new Response(history || "[]", { headers: CORS_HEADERS });
    }

    // --- AI予測 ---
    if (path === '/api/ai-predict') {
      const range = url.searchParams.get('range') || '1H';
      const ticker = await (await fetch(API_COINCHECK)).json();
      const orderbook = await (await fetch(API_ORDERBOOK)).json();

      // 履歴データを使って予測ロジックへ
      const historyRaw = await env.BTC_KV.get("full_history");
      const historyArr = historyRaw ? JSON.parse(historyRaw).map(d => d.price) : [];

      const prediction = this.generatePrediction(ticker.last, historyArr, orderbook, range);
      return new Response(JSON.stringify(prediction), { headers: CORS_HEADERS });
    }

    // --- 半減期 ---
    if (path === '/api/halving') {
      const nextHalving = new Date('2028-04-17T00:00:00Z');
      return new Response(JSON.stringify({
        nextHalving: nextHalving.toISOString(),
        daysRemaining: Math.ceil((nextHalving.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }), { headers: CORS_HEADERS });
    }

    return new Response('Path Not Found', { status: 404, headers: CORS_HEADERS });
  },

  // --- 履歴保存 (Cron用: 1つのキーに配列で溜める) ---
  async scheduled(event, env, ctx) {
    const res = await fetch(API_COINCHECK);
    const data = await res.json();
    const price = parseFloat(data.last);
    const now = Date.now();

    // 1. 現在の全履歴を取得
    const historyRaw = await env.BTC_KV.get("full_history");
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // 2. 新しいデータを追加
    history.push({ time: now, price: price });

    // 3. データを足しすぎるとKVの容量制限(1ファイル25MB)に触れるので、直近200件程度に絞る
    // (1分に1回実行なら、200件で約3時間分)
    if (history.length > 200) {
      history = history.slice(-200);
    }

    // 4. KVに書き戻す
    await env.BTC_KV.put("full_history", JSON.stringify(history));
  },

  // AIロジック (引数のhistoryを配列として処理するように調整)
  generatePrediction(currentPrice, historyArr, orderbook, range) {
    const price = parseFloat(currentPrice);
    const oldPrice = historyArr.length > 0 ? historyArr[0] : price;
    const momentum = (price - oldPrice) / oldPrice;

    const bidVol = orderbook.bids.slice(0, 10).reduce((s, b) => s + parseFloat(b[1]), 0);
    const askVol = orderbook.asks.slice(0, 10).reduce((s, a) => s + parseFloat(a[1]), 0);
    const pressure = (bidVol / (bidVol + askVol)) - 0.5;

    const volatilityMap = { '1H': 0.002, '1D': 0.015, '1W': 0.05, '1M': 0.12 };
    const coeff = volatilityMap[range] || 0.01;
    const score = (momentum * 0.4) + (pressure * 0.6);

    const futurePoints = [];
    for (let i = 1; i <= 5; i++) {
      futurePoints.push({ step: i, price: Math.floor(price * (1 + (score * coeff * i))) });
    }

    return {
      predictionLabel: score > 0.02 ? "上昇傾向" : score < -0.02 ? "下落傾向" : "横ばい",
      score: score.toFixed(4),
      futurePoints: futurePoints
    };
  }
};