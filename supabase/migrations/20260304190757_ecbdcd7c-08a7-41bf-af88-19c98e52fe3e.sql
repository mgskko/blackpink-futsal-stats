
-- Add age columns to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS original_age_desc TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS age_category TEXT;

-- Add youtube_link to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS youtube_link TEXT;

-- Add video_timestamp to goal_events
ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS video_timestamp TEXT;
