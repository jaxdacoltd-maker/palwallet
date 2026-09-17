CREATE TABLE public.nft_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  seller_address text NOT NULL,
  mint text NOT NULL,
  chain text NOT NULL DEFAULT 'Solana',
  name text NOT NULL,
  image text,
  price_sol numeric NOT NULL CHECK (price_sol > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','sold','cancelled')),
  buyer_address text,
  buyer_id uuid,
  payment_signature text,
  transfer_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nft_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_listings TO authenticated;
GRANT ALL ON public.nft_listings TO service_role;

ALTER TABLE public.nft_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings are publicly readable"
  ON public.nft_listings FOR SELECT
  USING (true);

CREATE POLICY "Users create their own listings"
  ON public.nft_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sellers update their own listings"
  ON public.nft_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Buyers can claim an active listing"
  ON public.nft_listings FOR UPDATE
  TO authenticated
  USING (status = 'active' AND auth.uid() <> user_id)
  WITH CHECK (status = 'paid' AND buyer_id = auth.uid());

CREATE POLICY "Sellers delete their own listings"
  ON public.nft_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX nft_listings_status_idx ON public.nft_listings (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nft_listings_touch
  BEFORE UPDATE ON public.nft_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();