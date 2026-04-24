export default async function handler(req, res) {
  const target = 'https://api.hsx.vn' + req.url.replace('/api/hsx', '');

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        'Origin': 'https://www.hsx.vn',
        'Referer': 'https://www.hsx.vn/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    const body = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
    res.status(response.status).send(body);
  } catch {
    res.status(502).json({ error: 'Proxy error' });
  }
}
