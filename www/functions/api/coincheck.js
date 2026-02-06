export async function onRequest(context) {
  const res = await fetch("https://coincheck.com/api/ticker");
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}