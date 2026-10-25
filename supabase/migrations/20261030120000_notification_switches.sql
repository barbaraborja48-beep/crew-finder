-- Update 9: the notification switches work again.
-- Every new pin spot and every message reaches the push function again, and the function
-- sends each one only to phones whose switches allow it:
--   "Pin notifications"  → friends' new spots and status changes
--   "Chat notifications" → messages, photos and shared locations
--   always               → SOS, pings and meet-spot changes
-- Phones in low data mode tell the server to pause pin and chat notifications for them,
-- so the switches decide per person instead of one rule for everyone.

drop trigger if exists checkins_push on public.checkins;
drop trigger if exists messages_push on public.messages;
create trigger checkins_push after insert on public.checkins for each row execute function public.push_hook();
create trigger messages_push after insert on public.messages for each row execute function public.push_hook();
