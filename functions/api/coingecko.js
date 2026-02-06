export async function onRequest(context) {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,jpy&include_24hr_vol=true";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "btc-dashboard/1.0"
    }
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}