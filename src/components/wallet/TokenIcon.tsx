import { tokenById, chainBadgeToken, type TokenId } from "@/lib/wallet-store";
import type { PriceMap } from "@/lib/prices";
import { cn } from "@/lib/utils";

export function TokenIcon({
  id,
  prices,
  size = 40,
  className,
  badge = true,
}: {
  id: TokenId;
  prices: PriceMap;
  size?: number;
  className?: string;
  badge?: boolean;
}) {
  const meta = tokenById(id);
  const img = prices[id]?.image;
  const badgeId = chainBadgeToken(meta.chain);
  const badgeImg = badge && badgeId && badgeId !== id ? prices[badgeId]?.image : undefined;
  const badgeSize = Math.max(14, Math.round(size * 0.42));

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div className="h-full w-full overflow-hidden rounded-full bg-surface-2">
        {img ? (
          <img src={img} alt={`${meta.symbol} logo`} width={size} height={size} loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {meta.symbol.slice(0, 3)}
          </span>
        )}
      </div>
      {badgeImg && (
        <img
          src={badgeImg}
          alt={`${meta.chain} network`}
          width={badgeSize}
          height={badgeSize}
          loading="lazy"
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background ring-2 ring-background"
          style={{ width: badgeSize, height: badgeSize }}
        />
      )}
    </div>
  );
}

export function Change({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={up ? "text-up" : "text-down"}>
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
