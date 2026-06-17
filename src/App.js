import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const MONTHS_SHORT = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

const CATS = {
  revenus: {
    label: "Revenus",
    color: "#10B981",
    bg: "#10B98115",
    icon: "💰",
    sign: 1,
  },
  fixe: {
    label: "Charges fixes",
    color: "#8B5CF6",
    bg: "#8B5CF615",
    icon: "🏠",
    sign: -1,
  },
  variable: {
    label: "Dépenses variables",
    color: "#F59E0B",
    bg: "#F59E0B15",
    icon: "🛒",
    sign: -1,
  },
  epargne: {
    label: "Épargne",
    color: "#06B6D4",
    bg: "#06B6D415",
    icon: "💎",
    sign: -1,
  },
};

const DEFAULT_ROWS = [
  { id: "r1", label: "Salaire / bourse", category: "revenus", amount: 0 },
  { id: "r2", label: "Revenus annexes", category: "revenus", amount: 0 },
  { id: "r3", label: "Loyer / hébergement", category: "fixe", amount: 0 },
  { id: "r4", label: "Abonnements & forfaits", category: "fixe", amount: 0 },
  { id: "r5", label: "Transports", category: "fixe", amount: 0 },
  { id: "r6", label: "Mutuelles / assurances", category: "fixe", amount: 0 },
  { id: "r7", label: "Alimentation", category: "variable", amount: 0 },
  { id: "r8", label: "Loisirs & sorties", category: "variable", amount: 0 },
  { id: "r9", label: "Vêtements & achats", category: "variable", amount: 0 },
  { id: "r10", label: "Santé & pharmacie", category: "variable", amount: 0 },
  { id: "r11", label: "Livret A / épargne", category: "epargne", amount: 0 },
  { id: "r12", label: "Fond d'urgence", category: "epargne", amount: 0 },
];

const DEFAULT_GOALS = [
  {
    id: "g1",
    label: "Voyage d'été",
    target: 800,
    current: 0,
    color: "#F59E0B",
    icon: "✈️",
  },
  {
    id: "g2",
    label: "Fond d'urgence",
    target: 1000,
    current: 0,
    color: "#06B6D4",
    icon: "🛡️",
  },
  {
    id: "g3",
    label: "Matériel / achat",
    target: 500,
    current: 0,
    color: "#8B5CF6",
    icon: "🛒",
  },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const mkKey = (y, m) => `budgetpro_${y}_${String(m).padStart(2, "0")}`;
const goalsKey = "budgetpro_goals";
const simKey = "budgetpro_sim";

function loadMonth(y, m) {
  try {
    const r = localStorage.getItem(mkKey(y, m));
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
function saveMonth(y, m, rows) {
  try {
    localStorage.setItem(mkKey(y, m), JSON.stringify(rows));
  } catch {}
}
function loadGoals() {
  try {
    const r = localStorage.getItem(goalsKey);
    return r ? JSON.parse(r) : DEFAULT_GOALS;
  } catch {
    return DEFAULT_GOALS;
  }
}
function saveGoals(g) {
  try {
    localStorage.setItem(goalsKey, JSON.stringify(g));
  } catch {}
}
function loadSim() {
  try {
    const r = localStorage.getItem(simKey);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
function saveSim(s) {
  try {
    localStorage.setItem(simKey, JSON.stringify(s));
  } catch {}
}
function loadAllMonths(y) {
  const data = [];
  for (let m = 0; m < 12; m++) {
    const rows = loadMonth(y, m);
    if (rows) {
      const rev = rows
        .filter((r) => r.category === "revenus")
        .reduce((s, r) => s + r.amount, 0);
      const dep = rows
        .filter((r) => r.category !== "revenus")
        .reduce((s, r) => s + r.amount, 0);
      const ep = rows
        .filter((r) => r.category === "epargne")
        .reduce((s, r) => s + r.amount, 0);
      const fx = rows
        .filter((r) => r.category === "fixe")
        .reduce((s, r) => s + r.amount, 0);
      const va = rows
        .filter((r) => r.category === "variable")
        .reduce((s, r) => s + r.amount, 0);
      data.push({ month: m, rev, dep, ep, fx, va, solde: rev - dep });
    }
  }
  return data;
}

let _uid = 200;
const uid = () => `u${_uid++}`;

// ─── SCORE ────────────────────────────────────────────────────────────────────
function calcScore(rev, dep, ep, fx, va) {
  if (rev === 0) return 0;
  let score = 100;
  const tauxEp = (ep / rev) * 100;
  const tauxDep = (dep / rev) * 100;
  const tauxFx = (fx / rev) * 100;
  const tauxVa = (va / rev) * 100;
  if (tauxEp < 5) score -= 30;
  else if (tauxEp < 10) score -= 15;
  else if (tauxEp >= 20) score += 5;
  if (tauxDep > 95) score -= 35;
  else if (tauxDep > 85) score -= 20;
  else if (tauxDep > 70) score -= 8;
  if (tauxFx > 50) score -= 15;
  else if (tauxFx > 40) score -= 8;
  if (tauxVa > 35) score -= 10;
  else if (tauxVa > 25) score -= 4;
  if (rev - dep < 0) score -= 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(s) {
  if (s >= 85) return { label: "Excellent", color: "#10B981" };
  if (s >= 70) return { label: "Bon", color: "#06B6D4" };
  if (s >= 50) return { label: "Moyen", color: "#F59E0B" };
  if (s >= 30) return { label: "Fragile", color: "#F97316" };
  return { label: "Critique", color: "#EF4444" };
}

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const c =
    { ok: "#10B981", warn: "#F59E0B", err: "#EF4444", ai: "#8B5CF6" }[type] ||
    "#8B5CF6";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: "#0D1117",
        border: `1px solid ${c}`,
        color: c,
        borderRadius: 12,
        padding: "11px 20px",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 8px 32px #00000090",
        maxWidth: 320,
        animation: "toastIn 0.3s ease",
      }}
    >
      {msg}
    </div>
  );
}

function EditableCell({ value, onChange, color }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState("");
  const ref = useRef();
  const open = () => {
    setLocal(value === 0 ? "" : String(value));
    setEditing(true);
  };
  const commit = () => {
    const n = parseFloat(String(local).replace(",", ".")) || 0;
    onChange(n);
    setEditing(false);
  };
  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);
  if (editing)
    return (
      <input
        ref={ref}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="0"
        style={{
          width: 90,
          textAlign: "right",
          background: "#0D1117",
          border: `1.5px solid ${color}`,
          borderRadius: 7,
          color: "#F1F5F9",
          fontSize: 13,
          padding: "4px 8px",
          outline: "none",
          fontFamily: "inherit",
          fontVariantNumeric: "tabular-nums",
        }}
      />
    );
  return (
    <span
      onClick={open}
      style={{
        cursor: "pointer",
        fontVariantNumeric: "tabular-nums",
        fontSize: 13,
        color: value === 0 ? "#2D3350" : "#E2E8F0",
        padding: "4px 10px",
        borderRadius: 7,
        border: "1px solid transparent",
        display: "inline-block",
        textAlign: "right",
        minWidth: 92,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#2D3350";
        e.currentTarget.style.background = "#141830";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {value === 0 ? "—" : `${value.toFixed(2)} €`}
    </span>
  );
}

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const sl = scoreLabel(score);
  const dash = (score / 100) * circ;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke="#1A1E2E"
          strokeWidth={11}
        />
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke={sl.color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ / 4}
          style={{
            transition:
              "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1),stroke 0.4s",
          }}
        />
        <text
          x={65}
          y={60}
          textAnchor="middle"
          fill={sl.color}
          fontSize={26}
          fontWeight={800}
          fontFamily="Inter,sans-serif"
        >
          {score}
        </text>
        <text
          x={65}
          y={78}
          textAnchor="middle"
          fill={sl.color}
          fontSize={11}
          fontWeight={600}
          fontFamily="Inter,sans-serif"
        >
          {sl.label}
        </text>
        <text
          x={65}
          y={95}
          textAnchor="middle"
          fill="#334155"
          fontSize={9}
          fontFamily="Inter,sans-serif"
        >
          score santé
        </text>
      </svg>
    </div>
  );
}

function MiniBar({ history, field, color, max: maxOverride }) {
  const vals = history.map((h) => h[field] || 0);
  const max = maxOverride || Math.max(...vals, 1);
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        alignItems: "flex-end",
        height: 44,
        padding: "0 2px",
      }}
    >
      {MONTHS_SHORT.map((mo, i) => {
        const h = history.find((x) => x.month === i);
        const v = h ? h[field] || 0 : null;
        const ht = v !== null ? Math.max((v / max) * 40, 2) : 3;
        return (
          <div
            key={i}
            title={`${MONTHS[i]}: ${v !== null ? v.toFixed(2) + " €" : "—"}`}
            style={{
              flex: 1,
              borderRadius: "3px 3px 0 0",
              height: `${ht}px`,
              background: v !== null ? color : "#1A1E2E",
              opacity: v !== null ? 1 : 0.3,
              transition: "height 0.5s ease",
              cursor: "pointer",
            }}
          />
        );
      })}
    </div>
  );
}

