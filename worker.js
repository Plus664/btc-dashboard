const API_COINCHECK = 'https://coincheck.com/api/ticker';
const API_ORDERBOOK = 'https://coincheck.com/api/order_books';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // これがCORS解決に必須
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const path = url.pathname;

    // --- script.jsの要望に合わせてパスを定義し直す ---

    if (path === '/api/coincheck') {
      const res = await fetch(API_COINCHECK);
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }

    if (path === '/api/orderbook') {
      const res = await fetch(API_ORDERBOOK);
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }

    if (path === '/api/ai-predict') {
      const range = url.searchParams.get('range') || '1H';
      const ticker = await (await fetch(API_COINCHECK)).json();
      const orderbook = await (await fetch(API_ORDERBOOK)).json();
      const history = await this.getHistory(env, range);
      const prediction = this.generatePrediction(ticker.last, history, orderbook, range);
      return new Response(JSON.stringify(prediction), { headers: CORS_HEADERS });
    }

    if (path === '/api/halving') {
      const nextHalving = new Date('2028-04-20T00:00:00Z');
      return new Response(JSON.stringify({
        nextHalving: nextHalving.toISOString(),
        daysRemaining: Math.ceil((nextHalving.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }), { headers: CORS_HEADERS });
    }

    // どのパスにも当てはまらない場合
    return new Response('Path Not Found', { status: 404, headers: CORS_HEADERS });
  },

  // 履歴保存 (Cron用)
  async scheduled(event, env, ctx) {
    const res = await fetch(API_COINCHECK);
    const data = await res.json();
    await env.BTC_KV.put(`hist_${Date.now()}`, data.last, { expirationTtl: 86400 * 30 });
  },

  // AIロジック
  generatePrediction(currentPrice, history, orderbook, range) {
    const price = parseFloat(currentPrice);
    const oldPrice = history.length > 0 ? history[0] : price;
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
  },

  async getHistory(env, range) {
    try {
      const list = await env.BTC_KV.list({ prefix: 'hist_', limit: 10 });
      const prices = [];
      for (const key of list.keys) {
        const val = await env.BTC_KV.get(key.name);
        if (val) prices.push(parseFloat(val));
      }
      return prices;
    } catch (e) { return []; }
  }
};