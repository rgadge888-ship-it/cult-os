"use client";

import { useMemo, useState } from "react";
import { Panel, SectionHeader } from "@/components/ui/section";

type Inputs = {
  spend: number;
  impressions: number;
  ctr: number; // percent
  loadingSpeed: number; // percent — Clicks → LPV
  convRatio: number; // percent — LPV → Purchase
  showUpRate: number; // percent — Purchase → Show Up
  conversionRate: number; // percent — Show Up → L1 sale
  l0Price: number; // ₹ (set to 0 for free funnel)
  l1Price: number; // ₹
};

const DEFAULTS: Inputs = {
  spend: 50000,
  impressions: 80000,
  ctr: 1.5,
  loadingSpeed: 80,
  convRatio: 10,
  showUpRate: 30,
  conversionRate: 8,
  l0Price: 99,
  l1Price: 19999,
};

const inr = (n: number) =>
  "₹" +
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Math.abs(n)),
  );
const num = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

export function FunnelCalculator() {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  const set = <K extends keyof Inputs>(k: K) => (v: number) =>
    setI((s) => ({ ...s, [k]: Number.isFinite(v) ? v : 0 }));

  const c = useMemo(() => {
    const clicks = i.impressions * (i.ctr / 100);
    const lpv = clicks * (i.loadingSpeed / 100);
    const purchases = lpv * (i.convRatio / 100);
    const showUps = purchases * (i.showUpRate / 100);
    const conversions = showUps * (i.conversionRate / 100);
    const l0Revenue = purchases * i.l0Price;
    const l1Revenue = conversions * i.l1Price;
    const revenue = l0Revenue + l1Revenue;
    const netPL = revenue - i.spend;
    const roas = i.spend > 0 ? revenue / i.spend : 0;
    const cpr = purchases > 0 ? i.spend / purchases : 0;
    const cpm = i.impressions > 0 ? (i.spend / i.impressions) * 1000 : 0;
    const cpc = clicks > 0 ? i.spend / clicks : 0;
    return {
      clicks, lpv, purchases, showUps, conversions,
      l0Revenue, l1Revenue, revenue, netPL, roas, cpr, cpm, cpc,
    };
  }, [i]);

  const profitable = c.netPL >= 0;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ─── INPUTS ───────────────────────────────────────── */}
      <div>
        <SectionHeader
          label="inputs"
          className="mb-3"
          action={
            <button
              type="button"
              onClick={() => setI(DEFAULTS)}
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              reset
            </button>
          }
        />
        <Panel className="space-y-5 p-5">
          <NumberRow
            label="Ad Spend"
            prefix="₹"
            value={i.spend}
            step={1000}
            onChange={set("spend")}
          />
          <NumberRow
            label="Impressions"
            value={i.impressions}
            step={1000}
            onChange={set("impressions")}
          />
          <PercentRow
            label="CTR"
            value={i.ctr}
            step={0.1}
            max={20}
            onChange={set("ctr")}
          />
          <PercentRow
            label="Loading Speed"
            help="Clicks that actually load the LP"
            value={i.loadingSpeed}
            onChange={set("loadingSpeed")}
          />
          <PercentRow
            label="Conv Ratio (LPV → Purchase)"
            value={i.convRatio}
            step={0.5}
            max={30}
            onChange={set("convRatio")}
          />
          <PercentRow
            label="Show Up Rate"
            help="Of purchases who attend the webinar"
            value={i.showUpRate}
            onChange={set("showUpRate")}
          />
          <PercentRow
            label="Conversion Rate (Show Up → L1)"
            value={i.conversionRate}
            step={0.5}
            max={50}
            onChange={set("conversionRate")}
          />
          <div className="border-t border-zinc-900 pt-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Offer prices
            </p>
            <NumberRow
              label="L0 ticket price"
              help="0 = free funnel"
              prefix="₹"
              value={i.l0Price}
              step={50}
              onChange={set("l0Price")}
            />
            <div className="h-3" />
            <NumberRow
              label="L1 offer price"
              prefix="₹"
              value={i.l1Price}
              step={500}
              onChange={set("l1Price")}
            />
          </div>
        </Panel>
      </div>

      {/* ─── OUTPUTS ──────────────────────────────────────── */}
      <div className="space-y-6">
        <SectionHeader label="the funnel" className="mb-3" />
        <Panel className="p-5">
          <ol className="space-y-1">
            <FunnelStep label="Impressions" value={i.impressions} first />
            <FunnelDrop pct={i.ctr} note="CTR" />
            <FunnelStep label="Clicks" value={c.clicks} />
            <FunnelDrop pct={i.loadingSpeed} note="loading" />
            <FunnelStep label="Landing Page Views" value={c.lpv} />
            <FunnelDrop pct={i.convRatio} note="register" />
            <FunnelStep label="Purchases (L0)" value={c.purchases} accent />
            <FunnelDrop pct={i.showUpRate} note="show up" />
            <FunnelStep label="Show Ups" value={c.showUps} />
            <FunnelDrop pct={i.conversionRate} note="convert" />
            <FunnelStep label="L1 Conversions" value={c.conversions} accent />
          </ol>
        </Panel>

        <SectionHeader label="bottom line" className="mb-3" />
        <Panel className="p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <BigOutcome
              label="Total Revenue"
              value={inr(c.revenue)}
              sub={`L0 ${inr(c.l0Revenue)} · L1 ${inr(c.l1Revenue)}`}
              accent
            />
            <BigOutcome
              label="Net P/L"
              value={(profitable ? "+" : "−") + inr(c.netPL)}
              sub={`vs spend ${inr(i.spend)}`}
              tone={profitable ? "good" : "bad"}
            />
            <Outcome label="ROAS" value={`${c.roas.toFixed(2)}x`} />
            <Outcome label="CPR (cost per purchase)" value={inr(c.cpr)} />
            <Outcome label="CPM" value={inr(c.cpm)} />
            <Outcome label="CPC" value={inr(c.cpc)} />
          </div>
        </Panel>

        <p className="text-xs text-zinc-600">
          Standalone simulator. Numbers are what-if projections — change any input,
          everything to the right recomputes live.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────── input rows ───────────────────────────── */

