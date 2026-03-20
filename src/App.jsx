import { useState, useRef } from "react";

// ─── Utility helpers ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);
const monthOf = (d) => d.slice(0, 7);
const weekAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
};
const monthAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CATS = ["Food", "Travel", "Shopping", "Bills", "Health", "Entertainment", "Others"];
const CAT_COLORS = {
  Food: "#f97316", Travel: "#8b5cf6", Shopping: "#3b82f6",
  Bills: "#10b981", Health: "#ef4444", Entertainment: "#f59e0b", Others: "#6b7280",
};
const CAT_ICONS = {
  Food: "🍽", Travel: "✈", Shopping: "🛍", Bills: "💡",
  Health: "💊", Entertainment: "🎬", Others: "📦",
};

const SAMPLE = [
  { id: uid(), amount: 1200, category: "Food",          date: today(),    description: "Grocery shopping" },
  { id: uid(), amount: 4500, category: "Travel",        date: today(),    description: "Uber rides this week" },
  { id: uid(), amount: 2800, category: "Shopping",      date: monthAgo(), description: "New shirt & jeans" },
  { id: uid(), amount: 1800, category: "Bills",         date: monthAgo(), description: "Electricity bill" },
  { id: uid(), amount: 650,  category: "Food",          date: weekAgo(),  description: "Restaurant dinner" },
  { id: uid(), amount: 999,  category: "Entertainment", date: weekAgo(),  description: "Netflix subscription" },
  { id: uid(), amount: 3200, category: "Health",        date: monthAgo(), description: "Doctor consultation & meds" },
  { id: uid(), amount: 500,  category: "Food",          date: weekAgo(),  description: "Lunch with colleagues" },
  { id: uid(), amount: 1500, category: "Travel",        date: weekAgo(),  description: "Weekend trip fuel" },
  { id: uid(), amount: 2200, category: "Shopping",      date: today(),    description: "Books and stationery" },
];

