-- earshot: move the fictional residents out.
--
-- seed.sql fills the app with made-up Toronto listeners so it isn't empty while
-- you build. Before real people use it, they should go: run this once in the
-- Supabase SQL editor. It cannot be undone, except by running seed.sql again.
--
-- What goes with them: their rooms, listening, city posts, threads (including
-- any replies real people left on those threads), their replies on other
-- threads, songs they sent or were sent and any chats that followed, and their
-- signatures in real people's guestbooks. Real accounts are not touched.
--
-- Don't run seed.sql on a production project afterwards. With no residents, the
-- neighbourhood simulation has nobody to move and simply does nothing.

begin;

-- their signatures come out of real people's guestbooks first
select app.unsign(null, p.id) from app.profiles p where p.seeded;

-- everything else of theirs is tied to their profile and goes with it
delete from app.profiles where seeded;
delete from app.sim_state;

commit;
