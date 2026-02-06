export async function onRequest(context) {
  // TODO: FRED API に差し替え
  return new Response(JSON.stringify({
    rate: null,
    note: "Fed金利APIは未接続"
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}