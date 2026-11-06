import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
let ready = null;

function ensureTable() {
  ready ??= sql`CREATE TABLE IF NOT EXISTS notas (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return ready;
}

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!ID_RE.test(id)) return res.status(400).json({ error: "id inválido" });

  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`SELECT data FROM notas WHERE id = ${id}`;
      return res.status(200).json({ data: rows[0]?.data ?? null });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const data = body?.data;
      if (!data || typeof data !== "object") return res.status(400).json({ error: "datos inválidos" });
      const json = JSON.stringify(data);
      if (json.length > 20000) return res.status(413).json({ error: "demasiado grande" });
      await sql`INSERT INTO notas (id, data, updated_at) VALUES (${id}, ${json}::jsonb, now())
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return res.status(405).json({ error: "método no permitido" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "error del servidor" });
  }
}
