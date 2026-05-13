
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE public.gender_t AS ENUM ('male', 'female', 'non_binary', 'other');
CREATE TYPE public.hosting_pref AS ENUM ('hosting', 'to_be_hosted', 'lets_get_a_room');
CREATE TYPE public.swipe_action AS ENUM ('like', 'super_like', 'pass');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  bio TEXT,
  dob DATE,
  gender public.gender_t,
  interested_in public.gender_t[],
  hosting public.hosting_pref,
  city TEXT,
  county TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Age-gate trigger: refuse DOB making user under 18
CREATE OR REPLACE FUNCTION public.enforce_age_gate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dob IS NOT NULL AND NEW.dob > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'You must be 18 or older to use After Dark';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profiles_age BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_age_gate();

-- Auto-create profile row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NULL))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ PHOTOS ============
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_photos_user ON public.photos(user_id);

-- ============ SWIPES ============
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action public.swipe_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, target_id)
);
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_swipes_target ON public.swipes(target_id);

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Match-creation trigger when mutual like
CREATE OR REPLACE FUNCTION public.create_match_if_mutual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _a UUID; _b UUID;
BEGIN
  IF NEW.action IN ('like','super_like') THEN
    IF EXISTS (SELECT 1 FROM public.swipes
               WHERE swiper_id = NEW.target_id AND target_id = NEW.swiper_id
                 AND action IN ('like','super_like')) THEN
      _a := LEAST(NEW.swiper_id, NEW.target_id);
      _b := GREATEST(NEW.swiper_id, NEW.target_id);
      INSERT INTO public.matches (user_a, user_b) VALUES (_a, _b)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_match_on_swipe AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.create_match_if_mutual();

-- ============ LOCATION LOGS (admin trace) ============
CREATE TABLE public.location_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- profiles: anyone authenticated can read non-hidden non-banned profiles; users edit only their own
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT
  TO authenticated USING (NOT is_banned AND (NOT is_hidden OR id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: users see own; only admins write
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- photos: anyone authenticated can read; users manage own
CREATE POLICY "photos_select_all" ON public.photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "photos_insert_own" ON public.photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "photos_update_own" ON public.photos FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "photos_delete_own" ON public.photos FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- swipes: users see/insert own
CREATE POLICY "swipes_select_own" ON public.swipes FOR SELECT TO authenticated USING (swiper_id = auth.uid());
CREATE POLICY "swipes_insert_own" ON public.swipes FOR INSERT TO authenticated WITH CHECK (swiper_id = auth.uid());

-- matches: users see matches they're part of
CREATE POLICY "matches_select_own" ON public.matches FOR SELECT
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- location_logs: own + admin
CREATE POLICY "location_logs_select" ON public.location_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "location_logs_insert_own" ON public.location_logs FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- reports: reporter inserts; admins read all; reporters read own
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_select" ON public.reports FOR SELECT
  TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE BUCKET FOR PHOTOS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "profile_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');
CREATE POLICY "profile_photos_user_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "profile_photos_user_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "profile_photos_user_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============ DISTANCE HELPER (haversine in km) ============
CREATE OR REPLACE FUNCTION public.distance_km(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;
