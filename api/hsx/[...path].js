module.exports = async function handler(req, res) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join('/') : (segments ?? '');

  const url = new URL(`https://api.hsx.vn/${path}`);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers: {
      Origin: 'https://www.hsx.vn',
      Referer: 'https://www.hsx.vn/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
