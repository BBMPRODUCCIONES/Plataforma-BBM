-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('administrador', 'operativo', 'visual');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (roles stored separately for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'operativo',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operativo',
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at TIMESTAMPTZ,
  created_by_admin_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- RLS Policies for invitations
CREATE POLICY "Admins can view all invitations"
ON public.invitations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can create invitations"
ON public.invitations FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Anyone can view invitation by token"
ON public.invitations FOR SELECT
TO anon
USING (true);

CREATE POLICY "Service role can update invitations"
ON public.invitations FOR UPDATE
TO service_role
USING (true);