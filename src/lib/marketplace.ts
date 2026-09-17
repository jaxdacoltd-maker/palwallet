// NFT marketplace: listings live in Lovable Cloud, money and collectibles move on-chain.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Listing {
  id: string;
  user_id: string;
  seller_address: string;
  mint: string;
  chain: string;
  name: string;
  image: string | null;
  price_sol: number;
  status: "active" | "paid" | "sold" | "cancelled";
  buyer_address: string | null;
  buyer_id: string | null;
  payment_signature: string | null;
  transfer_signature: string | null;
  created_at: string;
}

const TABLE = "nft_listings";

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from(TABLE)
      .select("*")
      .in("status", ["active", "paid", "sold"])
      .order("created_at", { ascending: false })
      .limit(100);
    setListings((data ?? []) as unknown as Listing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel("nft_listings_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { listings, loading, refresh };
}

export async function createListing(input: {
  sellerAddress: string;
  mint: string;
  chain: string;
  name: string;
  image?: string | undefined;
  priceSol: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to list a collectible.");
  const { error } = await supabase.from(TABLE).insert({
    user_id: auth.user.id,
    seller_address: input.sellerAddress,
    mint: input.mint,
    chain: input.chain,
    name: input.name,
    image: input.image ?? null,
    price_sol: input.priceSol,
  });
  if (error) throw new Error(error.message);
}

/** Mark a listing as paid after the buyer's SOL payment is confirmed on-chain. */
export async function markPaid(id: string, buyerAddress: string, paymentSignature: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to buy a collectible.");
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: "paid",
      buyer_id: auth.user.id,
      buyer_address: buyerAddress,
      payment_signature: paymentSignature,
    })
    .eq("id", id)
    .eq("status", "active");
  if (error) throw new Error(error.message);
}

/** Mark a listing as delivered after the seller's NFT transfer is confirmed. */
export async function markDelivered(id: string, transferSignature: string) {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: "sold", transfer_signature: transferSignature })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cancelListing(id: string) {
  const { error } = await supabase.from(TABLE).update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
}
