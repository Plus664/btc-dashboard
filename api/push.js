import webPush from 'web-push';

// VAPID設定
webPush.setVapidDetails(
  'mailto:btc-alert@example.com',
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

// 簡単なSubscription保存用 (メモリ or DBに変えてOK)
let subscriptions = [];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  // Subscription保存
  if (req.method === 'POST' && req.url.includes('/api/subscribe')) {
    const sub = req.body;
    // endpointで重複チェック
    if (!subscriptions.find(s => s.endpoint === sub.endpoint)) {
      subscriptions.push(sub);
    }
    return res.status(200).json({ ok: true });
  }

  // 通知送信
  if (req.method === 'POST' && req.url.includes('/api/push')) {
    const payload = JSON.stringify({
      title: 'BTCが動いたよ！',
      body: 'Whale検知 / Orderbook変動',
      icon: '/icon.png'
    });

    await Promise.all(subscriptions.map(sub =>
      webPush.sendNotification(sub, payload).catch(console.error)
    ));

    return res.status(200).json({ ok: true });
  }

  res.status(404).send('Not found');
}
