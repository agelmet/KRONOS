/* POST /api/save {pass, action:"login"}                -> {ok}
   POST /api/save {pass, action:"publish", content}     -> {ok, when}
   POST /api/save {pass, action:"undo"}                 -> {ok, content}   (puts back the version before the last publish)
   Saves to Netlify Blobs only — no Git commit, no rebuild, no deploy, 0 credits. */
import { content, json, checkPass } from "./_lib.mjs";
const str = (v, n) => v == null || (typeof v === "string" && v.length <= n);
const okImg = (im) => im && typeof im.src === "string" && im.src.length < 300 && !/^data:/.test(im.src);
const okShape = (c) => c && typeof c === "object" &&
  Array.isArray(c.projects) && c.projects.length <= 40 && c.projects.every((p) => p && str(p.t, 160) && str(p.txt, 2500) && (p.imgs || []).length <= 6 && (p.imgs || []).every(okImg)) &&
  Array.isArray(c.gallery) && c.gallery.length <= 200 && c.gallery.every((g) => okImg(g) && str(g.cap, 120)) &&
  Array.isArray(c.jobs) && c.jobs.length <= 30 && c.jobs.every((j) => j && str(j.t, 160) && str(j.txt, 3000)) &&
  c.contact && typeof c.contact === "object" && str(c.contact.email, 120) && str(c.contact.phone, 40) &&
  c.legal && typeof c.legal === "object";
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: "json" }, 400); }
  if (!(await checkPass(b.pass))) return json({ ok: false, error: "pass" }, 401);
  if (b.action === "login") return json({ ok: true });
  const st = content();
  if (b.action === "undo") {
    const prev = await st.get("content-prev.json");
    if (!prev) return json({ ok: false, error: "nothing to undo" }, 404);
    const cur = await st.get("content.json");
    const c = JSON.parse(prev); c.updated = new Date().toISOString();
    await st.set("content.json", JSON.stringify(c)); if (cur) await st.set("content-prev.json", cur);
    return json({ ok: true, content: c });
  }
  if (b.action !== "publish") return json({ ok: false, error: "action" }, 400);
  if (!okShape(b.content)) return json({ ok: false, error: "content" }, 400);
  const c = b.content; c.updated = new Date().toISOString();
  const text = JSON.stringify(c);
  if (text.length > 900000) return json({ ok: false, error: "too big" }, 413);
  try {
    const prev = await st.get("content.json");
    if (prev) { await st.set("content-prev.json", prev); await st.set("history/" + c.updated.slice(0, 10) + ".json", prev); }
    await st.set("content.json", text);
  } catch (e) { return json({ ok: false, error: "store" }, 500); }
  return json({ ok: true, when: c.updated });
};
export const config = { path: "/api/save" };
