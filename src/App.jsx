import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ✅ Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ukacnzxftrmyqjzmiatq.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_xbu7Lm_JMAgoV7kyWm3CPw_kmLicfaX";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🎨 Charte (inspirée du logo : teal/cyan + gris)
const BRAND = {
  primary: "#41B8AB",   // teal
  primary2: "#5AC2EC",  // cyan
  text: "#0F172A",
  muted: "#64748B",
  panel: "#0B1220",
};

const LOGO_URL = "/logo-centre-diagnostic.png"; // Mets le logo dans /public avec ce nom

// ✅ Checklist (structure stable + stockage JSON)
const CHECKLIST = [
  {
    section: "Bâtiment & Locaux",
    items: [
      { id: "bat_doors_locks", label: "Portes et serrures fonctionnelles" },
      { id: "bat_windows", label: "Fenêtres / ouvertures" },
      { id: "bat_ventilation", label: "Ventilation naturelle ou mécanique opérationnelle" },
      { id: "bat_ceiling", label: "État des plafonds (taches, fuites, fissures)" },
      { id: "bat_walls", label: "État des murs et peintures" },
      { id: "bat_floors", label: "État des sols (carrelage, lino, fissures, décollements)" },
      { id: "bat_lighting", label: "Éclairage suffisant et opérationnel dans toutes les zones" },
    ],
  },
  {
    section: "Installations Électriques",
    items: [
      { id: "elec_inside_lighting", label: "Éclairage intérieur" },
      { id: "elec_outside_lighting", label: "Éclairage extérieur" },
      { id: "elec_outlets", label: "Prises de courant (fixation, chauffe, odeur, déclenchement)" },
      { id: "elec_cabinets", label: "Armoires électriques fermées et propres" },
      { id: "elec_ups", label: "Onduleurs (voyants, alarmes, autonomie)" },
    ],
  },
  {
    section: "Plomberies & Sanitaires",
    items: [
      { id: "plumb_leaks", label: "Absence de fuite visible (WC, lavabo, douche, réseau d’eau)" },
      { id: "plumb_pressure", label: "Pression d’eau correcte" },
      { id: "plumb_flush", label: "Chasses d’eau fonctionnelles" },
      { id: "plumb_drainage", label: "Évacuation correcte / pas d’odeur anormale" },
      { id: "plumb_points_secured", label: "Points d’eau fermés et sécurisés" },
    ],
  },
  {
    section: "Climatisation / Froid",
    items: [
      { id: "ac_no_leak", label: "Absence de fuite d’eau" },
      { id: "ac_noise", label: "Bruit anormal ?" },
    ],
  },
];

// helpers
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function flattenChecklistAnswers(answers) {
  // answers shape: { [itemId]: { value: "Oui"|"Non"|"" , comment: "" } }
  const flat = {};
  for (const group of CHECKLIST) {
    for (const it of group.items) {
      const a = answers?.[it.id] || {};
      flat[`${it.id}__value`] = a.value || "";
      flat[`${it.id}__comment`] = a.comment || "";
    }
  }
  return flat;
}

function ensureAllChecklistKeys(answers) {
  const next = { ...(answers || {}) };
  for (const group of CHECKLIST) {
    for (const it of group.items) {
      if (!next[it.id]) next[it.id] = { value: "", comment: "" };
      if (typeof next[it.id].value !== "string") next[it.id].value = "";
      if (typeof next[it.id].comment !== "string") next[it.id].comment = "";
    }
  }
  return next;
}

