import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Copy,
  History,
  Plus,
  ScanLine,
  Settings,
  UserRound,
} from "lucide-react";
import { useSession } from "@/lib/use-session";
import { Toaster, toast } from "sonner";
import {
  activeWallet,
  createWallet,
  setActive,
  setWalletUser,
  shortAddr,
  useWalletState,
} from "@/lib/wallet-store";
import { usePrices } from "@/lib/prices";
import { WalletScreen } from "@/components/wallet/WalletScreen";
import { SwapScreen } from "@/components/wallet/SwapScreen";
import {
  ExploreScreen,
  MarketScreen,
  TradeScreen,
} from "@/components/wallet/OtherScreens";
import { HistorySheet } from "@/components/wallet/HistorySheet";
import { Sheet } from "@/components/wallet/Sheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wallet — Crypto Wallet, Swap & Markets" },
      {
        name: "description",
        content:
          "Multi-chain crypto wallet with live market prices, instant token swaps, transaction history and multi-wallet transfers.",
      },
      {
        property: "og:title",
        content: "Wallet — Crypto Wallet, Swap & Markets",
      },
      {
        property: "og:description",
        content:
          "Track live prices, swap any token and manage multiple wallets from one secure app.",
      },
      { property: "og:type", content: "website" },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),
  component: App,
});

type Tab =
  | "wallet"
  | "market"
  | "explore"
  | "swap"
  | "trade";

