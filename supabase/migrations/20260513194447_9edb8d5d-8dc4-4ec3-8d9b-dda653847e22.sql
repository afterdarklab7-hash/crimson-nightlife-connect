-- Add free message quota column to chat_settings
ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS free_message_quota integer NOT NULL DEFAULT 20;

-- Update debit trigger: bypass charge while sender has fewer sent messages than quota
CREATE OR REPLACE FUNCTION public.debit_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD; bal NUMERIC; is_admin_user BOOLEAN; sent_count INTEGER;
BEGIN
  SELECT * INTO cfg FROM public.chat_settings WHERE id = 1;
  SELECT public.has_role(NEW.sender_id, 'admin') INTO is_admin_user;
  IF cfg.free_chat_enabled OR is_admin_user THEN
    RETURN NEW;
  END IF;

  -- Count messages already sent by this user (excluding the row being inserted)
  SELECT COUNT(*) INTO sent_count FROM public.messages WHERE sender_id = NEW.sender_id;
  IF sent_count < COALESCE(cfg.free_message_quota, 20) THEN
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
END $function$;
