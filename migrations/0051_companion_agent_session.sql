-- Client-driven agent loops persist tool-session guards across short HTTP hops.
ALTER TABLE companion_turns ADD COLUMN agent_session_json TEXT NOT NULL DEFAULT '{}';
