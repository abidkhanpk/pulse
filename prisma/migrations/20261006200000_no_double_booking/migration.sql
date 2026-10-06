-- Database-enforced overlap protection: a desk cannot be double-booked.
-- Only applies to SCHEDULED occurrences that have a desk (REMOTE bookings
-- have deskId NULL and never conflict; CANCELLED slots free the desk).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BookingOccurrence"
  ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    "deskId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  )
  WHERE ("status" = 'SCHEDULED' AND "deskId" IS NOT NULL);
