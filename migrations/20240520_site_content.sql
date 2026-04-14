-- Content Table for editable pages
CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY, -- e.g., 'home.hero.headline'
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES players(id)
);

-- RLS for site_content
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read
CREATE POLICY "Allow public read access" ON site_content
  FOR SELECT USING (true);

-- Allow only admins to update
CREATE POLICY "Allow admin update access" ON site_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
      AND r.name = 'Admin'
    )
  );

-- Allow only admins to insert
CREATE POLICY "Allow admin insert access" ON site_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
      AND r.name = 'Admin'
    )
  );

-- Initial Content
INSERT INTO site_content (id, content) VALUES
('home.hero.headline', 'The home of competitive Beyblade X'),
('home.hero.subtitle', 'Tournament management, live match scoring, and global rankings — all in one place. Built for the Spirit Gaming Beyblade X community.'),
('home.features.tournament.title', 'Tournament Engine'),
('home.features.tournament.body', 'Swiss, Round Robin, Single & Double Elimination. Auto-seeding by ranking. Bracket preview before you generate.'),
('home.features.scoring.title', 'Live Scoring'),
('home.features.scoring.body', 'Referees grab and score matches in real-time. Every EXT, OVR, BUR, SPN finish logged per beyblade.'),
('home.features.rankings.title', 'Global Rankings'),
('home.features.rankings.body', 'Points awarded automatically on tournament completion. Head-to-head records and meta stats per part.')
ON CONFLICT (id) DO NOTHING;
