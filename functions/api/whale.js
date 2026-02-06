export async function onRequest(context) {
  // TODO: Whale Alert API に差し替え
  return new Response(JSON.stringify({
    info: "クジラAPIは未接続"
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}