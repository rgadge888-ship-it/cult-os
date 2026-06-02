"use client";

import { useMemo, useState } from "react";
import { Panel, SectionHeader } from "@/components/ui/section";

type ImpressionsMode = "manual" | "cpm";

type Inputs = {
  // Top of funnel
  spend: number;
  // Two ways to express "how much volume": manual impressions count, or a
  // target CPM that derives impressions from spend.
  impressionsMode: ImpressionsMode;
  impressions: number;
  cpmTarget: number;
  ctr: number;
  loadingSpeed: number;
  convRatio: number;
  showUpRate: number;
  conversionRate: number; // Show Up → L1
  // Offer prices
  l0Price: number;
  l1Price: number;
  // L2 — monthly upsell of L1
  hasL2: boolean;
  l1ToL2Rate: number; // % of L1 buyers that take L2
  l2Price: number;
  // L3 — 6-month / annual upsell. Source depends on whether L2 exists.
  hasL3: boolean;
  l2ToL3Rate: number; // used when hasL2 === true
  l1ToL3Rate: number; // used when hasL2 === false
  l3Price: number;
};

const DEFAULTS: Inputs = {
  spend: 50000,
  impressionsMode: "manual",
  impressions: 80000,
  cpmTarget: 625,
  ctr: 1.5,
  loadingSpeed: 80,
  convRatio: 10,
  showUpRate: 30,
  conversionRate: 8,
  l0Price: 99,
  l1Price: 19999,
  hasL2: true,
  l1ToL2Rate: 30,
  l2Price: 49999,
  hasL3: true,
  l2ToL3Rate: 50,
  l1ToL3Rate: 10,
  l3Price: 299999,
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
  const set = <K extends keyof Inputs>(k: K) => (v: number | boolean | string) =>
    setI((s) => ({
      ...s,
      [k]:
        typeof v === "string" || typeof v === "boolean"
          ? v
          : Number.isFinite(v)
          ? v
          : 0,
    }));

  const c = useMemo(() => {
    // Resolve effective impressions + CPM based on mode.
    // - manual mode: impressions is the input → CPM = spend / impressions × 1000
    // - cpm mode: cpmTarget is the input → impressions = spend × 1000 / cpm
    const effectiveImpressions =
      i.impressionsMode === "cpm" && i.cpmTarget > 0
        ? (i.spend * 1000) / i.cpmTarget
        : i.impressions;
    const effectiveCpm =
      i.impressionsMode === "cpm"
        ? i.cpmTarget
        : effectiveImpressions > 0
        ? (i.spend / effectiveImpressions) * 1000
        : 0;
    const clicks = effectiveImpressions * (i.ctr / 100);
    const lpv = clicks * (i.loadingSpeed / 100);
    const purchases = lpv * (i.convRatio / 100); // L0
    const showUps = purchases * (i.showUpRate / 100);
    const l1Conversions = showUps * (i.conversionRate / 100);

    // L2: only if hasL2
    const l2Conversions = i.hasL2 ? l1Conversions * (i.l1ToL2Rate / 100) : 0;

    // L3: from L2 if it exists, else direct from L1
    const l3Conversions = i.hasL3
      ? i.hasL2
        ? l2Conversions * (i.l2ToL3Rate / 100)
        : l1Conversions * (i.l1ToL3Rate / 100)
      : 0;

    const l0Revenue = purchases * i.l0Price;
    const l1Revenue = l1Conversions * i.l1Price;
    const l2Revenue = i.hasL2 ? l2Conversions * i.l2Price : 0;
    const l3Revenue = i.hasL3 ? l3Conversions * i.l3Price : 0;
    const revenue = l0Revenue + l1Revenue + l2Revenue + l3Revenue;

    const netPL = revenue - i.spend;
    const roas = i.spend > 0 ? revenue / i.spend : 0;
    const cpr = purchases > 0 ? i.spend / purchases : 0;
    const cpc = clicks > 0 ? i.spend / clicks : 0;

    return {
      impressions: effectiveImpressions,
      cpm: effectiveCpm,
      clicks, lpv, purchases, showUps,
      l1Conversions, l2Conversions, l3Conversions,
      l0Revenue, l1Revenue, l2Revenue, l3Revenue,
      revenue, netPL, roas, cpr, cpc,
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
          {/* Impressions mode toggle */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label className="text-sm text-zinc-300">Volume input</label>
              <div className="inline-flex overflow-hidden rounded-md border border-zinc-800">
                <button
                  type="button"
                  onClick={() => set("impressionsMode")("manual")}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest ${
                    i.impressionsMode === "manual"
                      ? "bg-orange-500 text-zinc-950"
                      : "bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Impressions
                </button>
                <button
                  type="button"
                  onClick={() => set("impressionsMode")("cpm")}
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest ${
                    i.impressionsMode === "cpm"
                      ? "bg-orange-500 text-zinc-950"
                      : "bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  CPM target
                </button>
              </div>
            </div>
            {i.impressionsMode === "manual" ? (
              <NumberRow
                label="Impressions"
                value={i.impressions}
                step={1000}
                onChange={set("impressions")}
              />
            ) : (
              <NumberRow
                label="CPM target"
                prefix="₹"
                help={`implies ${Math.round(c.impressions).toLocaleString("en-IN")} impressions`}
                value={i.cpmTarget}
                step={10}
                onChange={set("cpmTarget")}
              />
            )}
          </div>
          <PercentRow label="CTR" value={i.ctr} step={0.1} max={20} onChange={set("ctr")} />
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

          {/* L0 + L1 prices */}
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

          {/* L2 — monthly upsell */}
          <div className="border-t border-zinc-900 pt-5">
            <ToggleRow
              label="L2 upsell"
              help="monthly cadence · boot camp / challenge"
              value={i.hasL2}
              onChange={set("hasL2")}
            />
            {i.hasL2 ? (
              <div className="mt-4 space-y-4">
                <PercentRow
                  label="L1 → L2 conversion"
                  value={i.l1ToL2Rate}
                  step={1}
                  max={100}
                  onChange={set("l1ToL2Rate")}
                />
                <NumberRow
                  label="L2 offer price"
                  prefix="₹"
                  value={i.l2Price}
                  step={1000}
                  onChange={set("l2Price")}
                />
              </div>
            ) : null}
          </div>

          {/* L3 — long cadence upsell */}
          <div className="border-t border-zinc-900 pt-5">
            <ToggleRow
              label="L3 upsell"
              help={i.hasL2 ? "6-month / annual · upsell of L2" : "direct from L1"}
              value={i.hasL3}
              onChange={set("hasL3")}
            />
            {i.hasL3 ? (
              <div className="mt-4 space-y-4">
                {i.hasL2 ? (
                  <PercentRow
                    label="L2 → L3 conversion"
                    value={i.l2ToL3Rate}
                    step={1}
                    max={100}
                    onChange={set("l2ToL3Rate")}
                  />
                ) : (
                  <PercentRow
                    label="L1 → L3 conversion"
                    help="L2 disabled · jumps from L1 to L3 directly"
                    value={i.l1ToL3Rate}
                    step={0.5}
                    max={50}
                    onChange={set("l1ToL3Rate")}
                  />
                )}
                <NumberRow
                  label="L3 offer price"
                  prefix="₹"
                  value={i.l3Price}
                  step={5000}
                  onChange={set("l3Price")}
                />
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* ─── OUTPUTS ──────────────────────────────────────── */}
      <div className="space-y-6">
        <SectionHeader label="the funnel" className="mb-3" />
        <Panel className="p-5">
          <ol className="space-y-1">
            <FunnelStep label="Impressions" value={c.impressions} first />
            <FunnelDrop pct={i.ctr} note="CTR" />
            <FunnelStep label="Clicks" value={c.clicks} />
            <FunnelDrop pct={i.loadingSpeed} note="loading" />
            <FunnelStep label="Landing Page Views" value={c.lpv} />
            <FunnelDrop pct={i.convRatio} note="register" />
            <FunnelStep label="Purchases (L0)" value={c.purchases} accent />
            <FunnelDrop pct={i.showUpRate} note="show up" />
            <FunnelStep label="Show Ups" value={c.showUps} />
            <FunnelDrop pct={i.conversionRate} note="convert" />
            <FunnelStep label="L1 Conversions" value={c.l1Conversions} accent />
            {i.hasL2 ? (
              <>
                <FunnelDrop pct={i.l1ToL2Rate} note="L1 → L2" />
                <FunnelStep label="L2 Conversions" value={c.l2Conversions} accent />
              </>
            ) : null}
            {i.hasL3 ? (
              <>
                <FunnelDrop
                  pct={i.hasL2 ? i.l2ToL3Rate : i.l1ToL3Rate}
                  note={i.hasL2 ? "L2 → L3" : "L1 → L3"}
                />
                <FunnelStep label="L3 Conversions" value={c.l3Conversions} accent />
              </>
            ) : null}
          </ol>
        </Panel>

        <SectionHeader label="bottom line" className="mb-3" />
        <Panel className="p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <BigOutcome
              label="Total Revenue"
              value={inr(c.revenue)}
              sub={[
                `L0 ${inr(c.l0Revenue)}`,
                `L1 ${inr(c.l1Revenue)}`,
                i.hasL2 ? `L2 ${inr(c.l2Revenue)}` : null,
                i.hasL3 ? `L3 ${inr(c.l3Revenue)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
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

        {/* Per-tier revenue + counts breakdown */}
        <SectionHeader label="per-tier breakdown" className="mb-3" />
        <Panel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-2 text-left font-normal">Tier</th>
                <th className="px-4 py-2 text-right font-normal">Conversions</th>
                <th className="px-4 py-2 text-right font-normal">Unit price</th>
                <th className="px-4 py-2 text-right font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody>
              <TierRow label="L0 ticket" count={c.purchases} price={i.l0Price} rev={c.l0Revenue} />
              <TierRow label="L1 offer" count={c.l1Conversions} price={i.l1Price} rev={c.l1Revenue} />
              {i.hasL2 ? (
                <TierRow label="L2 offer" count={c.l2Conversions} price={i.l2Price} rev={c.l2Revenue} />
              ) : null}
              {i.hasL3 ? (
                <TierRow label="L3 offer" count={c.l3Conversions} price={i.l3Price} rev={c.l3Revenue} />
              ) : null}
            </tbody>
          </table>
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

function ToggleRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3"
    >
      <div className="text-left">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        {help ? <p className="mt-0.5 text-[11px] text-zinc-600">{help}</p> : null}
      </div>
      <span
        className={`inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
          value ? "border-orange-500 bg-orange-950/50" : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <span
          className={`mx-0.5 h-5 w-5 rounded-full transition-transform ${
            value ? "translate-x-5 bg-orange-400" : "translate-x-0 bg-zinc-600"
          }`}
        />
      </span>
    </button>
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
      <span className="text-xs uppercase tracking-widest text-zinc-500">{label}</span>
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

function TierRow({
  label,
  count,
  price,
  rev,
}: {
  label: string;
  count: number;
  price: number;
  rev: number;
}) {
  return (
    <tr className="border-b border-zinc-900/60 last:border-b-0">
      <td className="px-4 py-2 text-zinc-300">{label}</td>
      <td className="px-4 py-2 text-right font-mono text-zinc-200">{num(count)}</td>
      <td className="px-4 py-2 text-right font-mono text-zinc-400">{inr(price)}</td>
      <td className="px-4 py-2 text-right font-mono text-orange-300">{inr(rev)}</td>
    </tr>
  );
}
