
-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY,
  balance_kes NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallets_select ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY wallets_admin_write ON public.wallets FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_kes NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wtx_select ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY wtx_admin_insert ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'));
CREATE INDEX idx_wtx_user ON public.wallet_transactions(user_id, created_at DESC);

-- ============ CHAT SETTINGS (singleton) ============
CREATE TABLE public.chat_settings (
  id INT PRIMARY KEY DEFAULT 1,
  free_chat_enabled BOOLEAN NOT NULL DEFAULT true,
  message_cost_kes NUMERIC(6,2) NOT NULL DEFAULT 0.25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_settings_singleton CHECK (id = 1)
);
INSERT INTO public.chat_settings(id) VALUES (1);
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_settings_read ON public.chat_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY chat_settings_admin ON public.chat_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX idx_messages_match ON public.messages(match_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.matches m
                WHERE m.id = match_id
                  AND ((m.user_a = auth.uid() AND m.user_b = recipient_id)
                    OR (m.user_b = auth.uid() AND m.user_a = recipient_id)))
  );
CREATE POLICY messages_update_read ON public.messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Billing trigger: skip when free chat is on OR sender is admin
CREATE OR REPLACE FUNCTION public.debit_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg RECORD; bal NUMERIC; is_admin_user BOOLEAN;
BEGIN
  SELECT * INTO cfg FROM public.chat_settings WHERE id = 1;
  SELECT public.has_role(NEW.sender_id, 'admin') INTO is_admin_user;
  IF cfg.free_chat_enabled OR is_admin_user THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.wallets(user_id) VALUES (NEW.sender_id) ON CONFLICT DO NOTHING;
  SELECT balance_kes INTO bal FROM public.wallets WHERE user_id = NEW.sender_id FOR UPDATE;
  IF bal < cfg.message_cost_kes THEN
    RAISE EXCEPTION 'Insufficient balance. Top up to keep chatting.';
  END IF;
  UPDATE public.wallets SET balance_kes = balance_kes - cfg.message_cost_kes, updated_at = now()
    WHERE user_id = NEW.sender_id;
  INSERT INTO public.wallet_transactions(user_id, amount_kes, kind, ref)
    VALUES (NEW.sender_id, -cfg.message_cost_kes, 'message_debit', NEW.id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_debit_message BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.debit_message();

-- ============ ADMIN AUTO VIP ============
CREATE OR REPLACE FUNCTION public.on_admin_role_grant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    UPDATE public.profiles SET is_vip = true, is_verified = true WHERE id = NEW.user_id;
    INSERT INTO public.wallets(user_id, balance_kes) VALUES (NEW.user_id, 10000)
      ON CONFLICT (user_id) DO UPDATE SET balance_kes = public.wallets.balance_kes + 10000;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_admin_role_grant AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.on_admin_role_grant();

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  city TEXT,
  address TEXT,
  price_kes NUMERIC(10,2) NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  cover_url TEXT,
  amenities TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select ON public.rooms FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY rooms_admin_write ON public.rooms FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  guests INT NOT NULL DEFAULT 2,
  total_kes NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmation_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_select ON public.room_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY bookings_insert ON public.room_bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY bookings_admin_update ON public.room_bookings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Confirmation code generator
CREATE OR REPLACE FUNCTION public.gen_booking_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.confirmation_code IS NULL THEN
    NEW.confirmation_code := 'AD-' || upper(substr(md5(random()::text || NEW.id::text), 1, 8));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_booking_code BEFORE INSERT ON public.room_bookings
  FOR EACH ROW EXECUTE FUNCTION public.gen_booking_code();

-- Seed a few rooms
INSERT INTO public.rooms (name, description, city, address, price_kes, capacity, cover_url, amenities) VALUES
('The Velvet Suite', 'Plush king suite with city skyline views, jacuzzi, and mood lighting.', 'Nairobi', 'Westlands', 4500, 2, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200', ARRAY['Jacuzzi','Skyline view','Mood lights','Wine bar']),
('Crimson Loft', 'Industrial loft with private rooftop and outdoor shower.', 'Nairobi', 'Kilimani', 3800, 2, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200', ARRAY['Rooftop','Outdoor shower','Speakers']),
('Onyx Penthouse', 'Floor-to-ceiling glass, private pool, premium concierge.', 'Mombasa', 'Nyali', 9800, 4, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200', ARRAY['Private pool','Concierge','Ocean view','Bar']),
('Midnight Cabin', 'Secluded cabin retreat with fireplace and king bed.', 'Naivasha', 'Lakeview', 5200, 2, 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200', ARRAY['Fireplace','Lake view','Hot tub']);
