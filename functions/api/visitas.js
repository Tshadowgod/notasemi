import { neon } from "@neondatabase/serverless";

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
let ready = null;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// GET: devuelve los contadores. POST ?id=...: registra una visita de ese visitante.
export async function onRequest({ request, env }) {
  const sql = neon(env.DATABASE_URL);
  try {
    ready ??= sql`CREATE TABLE IF NOT EXISTS visitantes (
      id TEXT PRIMARY KEY,
      primera TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultima TIMESTAMPTZ NOT NULL DEFAULT now(),
      visitas INTEGER NOT NULL DEFAULT 1
    )`;
    await ready;

    if (request.method === "POST") {
      const id = new URL(request.url).searchParams.get("id") || "";
      if (!ID_RE.test(id)) return json(400, { error: "id inválido" });
      await sql`INSERT INTO visitantes (id) VALUES (${id})
                ON CONFLICT (id) DO UPDATE SET visitas = visitantes.visitas + 1, ultima = now()`;
    } else if (request.method !== "GET") {
      return json(405, { error: "método no permitido" });
    }

    const [row] = await sql`SELECT count(*)::int AS personas, coalesce(sum(visitas), 0)::int AS visitas,
                                   count(*) FILTER (WHERE ultima > now() - interval '1 day')::int AS hoy
                            FROM visitantes`;
    return json(200, row);
  } catch (e) {
    ready = null;
    console.error(e);
    return json(500, { error: "error del servidor" });
  }
}
