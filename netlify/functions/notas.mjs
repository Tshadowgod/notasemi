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

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json(400, { error: "id inválido" });

  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`SELECT data FROM notas WHERE id = ${id}`;
      return json(200, { data: rows[0]?.data ?? null });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const text = await req.text();
      if (text.length > 20000) return json(413, { error: "demasiado grande" });
      let data;
      try { data = JSON.parse(text)?.data; } catch { return json(400, { error: "datos inválidos" }); }
      if (!data || typeof data !== "object") return json(400, { error: "datos inválidos" });
      await sql`INSERT INTO notas (id, data, updated_at) VALUES (${id}, ${JSON.stringify(data)}::jsonb, now())
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return json(200, { ok: true });
    }

    return json(405, { error: "método no permitido" }, { Allow: "GET, PUT, POST" });
  } catch (e) {
    console.error(e);
    return json(500, { error: "error del servidor" });
  }
};

export const config = { path: "/api/notas" };
