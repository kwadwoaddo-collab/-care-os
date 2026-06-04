-- 059_widen_training_categories.sql
--
-- Widens the training_category CHECK constraint on the documents table
-- to include all 13 UK mandatory domiciliary care training categories.
--
-- Previously only 7 categories were allowed:
--   manual_handling, safeguarding, basic_life_support, infection_control,
--   health_safety, medication, fire_safety
--
-- Now adds:
--   safeguarding_children, mental_capacity, food_hygiene, lone_working,
--   dementia_awareness, communication
--
-- Safe to run multiple times (DROP CONSTRAINT IF EXISTS is idempotent).

-- Step 1: Drop the old restrictive CHECK constraint
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_training_category_check;

-- Step 2: Add the widened CHECK constraint with all 13 categories
ALTER TABLE documents
  ADD CONSTRAINT documents_training_category_check
  CHECK (training_category IN (
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'medication',
    'fire_safety',
    'safeguarding_children',
    'mental_capacity',
    'food_hygiene',
    'lone_working',
    'dementia_awareness',
    'communication'
  ));

-- Step 3: Update the column comment to reflect all 13 values
COMMENT ON COLUMN documents.training_category IS
  'Structured training type for training_certificate documents. '
  'All 13 UK mandatory domiciliary care categories: '
  'manual_handling | safeguarding | safeguarding_children | basic_life_support | '
  'infection_control | health_safety | medication | fire_safety | '
  'mental_capacity | food_hygiene | lone_working | dementia_awareness | communication. '
  'NULL for non-training documents.';
