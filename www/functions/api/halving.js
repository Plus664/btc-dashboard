export async function onRequest(context) {
  // 仮の次回半減期（あとでブロック数計算に差し替え可）
  const nextHalving = "2028-04-20T00:00:00Z";

  return new Response(JSON.stringify({ nextHalving }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}