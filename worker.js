export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 共通ヘッダ
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (path === '/api/coincheck') {
        const r = await fetch('https://coincheck.com/api/ticker');
        const data = await r.json();
        return json(data, corsHeaders);
      }

      if (path === '/api/coingecko') {
        const r = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
        const data = await r.json();
        return json(data, corsHeaders);
      }

      if (path === '/api/halving') {
        // 仮：次回半減期を固定日で返す（あとでブロック数計算に差し替え可）
        const nextHalving = '2028-04-20T00:00:00Z';
        return json({ nextHalving }, corsHeaders);
      }

      if (path === '/api/fed') {
        // TODO: FRED API などに差し替え
        return json({ rate: null, note: 'TODO: Fed rate API を接続' }, corsHeaders);
      }

      if (path === '/api/whale') {
        // TODO: Whale Alert API などに差し替え
        return json({ info: 'TODO: クジラAPIを接続' }, corsHeaders);
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response('Error: ' + e.toString(), { status: 500, headers: corsHeaders });
    }
  },
};

function json(obj, headers) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}