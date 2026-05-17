
CREATE TABLE IF NOT EXISTS public.topup_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_kes NUMERIC NOT NULL CHECK (amount_kes > 0),
  phone TEXT NOT NULL,
  invoice_id TEXT UNIQUE,
  api_ref TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'intasend',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.topup_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY topup_select ON public.topup_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by UUID NOT NULL,
  target_user_id UUID,
  phone TEXT NOT NULL,
  amount_kes NUMERIC NOT NULL CHECK (amount_kes > 0),
  conversation_id TEXT,
  originator_conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY withdrawals_admin_select ON public.withdrawals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR initiated_by = auth.uid());

-- Atomic wallet credit (used by webhook + admin)
CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id UUID, _amount NUMERIC, _kind TEXT, _ref TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_bal NUMERIC;
BEGIN
  INSERT INTO public.wallets(user_id, balance_kes) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance_kes = balance_kes + _amount, updated_at = now()
    WHERE user_id = _user_id RETURNING balance_kes INTO new_bal;
  INSERT INTO public.wallet_transactions(user_id, amount_kes, kind, ref)
    VALUES (_user_id, _amount, _kind, _ref);
  RETURN new_bal;
END $$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID,NUMERIC,TEXT,TEXT) TO authenticated;
