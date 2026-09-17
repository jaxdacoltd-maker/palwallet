import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { Toaster, toast } from "sonner";

export const Route = createFileRoute("/escrow")({
  head: () => ({
    meta: [
      { title: "Escrow Trade — Protected P2P Order" },
      {
        name: "description",
        content:
          "Escrow trade view showing buyer and seller, order amount, payment window countdown and release or dispute controls.",
      },
      { property: "og:title", content: "Escrow Trade — Protected P2P Order" },
      {
        property: "og:description",
        content: "Track a protected peer-to-peer order with payment timer, release and dispute controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Escrow,
});

type Step = "locked" | "paid" | "released" | "disputed";

const STEPS: { key: Step; label: string }[] = [
  { key: "locked", label: "Funds locked in escrow" },
  { key: "paid", label: "Buyer marked as paid" },
  { key: "released", label: "Seller released funds" },
];

function Escrow() {
  const [step, setStep] = useState<Step>("locked");
  const [left, setLeft] = useState(14 * 60 + 52);

  useEffect(() => {
    if (step === "released" || step === "disputed") return;
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const reached = (k: Step) =>
    step === "released" ? true : k === "locked" ? true : k === "paid" ? step === "paid" : false;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <Toaster theme="dark" position="top-center" />
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background px-4 pb-2 pt-3">
        <Link to="/" aria-label="Back">
          <ArrowLeft size={22} className="text-muted-foreground" />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">Escrow trade</h1>
        <span className="flex items-center gap-1 rounded-full bg-brand/20 px-2 py-1 text-xs text-brand">
          <ShieldCheck size={14} /> Protected
        </span>
      </header>

      <main className="flex-1 space-y-3 px-4 pb-10">
        <section className="rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Order amount</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock size={14} /> {step === "released" || step === "disputed" ? "--:--" : `${mm}:${ss}`}
            </span>
          </div>
          <div className="mt-1 text-3xl font-semibold">1,500.00 USDT</div>
          <div className="text-sm text-muted-foreground">≈ 2,325,000.00 NGN · 1,550.00 NGN / USDT</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Party role="Buyer" name="Ada_Trades" orders="248 orders · 99.2%" />
            <Party role="Seller" name="BlueRock" orders="1,032 orders · 99.8%" />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Progress</h2>
          <ol className="space-y-3">
            {STEPS.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    reached(s.key) ? "bg-brand text-background" : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Check size={14} />
                </span>
                <span className={reached(s.key) ? "" : "text-muted-foreground"}>{s.label}</span>
              </li>
            ))}
          </ol>
          {step === "disputed" && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-down/15 px-3 py-2 text-sm text-down">
              <TriangleAlert size={16} /> Dispute opened — support is reviewing this order.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Payment details</h2>
          <Row label="Method" value="Bank transfer" />
          <Row label="Account name" value="Blue Rock Ventures" />
          <Row label="Account number" value="0123456789" />
          <Row label="Bank" value="Access Bank" />
          <Row label="Reference" value="ESC-8F42QK" />
        </section>

        <div className="space-y-2 pt-1">
          {step === "locked" && (
            <button
              onClick={() => {
                setStep("paid");
                toast.success("Marked as paid");
              }}
              className="w-full rounded-xl bg-brand py-3 font-medium"
            >
              I have paid
            </button>
          )}
          {step === "paid" && (
            <button
              onClick={() => {
                setStep("released");
                toast.success("Funds released");
              }}
              className="w-full rounded-xl bg-brand py-3 font-medium"
            >
              Release funds
            </button>
          )}
          {step === "released" && (
            <div className="rounded-xl bg-up/15 py-3 text-center font-medium text-up">Order completed</div>
          )}
          {step !== "released" && step !== "disputed" && (
            <button
              onClick={() => {
                setStep("disputed");
                toast("Dispute opened");
              }}
              className="w-full rounded-xl bg-surface-2 py-3 font-medium text-muted-foreground"
            >
              Open dispute
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function Party({ role, name, orders }: { role: string; name: string; orders: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-xs text-muted-foreground">{role}</div>
      <div className="mt-1 flex items-center gap-2 font-medium">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/25">
          <User size={13} />
        </span>
        {name}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{orders}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