function NumberRow({
  label,
  prefix,
  value,
  step = 1,
  help,
  onChange,
}: {
  label: string;
  prefix?: string;
  value: number;
  step?: number;
  help?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm text-zinc-300">{label}</label>
        {help ? <span className="text-[10px] text-zinc-600">{help}</span> : null}
      </div>
      <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
        {prefix ? (
          <span className="pl-3 font-mono text-sm text-zinc-500">{prefix}</span>
        ) : null}
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={0}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none"
        />
      </div>
    </div>
  );
}

function PercentRow({
  label,
  value,
  step = 1,
  max = 100,
  help,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  max?: number;
  help?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm text-zinc-300">{label}</label>
        {help ? <span className="text-[10px] text-zinc-600">{help}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-orange-500"
        />
        <div className="flex w-24 items-center rounded-md border border-zinc-800 bg-zinc-950 focus-within:border-orange-500">
          <input
            type="number"
            value={Number.isFinite(value) ? value : ""}
            step={step}
            min={0}
            max={max}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full bg-transparent px-2 py-1 text-right font-mono text-sm text-zinc-100 focus:outline-none"
          />
          <span className="pr-2 font-mono text-xs text-zinc-500">%</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── output blocks ──────────────────────────── */

function FunnelStep({
  label,
  value,
  accent,
  first,
}: {
  label: string;
  value: number;
  accent?: boolean;
  first?: boolean;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-3 rounded-md border px-3 py-2 ${
        accent
          ? "border-orange-500/40 bg-orange-950/20"
          : first
          ? "border-zinc-700 bg-zinc-900/60"
          : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <span className="text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span
        className={`font-mono text-lg ${accent ? "text-orange-300" : "text-zinc-100"}`}
      >
        {num(value)}
      </span>
    </li>
  );
}

function FunnelDrop({ pct, note }: { pct: number; note: string }) {
  return (
    <li className="flex items-center gap-2 pl-3 text-zinc-700">
      <span>↓</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        {pct.toFixed(pct < 10 ? 1 : 0)}% · {note}
      </span>
    </li>
  );
}

function BigOutcome({
  label,
  value,
  sub,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: "good" | "bad";
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
      ? "text-red-400"
      : accent
      ? "text-orange-300"
      : "text-zinc-100";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-1 font-mono text-[10px] text-zinc-600">{sub}</p> : null}
    </div>
  );
}

function Outcome({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-base text-zinc-200">{value}</p>
    </div>
  );
}