function App() {
  const state = useWalletState();
  const { prices, rows } = usePrices();

  const [tab, setTab] = useState<Tab>("wallet");
  const [history, setHistory] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [phrase, setPhrase] = useState<{
    name: string;
    words: string;
  } | null>(null);

  const w = activeWallet(state);
  const navigate = useNavigate();
  const { user, loading } = useSession();

  useEffect(() => {
    if (user) {
      setWalletUser(user.id);
    }
  }, [user]);

  /*
   * If there is no logged-in user, redirect to login.
   */
  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  /*
   * While Supabase checks the existing session,
   * don't display the wallet.
   */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-brand" />
          <p className="text-sm text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  /*
   * No authenticated user.
   */
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-brand" />
      </div>
    );
  }

  /*
   * IMPORTANT:
   * After login, wallet-store can briefly have no active wallet
   * while the user's wallet is being loaded from localStorage.
   *
   * Do not render anything that accesses w.name or w.address
   * until the wallet exists.
   */
  if (!w) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-brand" />
          <p className="text-sm text-muted-foreground">
            Loading wallet...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <Toaster
        theme="dark"
        position="top-center"
      />

      <h1 className="sr-only">
        Multi-chain crypto wallet with live prices,
        swaps and transaction history
      </h1>

      <header className="sticky top-0 z-30 flex items-center gap-2 bg-background px-4 pb-2 pt-3">
        {tab === "wallet" ? (
          <>
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/auth",
                })
              }
              aria-label={
                user
                  ? "Your account"
                  : "Sign up or sign in"
              }
            >
              {user ? (
                <UserRound
                  size={22}
                  className="text-brand"
                />
              ) : (
                <Settings
                  size={22}
                  className="text-muted-foreground"
                />
              )}
            </button>

            <Bell
              size={22}
              className="text-muted-foreground"
            />
          </>
        ) : (
          <span className="w-2" />
        )}

        <button
          type="button"
          onClick={() => setSwitcher(true)}
          className="flex flex-1 items-center justify-center gap-1 text-lg font-semibold"
        >
          {w.name}

          <ChevronDown
            size={18}
            className="text-muted-foreground"
          />
        </button>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(
              w.address,
            );
            toast.success("Address copied");
          }}
          aria-label="Copy address"
        >
          <Copy
            size={18}
            className="text-muted-foreground"
          />
        </button>

        <button
          type="button"
          onClick={() => setHistory(true)}
          aria-label="Transaction history"
        >
          {tab === "wallet" ? (
            <ScanLine
              size={22}
              className="text-muted-foreground"
            />
          ) : (
            <History
              size={22}
              className="text-muted-foreground"
            />
          )}
        </button>
      </header>

      <main className="flex-1 pb-24">
        {tab === "wallet" && (
          <WalletScreen
            state={state}
            prices={prices}
            onOpenHistory={() =>
              setHistory(true)
            }
            onGoSwap={() => setTab("swap")}
          />
        )}

        {tab === "market" && (
          <MarketScreen
            prices={prices}
            rows={rows}
          />
        )}

        {tab === "explore" && (
          <ExploreScreen />
        )}

        {tab === "swap" && (
          <SwapScreen
            state={state}
            prices={prices}
            onDone={(sig) =>
              window.open(
                `https://solscan.io/tx/${sig}`,
                "_blank",
              )
            }
          />
        )}

        {tab === "trade" && (
          <TradeScreen prices={prices} />
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {(
            [
              ["wallet", "Wallet"],
              ["market", "Market"],
              ["explore", "Explore"],
              ["swap", "Swap"],
              ["trade", "Trade"],
            ] as const
          ).map(([k, label]) => (
            <button
              type="button"
              key={k}
              onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs ${
                tab === k
                  ? "text-up"
                  : "text-muted-foreground"
              }`}
            >
              <NavIcon
                name={k}
                active={tab === k}
              />

              {label}
            </button>
          ))}
        </div>
      </nav>

      <HistorySheet
        open={history}
        onClose={() => setHistory(false)}
        state={state}
        prices={prices}
      />

      <Sheet
        open={switcher}
        onClose={() => setSwitcher(false)}
        title="Wallets"
      >
        <div className="space-y-2">
          {state.wallets.map((x) => (
            <div
              key={x.id}
              className={`rounded-xl px-3 py-3 ${
                x.id === state.activeId
                  ? "bg-brand/20 ring-1 ring-brand"
                  : "bg-surface-2"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActive(x.id);
                  setSwitcher(false);
                }}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium">
                  {x.name}
                </span>

                <span className="font-mono text-xs text-muted-foreground">
                  {shortAddr(
                    x.address,
                    6,
                  )}
                </span>
              </button>

              {x.mnemonic && (
                <button
                  type="button"
                  onClick={() =>
                    setPhrase({
                      name: x.name,
                      words: x.mnemonic!,
                    })
                  }
                  className="mt-2 text-xs text-brand underline"
                >
                  Backup phrase
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              const n = createWallet(
                `Wallet${String(
                  state.wallets.length + 1,
                ).padStart(2, "0")}`,
              );

              toast.success(
                `${n.name} created`,
              );

              setSwitcher(false);

              if (n.mnemonic) {
                setPhrase({
                  name: n.name,
                  words: n.mnemonic,
                });
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-medium"
          >
            <Plus size={18} />
            Create new wallet
          </button>
        </div>
      </Sheet>

      <Sheet
        open={!!phrase}
        onClose={() => setPhrase(null)}
        title={`${phrase?.name ?? ""} backup phrase`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Write these 12 words down in order
            and keep them private. Anyone with
            this phrase can open this wallet.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {(phrase?.words ?? "")
              .split(" ")
              .map((word, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-surface-2 px-2 py-2 text-center text-sm"
                >
                  <span className="mr-1 text-xs text-muted-foreground">
                    {i + 1}
                  </span>

                  {word}
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                phrase?.words ?? "",
              );

              toast.success(
                "Backup phrase copied",
              );
            }}
            className="w-full rounded-xl bg-brand py-3 font-medium"
          >
            Copy phrase
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function NavIcon({
  name,
  active,
}: {
  name: Tab;
  active: boolean;
}) {
  const c = active
    ? "currentColor"
    : "currentColor";

  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: 1.7,
  } as const;

  if (name === "wallet") {
    return (
      <svg {...common}>
        <rect
          x="3"
          y="6"
          width="18"
          height="13"
          rx="3"
        />
        <circle
          cx="16.5"
          cy="12.5"
          r="1.4"
        />
      </svg>
    );
  }

  if (name === "market") {
    return (
      <svg {...common}>
        <path
          d="M4 20V10M9.5 20V4M15 20v-7M20.5 20v-4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "explore") {
    return (
      <svg {...common}>
        <rect
          x="3"
          y="13"
          width="7"
          height="7"
          rx="2"
        />
        <rect
          x="3"
          y="4"
          width="7"
          height="7"
          rx="2"
        />
        <rect
          x="14"
          y="13"
          width="7"
          height="7"
          rx="2"
        />
        <path d="M17.5 3.5l3.5 3.5-3.5 3.5L14 7z" />
      </svg>
    );
  }

  if (name === "swap") {
    return (
      <svg {...common}>
        <path
          d="M7 17L17 7M17 7h-6M17 7v6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path
        d="M8 10h8M8 14h8"
        strokeLinecap="round"
      />
    </svg>
  );
}