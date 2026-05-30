-- Fix existing Inactive equipment that still has needs_calibration = true
UPDATE equipment
SET needs_calibration = false
WHERE status = 'Inactive'
  AND needs_calibration = true;
