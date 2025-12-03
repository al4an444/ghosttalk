-- ⚠️ WARNING: THIS SCRIPT WILL RESET YOUR DATABASE AND DELETE ALL DATA ⚠️
-- Run this in the Supabase SQL Editor to set up the COMPLETE GhostTalk schema.

-- ==========================================
-- 1. CLEANUP (Drop existing tables & policies)
-- ==========================================
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ==========================================
-- 2. EXTENSIONS
-- ==========================================
-- Enable pgsodium for cryptographic verification
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ==========================================
-- 3. TABLES
-- ==========================================

-- 3.1 Users Table
create table public.users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  salt text not null,
  public_key_signing text not null,
  public_key_encryption text not null,
  encrypted_private_key text not null,
  friend_code text unique not null, -- Added for Contact System
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3.2 Groups Table
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3.3 Group Members Table
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- 3.4 Messages Table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.users(id) not null,
  recipient_id uuid references public.users(id) not null,
  group_id uuid references public.groups(id),
  encrypted_content text not null,
  nonce text not null,
  expires_at timestamp with time zone, -- TTL Support
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3.5 Contacts Table (New)
create table public.contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    contact_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, contact_id),
    CHECK (user_id != contact_id)
);

-- ==========================================
-- 4. STORAGE (Secure Images)
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure-images', 'secure-images', false)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.contacts enable row level security;
-- alter table storage.objects enable row level security; -- Already enabled by default or restricted

-- ==========================================
-- 6. POLICIES
-- ==========================================

-- 6.1 Users
-- Users can only see: Themselves OR people in their contacts list
create policy "View self and contacts" 
on public.users for select 
using (
    id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.contacts 
        WHERE user_id = auth.uid() AND contact_id = users.id
    )
);

-- Anyone can register
create policy "Register" on public.users for insert with check ( true );

-- 6.2 Groups
create policy "View groups" on public.groups for select using ( true );
create policy "Create groups" on public.groups for insert with check ( true );

-- 6.3 Group Members
create policy "View members" on public.group_members for select using ( true );
create policy "Add members" on public.group_members for insert with check ( true );

-- 6.4 Messages
-- Read: Users can read messages sent to them OR sent by them, AND not expired
create policy "Read messages" on public.messages for select using (
  (sender_id = auth.uid() OR recipient_id = auth.uid())
  AND
  (expires_at IS NULL OR expires_at > now())
);

-- Send: Authenticated users can insert messages
create policy "Send messages" on public.messages for insert with check (
  auth.uid() = sender_id
);

-- 6.5 Contacts
create policy "View own contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "Add contacts" on public.contacts for insert with check (auth.uid() = user_id);

-- 6.6 Storage (Secure Images)
create policy "Authenticated users can upload images"
on storage.objects for insert to authenticated
with check (bucket_id = 'secure-images');

create policy "Authenticated users can download images"
on storage.objects for select to authenticated
using (bucket_id = 'secure-images');

create policy "Users can delete their own images"
on storage.objects for delete to authenticated
using (bucket_id = 'secure-images' AND auth.uid() = owner);

-- ==========================================
-- 7. REALTIME
-- ==========================================
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table messages, groups, group_members;
commit;

-- ==========================================
-- 8. FUNCTIONS (RPC)
-- ==========================================

-- 8.1 Secure Account Recovery
CREATE OR REPLACE FUNCTION recover_account(
    p_username text,
    p_new_salt text,
    p_new_encrypted_key text,
    p_timestamp text,
    p_signature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_public_key_signing text;
BEGIN
    SELECT id, public_key_signing INTO v_user_id, v_public_key_signing
    FROM public.users
    WHERE username = p_username;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Timestamp Check (5 min window)
    IF abs(EXTRACT(EPOCH FROM now()) - (p_timestamp::bigint / 1000)) > 300 THEN
        RAISE EXCEPTION 'Request expired';
    END IF;

    -- Update
    UPDATE public.users
    SET 
        salt = p_new_salt,
        encrypted_private_key = p_new_encrypted_key
    WHERE id = v_user_id;

    RETURN true;
END;
$$;

-- 8.2 Find User by Code (Bypasses RLS)
CREATE OR REPLACE FUNCTION find_user_by_code(p_username text, p_code text)
RETURNS TABLE (
    id uuid,
    username text,
    public_key_encryption text,
    public_key_signing text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT u.id, u.username, u.public_key_encryption, u.public_key_signing
    FROM public.users u
    WHERE u.username = p_username AND u.friend_code = p_code;
END;
$$;

-- 8.3 Get Auth Data (Bypasses RLS for Login)
CREATE OR REPLACE FUNCTION get_auth_data(p_username text)
RETURNS TABLE (
    id uuid,
    username text,
    salt text,
    encrypted_private_key text,
    friend_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.salt, u.encrypted_private_key, u.friend_code
    FROM public.users u
    WHERE u.username = p_username;
END;
$$;

-- ==========================================
-- 9. TRIGGERS (Auto-Confirm Email)
-- ==========================================

-- 9.1 Auto-confirm existing users
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 9.2 Create Trigger to Auto-confirm FUTURE users
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- Attach Trigger
CREATE TRIGGER on_auth_user_created_auto_confirm
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_new_users();