function BarChart({ history }) {
  if (!history.length)
    return (
      <div
        style={{
          color: "#2D3350",
          textAlign: "center",
          padding: 30,
          fontSize: 13,
        }}
      >
        Commence à saisir ton budget pour voir l'évolution ici.
      </div>
    );
  const maxVal = Math.max(...history.map((h) => Math.max(h.rev, h.dep)), 1);
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "flex-end",
        height: 100,
        padding: "0 4px",
      }}
    >
      {MONTHS_SHORT.map((mo, i) => {
        const h = history.find((x) => x.month === i);
        if (!h)
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 3,
                  background: "#1A1E2E",
                  borderRadius: 2,
                }}
              />
              <div style={{ fontSize: 9, color: "#1E2535" }}>{mo}</div>
            </div>
          );
        const rH = (h.rev / maxVal) * 90;
        const dH = (h.dep / maxVal) * 90;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
            title={`${MONTHS[i]}\nRevenus: ${h.rev.toFixed(
              0
            )}€\nDépenses: ${h.dep.toFixed(0)}€`}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: 1,
                alignItems: "flex-end",
                height: 90,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#10B98160",
                  borderRadius: "2px 2px 0 0",
                  height: `${rH}px`,
                  transition: "height 0.5s",
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: "#F59E0B60",
                  borderRadius: "2px 2px 0 0",
                  height: `${dH}px`,
                  transition: "height 0.5s",
                }}
              />
            </div>
            <div style={{ fontSize: 8, color: "#334155" }}>{mo}</div>
          </div>
        );
      })}
    </div>
  );
}