const DEFAULT_BUDGETS = {
  Food: 5000, Travel: 6000, Shopping: 4000, Bills: 3000,
  Health: 3000, Entertainment: 2000, Others: 2000,
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function hashPass(p) {
  let h = 0;
  for (let c of p) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return h.toString(16);
}
const getUsers    = () => JSON.parse(localStorage.getItem("et_users") || "{}");
const saveUsers   = (u) => localStorage.setItem("et_users", JSON.stringify(u));
const getSession  = () => localStorage.getItem("et_session");
const setSession  = (e) => localStorage.setItem("et_session", e);
const clearSession = () => localStorage.removeItem("et_session");

// ─── Groq API (FREE) ──────────────────────────────────────────────────────────
// Sign up free at console.groq.com — no credit card required
async function groqChat(messages, systemPrompt = "") {
  const key = localStorage.getItem("et_groq_key") || "";
  if (!key) throw new Error("NO_KEY");
  const payload = {
    model: "llama-3.1-8b-instant",
    max_tokens: 1200,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  light: {
    bg: "#f1f5f9", sidebar: "#ffffff", text: "#0f172a", muted: "#64748b",
    border: "#e2e8f0", card: "#ffffff", cardBorder: "#e2e8f0", input: "#f8fafc",
  },
  dark: {
    bg: "#0d0d1a", sidebar: "#13132b", text: "#e2e8f0", muted: "#64748b",
    border: "#1e1e3a", card: "#1a1a30", cardBorder: "#1e1e3a", input: "#222240",
  },
};

const iStyle = (dark, extra = {}) => ({
  width: "100%", padding: "10px 14px", marginBottom: 12,
  border: `1px solid ${dark ? "#1e1e3a" : "#e2e8f0"}`,
  borderRadius: 10,
  background: dark ? "#222240" : "#f8fafc",
  color: dark ? "#e2e8f0" : "#0f172a",
  fontSize: 14, outline: "none", boxSizing: "border-box", ...extra,
});

const btnPrimary = {
  padding: "10px 22px",
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  color: "#fff", border: "none", borderRadius: 10,
  fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};

// ═════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,    setUser]    = useState(getSession);
  const [dark,    setDark]    = useState(() => localStorage.getItem("et_dark") === "1");
  const [page,    setPage]    = useState("dashboard");
  const [sidebar, setSidebar] = useState(true);

  const [expenses, setExpenses] = useState(() => {
    const s = getSession();
    if (!s) return SAMPLE;
    const raw = localStorage.getItem("et_expenses_" + s);
    return raw ? JSON.parse(raw) : SAMPLE;
  });

  const [budgets, setBudgets] = useState(() => {
    const s = getSession();
    if (!s) return DEFAULT_BUDGETS;
    const raw = localStorage.getItem("et_budgets_" + s);
    return raw ? JSON.parse(raw) : DEFAULT_BUDGETS;
  });

  const saveExpenses = (list) => {
    setExpenses(list);
    if (user) localStorage.setItem("et_expenses_" + user, JSON.stringify(list));
  };
  const saveBudgets = (b) => {
    setBudgets(b);
    if (user) localStorage.setItem("et_budgets_" + user, JSON.stringify(b));
  };

  const toggleDark = () =>
    setDark((d) => { localStorage.setItem("et_dark", d ? "0" : "1"); return !d; });

  const login = (email, pass) => {
    const users = getUsers();
    if (!users[email] || users[email] !== hashPass(pass)) return false;
    setUser(email); setSession(email);
    const raw = localStorage.getItem("et_expenses_" + email);
    setExpenses(raw ? JSON.parse(raw) : SAMPLE);
    const rb  = localStorage.getItem("et_budgets_" + email);
    setBudgets(rb ? JSON.parse(rb) : DEFAULT_BUDGETS);
    return true;
  };

  const signup = (email, pass, name) => {
    const users = getUsers();
    if (users[email]) return false;
    users[email] = hashPass(pass);
    localStorage.setItem("et_names_" + email, name);
    saveUsers(users);
    setUser(email); setSession(email);
    setExpenses(SAMPLE); setBudgets(DEFAULT_BUDGETS);
    return true;
  };

  const logout = () => {
    clearSession(); setUser(null);
    setExpenses(SAMPLE); setBudgets(DEFAULT_BUDGETS);
    setPage("dashboard");
  };

  const addExpense    = (e) => saveExpenses([{ ...e, id: uid() }, ...expenses]);
  const editExpense   = (id, d) => saveExpenses(expenses.map((x) => (x.id === id ? { ...x, ...d } : x)));
  const deleteExpense = (id) => saveExpenses(expenses.filter((x) => x.id !== id));

  const userName = user
    ? (localStorage.getItem("et_names_" + user) || user.split("@")[0])
    : "Guest";

  if (!user)
    return <AuthPage onLogin={login} onSignup={signup} dark={dark} toggleDark={toggleDark} />;

  const th = dark ? T.dark : T.light;

  const NAV = [
    { key: "dashboard", label: "Dashboard",   icon: "⊡" },
    { key: "expenses",  label: "Expenses",    icon: "₹" },
    { key: "insights",  label: "AI Insights", icon: "✦" },
    { key: "budgets",   label: "Budgets",     icon: "◎" },
    { key: "settings",  label: "Settings",    icon: "⚙" },
    { key: "export",    label: "Export",      icon: "⇓" },
  ];

  const pages = {
    dashboard: <Dashboard  expenses={expenses} budgets={budgets} dark={dark} />,
    expenses:  <ExpensesPage expenses={expenses} onAdd={addExpense} onEdit={editExpense} onDelete={deleteExpense} dark={dark} />,
    insights:  <InsightsPage expenses={expenses} budgets={budgets} dark={dark} />,
    budgets:   <BudgetsPage  budgets={budgets} expenses={expenses} onChange={saveBudgets} dark={dark} />,
    settings:  <SettingsPage dark={dark} />,
    export:    <ExportPage   expenses={expenses} dark={dark} />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'Outfit','DM Sans',system-ui,sans-serif", transition: "background .3s,color .3s" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebar ? 220 : 64, flexShrink: 0,
        background: th.sidebar, borderRight: `1px solid ${th.border}`,
        display: "flex", flexDirection: "column",
        transition: "width .25s", overflow: "hidden",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 14px 12px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${th.border}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>₿</div>
          {sidebar && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.3px" }}>SpendWise</div>
              <div style={{ fontSize: 10, color: th.muted }}>AI Tracker · Groq Free</div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
              marginBottom: 2, textAlign: "left", fontSize: 14,
              background: page === n.key
                ? (dark ? "rgba(99,102,241,.22)" : "rgba(99,102,241,.1)") : "transparent",
              color: page === n.key ? "#6366f1" : th.text,
              fontWeight: page === n.key ? 600 : 400, transition: "all .15s",
            }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{n.icon}</span>
              {sidebar && <span>{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* User + actions */}
        <div style={{ padding: "10px 8px", borderTop: `1px solid ${th.border}` }}>
          {sidebar && (
            <div style={{ padding: "6px 12px", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{userName}</div>
              <div style={{ fontSize: 11, color: th.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</div>
            </div>
          )}
          <button onClick={toggleDark} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: th.muted, fontSize: 13 }}>
            <span style={{ width: 20, textAlign: "center" }}>{dark ? "☀" : "☽"}</span>
            {sidebar && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </button>
          <button onClick={logout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: "#ef4444", fontSize: 13 }}>
            <span style={{ width: 20, textAlign: "center" }}>⏻</span>
            {sidebar && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "14px 22px", borderBottom: `1px solid ${th.border}`, display: "flex", alignItems: "center", gap: 12, background: th.sidebar, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebar((o) => !o)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: th.muted }}>☰</button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, flex: 1 }}>
            {NAV.find((n) => n.key === page)?.label}
          </h1>
          <span style={{ fontSize: 12, color: th.muted }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </header>
        <main style={{ flex: 1, padding: "22px", overflowY: "auto" }}>
          {pages[page] || null}
        </main>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH PAGE
// ═════════════════════════════════════════════════════════════════════════════
function AuthPage({ onLogin, onSignup, dark, toggleDark }) {
  const [mode,  setMode]  = useState("login");
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [name,  setName]  = useState("");
  const [err,   setErr]   = useState("");
  const th = dark ? T.dark : T.light;

  const submit = () => {
    setErr("");
    if (!email || !pass) { setErr("All fields are required."); return; }
    if (mode === "signup") {
      if (!name) { setErr("Name is required."); return; }
      if (!onSignup(email, pass, name)) { setErr("Email already registered."); return; }
    } else {
      if (!onLogin(email, pass)) { setErr("Invalid email or password."); return; }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#0d0d1a" : "#f1f5f9", fontFamily: "'Outfit','DM Sans',system-ui" }}>
      <div style={{ background: dark ? "#13132b" : "#fff", border: `1px solid ${dark ? "#1e1e3a" : "#e2e8f0"}`, borderRadius: 22, padding: "38px 34px", width: 390, boxShadow: "0 24px 64px rgba(0,0,0,.13)" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 12px" }}>₿</div>
          <div style={{ fontSize: 23, fontWeight: 800, color: dark ? "#e2e8f0" : "#0f172a" }}>SpendWise</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>AI Expense Tracker · Powered by Groq (Free)</div>
        </div>

        {/* Tab */}
        <div style={{ display: "flex", background: dark ? "#222240" : "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 18 }}>
          {["login", "signup"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
              flex: 1, padding: "8px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: mode === m ? (dark ? "#1a1a30" : "#fff") : "transparent",
              color: mode === m ? (dark ? "#e2e8f0" : "#0f172a") : "#6b7280",
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.1)" : "none", transition: "all .2s",
            }}>
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} style={iStyle(dark)} />
        )}
        <input placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={iStyle(dark)} />
        <input placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} style={iStyle(dark)} />

        {err && (
          <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,.1)", borderRadius: 8 }}>
            {err}
          </div>
        )}

        <button onClick={submit} style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: 15 }}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 14 }}>
          Use any email + password to create a demo account
        </p>
        <button onClick={toggleDark} style={{ display: "block", margin: "6px auto 0", border: "none", background: "none", cursor: "pointer", color: "#6b7280", fontSize: 12 }}>
          {dark ? "☀ Light mode" : "☽ Dark mode"}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function Dashboard({ expenses, budgets, dark }) {
  const th = dark ? T.dark : T.light;
  const card = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: "20px 22px" };

  const total     = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses.filter((e) => monthOf(e.date) === monthOf(today())).reduce((s, e) => s + e.amount, 0);
  const thisWeek  = expenses.filter((e) => e.date >= weekAgo()).reduce((s, e) => s + e.amount, 0);

  const prevWeekStart = () => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); };
  const prevWeek = expenses.filter((e) => e.date >= prevWeekStart() && e.date < weekAgo()).reduce((s, e) => s + e.amount, 0);
  const weekDiff = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : 0;

  const byCat = {};
  expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const catTotal = Object.values(byCat).reduce((a, b) => a + b, 0) || 1;

  // 6-month bar
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key    = d.toISOString().slice(0, 7);
    const label  = d.toLocaleDateString("en-IN", { month: "short" });
    const amount = expenses.filter((e) => monthOf(e.date) === key).reduce((s, e) => s + e.amount, 0);
    months.push({ key, label, amount });
  }
  const maxMonth = Math.max(...months.map((m) => m.amount), 1);

  const alerts = CATS.filter((c) => byCat[c] > budgets[c]).map((c) => ({ cat: c, spent: byCat[c], budget: budgets[c] }));

  const stats = [
    { label: "Total Spent",  value: fmt(total),      icon: "💰", color: "#6366f1" },
    { label: "This Month",   value: fmt(thisMonth),  icon: "📅", color: "#8b5cf6" },
    { label: "This Week",    value: fmt(thisWeek),   icon: "📆", color: "#06b6d4", sub: weekDiff !== 0 ? `${weekDiff > 0 ? "+" : ""}${weekDiff}% vs last week` : null, subColor: weekDiff > 0 ? "#ef4444" : "#10b981" },
    { label: "Transactions", value: expenses.length, icon: "🧾", color: "#10b981" },
  ];

  return (
    <div>
      {/* Budget alerts */}
      {alerts.length > 0 && (
        <div style={{ background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>Budget Exceeded</div>
            <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>
              {alerts.map((a) => `${a.cat}: ${fmt(a.spent)} / ${fmt(a.budget)}`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 22 }}>
        {stats.map((s) => (
          <div key={s.label} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: th.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.label}</span>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: s.subColor, marginTop: 4, fontWeight: 500 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 20 }}>
        {/* Bar chart */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Monthly Spending Trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>
            {months.map((m) => {
              const h = Math.max((m.amount / maxMonth) * 110, 4);
              const current = monthOf(m.key) === monthOf(today());
              return (
                <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {m.amount > 0 && <div style={{ fontSize: 9, color: th.muted }}>₹{Math.round(m.amount / 1000)}k</div>}
                  <div style={{ width: "100%", height: h, borderRadius: "5px 5px 0 0", background: current ? "linear-gradient(180deg,#6366f1,#8b5cf6)" : (dark ? "#1e1e3a" : "#e2e8f0"), transition: "height .5s" }} />
                  <div style={{ fontSize: 10, color: th.muted }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie chart */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>By Category</div>
          <PieChart byCat={byCat} catTotal={catTotal} dark={dark} />
        </div>
      </div>

      {/* Recent transactions */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Recent Transactions</div>
        {expenses.slice(0, 6).map((e, i) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < Math.min(expenses.length, 6) - 1 ? `1px solid ${th.border}` : "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: CAT_COLORS[e.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
              {CAT_ICONS[e.category]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</div>
              <div style={{ fontSize: 11, color: th.muted }}>{e.category} · {fmtDate(e.date)}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: CAT_COLORS[e.category] }}>{fmt(e.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pie Chart ────────────────────────────────────────────────────────────────
function PieChart({ byCat, catTotal, dark }) {
  const th = dark ? T.dark : T.light;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!cats.length) return <div style={{ color: th.muted, fontSize: 13 }}>No data yet</div>;

  let start = 0;
  const slices = cats.map(([cat, val]) => {
    const pct = val / catTotal;
    const s = { cat, val, pct, start };
    start += pct * 2 * Math.PI;
    return s;
  });

  const arc = (s, r) => {
    const x1 = 56 + r * Math.sin(s.start),  y1 = 56 - r * Math.cos(s.start);
    const a  = s.start + s.pct * 2 * Math.PI;
    const x2 = 56 + r * Math.sin(a), y2 = 56 - r * Math.cos(a);
    return `M56 56 L${x1} ${y1} A${r} ${r} 0 ${s.pct > 0.5 ? 1 : 0} 1 ${x2} ${y2}Z`;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        {slices.map((s) => <path key={s.cat} d={arc(s, 50)} fill={CAT_COLORS[s.cat]} opacity=".88" />)}
        <circle cx="56" cy="56" r="28" fill={dark ? "#1a1a30" : "#fff"} />
        <text x="56" y="53" textAnchor="middle" style={{ fontSize: 9, fill: th.muted }}>total</text>
        <text x="56" y="65" textAnchor="middle" style={{ fontSize: 10, fill: th.text, fontWeight: 700 }}>
          ₹{Math.round(catTotal / 1000)}k
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {cats.slice(0, 6).map(([cat, val]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat], flexShrink: 0 }} />
            <div style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: CAT_COLORS[cat] }}>{Math.round((val / catTotal) * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPENSES PAGE
// ═════════════════════════════════════════════════════════════════════════════
function ExpensesPage({ expenses, onAdd, onEdit, onDelete, dark }) {
  const th = dark ? T.dark : T.light;
  const card = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: "20px 22px" };

  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState("All");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo,   setFilterTo]   = useState("");
  const [sortBy,     setSortBy]     = useState("date");
  const [form, setForm] = useState({ amount: "", category: "Food", date: today(), description: "" });

  const filtered = expenses
    .filter((e) => {
      if (filterCat !== "All" && e.category !== filterCat) return false;
      if (filterFrom && e.date < filterFrom) return false;
      if (filterTo   && e.date > filterTo)   return false;
      if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) =>
      sortBy === "date"   ? b.date.localeCompare(a.date) :
      sortBy === "amount" ? b.amount - a.amount :
      a.category.localeCompare(b.category)
    );

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  const openAdd  = () => { setForm({ amount: "", category: "Food", date: today(), description: "" }); setEditId(null); setShowForm(true); };
  const openEdit = (e) => { setForm({ amount: e.amount, category: e.category, date: e.date, description: e.description }); setEditId(e.id); setShowForm(true); };
  const save     = () => {
    if (!form.amount || !form.description) return;
    editId ? onEdit(editId, { ...form, amount: +form.amount }) : onAdd({ ...form, amount: +form.amount });
    setShowForm(false);
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center" }}>
        <input placeholder="🔍  Search description or category…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...iStyle(dark, { margin: 0, flex: "1 1 180px" }) }} />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          style={{ ...iStyle(dark, { margin: 0, width: "auto" }) }}>
          <option>All</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          style={{ ...iStyle(dark, { margin: 0, width: "auto" }) }} />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          style={{ ...iStyle(dark, { margin: 0, width: "auto" }) }} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          style={{ ...iStyle(dark, { margin: 0, width: "auto" }) }}>
          <option value="date">Sort: Date</option>
          <option value="amount">Sort: Amount</option>
          <option value="category">Sort: Category</option>
        </select>
        <button onClick={openAdd} style={btnPrimary}>+ Add Expense</button>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: th.card, borderRadius: 20, padding: "28px 30px", width: 420, boxShadow: "0 24px 64px rgba(0,0,0,.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editId ? "Edit Expense" : "Add New Expense"}</div>
            <input placeholder="Amount (₹)" type="number" min="0" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={iStyle(dark)} />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={iStyle(dark)}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={iStyle(dark)} />
            <input placeholder="Description" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && save()} style={iStyle(dark)} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "11px", border: `1px solid ${th.border}`, borderRadius: 10, background: "transparent", color: th.text, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={save} style={{ ...btnPrimary, flex: 1, padding: "11px", textAlign: "center" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: th.muted }}>{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(totalFiltered)}</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "44px 0", color: th.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
            <div>No expenses found</div>
          </div>
        ) : (
          filtered.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < filtered.length - 1 ? `1px solid ${th.border}` : "none" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: CAT_COLORS[e.category] + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {CAT_ICONS[e.category]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</div>
                <div style={{ fontSize: 11, color: th.muted }}>{e.category} · {fmtDate(e.date)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: CAT_COLORS[e.category], marginRight: 4 }}>{fmt(e.amount)}</div>
              <button onClick={() => openEdit(e)} title="Edit"   style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: th.muted,  padding: "4px 5px" }}>✏</button>
              <button onClick={() => onDelete(e.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444", padding: "4px 5px" }}>🗑</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AI INSIGHTS PAGE  —  uses Groq (FREE Llama 3)
// ═════════════════════════════════════════════════════════════════════════════
function InsightsPage({ expenses, budgets, dark }) {
  const th = dark ? T.dark : T.light;
  const card = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: "20px 22px", marginBottom: 20 };

  const [insights,    setInsights]    = useState([]);
  const [insLoading,  setInsLoading]  = useState(false);
  const [insErr,      setInsErr]      = useState("");
  const [chat,        setChat]        = useState([]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatErr,     setChatErr]     = useState("");
  const chatRef = useRef(null);

  const buildCtx = () => {
    const byCat = {};
    expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const prevStart = () => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); };
    return {
      byCat,
      total:      expenses.reduce((s, e) => s + e.amount, 0),
      weekTotal:  expenses.filter((e) => e.date >= weekAgo()).reduce((s, e) => s + e.amount, 0),
      prevWeek:   expenses.filter((e) => e.date >= prevStart() && e.date < weekAgo()).reduce((s, e) => s + e.amount, 0),
      monthTotal: expenses.filter((e) => monthOf(e.date) === monthOf(today())).reduce((s, e) => s + e.amount, 0),
      exceeded:   CATS.filter((c) => byCat[c] > budgets[c]),
      budgets, count: expenses.length,
    };
  };

  const generateInsights = async () => {
    setInsLoading(true); setInsErr("");
    const ctx = buildCtx();
    const prompt = `You are a personal finance AI. Analyze this Indian user's expense data and return EXACTLY 5 helpful insights as a JSON array. Use ₹ symbol for amounts.

Data:
- Total spent all time: ₹${ctx.total}
- This week: ₹${ctx.weekTotal} | Last week: ₹${ctx.prevWeek}
- This month: ₹${ctx.monthTotal}
- Spending by category: ${JSON.stringify(ctx.byCat)}
- Monthly budgets set: ${JSON.stringify(ctx.budgets)}
- Categories over budget: ${ctx.exceeded.join(", ") || "none"}
- Total transactions: ${ctx.count}

You MUST return ONLY a JSON array. No intro text, no markdown, no explanation before or after. Start your response with [ and end with ]. Format:
[{"icon":"emoji","title":"short title max 5 words","body":"2-3 sentences with specific rupee amounts and 1 concrete saving tip"}]`;

    try {
      const text  = await groqChat([{ role: "user", content: prompt }]);
      const clean = text.replace(/```json|```/g, "").trim();
      let arr = [];
      try {
        const start = clean.indexOf("[");
        const end   = clean.lastIndexOf("]") + 1;
        if (start !== -1 && end > start) {
          arr = JSON.parse(clean.slice(start, end));
        }
      } catch {
        const start = clean.indexOf("{");
        const end   = clean.lastIndexOf("}") + 1;
        if (start !== -1 && end > start) {
          arr = [JSON.parse(clean.slice(start, end))];
        }
      }
      setInsights(Array.isArray(arr) ? arr : []);
    } catch (e) {
      if (e.message === "NO_KEY") {
        setInsErr("Add your free Groq API key in the Settings page first.");
      } else {
        setInsErr("AI error: " + e.message + " — showing fallback insights.");
        const ctx2 = buildCtx();
        const top  = Object.entries(ctx2.byCat).sort((a, b) => b[1] - a[1])[0];
        const diff = ctx2.prevWeek > 0 ? Math.round(((ctx2.weekTotal - ctx2.prevWeek) / ctx2.prevWeek) * 100) : 0;
        setInsights([
          { icon: "📊", title: "Spending overview",   body: `You have ${ctx2.count} transactions totaling ${fmt(ctx2.total)}. Monthly spend is ${fmt(ctx2.monthTotal)}.` },
          { icon: "🏆", title: "Top category",        body: top ? `${top[0]} is your biggest expense at ${fmt(top[1])}. Try reducing it by 15% to save ${fmt(top[1] * 0.15)} monthly.` : "Add more expenses to see your top category." },
          { icon: "📅", title: "Weekly comparison",   body: `This week: ${fmt(ctx2.weekTotal)} vs last week: ${fmt(ctx2.prevWeek)} — a ${diff > 0 ? "+" : ""}${diff}% ${diff > 0 ? "increase" : "decrease"}.` },
          { icon: "⚠️", title: "Budget status",       body: ctx2.exceeded.length ? `You've exceeded budget in: ${ctx2.exceeded.join(", ")}. Reduce spending in these areas.` : "Great job — you're within budget in all categories!" },
          { icon: "💡", title: "Quick savings tip",   body: "Review subscriptions and recurring bills monthly. Cancelling just one unused subscription can save ₹500-2000/month." },
        ]);
      }
    }
    setInsLoading(false);
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput(""); setChatErr("");
    const ctx = buildCtx();
    const history = [...chat, { role: "user", content: msg }];
    setChat(history);
    setChatLoading(true);

    const system = `You are SpendWise AI, a friendly financial assistant for an Indian user. Be concise (2-4 sentences), warm, and practical. Always use ₹ for amounts.
User's current data: Total spent: ₹${ctx.total} | This month: ₹${ctx.monthTotal} | This week: ₹${ctx.weekTotal}
By category: ${JSON.stringify(ctx.byCat)} | Budgets: ${JSON.stringify(ctx.budgets)} | Over budget: ${ctx.exceeded.join(", ") || "none"}`;

    try {
      const reply = await groqChat(history, system);
      setChat([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      if (e.message === "NO_KEY") {
        setChatErr("Add your free Groq API key in Settings to use the chatbot.");
        setChat(history.slice(0, -1));
      } else {
        setChat([...history, { role: "assistant", content: "Sorry, I couldn't reach the AI. Please check your Groq key in Settings." }]);
      }
    }
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 80);
  };

  const SUGGESTIONS = [
    "Where am I overspending?",
    "How can I save ₹2000/month?",
    "Which category needs attention?",
    "Give me 3 budgeting tips",
  ];

  const hasKey = !!localStorage.getItem("et_groq_key");

  return (
    <div>
      {/* No-key banner */}
      {!hasKey && (
        <div style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <span>🔑</span>
          <div style={{ fontSize: 13 }}>
            <b>Free Groq API key needed.</b> Get yours in 2 min at{" "}
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>console.groq.com</a>
            {" "}(no credit card) then paste it in <b>Settings</b>.
          </div>
        </div>
      )}

      {/* Insights panel */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>✦ AI Financial Insights</div>
            <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>Powered by Groq · Llama 3 · 100% Free</div>
          </div>
          <button onClick={generateInsights} disabled={insLoading} style={{ ...btnPrimary, opacity: insLoading ? .6 : 1 }}>
            {insLoading ? "Analyzing…" : "Generate Insights"}
          </button>
        </div>

        {insErr && (
          <div style={{ fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,.08)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
            {insErr}
          </div>
        )}

        {!insLoading && insights.length === 0 && !insErr && (
          <div style={{ textAlign: "center", padding: "32px 0", color: th.muted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✦</div>
            <div style={{ fontSize: 14 }}>Click "Generate Insights" to get AI-powered analysis of your spending</div>
          </div>
        )}

        {insLoading && (
          <div style={{ textAlign: "center", padding: "28px 0", color: th.muted }}>
            <div style={{ fontSize: 13 }}>🤖 Analyzing your spending patterns with Llama 3…</div>
          </div>
        )}

        {insights.map((ins, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < insights.length - 1 ? `1px solid ${th.border}` : "none" }}>
            <div style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{ins.icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: th.muted, lineHeight: 1.65 }}>{ins.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chatbot */}
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>💬 AI Financial Assistant</div>
        <div style={{ fontSize: 12, color: th.muted, marginBottom: 14 }}>Ask anything · Groq Llama 3 · Free</div>

        <div ref={chatRef} style={{ height: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {chat.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: th.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
              <div style={{ fontSize: 13, marginBottom: 14 }}>Ask me anything about your spending!</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTIONS.map((q) => (
                  <button key={q} onClick={() => setChatInput(q)} style={{ padding: "6px 13px", border: `1px solid ${th.border}`, borderRadius: 20, background: "transparent", color: th.muted, fontSize: 12, cursor: "pointer" }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "10px 14px", lineHeight: 1.6, fontSize: 13,
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : (dark ? "#222240" : "#f1f5f9"),
                color: m.role === "user" ? "#fff" : th.text,
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: dark ? "#222240" : "#f1f5f9", color: th.muted, fontSize: 13 }}>
                Thinking…
              </div>
            </div>
          )}
        </div>

        {chatErr && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{chatErr}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Ask about your finances…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            style={{ ...iStyle(dark, { margin: 0, flex: 1 }) }}
          />
          <button onClick={sendChat} disabled={chatLoading} style={{ ...btnPrimary, opacity: chatLoading ? .6 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BUDGETS PAGE
// ═════════════════════════════════════════════════════════════════════════════
function BudgetsPage({ budgets, expenses, onChange, dark }) {
  const th = dark ? T.dark : T.light;
  const byCat = {};
  expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
  const totalSpent  = Object.values(byCat).reduce((a, b)  => a + b, 0);

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Budget",   value: fmt(totalBudget), color: "#6366f1" },
          { label: "Total Spent",    value: fmt(totalSpent),  color: totalSpent > totalBudget ? "#ef4444" : "#10b981" },
          { label: "Remaining",      value: fmt(Math.max(totalBudget - totalSpent, 0)), color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} style={{ background: (dark ? T.dark : T.light).card, border: `1px solid ${(dark ? T.dark : T.light).cardBorder}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: (dark ? T.dark : T.light).muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Per-category cards */}
      {CATS.map((cat) => {
        const spent  = byCat[cat] || 0;
        const budget = budgets[cat] || 0;
        const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
        const over   = spent > budget && budget > 0;
        const barColor = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : CAT_COLORS[cat];

        return (
          <div key={cat} style={{ background: (dark ? T.dark : T.light).card, border: `1px solid ${(dark ? T.dark : T.light).cardBorder}`, borderRadius: 16, padding: "18px 22px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: CAT_COLORS[cat] + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
                {CAT_ICONS[cat]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontSize: 12, color: over ? "#ef4444" : (dark ? T.dark : T.light).muted, fontWeight: over ? 600 : 400 }}>
                    {fmt(spent)} / {fmt(budget)}
                  </span>
                </div>
                <div style={{ height: 7, background: dark ? "#1e1e3a" : "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width .4s" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: (dark ? T.dark : T.light).muted, whiteSpace: "nowrap" }}>Monthly budget ₹</span>
              <input
                type="number" min="0" value={budgets[cat]}
                onChange={(e) => onChange((b) => ({ ...b, [cat]: +e.target.value }))}
                style={{ ...iStyle(dark, { margin: 0, flex: 1, padding: "8px 12px" }) }}
              />
              {over && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, whiteSpace: "nowrap" }}>⚠ +{fmt(spent - budget)}</span>}
              {!over && pct >= 80 && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, whiteSpace: "nowrap" }}>{Math.round(pct)}% used</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE  —  Groq API key setup
// ═════════════════════════════════════════════════════════════════════════════
function SettingsPage({ dark }) {
  const th = dark ? T.dark : T.light;
  const card = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: "22px 24px", marginBottom: 18 };

  const [key,     setKey]     = useState(() => localStorage.getItem("et_groq_key") || "");
  const [saved,   setSaved]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [showKey, setShowKey] = useState(false);

  const saveKey = () => {
    localStorage.setItem("et_groq_key", key.trim());
    setSaved(true); setTestMsg("");
    setTimeout(() => setSaved(false), 2500);
  };

  const testKey = async () => {
    if (!key.trim()) { setTestMsg("❌ Please enter a key first."); return; }
    setTesting(true); setTestMsg("");
    try {
      const reply = await groqChat([{ role: "user", content: 'Reply with only the words: "Groq API working"' }]);
      setTestMsg(reply.toLowerCase().includes("working") ? "✅ API key is working! AI features are ready." : `✅ Connected! Response: ${reply.slice(0, 80)}`);
    } catch (e) {
      setTestMsg("❌ " + e.message);
    }
    setTesting(false);
  };

  return (
    <div>
      {/* Groq key setup */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔑 Groq API Key</div>
        <div style={{ fontSize: 13, color: th.muted, marginBottom: 16, lineHeight: 1.65 }}>
          Groq gives you free AI powered by Llama 3 — no credit card needed, no billing.
          Get your key at{" "}
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontWeight: 600 }}>console.groq.com</a>.
        </div>

        {/* Steps */}
        <div style={{ background: dark ? "#1e1e3a" : "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>How to get your free key (2 minutes):</div>
          {[
            ["1", "Open", "console.groq.com", "https://console.groq.com"],
            ["2", "Click", "Sign Up with Google", null],
            ["3", "Click", "API Keys in left sidebar", null],
            ["4", "Click", "Create API Key → give it a name", null],
            ["5", "Copy the key and paste it below", null, null],
          ].map(([n, pre, label, href]) => (
            <div key={n} style={{ display: "flex", gap: 10, marginBottom: 7, fontSize: 13, color: th.muted }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
              <span>
                {pre && <span>{pre} </span>}
                {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontWeight: 600 }}>{label}</a> : <b style={{ color: th.text }}>{label}</b>}
              </span>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ position: "relative" }}>
          <input
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ ...iStyle(dark), paddingRight: 44 }}
          />
          <button onClick={() => setShowKey((s) => !s)} style={{ position: "absolute", right: 10, top: 10, border: "none", background: "none", cursor: "pointer", color: th.muted, fontSize: 16 }}>
            {showKey ? "🙈" : "👁"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={saveKey} style={{ ...btnPrimary, flex: 1 }}>{saved ? "✅ Saved!" : "Save Key"}</button>
          <button onClick={testKey} disabled={testing} style={{ flex: 1, padding: "10px 22px", border: `1px solid ${th.border}`, borderRadius: 10, background: "transparent", color: th.text, cursor: testing ? "default" : "pointer", fontSize: 14, opacity: testing ? .6 : 1 }}>
            {testing ? "Testing…" : "Test Connection"}
          </button>
        </div>
        {testMsg && (
          <div style={{ marginTop: 10, fontSize: 13, padding: "8px 12px", borderRadius: 8, background: testMsg.startsWith("✅") ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: testMsg.startsWith("✅") ? "#10b981" : "#ef4444" }}>
            {testMsg}
          </div>
        )}
      </div>

      {/* Free limits */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📊 Groq Free Tier Limits</div>
        {[
          { label: "Requests per minute",  value: "30 RPM",        ok: true },
          { label: "Requests per day",     value: "14,400 / day",  ok: true },
          { label: "Tokens per minute",    value: "6,000 TPM",     ok: true },
          { label: "Model",                value: "Llama 3 8B",    ok: true },
          { label: "Monthly cost",         value: "₹0 — Free!",    ok: true },
          { label: "Credit card required", value: "No",            ok: true },
        ].map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${th.border}`, fontSize: 13 }}>
            <span style={{ color: th.muted }}>{r.label}</span>
            <span style={{ fontWeight: 600, color: r.label.includes("cost") || r.label.includes("credit") ? "#10b981" : th.text }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Data privacy */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🔒 Privacy & Data</div>
        <div style={{ fontSize: 13, color: th.muted, lineHeight: 1.65 }}>
          • All expense data is stored locally in your browser (localStorage).<br />
          • Only AI queries are sent to Groq's servers — just category totals and amounts, no personal details.<br />
          • Your Groq API key is stored in localStorage and never shared.
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT PAGE
// ═════════════════════════════════════════════════════════════════════════════
function ExportPage({ expenses, dark }) {
  const th = dark ? T.dark : T.light;
  const card = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: "22px 24px" };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  const [filterMonth, setFilterMonth] = useState("all");
  const months  = [...new Set(expenses.map((e) => monthOf(e.date)))].sort().reverse();
  const filtered = filterMonth === "all" ? expenses : expenses.filter((e) => monthOf(e.date) === filterMonth);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  const exportCSV = () => {
    const rows = [
      ["Date", "Category", "Description", "Amount (INR)"],
      ...filtered.map((e) => [e.date, e.category, `"${e.description.replace(/"/g, '""')}"`, e.amount]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spendwise-${filterMonth}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spendwise-${filterMonth}.json`;
    a.click();
  };

  return (
    <div>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>⇓ Export Your Data</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            style={{ ...iStyle(dark, { margin: 0, width: "auto" }) }}>
            <option value="all">All time ({expenses.length} records)</option>
            {months.map((m) => {
              const d     = new Date(m + "-01");
              const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
              const count = expenses.filter((e) => monthOf(e.date) === m).length;
              return <option key={m} value={m}>{label} ({count})</option>;
            })}
          </select>
          <span style={{ fontSize: 13, color: th.muted }}>{filtered.length} transactions · {fmt(filteredTotal)}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={exportCSV}  style={{ ...btnPrimary, flex: 1, textAlign: "center" }}>⇓ Download CSV</button>
          <button onClick={exportJSON} style={{ flex: 1, padding: "10px 22px", border: `1px solid ${th.border}`, borderRadius: 10, background: "transparent", color: th.text, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>⇓ Download JSON</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Category Summary</div>
        {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, val], i, arr) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${th.border}` : "none" }}>
            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{CAT_ICONS[cat]}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{cat}</span>
            <div style={{ width: 90, height: 5, background: dark ? "#1e1e3a" : "#e2e8f0", borderRadius: 3, overflow: "hidden", marginRight: 8 }}>
              <div style={{ height: "100%", width: `${(val / total) * 100}%`, background: CAT_COLORS[cat], borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, color: th.muted, width: 32, textAlign: "right" }}>{Math.round((val / total) * 100)}%</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: CAT_COLORS[cat], width: 80, textAlign: "right" }}>{fmt(val)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontWeight: 700, fontSize: 14, borderTop: `2px solid ${th.border}`, paddingTop: 12 }}>
          <span>Grand Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
