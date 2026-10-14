import { pendingApprovals } from "../../../../lib/support";

export async function POST(request: Request) {
  const { id, approved } = await request.json();
  const resolve = pendingApprovals.get(id);
  if (!resolve) return Response.json({ error: "承認待ちが見つかりません" }, { status: 404 });
  pendingApprovals.delete(id);
  resolve(Boolean(approved));
  return Response.json({ ok: true });
}
