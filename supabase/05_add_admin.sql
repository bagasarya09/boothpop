-- FIRST: create your email/password user in Dashboard > Authentication > Users.
-- Replace the UUID below with that user's ID; never use a database password here.
-- Run this in SQL Editor as the project owner, not through the website.
insert into boothpop_private.admins (user_id)
values ('0017c8d2-4087-4353-aab5-78f4a785e01c'::uuid)
on conflict (user_id) do nothing;

select users.id, users.email, admins.created_at
from boothpop_private.admins as admins
join auth.users as users on users.id = admins.user_id;
