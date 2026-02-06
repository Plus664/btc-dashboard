export async function onRequest(context) {
  const url = "https://api.blockchain.info/charts/output-volume?timespan=1days&format=json";

  try {
    const res = await fetch(url);
    const data = await res.json();

    const latest = data.values[data.values.length - 1];

    return new Response(JSON.stringify({
      info: `大口送金量: ${(latest.y / 1e9).toFixed(2)} BTC/日`
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      info: "取得エラー"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}