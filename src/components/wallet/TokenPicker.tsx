import { useState } from "react";
import { Search } from "lucide-react";
import { TOKENS, type TokenId } from "@/lib/wallet-store";
import type { PriceMap } from "@/lib/prices";
import { useFiat } from "@/lib/currency";
import { TokenIcon, Change } from "./TokenIcon";
import { Sheet } from "./Sheet";


export function TokenPicker({
  open,
  onClose,
  onSelect,
  prices,
  title = "Select Token",
  balances,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: TokenId) => void;
  prices: PriceMap;
  title?: string;
  balances?: Partial<Record<TokenId, number>>;
}) {
  const [q, setQ] = useState("");
  const { fmt } = useFiat();
  const list = TOKENS.filter(

    (t) =>
      t.symbol.toLowerCase().includes(q.toLowerCase()) ||
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      t.chain.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} full>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="w-full text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3 py-3 text-left"
          >
            <TokenIcon id={t.id} prices={prices} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">
                {t.symbol} <span className="text-muted-foreground">({t.chain})</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {fmt(prices[t.id]?.price ?? 0, 6)}{" "}
                <Change value={prices[t.id]?.change ?? 0} />
              </div>
            </div>
            <div className="text-right text-sm">
              <div>{(balances?.[t.id] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 6 })}</div>
              <div className="text-xs text-muted-foreground">
                {fmt((balances?.[t.id] ?? 0) * (prices[t.id]?.price ?? 0))}
              </div>
            </div>

          </button>
        ))}
      </div>
    </Sheet>
  );
}
