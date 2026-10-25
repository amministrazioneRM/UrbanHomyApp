import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LayoutDashboard, TrendingUp, Target, History, Settings,
  ChevronLeft, ChevronRight, LogOut, RefreshCw, Save, Send,
  Plus, Pencil, Trash2, X, Check, AlertTriangle, Building2,
  ArrowUp, ArrowDown, Minus, Eye, EyeOff,
} from "lucide-react";
import UHAccounts from "./accounts";
import type { UHAccount, UHRuolo, UHSede, PermessiMap } from "./accounts";
import { forecastApi, useBackendOffline } from "./api";
import type { ForecastBU, ForecastVoce, ForecastEntry, ForecastTarget, ForecastStorico, ForecastActual, DashboardData } from "./api";

const APP_ID = "revenueForecast";
const ACCENT = "#0C7873";
const ACCENT_HOVER = "#095e59";
const MESI_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const MESI_FULL  = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function fmt(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(Math.round(n));
}
function pct(a: number, b: number): string {
  if (!b) return "–";
  return ((a / b) * 100).toFixed(1) + "%";
}

// ─── Permission helpers ──────────────────────────────────────────────────────

function canEdit(perm: PermessiMap | null, modulo: string): boolean {
  if (!perm) return false;
  return perm[modulo]?.modifica === true;
}
function canRead(perm: PermessiMap | null, modulo: string): boolean {
  if (!perm) return false;
  return perm[modulo]?.lettura === true;
}

// ─── UI primitives ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4 ${wide ? "w-full max-w-2xl" : "w-full max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-fraunces text-lg font-semibold text-stone-900">{title}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0C7873]/40 focus:border-[#0C7873]";

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color || "bg-stone-100 text-stone-600"}`}>
      {children}
    </span>
  );
}

// ─── Delta indicator ─────────────────────────────────────────────────────────

function Delta({ value, base }: { value: number; base: number }) {
  if (!base) return <span className="text-stone-400 text-xs">–</span>;
  const d = value - base;
  const p = (d / base) * 100;
  if (Math.abs(p) < 0.1) return <span className="text-stone-400 text-xs flex items-center gap-0.5"><Minus size={10} />0%</span>;
  const up = d > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(p).toFixed(1)}%
    </span>
  );
}

// ─── Mini bar chart for dashboard ────────────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; forecast: number; target: number; actual: number }[] }) {
  const max = Math.max(...data.flatMap((d) => [d.forecast, d.target, d.actual]), 1);
  return (
    <div className="flex items-end gap-1 h-24 mt-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-0.5 flex-1">
          <div className="w-full flex gap-px items-end" style={{ height: 80 }}>
            <div className="flex-1 rounded-sm" style={{ height: `${(d.target / max) * 80}px`, background: "#D1D5DB" }} title={`Target: ${fmt(d.target)}`} />
            <div className="flex-1 rounded-sm" style={{ height: `${(d.forecast / max) * 80}px`, background: ACCENT, opacity: 0.85 }} title={`Forecast: ${fmt(d.forecast)}`} />
            {d.actual > 0 && (
              <div className="flex-1 rounded-sm" style={{ height: `${(d.actual / max) * 80}px`, background: "#F59E0B" }} title={`Actual: ${fmt(d.actual)}`} />
            )}
          </div>
          <span className="text-[9px] text-stone-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, forecast, target, actual, icon: Icon }: {
  label: string; forecast: number; target: number; actual: number; icon: React.ElementType;
}) {
  const gap = target ? forecast - target : 0;
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-500">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
          <Icon size={17} color="white" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900 font-fraunces">{fmtShort(forecast)}</div>
        <div className="text-xs text-stone-400 mt-0.5">Forecast</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-stone-400">Target</div>
          <div className="font-semibold text-stone-700">{target ? fmtShort(target) : "–"}</div>
        </div>
        {actual > 0 ? (
          <div>
            <div className="text-stone-400">Actual (Mews)</div>
            <div className="font-semibold text-amber-600">{fmtShort(actual)}</div>
          </div>
        ) : (
          <div>
            <div className="text-stone-400">vs Target</div>
            <div>{target ? <Delta value={forecast} base={target} /> : <span className="text-stone-300">–</span>}</div>
          </div>
        )}
      </div>
      {target > 0 && (
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min((forecast / target) * 100, 100)}%`, background: forecast >= target ? "#059669" : ACCENT }} />
        </div>
      )}
    </div>
  );
}

// ─── Dashboard section ────────────────────────────────────────────────────────

