
-- Family groups table
CREATE TABLE public.family_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Family members table
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Family invitations table
CREATE TABLE public.family_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, invited_email)
);

-- Shared budgets table (link budgets to family groups)
CREATE TABLE public.shared_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_id, group_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_budgets ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is member of a family group
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- Helper function: check if user is owner of a family group
CREATE OR REPLACE FUNCTION public.is_family_owner(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_groups
    WHERE id = _group_id AND owner_id = _user_id
  )
$$;

-- RLS Policies for family_groups
CREATE POLICY "Members can view their groups" ON public.family_groups
FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), id));

CREATE POLICY "Users can create groups" ON public.family_groups
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update groups" ON public.family_groups
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete groups" ON public.family_groups
FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- RLS Policies for family_members
CREATE POLICY "Members can view group members" ON public.family_members
FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), group_id));

CREATE POLICY "Owners can add members" ON public.family_members
FOR INSERT TO authenticated
WITH CHECK (public.is_family_owner(auth.uid(), group_id));

CREATE POLICY "Owners can remove members" ON public.family_members
FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), group_id));

-- RLS Policies for family_invitations
CREATE POLICY "Members can view invitations" ON public.family_invitations
FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), group_id) OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Owners can create invitations" ON public.family_invitations
FOR INSERT TO authenticated
WITH CHECK (public.is_family_owner(auth.uid(), group_id));

CREATE POLICY "Owners can delete invitations" ON public.family_invitations
FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), group_id));

CREATE POLICY "Invitees can update invitation status" ON public.family_invitations
FOR UPDATE TO authenticated
USING (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for shared_budgets
CREATE POLICY "Members can view shared budgets" ON public.shared_budgets
FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), group_id));

CREATE POLICY "Owners can share budgets" ON public.shared_budgets
FOR INSERT TO authenticated
WITH CHECK (public.is_family_owner(auth.uid(), group_id));

CREATE POLICY "Owners can unshare budgets" ON public.shared_budgets
FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), group_id));

-- Auto-add owner as member when group is created
CREATE OR REPLACE FUNCTION public.auto_add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.family_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_family_group_created
AFTER INSERT ON public.family_groups
FOR EACH ROW EXECUTE FUNCTION public.auto_add_owner_as_member();

-- Enable realtime for family features
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_invitations;
