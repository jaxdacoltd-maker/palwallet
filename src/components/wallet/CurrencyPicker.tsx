import { useState } from "react";
import { Check, Search } from "lucide-react";
import { CURRENCIES, setCurrency, useCurrencyCode, useFxRates } from "@/lib/currency";
import { Sheet } from "./Sheet";

export function CurrencyPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const code = useCurrencyCode();
  const { data: rates } = useFxRates();
  const [q, setQ] = useState("");

  const list = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Sheet open={open} onClose={onClose} title="Display Currency" full>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search currency"
          className="w-full text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        {list.map((c) => (
          <button
            key={c.code}
            onClick={() => {
              setCurrency(c.code);
              onClose();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
              c.code === code ? "bg-brand/20 ring-1 ring-brand" : "bg-surface-2"
            }`}
          >
            <span className="text-xl">{c.flag}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">
                {c.code} <span className="text-muted-foreground">{c.symbol}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{c.name}</div>
            </div>
            {rates?.[c.code] ? (
              <span className="text-xs text-muted-foreground">
                1 USD = {rates[c.code]!.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
            ) : null}
            {c.code === code ? <Check size={18} className="text-brand" /> : null}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
