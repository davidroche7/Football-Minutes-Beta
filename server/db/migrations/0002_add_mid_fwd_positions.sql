-- Add MID and FWD to lineup_position enum for the new formation (1 DEF + 1 MID + 2 FWD).
-- Existing rows using GK, DEF, ATT are unaffected.
-- ATT is retained for backwards compatibility with previously saved fixtures.

ALTER TYPE lineup_position ADD VALUE IF NOT EXISTS 'MID';
ALTER TYPE lineup_position ADD VALUE IF NOT EXISTS 'FWD';
