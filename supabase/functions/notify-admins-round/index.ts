import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { round_id } = await req.json();
    if (!round_id) {
      return new Response("Missing round_id", { status: 400 });
    }

    // ✅ Variables fournies automatiquement par Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ✅ Secrets personnalisés autorisés
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail =
      Deno.env.get("MAIL_FROM") || "Johan <johan.nkoghoetoughe@centre-diagnostic.com>";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    /* ============================
       1) Récupération de la ronde
       ============================ */
    const { data: round, error: roundErr } = await supabase
      .from("checklist_rounds")
      .select("id, created_at, ronde_date, created_by")
      .eq("id", round_id)
      .single();

    if (roundErr || !round) {
      return new Response("Ronde introuvable", { status: 404 });
    }

    /* ============================
       2) Identité agent
       ============================ */
    const { data: agent } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", round.created_by)
      .single();

    const agentIdentity =
      agent?.full_name?.trim() ||
      agent?.email?.trim() ||
      `Agent ${String(round.created_by).slice(0, 8)}`;

    /* ============================
       3) Emails des admins
       ============================ */
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .not("email", "is", null);

    const recipients = (admins || [])
      .map((a) => a.email)
      .filter(Boolean);

    if (!recipients.length) {
      return new Response("Aucun admin avec email", { status: 200 });
    }

    /* ============================
       4) Email
       ============================ */
    const closedAt = new Date(round.created_at).toLocaleString("fr-FR");

    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>✅ Ronde QHSE clôturée</h2>
        <p><b>Date de ronde :</b> ${round.ronde_date}</p>
        <p><b>Heure de clôture :</b> ${closedAt}</p>
        <p><b>Agent :</b> ${agentIdentity}</p>
        <hr/>
        <p style="font-size:12px;color:#64748B">
          Centre Diagnostic – Application QHSE
        </p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject: `Ronde QHSE clôturée – ${round.ronde_date}`,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(err, { status: 500 });
    }

    return new Response(
      JSON.stringify({ ok: true, sent: recipients.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
});