function GoalCard({ goal, onUpdate, onDelete }) {
  const pct =
    goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal);
  const save = () => {
    onUpdate({
      ...draft,
      target: parseFloat(String(draft.target).replace(",", ".")) || 0,
      current: parseFloat(String(draft.current).replace(",", ".")) || 0,
    });
    setEditing(false);
  };
  const remain = Math.max((goal.target || 0) - (goal.current || 0), 0);
  if (editing)
    return (
      <div
        style={{
          background: "#0D1117",
          borderRadius: 12,
          padding: 16,
          border: `1px solid ${goal.color}50`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
            style={{
              width: 44,
              background: "#141830",
              border: "1px solid #2D3350",
              borderRadius: 8,
              color: "#F1F5F9",
              padding: "7px",
              fontSize: 18,
              fontFamily: "inherit",
              outline: "none",
              textAlign: "center",
            }}
          />
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Nom de l'objectif"
            style={{
              flex: 1,
              background: "#141830",
              border: "1px solid #2D3350",
              borderRadius: 8,
              color: "#F1F5F9",
              padding: "7px 10px",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>
              Objectif (€)
            </div>
            <input
              value={draft.target}
              onChange={(e) =>
                setDraft((d) => ({ ...d, target: e.target.value }))
              }
              style={{
                width: "100%",
                background: "#141830",
                border: "1px solid #2D3350",
                borderRadius: 8,
                color: "#F1F5F9",
                padding: "7px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>
              Déjà épargné (€)
            </div>
            <input
              value={draft.current}
              onChange={(e) =>
                setDraft((d) => ({ ...d, current: e.target.value }))
              }
              style={{
                width: "100%",
                background: "#141830",
                border: "1px solid #2D3350",
                borderRadius: 8,
                color: "#F1F5F9",
                padding: "7px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>
              Couleur
            </div>
            <select
              value={draft.color}
              onChange={(e) =>
                setDraft((d) => ({ ...d, color: e.target.value }))
              }
              style={{
                width: "100%",
                background: "#141830",
                border: "1px solid #2D3350",
                borderRadius: 8,
                color: "#F1F5F9",
                padding: "7px",
                fontSize: 12,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {[
                "#10B981",
                "#8B5CF6",
                "#F59E0B",
                "#06B6D4",
                "#EF4444",
                "#EC4899",
                "#F97316",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={save}
            style={{
              flex: 1,
              background: "#8B5CF6",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "8px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
            }}
          >
            Sauvegarder
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              background: "#1A1E2E",
              border: "none",
              color: "#475569",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  return (
    <div
      style={{
        background: "#0D1117",
        borderRadius: 12,
        padding: "14px 16px",
        border: `1px solid ${goal.color}25`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{goal.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>
            {goal.label}
          </span>
          {pct >= 100 && (
            <span
              style={{
                fontSize: 10,
                background: "#10B98120",
                color: "#10B981",
                borderRadius: 99,
                padding: "2px 8px",
                fontWeight: 700,
              }}
            >
              ATTEINT ✓
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: "none",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 5px",
            }}
            title="Modifier"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            style={{
              background: "none",
              border: "none",
              color: "#1E2535",
              cursor: "pointer",
              fontSize: 15,
              padding: "2px 5px",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#1E2535")}
          >
            ×
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#475569",
          marginBottom: 6,
        }}
      >
        <span style={{ color: goal.color, fontWeight: 600 }}>
          {goal.current.toFixed(0)} € épargnés
        </span>
        <span>objectif : {goal.target.toFixed(0)} €</span>
      </div>
      <div
        style={{
          height: 7,
          background: "#1A1E2E",
          borderRadius: 99,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            background: goal.color,
            width: `${pct}%`,
            transition: "width 0.7s ease",
            boxShadow: `0 0 8px ${goal.color}60`,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
        }}
      >
        <span style={{ color: goal.color, fontWeight: 700 }}>
          {pct.toFixed(0)}%
        </span>
        <span style={{ color: "#334155" }}>
          {remain > 0
            ? `Encore ${remain.toFixed(0)} € à économiser`
            : "Objectif atteint 🎉"}
        </span>
      </div>
    </div>
  );
}

// ─── AI COACH ─────────────────────────────────────────────────────────────────
function AICoach({ budgetData, history, goals }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef();

  const systemPrompt = `Tu es un conseiller financier personnel expert, chaleureux et direct. Tu analyses le budget de l'utilisateur et tu lui donnes des conseils concrets, chiffrés et actionnables.

DONNÉES DU BUDGET ACTUEL:
- Revenus: ${budgetData.rev.toFixed(2)}€
- Charges fixes: ${budgetData.fx.toFixed(2)}€
- Dépenses variables: ${budgetData.va.toFixed(2)}€  
- Épargne: ${budgetData.ep.toFixed(2)}€
- Solde restant: ${budgetData.solde.toFixed(2)}€
- Taux d'épargne: ${
    budgetData.rev > 0 ? ((budgetData.ep / budgetData.rev) * 100).toFixed(1) : 0
  }%
- Score santé financière: ${budgetData.score}/100 (${
    scoreLabel(budgetData.score).label
  })
- Lignes détaillées: ${JSON.stringify(budgetData.rows)}

HISTORIQUE (${history.length} mois de données):
${
  history
    .map(
      (h) =>
        `${MONTHS[h.month]}: revenus ${h.rev.toFixed(
          0
        )}€, dépenses ${h.dep.toFixed(0)}€, solde ${h.solde.toFixed(0)}€`
    )
    .join("\n") || "Pas encore d'historique"
}

OBJECTIFS D'ÉPARGNE:
${goals
  .map(
    (g) =>
      `${g.icon} ${g.label}: ${g.current}€/${g.target}€ (${
        g.target > 0 ? ((g.current / g.target) * 100).toFixed(0) : 0
      }%)`
  )
  .join("\n")}

RÈGLES DE RÉPONSE:
- Réponds TOUJOURS en français
- Sois direct, pas de blabla inutile
- Cite des chiffres précis basés sur les données
- Donne des conseils concrets et actionnables
- Si le budget est vide (tout à 0), invite l'utilisateur à renseigner ses données d'abord
- Limite tes réponses à 250 mots maximum
- Utilise des emojis avec parcimonie (2-3 max par message)
- Commence directement par la réponse, sans "Bonjour" ou introduction`;

  const startConversation = async () => {
    setStarted(true);
    setLoading(true);
    const intro =
      budgetData.rev === 0
        ? "Commence par renseigner ton budget (revenus, dépenses, épargne) dans l'onglet Budget, puis reviens me parler ! Je pourrai t'analyser ça en détail. 💡"
        : null;
    if (intro) {
      setMessages([{ role: "assistant", content: intro }]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content:
                "Analyse mon budget ce mois-ci et donne-moi ton diagnostic complet avec les points forts, les points faibles, et tes 3 priorités d'action concrètes.",
            },
          ],
        }),
      });
      const data = await res.json();
      const text =
        data.content?.map((c) => c.text || "").join("") ||
        "Erreur de connexion.";
      setMessages([{ role: "assistant", content: text }]);
    } catch (e) {
      setMessages([
        {
          role: "assistant",
          content:
            "Erreur de connexion à l'IA. Vérifie ta connexion et réessaie.",
        },
      ]);
    }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const text = data.content?.map((c) => c.text || "").join("") || "Erreur.";
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erreur de connexion." },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (bottomRef.current)
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const quickPrompts = [
    "Comment améliorer mon taux d'épargne ?",
    "Analyse mes dépenses variables",
    "Prévision pour le mois prochain",
    "Comment atteindre mes objectifs plus vite ?",
  ];

  if (!started)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          textAlign: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            boxShadow: "0 0 32px #8B5CF640",
          }}
        >
          🤖
        </div>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#F1F5F9",
              marginBottom: 6,
            }}
          >
            Coach IA Financier
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#475569",
              maxWidth: 300,
              lineHeight: 1.6,
            }}
          >
            Analyse de budget, conseils personnalisés, détection d'anomalies et
            prévisions basées sur tes données réelles.
          </div>
        </div>
        <button
          onClick={startConversation}
          style={{
            background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
            border: "none",
            color: "#fff",
            borderRadius: 12,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 20px #8B5CF640",
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.03)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          🚀 Analyser mon budget
        </button>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 480 }}>
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {m.role === "assistant" && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  flexShrink: 0,
                  marginRight: 8,
                  marginTop: 2,
                }}
              >
                🤖
              </div>
            )}
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 14px",
                borderRadius:
                  m.role === "user"
                    ? "12px 12px 3px 12px"
                    : "12px 12px 12px 3px",
                background: m.role === "user" ? "#8B5CF620" : "#141830",
                border: `1px solid ${
                  m.role === "user" ? "#8B5CF640" : "#1A1E2E"
                }`,
                fontSize: 13,
                color: "#CBD5E1",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              🤖
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#8B5CF6",
                    animation: `dot 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Quick prompts */}
      {messages.length <= 1 && !loading && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: "8px 0",
          }}
        >
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              style={{
                background: "#141830",
                border: "1px solid #1A1E2E",
                color: "#8B5CF6",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#8B5CF620";
                e.currentTarget.style.borderColor = "#8B5CF640";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#141830";
                e.currentTarget.style.borderColor = "#1A1E2E";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Pose une question sur ton budget…"
          style={{
            flex: 1,
            background: "#141830",
            border: "1px solid #1A1E2E",
            borderRadius: 10,
            color: "#F1F5F9",
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            transition: "border 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#8B5CF6")}
          onBlur={(e) => (e.target.style.borderColor = "#1A1E2E")}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            background:
              input.trim() && !loading
                ? "linear-gradient(135deg,#8B5CF6,#06B6D4)"
                : "#1A1E2E",
            border: "none",
            color: input.trim() && !loading ? "#fff" : "#334155",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 16,
            cursor: input.trim() && !loading ? "pointer" : "default",
            transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── SIMULATION ───────────────────────────────────────────────────────────────
function SimPanel({ currentRows }) {
  const [simRows, setSimRows] = useState(
    () => loadSim() || currentRows.map((r) => ({ ...r, id: uid() }))
  );
  const [synced, setSynced] = useState(false);

  const syncFromCurrent = () => {
    const copied = currentRows.map((r) => ({ ...r, id: uid() }));
    setSimRows(copied);
    saveSim(copied);
    setSynced(true);
    setTimeout(() => setSynced(false), 2000);
  };

  useEffect(() => {
    saveSim(simRows);
  }, [simRows]);

  const simTotals = useMemo(() => {
    const t = {};
    Object.keys(CATS).forEach((k) => {
      t[k] = simRows
        .filter((r) => r.category === k)
        .reduce((s, r) => s + r.amount, 0);
    });
    return t;
  }, [simRows]);

  const simRev = simTotals.revenus;
  const simDep = simTotals.fixe + simTotals.variable + simTotals.epargne;
  const simSolde = simRev - simDep;
  const simScore = calcScore(
    simRev,
    simDep,
    simTotals.epargne,
    simTotals.fixe,
    simTotals.variable
  );
  const sl = scoreLabel(simScore);

  const realRev = currentRows
    .filter((r) => r.category === "revenus")
    .reduce((s, r) => s + r.amount, 0);
  const realDep = currentRows
    .filter((r) => r.category !== "revenus")
    .reduce((s, r) => s + r.amount, 0);
  const realSolde = realRev - realDep;

  const diffSolde = simSolde - realSolde;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "#0D1117",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #8B5CF625",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#8B5CF6",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            🧪 Mode Simulation
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Modifie les chiffres sans affecter ton budget réel. Teste des
            scénarios hypothétiques.
          </div>
        </div>
        <button
          onClick={syncFromCurrent}
          style={{
            background: "#8B5CF620",
            border: "1px solid #8B5CF640",
            color: synced ? "#10B981" : "#8B5CF6",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          {synced ? "✓ Synchronisé" : "⟳ Copier budget actuel"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(CATS).map(([catKey, cat]) => {
            const catRows = simRows.filter((r) => r.category === catKey);
            return (
              <div
                key={catKey}
                style={{
                  background: "#0D1117",
                  borderRadius: 12,
                  padding: "14px 16px",
                  border: `1px solid ${cat.color}20`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span
                    style={{ fontWeight: 600, fontSize: 13, color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 13,
                      fontWeight: 700,
                      color: cat.color,
                    }}
                  >
                    {simTotals[catKey].toFixed(2)} €
                  </span>
                </div>
                {catRows.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 2px",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 12, color: "#64748B" }}>
                      {row.label}
                    </span>
                    <EditableCell
                      value={row.amount}
                      onChange={(v) =>
                        setSimRows((r) =>
                          r.map((x) =>
                            x.id === row.id ? { ...x, amount: v } : x
                          )
                        )
                      }
                      color={cat.color}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            position: "sticky",
            top: 16,
          }}
        >
          <div
            style={{
              background: "#0D1117",
              borderRadius: 12,
              padding: "16px",
              border: "1px solid #1A1E2E",
              textAlign: "center",
            }}
          >
            <ScoreRing score={simScore} />
            <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>
              score simulé
            </div>
          </div>
          <div
            style={{
              background: "#0D1117",
              borderRadius: 12,
              padding: "14px 16px",
              border: "1px solid #1A1E2E",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#334155",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 10,
              }}
            >
              Comparaison
            </div>
            {[
              {
                label: "Revenus",
                sim: simRev,
                real: realRev,
                color: "#10B981",
              },
              {
                label: "Dépenses",
                sim: simDep,
                real: realDep,
                color: "#F59E0B",
              },
              {
                label: "Solde",
                sim: simSolde,
                real: realSolde,
                color: simSolde >= 0 ? "#10B981" : "#EF4444",
              },
            ].map(({ label, sim, real, color }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div
                  style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}
                >
                  {label}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#334155" }}>
                    Réel:{" "}
                    <span
                      style={{
                        color: "#94A3B8",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {real.toFixed(0)}€
                    </span>
                  </span>
                  <span
                    style={{
                      color: color,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                    }}
                  >
                    {sim.toFixed(0)}€
                  </span>
                </div>
              </div>
            ))}
            <div
              style={{ height: 1, background: "#1A1E2E", margin: "10px 0" }}
            />
            <div
              style={{
                fontSize: 12,
                textAlign: "center",
                color: diffSolde >= 0 ? "#10B981" : "#EF4444",
                fontWeight: 700,
              }}
            >
              {diffSolde >= 0 ? "+" : " "}
              {diffSolde.toFixed(2)} € vs réel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BudgetUltimate() {
  const now = new Date();
  const [tab, setTab] = useState("dashboard");
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState(
    () => loadMonth(now.getFullYear(), now.getMonth()) || DEFAULT_ROWS
  );
  const [goals, setGoals] = useState(loadGoals);
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimer = useRef();

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 2800);
  };

  // Autosave
  useEffect(() => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMonth(year, month, rows);
      setSaveStatus("saved");
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [rows, year, month]);

  useEffect(() => {
    saveGoals(goals);
  }, [goals]);

  const switchMonth = useCallback(
    (y, m) => {
      saveMonth(year, month, rows);
      const loaded = loadMonth(y, m);
      setRows(loaded || DEFAULT_ROWS.map((r) => ({ ...r, id: uid() })));
      setYear(y);
      setMonth(m);
    },
    [rows, year, month]
  );

  const copyFromPrev = () => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const prev = loadMonth(py, pm);
    if (!prev) {
      showToast("Aucune donnée le mois précédent", "warn");
      return;
    }
    setRows(prev.map((r) => ({ ...r, id: uid() })));
    showToast("Données copiées depuis " + MONTHS[pm] + " ✓", "ok");
  };

  const exportJSON = () => {
    const all = {};
    for (let y = 2024; y <= 2027; y++)
      for (let m = 0; m < 12; m++) {
        const d = loadMonth(y, m);
        if (d) all[mkKey(y, m)] = d;
      }
    all["goals"] = goals;
    const blob = new Blob([JSON.stringify(all, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mon-budget-${year}.json`;
    a.click();
    showToast("Export téléchargé ✓", "ok");
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.entries(data).forEach(([k, v]) => {
          if (k === "goals") saveGoals(v);
          else localStorage.setItem(k, JSON.stringify(v));
        });
        if (data["goals"]) setGoals(data["goals"]);
        const cur = data[mkKey(year, month)];
        if (cur) setRows(cur);
        showToast("Import réussi ✓", "ok");
      } catch {
        showToast("Fichier invalide", "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetMonth = () => {
    if (!window.confirm(`Réinitialiser ${MONTHS[month]} ${year} ?`)) return;
    setRows(DEFAULT_ROWS.map((r) => ({ ...r, id: uid() })));
    showToast("Mois réinitialisé", "warn");
  };

  // Totals
  const totals = useMemo(() => {
    const t = {};
    Object.keys(CATS).forEach((k) => {
      t[k] = rows
        .filter((r) => r.category === k)
        .reduce((s, r) => s + r.amount, 0);
    });
    return t;
  }, [rows]);
  const rev = totals.revenus;
  const dep = totals.fixe + totals.variable + totals.epargne;
  const solde = rev - dep;
  const pct = rev > 0 ? (dep / rev) * 100 : 0;
  const tauxEp = rev > 0 ? (totals.epargne / rev) * 100 : 0;
  const score = calcScore(
    rev,
    dep,
    totals.epargne,
    totals.fixe,
    totals.variable
  );
  const sl = scoreLabel(score);

  const history = useMemo(() => loadAllMonths(year), [year, month, rows]); // eslint-disable-line

  const budgetData = {
    rev,
    dep,
    ep: totals.epargne,
    fx: totals.fixe,
    va: totals.variable,
    solde,
    score,
    rows,
  };

  // Style tokens
  const surface = "#0D1117";
  const card = {
    background: "#141830",
    borderRadius: 14,
    padding: "18px 20px",
    border: "1px solid #1A1E2E",
  };
  const TAB = [
    ["dashboard", "🏠 Accueil"],
    ["budget", "💰 Budget"],
    ["analyse", "📊 Analyse"],
    ["ia", "🤖 Coach IA"],
    ["objectifs", "🎯 Objectifs"],
    ["simulation", "🧪 Simulation"],
    ["historique", "📈 Historique"],
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: surface,
        color: "#CBD5E1",
        fontFamily: "Inter,system-ui,sans-serif",
        fontSize: 14,
      }}
    >
      <style>{`
        @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0D1117}
        ::-webkit-scrollbar-thumb{background:#1A1E2E;border-radius:99px}
        input::placeholder{color:#2D3350}
      `}</style>
      <Toast msg={toast.msg} type={toast.type} />

      {/* ── TOP NAV ── */}
      <div
        style={{
          borderBottom: "1px solid #1A1E2E",
          padding: "0 20px",
          background: "#0A0D14",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "14px 0",
              marginRight: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
            >
              💎
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 14,
                color: "#F1F5F9",
                letterSpacing: "-0.02em",
              }}
            >
              BudgetPro
            </span>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
            {TAB.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  padding: "16px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: "none",
                  border: "none",
                  borderBottom:
                    tab === k ? "2px solid #8B5CF6" : "2px solid transparent",
                  color: tab === k ? "#8B5CF6" : "#475569",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {/* Status + actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              paddingLeft: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: saveStatus === "saved" ? "#10B981" : "#F59E0B",
                fontWeight: 600,
              }}
            >
              {saveStatus === "saved" ? "✓ Sauvegardé" : "● Sauvegarde…"}
            </span>
            <button
              onClick={exportJSON}
              style={{
                background: "#1A1E2E",
                border: "1px solid #1A1E2E",
                color: "#64748B",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↓ Export
            </button>
            <label
              style={{
                background: "#1A1E2E",
                border: "1px solid #1A1E2E",
                color: "#64748B",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↑ Import
              <input
                type="file"
                accept=".json"
                onChange={importJSON}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── MONTH BAR ── */}
      <div
        style={{
          borderBottom: "1px solid #1A1E2E",
          background: "#0A0D14",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
          }}
        >
          <button
            onClick={() =>
              switchMonth(
                month === 0 ? year - 1 : year,
                month === 0 ? 11 : month - 1
              )
            }
            style={{
              background: "none",
              border: "1px solid #1A1E2E",
              color: "#475569",
              borderRadius: 7,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: "inherit",
            }}
          >
            ‹
          </button>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#F1F5F9",
              minWidth: 180,
              textAlign: "center",
            }}
          >
            {MONTHS[month]}{" "}
            <span style={{ color: "#334155", fontWeight: 400 }}>{year}</span>
          </div>
          <button
            onClick={() =>
              switchMonth(
                month === 11 ? year + 1 : year,
                month === 11 ? 0 : month + 1
              )
            }
            style={{
              background: "none",
              border: "1px solid #1A1E2E",
              color: "#475569",
              borderRadius: 7,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: "inherit",
            }}
          >
            ›
          </button>
          <div
            style={{
              height: 16,
              width: 1,
              background: "#1A1E2E",
              margin: "0 4px",
            }}
          />
          <button
            onClick={copyFromPrev}
            style={{
              background: "none",
              border: "1px solid #1A1E2E",
              color: "#8B5CF6",
              borderRadius: 7,
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Copier mois préc.
          </button>
          <button
            onClick={resetMonth}
            style={{
              background: "none",
              border: "1px solid #1A1E2E",
              color: "#475569",
              borderRadius: 7,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {/* ════ DASHBOARD ════ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* KPI row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))",
                gap: 12,
              }}
            >
              {[
                {
                  label: "Revenus",
                  val: rev,
                  color: "#10B981",
                  icon: "💰",
                  sub: "ce mois",
                },
                {
                  label: "Dépenses",
                  val: dep,
                  color: dep > rev ? "#EF4444" : "#F59E0B",
                  icon: "📤",
                  sub: "ce mois",
                },
                {
                  label: "Solde",
                  val: solde,
                  color: solde >= 0 ? "#10B981" : "#EF4444",
                  icon: "⚖️",
                  sub: "restant",
                  signed: true,
                },
                {
                  label: "Taux d'épargne",
                  val: tauxEp,
                  color: "#06B6D4",
                  icon: "💎",
                  sub: "des revenus",
                  pct: true,
                },
              ].map((k) => (
                <div
                  key={k.label}
                  style={{ ...card, position: "relative", overflow: "hidden" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: k.color,
                      opacity: 0.7,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontWeight: 600,
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{k.icon}</span>
                    {k.label}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: k.color,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {k.signed && solde >= 0 ? "+" : " "}
                    {k.pct ? `${k.val.toFixed(1)}%` : `${k.val.toFixed(2)} €`}
                  </div>
                  <div style={{ fontSize: 10, color: "#2D3350", marginTop: 4 }}>
                    {k.sub}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 220px",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Répartition */}
                <div style={card}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#334155",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 14,
                    }}
                  >
                    Répartition du budget
                  </div>
                  {rev === 0 ? (
                    <div
                      style={{
                        color: "#2D3350",
                        textAlign: "center",
                        padding: "20px 0",
                        fontSize: 13,
                      }}
                    >
                      Renseigne tes revenus et dépenses dans l'onglet Budget
                      pour voir la répartition.
                    </div>
                  ) : (
                    Object.entries(CATS).map(([k, cat]) => {
                      const w = rev > 0 ? (totals[k] / rev) * 100 : 0;
                      return (
                        <div key={k} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span style={{ fontSize: 14 }}>{cat.icon}</span>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: cat.color,
                                  fontWeight: 600,
                                }}
                              >
                                {cat.label}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#64748B",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {totals[k].toFixed(2)} €{" "}
                              <span style={{ color: "#334155" }}>
                                ({w.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              height: 7,
                              background: "#1A1E2E",
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                background: cat.color,
                                width: `${Math.min(w, 100)}%`,
                                transition: "width 0.7s ease",
                                boxShadow: `0 0 6px ${cat.color}40`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Mini chart */}
                <div style={card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#334155",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Revenus vs Dépenses — {year}
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: "#10B98160",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ color: "#334155" }}>Revenus</span>
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: "#F59E0B60",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ color: "#334155" }}>Dépenses</span>
                      </span>
                    </div>
                  </div>
                  <BarChart history={history} />
                </div>
              </div>

              {/* Score + résumé */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{ ...card, textAlign: "center", padding: "20px 14px" }}
                >
                  <ScoreRing score={score} />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "#334155",
                      lineHeight: 1.5,
                    }}
                  >
                    {score >= 85
                      ? "Budget exemplaire 🎉"
                      : score >= 70
                      ? "Bonne gestion 👍"
                      : score >= 50
                      ? "Des améliorations possibles"
                      : score >= 30
                      ? "Budget fragile, agis vite"
                      : "Budget en difficulté ⚠️"}
                  </div>
                </div>
                <div style={card}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#334155",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 12,
                    }}
                  >
                    Résumé
                  </div>
                  {[
                    {
                      label: "Charges fixes",
                      val: totals.fixe,
                      color: "#8B5CF6",
                    },
                    {
                      label: "Dépenses var.",
                      val: totals.variable,
                      color: "#F59E0B",
                    },
                    { label: "Épargne", val: totals.epargne, color: "#06B6D4" },
                  ].map(({ label, val, color }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 9,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 11, color: "#475569" }}>
                          {label}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          color,
                        }}
                      >
                        {val.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      height: 1,
                      background: "#1A1E2E",
                      margin: "10px 0",
                    }}
                  />
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#F1F5F9",
                        fontSize: 13,
                      }}
                    >
                      Solde
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color: solde >= 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {solde >= 0 ? "+" : ""}
                      {solde.toFixed(2)} €
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    ...card,
                    padding: "12px 14px",
                    borderColor:
                      solde < 0
                        ? "#EF444430"
                        : pct > 80
                        ? "#F59E0B20"
                        : "#10B98120",
                    background:
                      solde < 0 ? "#120808" : pct > 80 ? "#110E08" : "#080E0A",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        solde < 0
                          ? "#EF4444"
                          : pct > 80
                          ? "#F59E0B"
                          : "#10B981",
                      marginBottom: 4,
                    }}
                  >
                    {solde < 0
                      ? "⚠️ Déficit"
                      : pct > 90
                      ? "🔴 Budget critique"
                      : pct > 75
                      ? "🟡 Budget serré"
                      : "✅ Budget sain"}
                  </div>
                  <div style={{ fontSize: 11, color: "#334155" }}>
                    {solde < 0
                      ? `Déficit de ${Math.abs(solde).toFixed(2)} €`
                      : `Taux d'épargne : ${tauxEp.toFixed(1)}%`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ BUDGET ════ */}
        {tab === "budget" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 210px",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(CATS).map(([catKey, cat]) => {
                const catRows = rows.filter((r) => r.category === catKey);
                return (
                  <div
                    key={catKey}
                    style={{ ...card, borderLeft: `3px solid ${cat.color}` }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: cat.color,
                        }}
                      >
                        {cat.label}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 14,
                          fontWeight: 700,
                          color: cat.color,
                        }}
                      >
                        {totals[catKey].toFixed(2)} €
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      {catRows.map((row) => (
                        <div
                          key={row.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 4px",
                            borderRadius: 8,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#0D111780")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <input
                            value={row.label}
                            onChange={(e) =>
                              setRows((r) =>
                                r.map((x) =>
                                  x.id === row.id
                                    ? { ...x, label: e.target.value }
                                    : x
                                )
                              )
                            }
                            style={{
                              flex: 1,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              color: "#64748B",
                              fontSize: 13,
                              fontFamily: "inherit",
                              minWidth: 0,
                            }}
                          />
                          <EditableCell
                            value={row.amount}
                            onChange={(v) =>
                              setRows((r) =>
                                r.map((x) =>
                                  x.id === row.id ? { ...x, amount: v } : x
                                )
                              )
                            }
                            color={cat.color}
                          />
                          <button
                            onClick={() =>
                              setRows((r) => r.filter((x) => x.id !== row.id))
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#1A1E2E",
                              cursor: "pointer",
                              fontSize: 16,
                              lineHeight: 1,
                              padding: "2px 4px",
                              borderRadius: 4,
                              transition: "color 0.15s",
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "#EF4444")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "#1A1E2E")
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setRows((r) => [
                          ...r,
                          {
                            id: uid(),
                            label: "Nouvelle ligne",
                            category: catKey,
                            amount: 0,
                          },
                        ])
                      }
                      style={{
                        marginTop: 8,
                        background: "none",
                        border: `1px dashed ${cat.color}30`,
                        color: cat.color,
                        borderRadius: 8,
                        padding: "6px",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        width: "100%",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = `${cat.color}0D`)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "none")
                      }
                    >
                      + Ajouter une ligne
                    </button>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "sticky",
                top: 80,
              }}
            >
              <div
                style={{ ...card, textAlign: "center", padding: "20px 12px" }}
              >
                <ScoreRing score={score} />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 22,
                    fontWeight: 800,
                    color: solde >= 0 ? "#10B981" : "#EF4444",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {solde >= 0 ? "+" : ""}
                  {solde.toFixed(2)} €
                </div>
                <div style={{ fontSize: 10, color: "#334155" }}>
                  solde restant
                </div>
              </div>
              <div style={card}>
                {[
                  { l: "Revenus", v: rev, c: "#10B981" },
                  { l: "Fixes", v: totals.fixe, c: "#8B5CF6" },
                  { l: "Variables", v: totals.variable, c: "#F59E0B" },
                  { l: "Épargne", v: totals.epargne, c: "#06B6D4" },
                ].map(({ l, v, c }) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 9,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: c,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#475569" }}>
                        {l}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        color: c,
                      }}
                    >
                      {v.toFixed(2)} €
                    </span>
                  </div>
                ))}
                <div
                  style={{ height: 1, background: "#1A1E2E", margin: "8px 0" }}
                />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span
                    style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 13 }}
                  >
                    Solde net
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                      color: solde >= 0 ? "#10B981" : "#EF4444",
                    }}
                  >
                    {solde >= 0 ? "+" : ""}
                    {solde.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ ANALYSE ════ */}
        {tab === "analyse" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                gap: 12,
              }}
            >
              {[
                {
                  l: "Revenus",
                  v: `${rev.toFixed(2)} €`,
                  c: "#10B981",
                  ico: "💰",
                  s: "ce mois",
                },
                {
                  l: "Dépenses",
                  v: `${dep.toFixed(2)} €`,
                  c: dep > rev ? "#EF4444" : "#F59E0B",
                  ico: "📤",
                  s: "ce mois",
                },
                {
                  l: "Taux d'épargne",
                  v: `${tauxEp.toFixed(1)}%`,
                  c: "#06B6D4",
                  ico: "💎",
                  s: "des revenus",
                },
                {
                  l: "Score santé",
                  v: `${score}/100`,
                  c: sl.color,
                  ico: "❤️",
                  s: sl.label,
                },
              ].map((k) => (
                <div key={k.l} style={{ ...card, textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{k.ico}</div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: k.c,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {k.v}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {k.l}
                  </div>
                  <div style={{ fontSize: 10, color: "#2D3350" }}>{k.s}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div style={card}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 14,
                  }}
                >
                  Dépenses poste par poste
                </div>
                {dep === 0 ? (
                  <div
                    style={{
                      color: "#2D3350",
                      textAlign: "center",
                      padding: 20,
                      fontSize: 13,
                    }}
                  >
                    Aucune dépense saisie
                  </div>
                ) : (
                  rows
                    .filter((r) => r.category !== "revenus" && r.amount > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .map((row) => {
                      const cat = CATS[row.category];
                      const w = dep > 0 ? (row.amount / dep) * 100 : 0;
                      return (
                        <div key={row.id} style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 3,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#64748B" }}>
                              {row.label}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontVariantNumeric: "tabular-nums",
                                color: cat.color,
                                fontWeight: 600,
                              }}
                            >
                              {row.amount.toFixed(2)} €{" "}
                              <span style={{ color: "#334155" }}>
                                ({w.toFixed(0)}%)
                              </span>
                            </span>
                          </div>
                          <div
                            style={{
                              height: 5,
                              background: "#1A1E2E",
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                background: cat.color,
                                width: `${w}%`,
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
              <div style={card}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 14,
                  }}
                >
                  Règles budgétaires
                </div>
                {[
                  {
                    label: "Règle 50/30/20",
                    desc: "50% besoins, 30% envies, 20% épargne",
                    checks: [
                      {
                        item: "Besoins (fixes)",
                        val: rev > 0 ? (totals.fixe / rev) * 100 : 0,
                        target: 50,
                        ok: (totals.fixe / Math.max(rev, 1)) * 100 <= 55,
                      },
                      {
                        item: "Envies (variables)",
                        val: rev > 0 ? (totals.variable / rev) * 100 : 0,
                        target: 30,
                        ok: (totals.variable / Math.max(rev, 1)) * 100 <= 35,
                      },
                      {
                        item: "Épargne",
                        val: rev > 0 ? (totals.epargne / rev) * 100 : 0,
                        target: 20,
                        ok: (totals.epargne / Math.max(rev, 1)) * 100 >= 18,
                      },
                    ],
                  },
                ].map((rule) => (
                  <div key={rule.label}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#8B5CF6",
                        marginBottom: 2,
                      }}
                    >
                      {rule.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#334155",
                        marginBottom: 12,
                      }}
                    >
                      {rule.desc}
                    </div>
                    {rule.checks.map((c) => (
                      <div key={c.item} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 3,
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#475569" }}>
                            {c.item}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: c.ok ? "#10B981" : "#F59E0B",
                            }}
                          >
                            {c.val.toFixed(0)}% / {c.target}% {c.ok ? "✓" : "↗"}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 5,
                            background: "#1A1E2E",
                            borderRadius: 99,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 99,
                              background: c.ok ? "#10B981" : "#F59E0B",
                              width: `${Math.min(c.val, 100)}%`,
                              transition: "width 0.5s",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div
                  style={{ height: 1, background: "#1A1E2E", margin: "12px 0" }}
                />
                <div
                  style={{ fontSize: 11, color: "#334155", lineHeight: 1.6 }}
                >
                  <span style={{ color: "#10B981", fontWeight: 600 }}>
                    ✓ Vert
                  </span>{" "}
                  = dans les clous &nbsp;·&nbsp;{" "}
                  <span style={{ color: "#F59E0B", fontWeight: 600 }}>
                    ↗ Orange
                  </span>{" "}
                  = à surveiller
                </div>
              </div>
            </div>
            <div style={card}>
              <div
                style={{
                  fontSize: 11,
                  color: "#334155",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                }}
              >
                Évolution sur {year}
              </div>
              <BarChart history={history} />
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 10,
                  fontSize: 11,
                  color: "#334155",
                  justifyContent: "center",
                }}
              >
                <span>
                  Revenus annuels :{" "}
                  <strong
                    style={{
                      color: "#10B981",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {history.reduce((s, h) => s + h.rev, 0).toFixed(2)} €
                  </strong>
                </span>
                <span>
                  Dépenses annuelles :{" "}
                  <strong
                    style={{
                      color: "#F59E0B",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {history.reduce((s, h) => s + h.dep, 0).toFixed(2)} €
                  </strong>
                </span>
                <span>
                  Épargne totale :{" "}
                  <strong
                    style={{
                      color: "#06B6D4",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {history.reduce((s, h) => s + h.ep, 0).toFixed(2)} €
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ════ COACH IA ════ */}
        {tab === "ia" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 240px",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: "1px solid #1A1E2E",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "linear-gradient(135deg,#8B5CF6,#06B6D4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  🤖
                </div>
                <div>
                  <div
                    style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}
                  >
                    Coach IA Financier
                  </div>
                  <div style={{ fontSize: 11, color: "#334155" }}>
                    Analyse tes données · Conseils personnalisés · Prévisions
                  </div>
                </div>
              </div>
              <AICoach
                budgetData={budgetData}
                history={history}
                goals={goals}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...card, padding: "14px 16px" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}
                >
                  Ce que l'IA peut faire
                </div>
                {[
                  "Analyser ton budget complet",
                  "Identifier les postes à réduire",
                  "Comparer avec l'historique",
                  "Prévoir le mois prochain",
                  "Calculer quand tu atteindras tes objectifs",
                  "Suggérer une allocation optimale",
                  "Détecter les dépenses anormales",
                ].map((f) => (
                  <div
                    key={f}
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      marginBottom: 7,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{ color: "#8B5CF6", flexShrink: 0, marginTop: 1 }}
                    >
                      ◆
                    </span>
                    {f}
                  </div>
                ))}
              </div>
              <div
                style={{
                  ...card,
                  padding: "14px 16px",
                  background: "#0D0E1A",
                  borderColor: "#8B5CF625",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#8B5CF6",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  💡 ASTUCE
                </div>
                <div
                  style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}
                >
                  Renseigne d'abord ton budget complet pour obtenir une analyse
                  précise et personnalisée.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ OBJECTIFS ════ */}
        {tab === "objectifs" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  ...card,
                  padding: "12px 16px",
                  background: "#0D0E1A",
                  borderColor: "#06B6D425",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#06B6D4",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  💎 Épargne ce mois
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#06B6D4",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totals.epargne.toFixed(2)} €
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>
                  Taux : {tauxEp.toFixed(1)}% des revenus{" "}
                  {tauxEp >= 20
                    ? "✓ Excellent"
                    : tauxEp >= 10
                    ? "👍 Bien"
                    : "↗ À augmenter"}
                </div>
              </div>
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onUpdate={(u) =>
                    setGoals((gs) => gs.map((x) => (x.id === g.id ? u : x)))
                  }
                  onDelete={() =>
                    setGoals((gs) => gs.filter((x) => x.id !== g.id))
                  }
                />
              ))}
              <button
                onClick={() =>
                  setGoals((gs) => [
                    ...gs,
                    {
                      id: uid(),
                      label: "Nouvel objectif",
                      target: 500,
                      current: 0,
                      color: "#10B981",
                      icon: "⭐",
                    },
                  ])
                }
                style={{
                  ...card,
                  border: "1px dashed #2D3350",
                  background: "none",
                  color: "#8B5CF6",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: "14px",
                  transition: "all 0.2s",
                  textAlign: "center",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#8B5CF608")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                + Ajouter un objectif
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={card}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 14,
                  }}
                >
                  Vue d'ensemble des objectifs
                </div>
                {goals.length === 0 ? (
                  <div
                    style={{
                      color: "#2D3350",
                      textAlign: "center",
                      padding: 20,
                      fontSize: 13,
                    }}
                  >
                    Aucun objectif défini
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {goals.map((g) => {
                      const pct =
                        g.target > 0
                          ? Math.min((g.current / g.target) * 100, 100)
                          : 0;
                      const remain = Math.max(g.target - g.current, 0);
                      const months =
                        totals.epargne > 0
                          ? Math.ceil(remain / totals.epargne)
                          : null;
                      return (
                        <div key={g.id}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                              {g.icon} {g.label}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: g.color,
                                fontWeight: 700,
                              }}
                            >
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              background: "#1A1E2E",
                              borderRadius: 99,
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                background: g.color,
                                width: `${pct}%`,
                                transition: "width 0.7s ease",
                                boxShadow: `0 0 8px ${g.color}50`,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            {pct >= 100
                              ? "🎉 Objectif atteint !"
                              : months
                              ? `≈ ${months} mois à ce rythme d'épargne`
                              : "Définis ton épargne pour voir la projection"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ ...card, padding: "14px 16px" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}
                >
                  Projection annuelle
                </div>
                <div
                  style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}
                >
                  Si tu maintiens{" "}
                  <span style={{ color: "#06B6D4", fontWeight: 600 }}>
                    {totals.epargne.toFixed(0)} €/mois
                  </span>{" "}
                  :
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#06B6D4",
                    fontVariantNumeric: "tabular-nums",
                    marginBottom: 4,
                  }}
                >
                  {(totals.epargne * 12).toFixed(2)} €
                </div>
                <div style={{ fontSize: 11, color: "#334155" }}>
                  en 12 mois (sans tenir compte des intérêts)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ SIMULATION ════ */}
        {tab === "simulation" && <SimPanel currentRows={rows} />}

        {/* ════ HISTORIQUE ════ */}
        {tab === "historique" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 12,
              }}
            >
              {[
                { label: "Revenus", field: "rev", color: "#10B981" },
                { label: "Dépenses", field: "dep", color: "#F59E0B" },
                { label: "Épargne", field: "ep", color: "#06B6D4" },
              ].map(({ label, field, color }) => (
                <div key={label} style={card}>
                  <div
                    style={{
                      fontSize: 10,
                      color,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 10,
                    }}
                  >
                    {label} {year}
                  </div>
                  <MiniBar history={history} field={field} color={color} />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 6,
                      fontSize: 9,
                      color: "#1E2535",
                    }}
                  >
                    {MONTHS_SHORT.map((m, i) => (
                      <span key={i}>{m}</span>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color,
                      fontWeight: 700,
                    }}
                  >
                    Total :{" "}
                    {history
                      .reduce((s, h) => s + (h[field] || 0), 0)
                      .toFixed(2)}{" "}
                    €
                  </div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div
                style={{
                  fontSize: 11,
                  color: "#334155",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                }}
              >
                Tableau mensuel {year}
              </div>
              {history.length === 0 ? (
                <div
                  style={{
                    color: "#2D3350",
                    textAlign: "center",
                    padding: "28px 0",
                    fontSize: 13,
                  }}
                >
                  Aucune donnée pour {year} — saisis ton budget pour voir
                  l'historique.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1A1E2E" }}>
                        {[
                          "Mois",
                          "Revenus",
                          "Charges",
                          "Variables",
                          "Épargne",
                          "Solde",
                          "Score",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "7px 10px",
                              textAlign: h === "Mois" ? "left" : "right",
                              color: "#334155",
                              fontWeight: 600,
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((mo, i) => {
                        const d = history.find((x) => x.month === i);
                        if (!d)
                          return (
                            <tr
                              key={i}
                              style={{ borderBottom: "1px solid #0D1117" }}
                            >
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#1A1E2E",
                                  fontSize: 12,
                                }}
                              >
                                {mo}
                              </td>
                              {["—", "—", "—", "—", "—", "—"].map((v, j) => (
                                <td
                                  key={j}
                                  style={{
                                    padding: "7px 10px",
                                    textAlign: "right",
                                    color: "#1A1E2E",
                                    fontSize: 12,
                                  }}
                                >
                                  {v}
                                </td>
                              ))}
                            </tr>
                          );
                        const sc = calcScore(d.rev, d.dep, d.ep, d.fx, d.va);
                        const scl = scoreLabel(sc);
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: "1px solid #0D1117",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#141830")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                            onClick={() => {
                              switchMonth(year, i);
                              setTab("budget");
                            }}
                            title={`Aller à ${mo} ${year}`}
                          >
                            <td
                              style={{
                                padding: "7px 10px",
                                color: "#94A3B8",
                                fontWeight: 600,
                              }}
                            >
                              {mo}
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                                color: "#10B981",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {d.rev.toFixed(2)} €
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                                color: "#8B5CF6",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {(d.fx || 0).toFixed(2)} €
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                                color: "#F59E0B",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {(d.va || 0).toFixed(2)} €
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                                color: "#06B6D4",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {(d.ep || 0).toFixed(2)} €
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                color: d.solde >= 0 ? "#10B981" : "#EF4444",
                              }}
                            >
                              {d.solde >= 0 ? "+" : ""}
                              {d.solde.toFixed(2)} €
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                textAlign: "right",
                              }}
                            >
                              <span
                                style={{
                                  color: scl.color,
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                {sc}
                              </span>
                              <span
                                style={{
                                  color: scl.color,
                                  fontSize: 10,
                                  marginLeft: 4,
                                }}
                              >
                                {scl.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {history.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: "2px solid #1A1E2E" }}>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "#475569",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            TOTAL {year}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              textAlign: "right",
                              color: "#10B981",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {history.reduce((s, h) => s + h.rev, 0).toFixed(2)}{" "}
                            €
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              textAlign: "right",
                              color: "#8B5CF6",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {history
                              .reduce((s, h) => s + (h.fx || 0), 0)
                              .toFixed(2)}{" "}
                            €
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              textAlign: "right",
                              color: "#F59E0B",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {history
                              .reduce((s, h) => s + (h.va || 0), 0)
                              .toFixed(2)}{" "}
                            €
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              textAlign: "right",
                              color: "#06B6D4",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {history
                              .reduce((s, h) => s + (h.ep || 0), 0)
                              .toFixed(2)}{" "}
                            €
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              textAlign: "right",
                              fontWeight: 800,
                              fontVariantNumeric: "tabular-nums",
                              color: "#F1F5F9",
                              fontSize: 14,
                            }}
                          >
                            {(
                              history.reduce((s, h) => s + h.rev, 0) -
                              history.reduce((s, h) => s + h.dep, 0)
                            ).toFixed(2)}{" "}
                            €
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
