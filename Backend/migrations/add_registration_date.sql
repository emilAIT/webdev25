-- Add registration_date column to users table
ALTER TABLE users ADD COLUMN registration_date TEXT;

-- Update existing users with current timestamp
UPDATE users SET registration_date = datetime('now') WHERE registration_date IS NULL; 