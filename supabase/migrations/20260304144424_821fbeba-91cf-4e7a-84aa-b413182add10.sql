
-- Players table
CREATE TABLE public.players (
  id integer PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  join_date date NOT NULL
);

-- Venues table
CREATE TABLE public.venues (
  id integer PRIMARY KEY,
  name text NOT NULL
);

-- Matches table
CREATE TABLE public.matches (
  id integer PRIMARY KEY,
  date date NOT NULL,
  venue_id integer REFERENCES public.venues(id),
  match_type text NOT NULL DEFAULT '6:6 풋살',
  is_custom boolean NOT NULL DEFAULT false,
  has_detail_log boolean NOT NULL DEFAULT false
);

-- Teams table
CREATE TABLE public.teams (
  id integer PRIMARY KEY,
  match_id integer REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_ours boolean NOT NULL DEFAULT true
);

-- Results table
CREATE TABLE public.results (
  id integer PRIMARY KEY,
  team_id integer REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  match_id integer REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  result text NOT NULL CHECK (result IN ('승', '패', '무')),
  score_for integer,
  score_against integer
);

-- Rosters table
CREATE TABLE public.rosters (
  id integer PRIMARY KEY,
  match_id integer REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  team_id integer REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  player_id integer REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0
);

-- Goal Events table
CREATE TABLE public.goal_events (
  id integer PRIMARY KEY,
  match_id integer REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  team_id integer REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  quarter integer NOT NULL,
  goal_player_id integer REFERENCES public.players(id),
  assist_player_id integer REFERENCES public.players(id),
  is_own_goal boolean NOT NULL DEFAULT false
);

-- Profiles table (links auth users to players)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id integer REFERENCES public.players(id),
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read policies (all data is publicly readable)
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can read venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Anyone can read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Anyone can read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can read results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Anyone can read rosters" ON public.rosters FOR SELECT USING (true);
CREATE POLICY "Anyone can read goal_events" ON public.goal_events FOR SELECT USING (true);
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);

-- Profile policies
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin role setup
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin write policies for data tables
CREATE POLICY "Admins can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update players" ON public.players FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert venues" ON public.venues FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update venues" ON public.venues FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update matches" ON public.matches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete matches" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert results" ON public.results FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update results" ON public.results FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert rosters" ON public.rosters FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update rosters" ON public.rosters FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert goal_events" ON public.goal_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update goal_events" ON public.goal_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete goal_events" ON public.goal_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles read policy
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
