-- Seed initial badges
INSERT INTO public.badges (id, name, description, emoji, category, tier, requirement_type, requirement_value) VALUES
-- Social badges (sharing)
('advocate', 'Advocate', 'Share the game once', '📢', 'social', 'bronze', 'shares', 1),
('promoter', 'Promoter', 'Share the game 5 times', '📣', 'social', 'silver', 'shares', 5),
('influencer', 'Influencer', 'Share the game 15 times', '🎤', 'social', 'gold', 'shares', 15),
('ambassador', 'Ambassador', 'Share the game 50 times', '👑', 'social', 'platinum', 'shares', 50),

-- Skill badges (runs played)
('newbie', 'Newbie', 'Complete your first run', '🎮', 'skill', 'bronze', 'runs', 1),
('regular', 'Regular Player', 'Complete 10 runs', '🎯', 'skill', 'silver', 'runs', 10),
('veteran', 'Veteran', 'Complete 50 runs', '⚡', 'skill', 'gold', 'runs', 50),
('legend', 'Legend', 'Complete 100 runs', '🔥', 'skill', 'platinum', 'runs', 100),

-- Achievement badges (special)
('founder', 'Founder', 'Joined during launch week', '🏆', 'achievement', 'platinum', 'special', 0),
('top_10', 'Top 10', 'Finish in top 10 of a contest', '🥇', 'achievement', 'gold', 'special', 0),
('perfect_score', 'Perfect Score', 'Score 10,000+ points in a single run', '💯', 'achievement', 'gold', 'score', 10000),
('speed_demon', 'Speed Demon', 'Travel 1,000+ meters in a single run', '💨', 'achievement', 'silver', 'special', 0),

-- Contest badges
('contest_winner', 'Contest Winner', 'Win 1st place in a contest', '👑', 'contest', 'platinum', 'contest_wins', 1),
('podium_finish', 'Podium Finish', 'Finish top 3 in a contest', '🥉', 'contest', 'gold', 'special', 0),

-- Learning badges
('security_pro', 'Security Pro', 'Complete all tutorial quizzes', '🛡️', 'achievement', 'gold', 'special', 0),
('quiz_master', 'Quiz Master', 'Pass 10 quizzes', '🧠', 'achievement', 'silver', 'special', 0)

ON CONFLICT (id) DO NOTHING;
