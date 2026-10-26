import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LayoutDashboard, TrendingUp, Target, History, Settings,
  ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, LogOut, RefreshCw, Save, Send,
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

type VistaForecast = "trimestre" | "anno";
const cellKey = (mese: number, voceId: string) => `${mese}|${voceId}`;
const num = (s: string | undefined) => parseFloat(s || "0") || 0;

function ForecastSection({ bus, voci, account, permessi }: {
  bus: ForecastBU[]; voci: ForecastVoce[]; account: UHAccount; permessi: PermessiMap | null; sedi: UHSede[];
}) {
  const today = new Date();
  const [anno, setAnno] = useState(today.getFullYear());
  const [trim, setTrim] = useState(Math.floor(today.getMonth() / 3));
  const [vista, setVista] = useState<VistaForecast>("trimestre");
  const [buId, setBuId] = useState(bus[0]?.id || "");
  const [entries, setEntries] = useState<ForecastEntry[]>([]);
  const [targets, setTargets] = useState<ForecastTarget[]>([]);
  const [actuals, setActuals] = useState<ForecastActual[]>([]);
  const [base, setBase] = useState<Record<string, string>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshingMews, setRefreshingMews] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const isAdmin = account.ruoloGlobale === "Amministratore";
  const canEditForecast = isAdmin || canEdit(permessi, "forecast");
  const activeVoci = voci.filter((v) => v.attiva);

  const mesiVista = vista === "anno" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [trim * 3 + 1, trim * 3 + 2, trim * 3 + 3];

  const load = useCallback(async () => {
    if (!buId) return;
    const [e, t, a] = await Promise.all([
      forecastApi.getEntries({ buId, anno }),
      forecastApi.getTargets({ buId, anno }),
      forecastApi.getActuals({ buId, anno }),
    ]);
    setEntries(e);
    setTargets(t);
    setActuals(a);
    const vals: Record<string, string> = {};
    e.forEach((x) => { vals[cellKey(x.mese, x.voceId)] = String(x.importo); });
    setBase(vals);
    setLocalValues(vals);
  }, [buId, anno]);

  useEffect(() => { load(); }, [load]);

  const dirtyKeys = Object.keys({ ...base, ...localValues }).filter((k) => num(base[k]) !== num(localValues[k]));
  const dirty = dirtyKeys.length > 0;

  function confermaModifiche(): boolean {
    return !dirty || window.confirm("Ci sono modifiche non salvate: se continui andranno perse.");
  }

  function navigaPeriodo(dir: number) {
    if (vista === "anno") {
      if (!confermaModifiche()) return;
      setAnno((a) => a + dir);
      return;
    }
    const t = trim + dir;
    if (t < 0 || t > 3) {
      if (!confermaModifiche()) return;
      setAnno((a) => a + (t < 0 ? -1 : 1));
      setTrim(t < 0 ? 3 : 0);
    } else {
      setTrim(t);
    }
  }

  function vaiAOggi() {
    if (anno !== today.getFullYear() && !confermaModifiche()) return;
    setAnno(today.getFullYear());
    setTrim(Math.floor(today.getMonth() / 3));
  }

  function cambiaBU(id: string) {
    if (!confermaModifiche()) return;
    setBuId(id);
  }

  function flash(m: { type: "ok" | "err"; text: string }, ms = 3000) {
    setMsg(m);
    setTimeout(() => setMsg(null), ms);
  }

  async function salvaModificati(): Promise<void> {
    const toSave = dirtyKeys.map((k) => {
      const [m, voceId] = k.split("|");
      return { buId, anno, mese: parseInt(m), voceId, importo: num(localValues[k]) };
    });
    if (toSave.length === 0) return;
    await forecastApi.saveEntries(toSave, account.id);
  }

  async function handleSave() {
    if (!buId || !canEditForecast) return;
    setSaving(true);
    try {
      const n = dirtyKeys.length;
      await salvaModificati();
      await load();
      flash({ type: "ok", text: n ? "Bozza salvata" : "Nessuna modifica da salvare" });
    } catch (e: unknown) {
      flash({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!buId || !canEditForecast) return;
    setPublishing(true);
    try {
      await salvaModificati();
      const fresh = await forecastApi.getEntries({ buId, anno });
      const daPubblicare = mesiVista.filter((m) => fresh.some((e) => e.mese === m && e.stato !== "pubblicato"));
      for (const m of daPubblicare) await forecastApi.pubblicaEntries(buId, anno, m, account.id);
      await load();
      flash(
        daPubblicare.length
          ? { type: "ok", text: daPubblicare.length === 1 ? `Forecast di ${MESI_FULL[daPubblicare[0] - 1]} pubblicato` : `Forecast pubblicato per ${daPubblicare.length} mesi` }
          : { type: "ok", text: "Niente da pubblicare nel periodo" },
        4000,
      );
    } catch (e: unknown) {
      flash({ type: "err", text: (e as Error).message }, 4000);
    } finally {
      setPublishing(false);
    }
  }

  async function handleRefreshMews() {
    if (!buId) return;
    setRefreshingMews(true);
    try {
      for (const m of mesiVista) await forecastApi.refreshActuals(buId, anno, m);
      setActuals(await forecastApi.getActuals({ buId, anno }));
      flash({ type: "ok", text: "Dati Mews aggiornati" });
    } catch (e: unknown) {
      flash({ type: "err", text: (e as Error).message });
    } finally {
      setRefreshingMews(false);
    }
  }

  const statoMese = (m: number): "pubblicato" | "bozza" | null => {
    const es = entries.filter((e) => e.mese === m);
    if (es.length === 0) return null;
    return es.every((e) => e.stato === "pubblicato") ? "pubblicato" : "bozza";
  };
  const forecastMese = (m: number) => activeVoci.reduce((s, v) => s + num(localValues[cellKey(m, v.id)]), 0);
  const targetMese = (m: number) => activeVoci.reduce((s, v) => s + (targets.find((t) => t.voceId === v.id && t.mese === m)?.importo || 0), 0);
  const actualMese = (m: number) => activeVoci.reduce((s, v) => s + (actuals.find((a) => a.voceId === v.id && a.mese === m)?.importo || 0), 0);
  const sumMesi = (f: (m: number) => number) => mesiVista.reduce((s, m) => s + f(m), 0);
  const haActual = actuals.some((a) => mesiVista.includes(a.mese) && a.importo > 0);
  const ultimaModifica = entries.length ? entries.reduce((a, b) => (a.dataModifica > b.dataModifica ? a : b)).dataModifica : null;

  const titoloPeriodo = vista === "anno" ? `Anno ${anno}` : `${trim + 1}° trimestre ${anno}`;
  const sottoPeriodo = vista === "anno" ? "" : `${MESI_SHORT[trim * 3]} – ${MESI_SHORT[trim * 3 + 2]}`;
  const inputW = vista === "anno" ? "w-24" : "w-32";
  const thCls = "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-right whitespace-nowrap";
  const stickyCell = "sticky left-0 z-10 bg-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {bus.length > 1 && (
          <select className={`${inputCls} w-48`} value={buId} onChange={(e) => cambiaBU(e.target.value)}>
            {bus.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-1 py-1">
          <button className="p-1.5 rounded-lg hover:bg-stone-100 transition" onClick={() => navigaPeriodo(-1)} title={vista === "anno" ? "Anno precedente" : "Trimestre precedente"}><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-stone-800 px-3 min-w-44 text-center">
            {titoloPeriodo}{sottoPeriodo && <span className="ml-1.5 font-normal text-stone-400 text-xs">{sottoPeriodo}</span>}
          </span>
          <button className="p-1.5 rounded-lg hover:bg-stone-100 transition" onClick={() => navigaPeriodo(1)} title={vista === "anno" ? "Anno successivo" : "Trimestre successivo"}><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 text-sm font-medium">
          {(["trimestre", "anno"] as VistaForecast[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1 rounded-lg transition ${vista === v ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
              style={vista === v ? { background: ACCENT } : {}}
            >
              {v === "trimestre" ? "Trimestre" : "Anno"}
            </button>
          ))}
        </div>
        <button className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition" onClick={vaiAOggi}>Oggi</button>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {dirty && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">Modifiche non salvate</span>}
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
                onClick={handleSave} disabled={saving || publishing}
              >
                <Save size={14} />
                Salva bozza
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-semibold text-white transition disabled:opacity-50"
                style={{ background: ACCENT }}
                onClick={handlePublish} disabled={publishing || saving}
                title={vista === "anno" ? "Pubblica i mesi dell'anno in bozza" : "Pubblica i mesi del trimestre in bozza"}
              >
                <Send size={14} />
                Pubblica {vista === "anno" ? "anno" : "trimestre"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="border-b border-stone-100">
              <th className={`${stickyCell} text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100`}>Voce di ricavo</th>
              {mesiVista.map((m) => {
                const st = statoMese(m);
                const corrente = anno === today.getFullYear() && m === today.getMonth() + 1;
                return (
                  <th key={m} className={`${thCls} border-b border-stone-100 ${corrente ? "bg-stone-50" : ""}`} style={{ color: ACCENT }}>
                    <div>{vista === "anno" ? MESI_SHORT[m - 1] : MESI_FULL[m - 1]}</div>
                    <div className="mt-1 h-4 normal-case tracking-normal">
                      {st && <Badge color={st === "pubblicato" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{st === "pubblicato" ? "Pubblicato" : "Bozza"}</Badge>}
                    </div>
                  </th>
                );
              })}
              <th className={`${thCls} text-stone-500 border-b border-stone-100`}>{vista === "anno" ? "Totale anno" : "Totale trim."}</th>
            </tr>
          </thead>
          <tbody>
            {activeVoci.map((v) => (
              <tr key={v.id} className="hover:bg-stone-50/50">
                <td className={`${stickyCell} px-5 py-2.5 font-medium text-stone-800 border-t border-stone-50`}>{v.nome}</td>
                {mesiVista.map((m) => {
                  const k = cellKey(m, v.id);
                  const modificato = num(base[k]) !== num(localValues[k]);
                  return (
                    <td key={m} className="px-3 py-2 text-right border-t border-stone-50">
                      {canEditForecast ? (
                        <input
                          type="number"
                          className={`${inputW} text-right rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C7873]/30 focus:border-[#0C7873] ${modificato ? "border-amber-300 bg-amber-50/40" : "border-stone-200"}`}
                          value={localValues[k] ?? ""}
                          onChange={(e) => setLocalValues((prev) => ({ ...prev, [k]: e.target.value }))}
                          placeholder="0"
                        />
                      ) : (
                        <span className="font-semibold text-stone-800">{num(localValues[k]) ? fmt(num(localValues[k])) : "–"}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-semibold text-stone-700 border-t border-stone-50">
                  {fmt(sumMesi((m) => num(localValues[cellKey(m, v.id)])))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-stone-50/60">
              <td className={`${stickyCell} bg-stone-50 px-5 py-2.5 font-bold text-xs uppercase tracking-wide text-stone-900 border-t-2 border-stone-200`}>Totale forecast</td>
              {mesiVista.map((m) => <td key={m} className="px-3 py-2.5 text-right font-bold border-t-2 border-stone-200" style={{ color: ACCENT }}>{fmt(forecastMese(m))}</td>)}
              <td className="px-3 py-2.5 text-right font-bold border-t-2 border-stone-200" style={{ color: ACCENT }}>{fmt(sumMesi(forecastMese))}</td>
            </tr>
            <tr>
              <td className={`${stickyCell} px-5 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400`}>Target</td>
              {mesiVista.map((m) => <td key={m} className="px-3 py-2 text-right text-stone-500">{targetMese(m) ? fmt(targetMese(m)) : "–"}</td>)}
              <td className="px-3 py-2 text-right font-semibold text-stone-500">{sumMesi(targetMese) ? fmt(sumMesi(targetMese)) : "–"}</td>
            </tr>
            <tr>
              <td className={`${stickyCell} px-5 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400`}>Forecast vs target</td>
              {mesiVista.map((m) => <td key={m} className="px-3 py-2"><div className="flex justify-end">{targetMese(m) ? <Delta value={forecastMese(m)} base={targetMese(m)} /> : <span className="text-stone-300">–</span>}</div></td>)}
              <td className="px-3 py-2"><div className="flex justify-end">{sumMesi(targetMese) ? <Delta value={sumMesi(forecastMese)} base={sumMesi(targetMese)} /> : <span className="text-stone-300">–</span>}</div></td>
            </tr>
            {haActual && (
              <tr>
                <td className={`${stickyCell} px-5 py-2 text-xs font-semibold uppercase tracking-wide text-amber-500`}>Actual (Mews)</td>
                {mesiVista.map((m) => <td key={m} className="px-3 py-2 text-right text-amber-600 font-medium">{actualMese(m) > 0 ? fmt(actualMese(m)) : "–"}</td>)}
                <td className="px-3 py-2 text-right font-semibold text-amber-600">{fmt(sumMesi(actualMese))}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {ultimaModifica && (
        <p className="text-xs text-stone-400 text-right">
          Ultima modifica: {new Date(ultimaModifica).toLocaleString("it-IT")}
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

  const dates = [...new Set(storici.map((s) => s.dataRegistrazione.slice(0, 16)))].sort().reverse();
  const activeVoci = voci.filter((v) => v.attiva);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  useEffect(() => { setPage(1); }, [buId, anno, mese, pageSize]);
  const totalPages = Math.max(1, Math.ceil(dates.length / pageSize));
  const pagedDates = dates.slice((page - 1) * pageSize, page * pageSize);

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
              {pagedDates.map((date) => {
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

      {dates.length > 0 && (
        <div className="flex items-center justify-between px-1 text-sm text-stone-500">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >‹</button>
            <span className="px-2">Pagina {page} di {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >›</button>
          </div>
          <div className="flex items-center gap-2">
            <span>Righe:</span>
            {[20, 50, 100].map((s) => (
              <button
                key={s}
                onClick={() => setPageSize(s)}
                className={`px-2 py-1 rounded border ${pageSize === s ? "bg-stone-800 text-white border-stone-800" : "border-stone-200 hover:bg-stone-100"}`}
              >{s}</button>
            ))}
          </div>
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
  const [impostazioniAperte, setImpostazioniAperte] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("forecast-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    try { localStorage.setItem("forecast-sidebar-collapsed", v ? "0" : "1"); } catch {}
    return !v;
  });

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



  if (!account || !UHAccounts.hasAccesso(account, APP_ID)) {
    return (
      <div className="min-h-screen w-full bg-[#F3F0E8] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#0F2A28] flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={26} className="text-white" />
          </div>
          <h1 className="font-fraunces text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {account
              ? "Il tuo account non ha accesso all'applicazione Revenue Forecast. Contatta un amministratore del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#0F2A28] hover:bg-[#0A1D1C] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
            <ArrowLeft size={15} /> Torna alla home
          </a>
        </div>
      </div>
    );
  }

  const nav: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Cruscotto", icon: LayoutDashboard },
    { id: "forecast", label: "Forecast", icon: TrendingUp },
    { id: "target", label: "Target", icon: Target },
    { id: "storico", label: "Storico", icon: History },
  ].filter((n) => canSeeSection(n.id));
  const puoConfigurare = canSeeSection("configurazione");
  const itemCls = (active: boolean, compact: boolean) =>
    `flex items-center gap-2.5 px-3 ${compact ? "py-2" : "py-2.5"} rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
      active ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
    }`;

  return (
    <div className="min-h-screen w-full bg-[#F3F0E8] text-stone-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      {offline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-rose-600 text-white text-xs font-semibold px-4 py-2 text-center">
          <AlertTriangle size={13} className="shrink-0" />
          Server non raggiungibile: le modifiche non vengono salvate. Verifica la connessione e ricarica la pagina.
        </div>
      )}

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* SIDEBAR */}
        <aside className={`${sidebarCollapsed ? "md:w-14" : "md:w-60"} shrink-0 bg-[#0F2A28] text-stone-200 flex md:flex-col md:sticky md:top-0 md:h-screen transition-all duration-200`}>
          <div className={`border-b border-white/10 hidden md:flex flex-col ${sidebarCollapsed ? "items-center px-0 py-4" : "px-5 py-5"}`}>
            {!sidebarCollapsed ? (
              <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
                <ArrowLeft size={12} /> Applicazioni Urban Homy
              </a>
            ) : (
              <a href="/" className="flex items-center justify-center p-1.5 mb-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/5 transition" title="Applicazioni Urban Homy">
                <ArrowLeft size={14} />
              </a>
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: ACCENT }}>
                <TrendingUp size={16} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="font-fraunces font-semibold text-white text-[15px] leading-none">Revenue Forecast</div>
                  <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · ricavi per BU</div>
                </div>
              )}
            </div>
          </div>

          <nav className="flex md:flex-col w-full px-2 py-3 gap-1 overflow-x-auto md:overflow-y-auto md:flex-1">
            <a
              href="/"
              className="md:hidden flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-white/5 transition"
              title="Applicazioni Urban Homy"
            >
              <ArrowLeft size={16} />
            </a>
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)} title={sidebarCollapsed ? label : undefined} className={itemCls(section === id, false)}>
                <Icon size={16} />
                {!sidebarCollapsed && label}
              </button>
            ))}

            {puoConfigurare && (
              <div className="md:mt-1">
                <button
                  onClick={() => setImpostazioniAperte((v) => !v)}
                  title={sidebarCollapsed ? "Impostazioni" : undefined}
                  className={`w-full ${itemCls(section === "configurazione", false)}`}
                >
                  <Settings size={16} />
                  {!sidebarCollapsed && <>Impostazioni<ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte || section === "configurazione" ? "rotate-180" : ""}`} /></>}
                </button>
                {(impostazioniAperte || section === "configurazione") && (
                  <div className={`flex md:flex-col gap-1 md:mt-1 ${sidebarCollapsed ? "" : "md:pl-4 md:border-l md:border-white/10 md:ml-4"}`}>
                    <button onClick={() => setSection("configurazione")} title={sidebarCollapsed ? "Business Unit e voci" : undefined} className={itemCls(section === "configurazione", true)}>
                      <Building2 size={15} />
                      {!sidebarCollapsed && "Business Unit e voci"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="hidden md:flex flex-col border-t border-white/10 mt-auto">
            {!sidebarCollapsed && (
              <div className="px-5 py-3 text-[11px] text-stone-500">
                {bus.filter((b) => b.attiva).length} BU attive · {voci.filter((v) => v.attiva).length} voci
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center py-2.5 text-stone-500 hover:text-stone-300 hover:bg-white/5 transition"
              title={sidebarCollapsed ? "Espandi menu" : "Comprimi menu"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
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