function Badge({ tone = "neutral", children }) {
  const styles =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "no"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  return <span className={classNames("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles)}>{children}</span>;
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className={classNames(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
          "focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        )}
      />
    </label>
  );
}

function Button({ variant = "primary", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? `text-white`
      : variant === "soft"
      ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
      : variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50";
  const styleInline =
    variant === "primary" ? { background: `linear-gradient(90deg, ${BRAND.primary} 0%, ${BRAND.primary2} 100%)` } : undefined;

  return <button {...props} className={classNames(base, styles, className)} style={styleInline} />;
}

function Card({ children, className = "" }) {
  return (
    <div className={classNames("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function Container({ children }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</div>;
}

function Topbar({ userEmail, role, onSignOut }) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <Container>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Centre Diagnostic" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">Application QHSE</div>
              <div className="text-xs text-slate-500">Ronde journalière · Checklist · Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex sm:flex-col sm:items-end">
              <div className="text-sm font-medium text-slate-900">{userEmail}</div>
              <div className="text-xs text-slate-500">Rôle: <span className="font-semibold">{role}</span></div>
            </div>
            <Button variant="soft" onClick={onSignOut}>Se déconnecter</Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

function LoginScreen({ mode, setMode, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin({ email, password, expectedRole: mode === "admin" ? "admin" : "agent" });
    } catch (err) {
      setError(err?.message || "Erreur de connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-slate-50">
      <Container>
        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <img src={LOGO_URL} alt="Centre Diagnostic" className="h-12 w-auto" />
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              QHSE · Ronde Journalière
            </h1>
           
            
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
  Checklist basée sur la procédure de ronde journalière QHSE – Centre Diagnostic de Libreville.
</div>

          </div>

          <Card>
            <CardHeader
              title="Connexion"
              subtitle="Choisis ton accès puis connecte-toi"
              right={
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    className={classNames(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold",
                      mode === "agent" ? "bg-white shadow-sm" : "text-slate-600"
                    )}
                    onClick={() => setMode("agent")}
                    type="button"
                  >
                    Agent
                  </button>
                  <button
                    className={classNames(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold",
                      mode === "admin" ? "bg-white shadow-sm" : "text-slate-600"
                    )}
                    onClick={() => setMode("admin")}
                    type="button"
                  >
                    Admin
                  </button>
                </div>
              }
            />
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div> : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Connexion..." : `Se connecter (${mode === "admin" ? "Admin" : "Agent"})`}
              </Button>
              
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}

function ChecklistScreen({ user, onSaved }) {
  const [rondeDate, setRondeDate] = useState(todayISO());
  const [answers, setAnswers] = useState(() => ensureAllChecklistKeys({}));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function setValue(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), value } }));
  }
  function setComment(id, comment) {
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), comment } }));
  }

  const completion = useMemo(() => {
    const all = CHECKLIST.flatMap((g) => g.items.map((i) => i.id));
    const done = all.filter((id) => (answers?.[id]?.value || "") !== "").length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }, [answers]);

  async function saveRound() {
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        ronde_date: rondeDate,
        created_by: user.id,
        answers: ensureAllChecklistKeys(answers),
      };
      const { data, error } = await supabase
        .from("checklist_rounds")
        .insert(payload)
        .select("id, created_at, ronde_date, created_by")
        .single();
      if (error) throw error;

      // 🔔 Notify admins by email (Supabase Edge Function)
      // Requires: Edge Function "notify-admins-round" deployed + profiles.email populated.
      try {
        await supabase.functions.invoke("notify-admins-round", {
          body: { round_id: data.id },
        });
      } catch (e) {
        // Don't block the user if email fails; log for debugging
        console.warn("Admin email notification failed:", e);
      }

      setMsg("✅ Ronde enregistrée avec succès.");
      setAnswers(ensureAllChecklistKeys({}));
      onSaved?.();
    } catch (e) {
      setMsg(`❌ Erreur: ${e?.message || "Impossible d'enregistrer."}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Checklist – Ronde journalière"
              right={
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs text-slate-500">Avancement</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {completion.done}/{completion.total} ({completion.pct}%)
                    </div>
                  </div>
                  <Button onClick={saveRound} disabled={busy}>
                    {busy ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              }
            />
            <div className="p-4">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Date" type="date" value={rondeDate} onChange={(e) => setRondeDate(e.target.value)} />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Rédactrice (référence doc)</div>
                  <div className="text-sm font-semibold text-slate-900">Sephora DE NGAVET – RQHSE</div>
                </div>
              </div>

              {CHECKLIST.map((group) => (
                <div key={group.section} className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                    <h2 className="text-base font-bold text-slate-900">{group.section}</h2>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((it) => {
                      const v = answers?.[it.id]?.value || "";
                      return (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{it.label}</div>
                              <div className="mt-1 text-xs text-slate-500">Choisis Oui / Non + commentaire si besoin</div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setValue(it.id, "Oui")}
                                className={classNames(
                                  "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                                  v === "Oui"
                                    ? "bg-emerald-600 text-white ring-emerald-600"
                                    : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                Oui
                              </button>
                              <button
                                type="button"
                                onClick={() => setValue(it.id, "Non")}
                                className={classNames(
                                  "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                                  v === "Non"
                                    ? "bg-rose-600 text-white ring-rose-600"
                                    : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                Non
                              </button>
                              <button
                                type="button"
                                onClick={() => setValue(it.id, "")}
                                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                                title="Effacer la réponse"
                              >
                                ↺
                              </button>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">Commentaires</span>
                              <textarea
                                value={answers?.[it.id]?.comment || ""}
                                onChange={(e) => setComment(it.id, e.target.value)}
                                rows={2}
                                className={classNames(
                                  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
                                  "focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                                )}
                                placeholder="Ajoute un détail si nécessaire…"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {msg ? (
                <div className={classNames("rounded-2xl p-4 text-sm", msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200")}>
                  {msg}
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader title="Récap" subtitle="Contrôle rapide" />
            <div className="space-y-3 p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Avancement</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{completion.pct}%</div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${completion.pct}%`, background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.primary2})` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Date de ronde</div>
                <div className="text-sm font-semibold text-slate-900">{rondeDate}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Conseil</div>
                <div className="text-sm text-slate-700">
                  Mets au moins <span className="font-semibold">Non</span> + commentaire si un point est non conforme.
                </div>
              </div>

              <Button onClick={saveRound} disabled={busy} className="w-full">
                {busy ? "Enregistrement..." : "Enregistrer la ronde"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}

function AdminDashboard({ user }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Profiles cache (id -> profile)
  const [profilesById, setProfilesById] = useState({});
  async function hydrateProfiles(userIds) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    const missing = ids.filter((id) => !profilesById[id]);
    if (!missing.length) return;

    // Use select('*') to avoid breaking if columns change (e.g., email)
    const { data, error } = await supabase.from("profiles").select("*").in("id", missing);
    if (!error && data) {
      setProfilesById((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = p;
        return next;
      });
    }
  }

  const displayAgent = (userId) => {
    const p = profilesById?.[userId];
    // Prefer full name, then email (if you add the column), otherwise fallback to shortened id
    return (
      (p?.full_name && String(p.full_name).trim()) ||
      (p?.email && String(p.email).trim()) ||
      (userId ? `${String(userId).slice(0, 8)}…` : "—")
    );
  };

  async function fetchData() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("checklist_rounds")
        .select("id, created_at, ronde_date, created_by, answers")
        .gte("ronde_date", from)
        .lte("ronde_date", to)
        .order("ronde_date", { ascending: false });

      if (error) throw error;

      const d = data || [];
      setRows(d);

      // Hydrate profiles for all involved agents
      await hydrateProfiles(d.map((x) => x.created_by));
    } catch (e) {
      setErr(e?.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPI + analytics
  const allItems = useMemo(() => CHECKLIST.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))), []);
  const analytics = useMemo(() => {
    const totalRounds = rows.length;
    const totalPointsPerRound = allItems.length;
    const totalPoints = totalRounds * totalPointsPerRound;

    let yes = 0;
    let no = 0;
    let empty = 0;

    // per section
    const sectionStats = {};
    for (const g of CHECKLIST) {
      sectionStats[g.section] = { yes: 0, no: 0, empty: 0, total: g.items.length * totalRounds };
    }

    // per item counts for "Non"
    const nonByItem = {};
    for (const it of allItems) nonByItem[it.id] = { label: it.label, section: it.section, count: 0 };

    // trend by date
    const nonByDate = {}; // date -> countNon
    const roundsByDate = {}; // date -> countRounds

    for (const r of rows) {
      const a = r.answers || {};
      nonByDate[r.ronde_date] = nonByDate[r.ronde_date] || 0;
      roundsByDate[r.ronde_date] = (roundsByDate[r.ronde_date] || 0) + 1;

      for (const it of allItems) {
        const v = a?.[it.id]?.value || "";
        if (v === "Oui") yes += 1;
        else if (v === "Non") {
          no += 1;
          nonByItem[it.id].count += 1;
          nonByDate[r.ronde_date] += 1;
        } else empty += 1;

        const sec = it.section;
        if (!sectionStats[sec]) sectionStats[sec] = { yes: 0, no: 0, empty: 0, total: 0 };
        if (v === "Oui") sectionStats[sec].yes += 1;
        else if (v === "Non") sectionStats[sec].no += 1;
        else sectionStats[sec].empty += 1;
      }
    }

    const compliancePct = totalPoints ? Math.round((yes / totalPoints) * 100) : 0;
    const nonPct = totalPoints ? Math.round((no / totalPoints) * 100) : 0;

    const topNon = Object.values(nonByItem)
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const trend = Object.keys(nonByDate)
      .sort()
      .slice(-10)
      .map((d) => ({ date: d, non: nonByDate[d] || 0, rounds: roundsByDate[d] || 0 }));

    return { totalRounds, totalPoints, yes, no, empty, compliancePct, nonPct, sectionStats, topNon, trend };
  }, [rows, allItems]);

  // Modal details
  const [activeRound, setActiveRound] = useState(null);

  function exportExcelStructured() {
    // Sheet 1: Checklist (1 row per item per round)
    const checklistRows = [];
    for (const r of rows) {
      const a = r.answers || {};
      for (const g of CHECKLIST) {
        for (const it of g.items) {
          const v = a?.[it.id]?.value || "";
          const c = a?.[it.id]?.comment || "";
          checklistRows.push({
            "Date de ronde": r.ronde_date,
            Agent: displayAgent(r.created_by),
            Section: g.section,
            "Point de contrôle": it.label,
            Statut: v,
            Commentaire: c,
          });
        }
      }
    }

    // Sheet 2: Synthese (1 row per round)
    const syntheseRows = rows.map((r) => {
      const a = r.answers || {};
      let y = 0, n = 0, e = 0;
      for (const g of CHECKLIST) {
        for (const it of g.items) {
          const v = a?.[it.id]?.value || "";
          if (v === "Oui") y += 1;
          else if (v === "Non") n += 1;
          else e += 1;
        }
      }
      const total = y + n + e;
      const pct = total ? Math.round((y / total) * 100) : 0;
      return {
        "Date de ronde": r.ronde_date,
        Agent: displayAgent(r.created_by),
        "Nb points": total,
        "Nb Oui": y,
        "Nb Non": n,
        "Non renseigné": e,
        "Taux conformité (%)": pct,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(checklistRows);
    const ws2 = XLSX.utils.json_to_sheet(syntheseRows);

    // Friendly column widths
    ws1["!cols"] = [
      { wch: 14 }, // date
      { wch: 26 }, // agent
      { wch: 22 }, // section
      { wch: 42 }, // item
      { wch: 10 }, // statut
      { wch: 50 }, // comment
    ];
    ws2["!cols"] = [
      { wch: 14 }, { wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "Checklist");
    XLSX.utils.book_append_sheet(wb, ws2, "Synthese");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `qhse_checklist_${from}_au_${to}.xlsx`);
  }

  return (
    <Container>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
          <p className="text-sm text-slate-600">Analyse des rondes · conformité · tendances · export structuré.</p>
        </div>

        <div className="flex items-center gap-2">
          

          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Rondes: {analytics.totalRounds}</Badge>
            <Badge tone={analytics.no ? "no" : "ok"}>Non: {analytics.no}</Badge>
            <Badge tone="neutral">Conformité: {analytics.compliancePct}%</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Filter */}
        <Card className="lg:col-span-1">
          <CardHeader title="Filtre période" subtitle="Choisis une plage de dates" />
          <div className="space-y-4 p-4">
            <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            {err ? (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{err}</div>
            ) : null}
            <div className="flex gap-2">
              <Button variant="soft" className="flex-1" onClick={fetchData} disabled={loading}>
                {loading ? "Chargement..." : "Appliquer"}
              </Button>
              <Button className="flex-1" onClick={exportExcelStructured} disabled={!rows.length}>
                Export Excel
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Export structuré : onglets <span className="font-semibold">Checklist</span> + <span className="font-semibold">Synthese</span>.
            </div>
          </div>
        </Card>

        {/* KPI + Trend + Top Non */}
        <Card className="lg:col-span-2">
          <CardHeader title="Synthèse" subtitle="Indicateurs & tendances" />
          <div className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Rondes</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{analytics.totalRounds}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Conformité</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{analytics.compliancePct}%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Points “Non”</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{analytics.no}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Points contrôlés</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{analytics.totalPoints}</div>
              </div>
            </div>

            {/* Trend mini-bars */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Tendance “Non” (10 dernières dates)</div>
                <div className="text-xs text-slate-500">Chaque barre = nb de “Non”</div>
              </div>
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                {analytics.trend.length === 0 ? (
                  <div className="text-sm text-slate-500">Pas de données.</div>
                ) : (
                  analytics.trend.map((t) => {
                    const h = analytics.no ? Math.max(6, Math.round((t.non / Math.max(1, Math.max(...analytics.trend.map((x) => x.non)))) * 80)) : 6;
                    return (
                      <div key={t.date} className="flex flex-col items-center gap-2">
                        <div
                          className="w-6 rounded-xl"
                          style={{ height: `${h}px`, background: `linear-gradient(180deg, ${BRAND.primary2}, ${BRAND.primary})` }}
                          title={`${t.date}: ${t.non} Non`}
                        />
                        <div className="w-8 truncate text-center text-[10px] text-slate-500" title={t.date}>
                          {t.date.slice(5)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top non */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-slate-900">Top non-conformités</div>
              {analytics.topNon.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Aucune non-conformité.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {analytics.topNon.map((x) => (
                    <div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs text-slate-500">{x.section}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{x.label}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge tone="no">{x.count} Non</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Section breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Conformité par section" subtitle="Oui / Non / Non renseigné" />
          <div className="space-y-3 p-4">
            {CHECKLIST.map((g) => {
              const s = analytics.sectionStats[g.section] || { yes: 0, no: 0, empty: 0 };
              const total = s.yes + s.no + s.empty || 1;
              const pct = Math.round((s.yes / total) * 100);
              return (
                <div key={g.section} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{g.section}</div>
                    <Badge tone={pct >= 90 ? "ok" : pct >= 70 ? "neutral" : "no"}>{pct}%</Badge>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.primary2})` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>Oui: <span className="font-semibold">{s.yes}</span></span>
                    <span>Non: <span className="font-semibold">{s.no}</span></span>
                    <span>NR: <span className="font-semibold">{s.empty}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Rounds list */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Rondes (clique pour détails)"
            subtitle='Aperçu rapide des “Non” + commentaires'
            right={<Badge tone="neutral">{rows.length} résultat(s)</Badge>}
          />
          <div className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">Aucune ronde sur cette période.</div>
            ) : (
              rows.map((r) => {
                let nonLocal = 0;
                for (const g of CHECKLIST)
                  for (const it of g.items)
                    if ((r.answers?.[it.id]?.value || "") === "Non") nonLocal += 1;

                return (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full p-4 text-left hover:bg-slate-50"
                    onClick={() => setActiveRound(r)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Ronde du {r.ronde_date}</div>
                        <div className="text-xs text-slate-500">
                          Agent: <span className="font-semibold">{displayAgent(r.created_by)}</span> · Créée le{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">ID: {r.id.slice(0, 8)}…</Badge>
                        <Badge tone={nonLocal ? "no" : "ok"}>{nonLocal ? `${nonLocal} “Non”` : "RAS"}</Badge>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Modal round details */}
      {activeRound ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <div className="text-lg font-bold text-slate-900">Détail de la ronde</div>
                <div className="mt-1 text-sm text-slate-600">
                  {activeRound.ronde_date} · Agent:{" "}
                  <span className="font-semibold">{displayAgent(activeRound.created_by)}</span>
                </div>
              </div>
              <Button variant="soft" onClick={() => setActiveRound(null)}>Fermer</Button>
            </div>

            <div className="max-h-[70dvh] overflow-auto p-4">
              {CHECKLIST.map((g) => {
                const nonItems = g.items.filter((it) => (activeRound.answers?.[it.id]?.value || "") === "Non");
                const yesItems = g.items.filter((it) => (activeRound.answers?.[it.id]?.value || "") === "Oui");
                const emptyItems = g.items.filter((it) => (activeRound.answers?.[it.id]?.value || "") === "");

                return (
                  <div key={g.section} className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">{g.section}</div>
                      <div className="flex gap-2">
                        <Badge tone="ok">Oui {yesItems.length}</Badge>
                        <Badge tone="no">Non {nonItems.length}</Badge>
                        <Badge tone="neutral">NR {emptyItems.length}</Badge>
                      </div>
                    </div>

                    {nonItems.length ? (
                      <div className="space-y-2">
                        {nonItems.map((it) => (
                          <div key={it.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                            <div className="text-sm font-semibold text-rose-900">{it.label}</div>
                            {activeRound.answers?.[it.id]?.comment ? (
                              <div className="mt-1 text-sm text-rose-800">
                                {activeRound.answers?.[it.id]?.comment}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-rose-700">Aucun commentaire.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
                        Aucun “Non” dans cette section.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </Container>
  );
}
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("agent"); // "agent" | "admin"
  const [booting, setBooting] = useState(true);

  // Boot auth
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      setBooting(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Load profile when session changes
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setProfile(null);
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;
      if (error) {
        // Si profil absent, on le crée en agent par défaut
        const { error: insErr } = await supabase.from("profiles").insert({ id: session.user.id, role: "agent" });
        if (!insErr) {
          setProfile({ id: session.user.id, role: "agent", full_name: null });
        }
      } else {
        setProfile(data);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  async function login({ email, password, expectedRole }) {
    // Sign-in
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check role in profiles
    const uid = data?.user?.id;
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", uid)
      .single();

    if (profErr) {
      // si pas de profil : on force agent
      if (expectedRole === "admin") {
        throw new Error("Compte sans profil admin. Vérifie la table profiles.");
      }
      await supabase.from("profiles").insert({ id: uid, role: "agent" });
      return;
    }

    if (expectedRole === "admin" && prof.role !== "admin") {
      await supabase.auth.signOut();
      throw new Error("Accès refusé : ce compte n’a pas le rôle admin.");
    }
    if (expectedRole === "agent" && prof.role !== "agent") {
      // autoriser admin à accéder à l’agent si tu veux : ici on bloque pour respecter “2 logins”
      await supabase.auth.signOut();
      throw new Error("Accès refusé : ce compte n’a pas le rôle agent.");
    }
    // Best-effort: store user email in profiles for admin display/export.
    // (Optional) add column `email` to profiles; if missing we fallback silently.
    try {
      const fullName = (prof?.full_name && String(prof.full_name).trim()) ? prof.full_name : email;
      const { error: upErr } = await supabase
        .from("profiles")
        .upsert({ id: uid, role: prof?.role || expectedRole, full_name: fullName, email }, { onConflict: "id" });
      if (upErr) {
        await supabase
          .from("profiles")
          .upsert({ id: uid, role: prof?.role || expectedRole, full_name: fullName }, { onConflict: "id" });
      }
    } catch (_) {}

  }

  const role = profile?.role || "";
  const user = session?.user || null;

  if (booting) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Chargement…
          </div>
        </Container>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen mode={mode} setMode={setMode} onLogin={login} />;
  }

  // Attendre le profil
  if (!profile) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Topbar userEmail={user?.email} role="…" onSignOut={signOut} />
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Chargement du profil…
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <Topbar userEmail={user?.email} role={role} onSignOut={signOut} />

      {/* routing simple */}
      {role === "agent" ? (
        <ChecklistScreen user={user} />
      ) : role === "admin" ? (
        <AdminDashboard user={user} />
      ) : (
        <Container>
          <Card>
            <CardHeader title="Rôle inconnu" />
            <div className="p-4 text-sm text-slate-600">
              Ton profil n’a pas un rôle valide. Corrige la colonne <span className="font-mono">profiles.role</span>.
            </div>
          </Card>
        </Container>
      )}

      <footer className="mt-10 border-t border-slate-200 bg-white">
        <Container>
          <div className="py-6 text-xs text-slate-500">
            Centre Diagnostic · QHSE — Checklist basée sur la procédure de ronde journalière.
          </div>
        </Container>
      </footer>
    </div>
  );
}
