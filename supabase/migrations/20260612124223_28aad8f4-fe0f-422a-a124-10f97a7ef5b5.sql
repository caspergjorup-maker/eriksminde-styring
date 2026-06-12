INSERT INTO public.user_roles (user_id, role)
VALUES ('c94cbf5f-c9c8-4b5b-a4a4-225c62b796b2', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;