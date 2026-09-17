// Función serverless de Vercel: guarda y lee todos los datos en Upstash Redis.
// Variables de entorno (las crea Vercel al conectar Upstash Redis desde Storage):
//   KV_REST_API_URL / KV_REST_API_TOKEN  (o UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// Opcional: APP_PASSWORD  -> si existe, la app pide contraseña.

const KEY = 'bbps-contenido';
const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!DB_URL || !DB_TOKEN) {
    return res.status(503).json({ error: 'Base de datos no configurada' });
  }

  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers['x-app-password'] !== pass) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${DB_URL}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${DB_TOKEN}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      return res.status(200).json({ data: j.result ? JSON.parse(j.result) : null });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.locales) || !body.historial ||
          !Array.isArray(body.historial.reel) || !Array.isArray(body.historial.stories)) {
        return res.status(400).json({ error: 'Datos inválidos' });
      }
      const r = await fetch(DB_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${DB_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', KEY, JSON.stringify(body)]),
      });
      if (!r.ok) throw new Error(await r.text());
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