function Dashboard({ bus, voci, buId, anno }: {
  bus: ForecastBU[]; voci: ForecastVoce[]; buId: string; anno: number;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    forecastApi.getDashboard({ buId: buId || undefined, anno }).then(setData).finally(() => setLoading(false));
  }, [buId, anno]);

  const today = new Date();
  const meseCorrente = today.getMonth() + 1;

  const sum = useCallback((arr: Array<{ buId: string; mese: number; importo: number }>, mese?: number) => {
    return arr
      .filter((x) => (!buId || x.buId === buId) && (mese === undefined || x.mese === mese))
      .reduce((s, x) => s + x.importo, 0);
  }, [buId]);

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Caricamento…</div>;
  if (!data) return null;

  const { entries, targets, actuals } = data;

  // Monthly chart data
  const chartData = MESI_SHORT.map((label, i) => ({
    label,
    forecast: sum(entries, i + 1),
    target: sum(targets, i + 1),
    actual: sum(actuals, i + 1),
  }));

  const meseCorr = meseCorrente;
  const meseProx = meseCorrente === 12 ? 1 : meseCorrente + 1;
  const ytdMesi = Array.from({ length: meseProx - 1 }, (_, i) => i + 1);

  const fc = (mese: number) => sum(entries, mese);
  const tg = (mese: number) => sum(targets, mese);
  const ac = (mese: number) => sum(actuals, mese);
  const fcYtd = ytdMesi.reduce((s, m) => s + fc(m), 0);
  const tgYtd = ytdMesi.reduce((s, m) => s + tg(m), 0);
  const acYtd = ytdMesi.reduce((s, m) => s + ac(m), 0);
  const fcAnno = entries.filter((e) => !buId || e.buId === buId).reduce((s, e) => s + e.importo, 0);
  const tgAnno = targets.filter((t) => !buId || t.buId === buId).reduce((s, t) => s + t.importo, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Mese corrente (${MESI_FULL[meseCorr - 1]})`} forecast={fc(meseCorr)} target={tg(meseCorr)} actual={ac(meseCorr)} icon={TrendingUp} />
        <StatCard label={`Mese prossimo (${MESI_FULL[meseProx - 1]})`} forecast={fc(meseProx)} target={tg(meseProx)} actual={0} icon={Target} />
        <StatCard label={`YTD (${MESI_FULL[0]}–${MESI_FULL[meseProx - 2]})`} forecast={fcYtd} target={tgYtd} actual={acYtd} icon={History} />
        <StatCard label={`Anno ${anno}`} forecast={fcAnno} target={tgAnno} actual={0} icon={LayoutDashboard} />
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="font-fraunces text-base font-semibold text-stone-900">Andamento mensile {anno}</span>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-stone-200 inline-block" /> Target</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: ACCENT }} /> Forecast</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Actual</span>
          </div>
        </div>
        <MiniBarChart data={chartData} />
      </div>

      {/* BU table */}
      {bus.length > 1 && !buId && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 overflow-x-auto">
          <div className="font-fraunces text-base font-semibold text-stone-900 mb-3">Dettaglio per Business Unit — {MESI_FULL[meseCorr - 1]}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 uppercase">
                <th className="text-left pb-2 pr-4">BU</th>
                <th className="text-right pb-2 pr-4">Forecast</th>
                <th className="text-right pb-2 pr-4">Target</th>
                <th className="text-right pb-2">vs Target</th>
              </tr>
            </thead>
            <tbody>
              {bus.map((bu) => {
                const f = entries.filter((e) => e.buId === bu.id && e.mese === meseCorr).reduce((s, e) => s + e.importo, 0);
                const t = targets.filter((tg) => tg.buId === bu.id && tg.mese === meseCorr).reduce((s, tg) => s + tg.importo, 0);
                return (
                  <tr key={bu.id} className="border-t border-stone-100">
                    <td className="py-2 pr-4 font-medium text-stone-800">{bu.nome}</td>
                    <td className="py-2 pr-4 text-right text-stone-800">{fmt(f)}</td>
                    <td className="py-2 pr-4 text-right text-stone-500">{t ? fmt(t) : "–"}</td>
                    <td className="py-2 text-right"><Delta value={f} base={t} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Forecast section ─────────────────────────────────────────────────────────

function ForecastSection({ bus, voci, account, permessi, sedi }: {
  bus: ForecastBU[]; voci: ForecastVoce[]; account: UHAccount; permessi: PermessiMap | null; sedi: UHSede[];
}) {
  const today = new Date();
  const [anno, setAnno] = useState(today.getFullYear());
  const [mese, setMese] = useState(today.getMonth() + 1);
  const [buId, setBuId] = useState(bus[0]?.id || "");
  const [entries, setEntries] = useState<ForecastEntry[]>([]);
  const [targets, setTargets] = useState<ForecastTarget[]>([]);
  const [actuals, setActuals] = useState<ForecastActual[]>([]);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshingMews, setRefreshingMews] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const canEditForecast = account.ruoloGlobale === "Amministratore" || canEdit(permessi, "forecast");
  const isAdmin = account.ruoloGlobale === "Amministratore";

  const load = useCallback(async () => {
    if (!buId) return;
    const [e, t, a] = await Promise.all([
      forecastApi.getEntries({ buId, anno, mese }),
      forecastApi.getTargets({ buId, anno }),
      forecastApi.getActuals({ buId, anno, mese }),
    ]);
    setEntries(e);
    setTargets(t);
    setActuals(a);
    // Initialize local values
    const vals: Record<string, string> = {};
    voci.filter((v) => v.attiva).forEach((v) => {
      const entry = e.find((x) => x.voceId === v.id);
      vals[v.id] = entry ? String(entry.importo) : "";
    });
    setLocalValues(vals);
  }, [buId, anno, mese, voci]);

  useEffect(() => { load(); }, [load]);

  function navMese(dir: number) {
    let m = mese + dir;
    let a = anno;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMese(m); setAnno(a);
  }

  async function handleSave() {
    if (!buId || !canEditForecast) return;
    setSaving(true);
    try {
      const toSave = voci.filter((v) => v.attiva).map((v) => ({
        buId, anno, mese, voceId: v.id, importo: parseFloat(localValues[v.id] || "0") || 0,
      }));
      await forecastApi.saveEntries(toSave, account.id);
      await load();
      setMsg({ type: "ok", text: "Bozza salvata" });
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function handlePublish() {
    if (!buId || !canEditForecast) return;
    setPublishing(true);
    try {
      await handleSave();
      await forecastApi.pubblicaEntries(buId, anno, mese, account.id);
      await load();
      setMsg({ type: "ok", text: "Forecast pubblicato" });
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setPublishing(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function handleRefreshMews() {
    if (!buId) return;
    setRefreshingMews(true);
    try {
      const a = await forecastApi.refreshActuals(buId, anno, mese);
      setActuals(a);
      setMsg({ type: "ok", text: "Dati Mews aggiornati" });
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setRefreshingMews(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  const activeVoci = voci.filter((v) => v.attiva);
  const stato = entries.length > 0 && entries.every((e) => e.stato === "pubblicato") ? "pubblicato"
    : entries.length > 0 ? "bozza" : null;

  const forecastTotal = activeVoci.reduce((s, v) => s + (parseFloat(localValues[v.id] || "0") || 0), 0);
  const targetTotal = activeVoci.reduce((s, v) => {
    const t = targets.find((x) => x.voceId === v.id && x.mese === mese);
    return s + (t?.importo || 0);
  }, 0);
  const actualTotal = activeVoci.reduce((s, v) => {
    const a = actuals.find((x) => x.voceId === v.id);
    return s + (a?.importo || 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {bus.length > 1 && (
          <select className={`${inputCls} w-48`} value={buId} onChange={(e) => setBuId(e.target.value)}>
            {bus.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-1 py-1">
          <button className="p-1.5 rounded-lg hover:bg-stone-100 transition" onClick={() => navMese(-1)}><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-stone-800 px-3 min-w-36 text-center">{MESI_FULL[mese - 1]} {anno}</span>
          <button className="p-1.5 rounded-lg hover:bg-stone-100 transition" onClick={() => navMese(1)}><ChevronRight size={16} /></button>
        </div>
        {stato && (
          <Badge color={stato === "pubblicato" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
            {stato === "pubblicato" ? "✓ Pubblicato" : "Bozza"}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {msg && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${msg.type === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
              {msg.text}
            </span>
          )}
          {isAdmin && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
              onClick={handleRefreshMews} disabled={refreshingMews}
            >
              <RefreshCw size={14} className={refreshingMews ? "animate-spin" : ""} />
              Aggiorna Mews
            </button>
          )}
          {canEditForecast && (
            <>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                onClick={handleSave} disabled={saving}
              >
                <Save size={14} />
                Salva bozza
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-semibold text-white transition disabled:opacity-50"
                style={{ background: ACCENT }}
                onClick={handlePublish} disabled={publishing || saving}
              >
                <Send size={14} />
                Pubblica
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Voce di ricavo</th>
              <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Target</th>
              <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>Forecast</th>
              <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-amber-500">Actual (Mews)</th>
              <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">vs Target</th>
            </tr>
          </thead>
          <tbody>
            {activeVoci.map((v) => {
              const target = targets.find((t) => t.voceId === v.id && t.mese === mese);
              const actual = actuals.find((a) => a.voceId === v.id);
              const val = parseFloat(localValues[v.id] || "0") || 0;
              return (
                <tr key={v.id} className="border-t border-stone-50 hover:bg-stone-50/50">
                  <td className="px-5 py-3 font-medium text-stone-800">{v.nome}</td>
                  <td className="px-5 py-3 text-right text-stone-400">{target ? fmt(target.importo) : "–"}</td>
                  <td className="px-5 py-3 text-right">
                    {canEditForecast ? (
                      <input
                        type="number"
                        className="w-36 text-right rounded-lg border border-stone-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C7873]/30 focus:border-[#0C7873]"
                        value={localValues[v.id] ?? ""}
                        onChange={(e) => setLocalValues((prev) => ({ ...prev, [v.id]: e.target.value }))}
                        placeholder="0"
                      />
                    ) : (
                      <span className="font-semibold text-stone-800">{val ? fmt(val) : "–"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-amber-600 font-medium">{actual ? fmt(actual.importo) : "–"}</td>
                  <td className="px-5 py-3 text-right">{target ? <Delta value={val} base={target.importo} /> : <span className="text-stone-300">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-200 bg-stone-50/50">
              <td className="px-5 py-3 font-bold text-stone-900 text-xs uppercase tracking-wide">TOTALE</td>
              <td className="px-5 py-3 text-right font-bold text-stone-500">{targetTotal ? fmt(targetTotal) : "–"}</td>
              <td className="px-5 py-3 text-right font-bold" style={{ color: ACCENT }}>{fmt(forecastTotal)}</td>
              <td className="px-5 py-3 text-right font-bold text-amber-600">{actualTotal > 0 ? fmt(actualTotal) : "–"}</td>
              <td className="px-5 py-3 text-right">{targetTotal ? <Delta value={forecastTotal} base={targetTotal} /> : "–"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {entries.length > 0 && (
        <p className="text-xs text-stone-400 text-right">
          Ultima modifica: {new Date(entries[0].dataModifica).toLocaleString("it-IT")}
        </p>
      )}
    </div>
  );
}

// ─── Target section ───────────────────────────────────────────────────────────

function TargetSection({ bus, voci, account, permessi }: {
  bus: ForecastBU[]; voci: ForecastVoce[]; account: UHAccount; permessi: PermessiMap | null;
}) {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [buId, setBuId] = useState(bus[0]?.id || "");
  const [targets, setTargets] = useState<ForecastTarget[]>([]);
  const [localVals, setLocalVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const canEditTarget = account.ruoloGlobale === "Amministratore" || canEdit(permessi, "target");

  const load = useCallback(async () => {
    if (!buId) return;
    const t = await forecastApi.getTargets({ buId, anno });
    setTargets(t);
    const vals: Record<string, string> = {};
    voci.filter((v) => v.attiva).forEach((v) => {
      for (let m = 1; m <= 12; m++) {
        const key = `${v.id}:${m}`;
        const found = t.find((x) => x.voceId === v.id && x.mese === m);
        vals[key] = found ? String(found.importo) : "";
      }
    });
    setLocalVals(vals);
  }, [buId, anno, voci]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!canEditTarget) return;
    setSaving(true);
    try {
      const toSave: Array<{ buId: string; anno: number; mese: number; voceId: string; importo: number }> = [];
      voci.filter((v) => v.attiva).forEach((v) => {
        for (let m = 1; m <= 12; m++) {
          toSave.push({ buId, anno, mese: m, voceId: v.id, importo: parseFloat(localVals[`${v.id}:${m}`] || "0") || 0 });
        }
      });
      await forecastApi.saveTargets(toSave);
      await load();
      setMsg({ type: "ok", text: "Target salvati" });
    } catch (e: unknown) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  const activeVoci = voci.filter((v) => v.attiva);
  const colTotals = Array.from({ length: 12 }, (_, i) =>
    activeVoci.reduce((s, v) => s + (parseFloat(localVals[`${v.id}:${i + 1}`] || "0") || 0), 0)
  );
  const grandTotal = colTotals.reduce((s, x) => s + x, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {bus.length > 1 && (
          <select className={`${inputCls} w-48`} value={buId} onChange={(e) => setBuId(e.target.value)}>
            {bus.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-2 py-1">
          <button className="p-1 rounded hover:bg-stone-100" onClick={() => setAnno((a) => a - 1)}><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-stone-800 px-3">{anno}</span>
          <button className="p-1 rounded hover:bg-stone-100" onClick={() => setAnno((a) => a + 1)}><ChevronRight size={15} /></button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {msg && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${msg.type === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
              {msg.text}
            </span>
          )}
          {canEditTarget && (
            <button
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-semibold text-white transition disabled:opacity-50"
              style={{ background: ACCENT }}
              onClick={handleSave} disabled={saving}
            >
              <Save size={14} />
              Salva target
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 min-w-36">Voce</th>
              {MESI_SHORT.map((m) => (
                <th key={m} className="text-right px-2 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 min-w-24">{m}</th>
              ))}
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 min-w-28">TOTALE</th>
            </tr>
          </thead>
          <tbody>
            {activeVoci.map((v) => {
              const rowTotal = Array.from({ length: 12 }, (_, i) => parseFloat(localVals[`${v.id}:${i + 1}`] || "0") || 0).reduce((s, x) => s + x, 0);
              return (
                <tr key={v.id} className="border-t border-stone-50 hover:bg-stone-50/30">
                  <td className="px-4 py-2 font-medium text-stone-800">{v.nome}</td>
                  {Array.from({ length: 12 }, (_, i) => (
                    <td key={i} className="px-2 py-2 text-right">
                      {canEditTarget ? (
                        <input
                          type="number"
                          className="w-24 text-right rounded border border-stone-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0C7873]/30 focus:border-[#0C7873]"
                          value={localVals[`${v.id}:${i + 1}`] ?? ""}
                          onChange={(e) => setLocalVals((p) => ({ ...p, [`${v.id}:${i + 1}`]: e.target.value }))}
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-stone-700">{parseFloat(localVals[`${v.id}:${i + 1}`] || "0") ? fmt(parseFloat(localVals[`${v.id}:${i + 1}`])) : "–"}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold text-stone-800">{rowTotal ? fmt(rowTotal) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-200 bg-stone-50/50">
              <td className="px-4 py-2 font-bold text-stone-900 text-xs uppercase tracking-wide">TOTALE</td>
              {colTotals.map((t, i) => (
                <td key={i} className="px-2 py-2 text-right font-bold text-stone-700 text-xs">{t ? fmtShort(t) : "–"}</td>
              ))}
              <td className="px-4 py-2 text-right font-bold" style={{ color: ACCENT }}>{grandTotal ? fmt(grandTotal) : "–"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Storico section ──────────────────────────────────────────────────────────

function StoricoSection({ bus, voci, account }: { bus: ForecastBU[]; voci: ForecastVoce[]; account: UHAccount }) {
  const today = new Date();
  const [anno, setAnno] = useState(today.getFullYear());
  const [mese, setMese] = useState(today.getMonth() + 1);
  const [buId, setBuId] = useState(bus[0]?.id || "");
  const [storici, setStorici] = useState<ForecastStorico[]>([]);

  useEffect(() => {
    if (!buId) return;
    forecastApi.getStorico({ buId, anno, mese }).then(setStorici);
  }, [buId, anno, mese]);

  function navMese(dir: number) {
    let m = mese + dir; let a = anno;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    setMese(m); setAnno(a);
  }

  // Group by data/tipo and show evolution per voce
  const byVoce: Record<string, ForecastStorico[]> = {};
  voci.filter((v) => v.attiva).forEach((v) => { byVoce[v.id] = storici.filter((s) => s.voceId === v.id); });

  const dates = [...new Set(storici.map((s) => s.dataRegistrazione.slice(0, 16)))].sort();
  const activeVoci = voci.filter((v) => v.attiva);

  // Compute reliability: last "pubblicazione" vs previous values
  const pubs = storici.filter((s) => s.tipo === "pubblicazione");
  const lastPubDate = pubs.length ? Math.max(...pubs.map((s) => new Date(s.dataRegistrazione).getTime())) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {bus.length > 1 && (
          <select className={`${inputCls} w-48`} value={buId} onChange={(e) => setBuId(e.target.value)}>
            {bus.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-1 py-1">
          <button className="p-1.5 rounded-lg hover:bg-stone-100" onClick={() => navMese(-1)}><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-stone-800 px-3 min-w-36 text-center">{MESI_FULL[mese - 1]} {anno}</span>
          <button className="p-1.5 rounded-lg hover:bg-stone-100" onClick={() => navMese(1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      {storici.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
          Nessun dato storico per questo mese
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Tipo</th>
                {activeVoci.map((v) => (
                  <th key={v.id} className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">{v.nome}</th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Totale</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const rows = storici.filter((s) => s.dataRegistrazione.slice(0, 16) === date);
                const tipo = rows[0]?.tipo;
                const total = activeVoci.reduce((s, v) => {
                  const row = rows.find((r) => r.voceId === v.id);
                  return s + (row?.importo || 0);
                }, 0);
                const isPub = tipo === "pubblicazione";
                return (
                  <tr key={date} className={`border-t border-stone-50 ${isPub ? "bg-emerald-50/50" : ""} hover:bg-stone-50/50`}>
                    <td className="px-4 py-2 text-stone-600">{new Date(date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2">
                      <Badge color={isPub ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"}>
                        {isPub ? "✓ Pubblicato" : "Modifica"}
                      </Badge>
                    </td>
                    {activeVoci.map((v) => {
                      const row = rows.find((r) => r.voceId === v.id);
                      return <td key={v.id} className="px-3 py-2 text-right text-stone-700">{row ? fmt(row.importo) : "–"}</td>;
                    })}
                    <td className="px-4 py-2 text-right font-bold text-stone-800">{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Configurazione section ───────────────────────────────────────────────────

type ModalConf =
  | { type: "nuovaBU" }
  | { type: "modificaBU"; bu: ForecastBU & { mewsClientToken?: string; mewsAccessToken?: string } }
  | { type: "nuovaVoce" }
  | { type: "modificaVoce"; voce: ForecastVoce };

function ConfigSection({ bus, voci, sedi, onReload }: {
  bus: ForecastBU[]; voci: ForecastVoce[]; sedi: UHSede[]; onReload: () => void;
}) {
  const [modal, setModal] = useState<ModalConf | null>(null);
  const [buForm, setBuForm] = useState({ nome: "", codiceBC: "", sedeCentraleId: "", mewsPropertyId: "", mewsClientToken: "", mewsAccessToken: "", attiva: true });
  const [voceForm, setVoceForm] = useState({ nome: "", ordine: 0 });
  const [showTokens, setShowTokens] = useState(false);

  function openNewBU() {
    setBuForm({ nome: "", codiceBC: "", sedeCentraleId: sedi[0]?.id || "", mewsPropertyId: "", mewsClientToken: "", mewsAccessToken: "", attiva: true });
    setModal({ type: "nuovaBU" });
  }
  function openEditBU(bu: ForecastBU) {
    setBuForm({ nome: bu.nome, codiceBC: bu.codiceBC || "", sedeCentraleId: bu.sedeCentraleId, mewsPropertyId: bu.mewsPropertyId || "", mewsClientToken: "", mewsAccessToken: "", attiva: bu.attiva });
    setModal({ type: "modificaBU", bu: bu as ForecastBU & { mewsClientToken?: string; mewsAccessToken?: string } });
    setShowTokens(false);
  }

  async function saveBU() {
    if (!buForm.nome.trim() || !buForm.sedeCentraleId) return;
    const data = { nome: buForm.nome, codiceBC: buForm.codiceBC || undefined, sedeCentraleId: buForm.sedeCentraleId, mewsPropertyId: buForm.mewsPropertyId || undefined, mewsClientToken: buForm.mewsClientToken || undefined, mewsAccessToken: buForm.mewsAccessToken || undefined, attiva: buForm.attiva };
    if (modal?.type === "nuovaBU") {
      await forecastApi.createBU(data);
    } else if (modal?.type === "modificaBU") {
      await forecastApi.updateBU(modal.bu.id, data);
    }
    setModal(null); onReload();
  }

  async function saveVoce() {
    if (!voceForm.nome.trim()) return;
    if (modal?.type === "nuovaVoce") {
      await forecastApi.createVoce(voceForm);
    } else if (modal?.type === "modificaVoce") {
      await forecastApi.updateVoce(modal.voce.id, voceForm);
    }
    setModal(null); onReload();
  }

  return (
    <div className="space-y-6">
      {/* BU */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-fraunces text-base font-semibold text-stone-900">Business Unit</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-semibold text-white" style={{ background: ACCENT }} onClick={openNewBU}>
            <Plus size={14} /> Nuova BU
          </button>
        </div>
        <div className="space-y-2">
          {bus.map((bu) => (
            <div key={bu.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 hover:border-stone-200">
              <div>
                <div className="font-medium text-stone-800">{bu.nome}</div>
                <div className="text-xs text-stone-400 mt-0.5">{bu.codiceBC ? `BC: ${bu.codiceBC}` : ""}{bu.mewsPropertyId ? ` · Mews: ${bu.mewsPropertyId}` : ""} · {sedi.find((s) => s.id === bu.sedeCentraleId)?.nome || bu.sedeCentraleId}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={bu.attiva ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}>{bu.attiva ? "Attiva" : "Disattiva"}</Badge>
                <button className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100" onClick={() => openEditBU(bu)}><Pencil size={14} /></button>
              </div>
            </div>
          ))}
          {bus.length === 0 && <p className="text-sm text-stone-400">Nessuna Business Unit configurata</p>}
        </div>
      </div>

      {/* Voci */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-fraunces text-base font-semibold text-stone-900">Voci di ricavo</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-semibold text-white" style={{ background: ACCENT }} onClick={() => { setVoceForm({ nome: "", ordine: voci.length }); setModal({ type: "nuovaVoce" }); }}>
            <Plus size={14} /> Nuova voce
          </button>
        </div>
        <div className="space-y-2">
          {voci.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 hover:border-stone-200">
              <div className="font-medium text-stone-800">{v.nome}</div>
              <div className="flex items-center gap-2">
                <Badge color={v.attiva ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}>{v.attiva ? "Attiva" : "Inattiva"}</Badge>
                <button className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100" onClick={() => { setVoceForm({ nome: v.nome, ordine: v.ordine }); setModal({ type: "modificaVoce", voce: v }); }}><Pencil size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BU modal */}
      {(modal?.type === "nuovaBU" || modal?.type === "modificaBU") && (
        <Modal title={modal.type === "nuovaBU" ? "Nuova Business Unit" : "Modifica Business Unit"} onClose={() => setModal(null)}>
          <Field label="Nome BU *">
            <input className={inputCls} value={buForm.nome} onChange={(e) => setBuForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Es. Hotel Roma Centro" />
          </Field>
          <Field label="Sede centrale *">
            <select className={inputCls} value={buForm.sedeCentraleId} onChange={(e) => setBuForm((p) => ({ ...p, sedeCentraleId: e.target.value }))}>
              <option value="">Seleziona sede…</option>
              {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Codice Business Central">
            <input className={inputCls} value={buForm.codiceBC} onChange={(e) => setBuForm((p) => ({ ...p, codiceBC: e.target.value }))} placeholder="Es. DIM_BU_ROMA" />
          </Field>
          <div className="border-t border-stone-100 pt-3">
            <button className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 mb-3" onClick={() => setShowTokens(!showTokens)}>
              {showTokens ? <EyeOff size={12} /> : <Eye size={12} />}
              Configurazione Mews
            </button>
            {showTokens && (
              <div className="space-y-3">
                <Field label="Mews Property ID">
                  <input className={inputCls} value={buForm.mewsPropertyId} onChange={(e) => setBuForm((p) => ({ ...p, mewsPropertyId: e.target.value }))} placeholder="Es. abc-123-def" />
                </Field>
                <Field label="Mews Client Token">
                  <input className={inputCls} type="password" value={buForm.mewsClientToken} onChange={(e) => setBuForm((p) => ({ ...p, mewsClientToken: e.target.value }))} placeholder="Lascia vuoto per non modificare" />
                </Field>
                <Field label="Mews Access Token">
                  <input className={inputCls} type="password" value={buForm.mewsAccessToken} onChange={(e) => setBuForm((p) => ({ ...p, mewsAccessToken: e.target.value }))} placeholder="Lascia vuoto per non modificare" />
                </Field>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input type="checkbox" checked={buForm.attiva} onChange={(e) => setBuForm((p) => ({ ...p, attiva: e.target.checked })) } className="accent-[#0C7873]" />
            BU attiva
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button className="px-4 py-2 text-sm rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setModal(null)}>Annulla</button>
            <button className="px-4 py-2 text-sm rounded-lg font-semibold text-white" style={{ background: ACCENT }} onClick={saveBU}>Salva</button>
          </div>
        </Modal>
      )}

      {/* Voce modal */}
      {(modal?.type === "nuovaVoce" || modal?.type === "modificaVoce") && (
        <Modal title={modal.type === "nuovaVoce" ? "Nuova voce" : "Modifica voce"} onClose={() => setModal(null)}>
          <Field label="Nome voce *">
            <input className={inputCls} value={voceForm.nome} onChange={(e) => setVoceForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Es. Accommodation" />
          </Field>
          <Field label="Ordine">
            <input type="number" className={inputCls} value={voceForm.ordine} onChange={(e) => setVoceForm((p) => ({ ...p, ordine: parseInt(e.target.value) || 0 }))} />
          </Field>
          {modal.type === "modificaVoce" && (
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={(modal.voce as ForecastVoce).attiva} className="accent-[#0C7873]" readOnly />
              Attiva (modifica tramite API)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button className="px-4 py-2 text-sm rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setModal(null)}>Annulla</button>
            <button className="px-4 py-2 text-sm rounded-lg font-semibold text-white" style={{ background: ACCENT }} onClick={saveVoce}>Salva</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type Section = "dashboard" | "forecast" | "target" | "storico" | "configurazione";

export default function App() {
  const [account, setAccount] = useState<UHAccount | null>(() => UHAccounts.loadSession());
  const [ruolo, setRuolo] = useState<UHRuolo | null>(null);
  const [bus, setBus] = useState<ForecastBU[]>([]);
  const [voci, setVoci] = useState<ForecastVoce[]>([]);
  const [sedi, setSedi] = useState<UHSede[]>([]);
  const [section, setSection] = useState<Section>("dashboard");
  const [buFilter, setBuFilter] = useState("");
  const [annoFilter, setAnnoFilter] = useState(new Date().getFullYear());
  const [loadingApp, setLoadingApp] = useState(true);
  const offline = useBackendOffline();

  const isAdmin = account?.ruoloGlobale === "Amministratore";
  const permessi: PermessiMap | null = ruolo?.permessi || null;

  // Check permission to show section
  function canSeeSection(s: Section): boolean {
    if (!account) return false;
    if (isAdmin) return true;
    const acc = account.accessi[APP_ID];
    if (!acc?.abilitato) return false;
    if (s === "configurazione") return canEdit(permessi, "configurazione");
    if (s === "target") return canRead(permessi, "target") || canEdit(permessi, "target");
    return true;
  }

  const loadMasterData = useCallback(async () => {
    try {
      const [b, v, s] = await Promise.all([
        forecastApi.getBU(),
        forecastApi.getVoci(),
        UHAccounts.fetchSedi(),
      ]);
      setBus(b);
      setVoci(v);
      setSedi(s);
      if (b.length > 0) setBuFilter(b[0].id);
    } catch (_) { /* offline handled elsewhere */ }
    setLoadingApp(false);
  }, []);

  useEffect(() => {
    if (!account) return;
    // Load role if not admin
    if (!isAdmin && account.accessi[APP_ID]?.ruoloId) {
      const ruoloId = account.accessi[APP_ID]!.ruoloId;
      UHAccounts.fetchRoles()
        .then((ruoli) => setRuolo(UHAccounts.roleById(ruoloId, ruoli)))
        .catch(() => {});
    }
    loadMasterData();
  }, [account, isAdmin, loadMasterData]);

  function handleLogout() {
    UHAccounts.clearSession();
    setAccount(null);
    window.location.href = "../";
  }

  // Not logged in
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F0E8]">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ background: ACCENT }}>
            <TrendingUp size={22} color="white" />
          </div>
          <div className="font-fraunces text-xl font-semibold text-stone-900">Revenue Forecast</div>
          <p className="text-sm text-stone-500">Effettua il login dal portale per accedere.</p>
          <a href="../" className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: ACCENT }}>
            Vai al portale
          </a>
        </div>
      </div>
    );
  }

  // No access
  const hasAccess = isAdmin || account.accessi[APP_ID]?.abilitato === true;
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F0E8]">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-sm w-full text-center space-y-3">
          <AlertTriangle size={32} className="mx-auto text-amber-400" />
          <div className="font-fraunces text-lg font-semibold text-stone-900">Accesso non autorizzato</div>
          <p className="text-sm text-stone-500">Non hai i permessi per accedere a Revenue Forecast.</p>
          <a href="../" className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Torna al portale</a>
        </div>
      </div>
    );
  }

  const nav: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "forecast", label: "Forecast", icon: TrendingUp },
    { id: "target", label: "Target", icon: Target },
    { id: "storico", label: "Storico", icon: History },
    { id: "configurazione", label: "Configurazione", icon: Settings },
  ].filter((n) => canSeeSection(n.id));

  return (
    <div className="min-h-screen bg-[#F3F0E8] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="../" className="flex items-center gap-2 text-stone-400 hover:text-stone-700 text-xs transition">
              <ChevronLeft size={14} />
            </a>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
              <TrendingUp size={16} color="white" />
            </div>
            <span className="font-fraunces font-semibold text-stone-900">Revenue Forecast</span>
          </div>

          {offline && (
            <Badge color="bg-amber-100 text-amber-700">
              <AlertTriangle size={10} className="mr-1" /> Backend offline
            </Badge>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600 hidden sm:block">{account.nome}</span>
            <button className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100" onClick={handleLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-xl mx-auto w-full gap-0 px-0">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0 py-6 px-3 hidden md:flex flex-col gap-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition w-full text-left ${section === id ? "text-white shadow-sm" : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"}`}
              style={section === id ? { background: ACCENT } : {}}
              onClick={() => setSection(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden w-full border-b border-stone-200 bg-white px-3 py-2 flex gap-1 overflow-x-auto sticky top-14 z-20">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${section === id ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
              style={section === id ? { background: ACCENT } : {}}
              onClick={() => setSection(id)}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 py-6 px-4 min-w-0">
          {loadingApp ? (
            <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Caricamento…</div>
          ) : (
            <>
              {section === "dashboard" && (
                <Dashboard bus={bus} voci={voci} buId={buFilter} anno={annoFilter} />
              )}
              {section === "forecast" && (
                <ForecastSection bus={bus} voci={voci} account={account} permessi={permessi} sedi={sedi} />
              )}
              {section === "target" && (
                <TargetSection bus={bus} voci={voci} account={account} permessi={permessi} />
              )}
              {section === "storico" && (
                <StoricoSection bus={bus} voci={voci} account={account} />
              )}
              {section === "configurazione" && (
                <ConfigSection bus={bus} voci={voci} sedi={sedi} onReload={loadMasterData} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
