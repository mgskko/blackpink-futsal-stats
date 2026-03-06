
-- Insert missing goal_events for matches 8-18 (early matches that have has_detail_log=true but no goal_events)
-- Match 8 = 2024-06-29, team_id 81 (버니즈)
-- Player ID mapping: 고명석=1, 윤태규=2, 이래현=3, 유성민=4, 최영재=5, 신동호=6, 신형찬=9, 이민혁=12, 박상기=13, 장영환=14

INSERT INTO goal_events (match_id, team_id, quarter, goal_player_id, assist_player_id, is_own_goal, assist_type, goal_type, build_up_process) VALUES
-- Match 8 (2024-06-29, 영등포, team 81)
(8, 81, 1, 3, 2, false, '킬패스', NULL, NULL),
(8, 81, 1, 9, 2, false, '킬패스', NULL, NULL),
(8, 81, 3, 9, 12, false, NULL, '주워먹기', NULL),
(8, 81, 3, 3, 13, false, '킬패스', NULL, NULL),
(8, 81, 3, 3, 9, false, '킬패스', NULL, NULL),
(8, 81, 4, 3, 4, false, NULL, '타격골', NULL),
(8, 81, 7, 13, 12, false, '컷백', '컷백골', NULL),
(8, 81, 5, 3, NULL, false, NULL, '타격골', NULL),
(8, 81, 6, 9, 12, false, NULL, NULL, NULL),
(8, 81, 6, 12, 2, false, NULL, NULL, NULL),
(8, 81, 8, 14, 3, false, '킬패스', NULL, NULL),
(8, 81, 8, 12, 13, false, '킬패스', NULL, '역습'),

-- Match 9 (2024-07-14, 용산 더베이스, team 91)
(9, 91, 4, 2, NULL, false, NULL, NULL, NULL),
(9, 91, 5, 9, 12, false, NULL, NULL, NULL),
(9, 91, 6, 12, 18, false, NULL, NULL, NULL),
(9, 91, 7, 6, NULL, false, NULL, NULL, NULL),
(9, 91, 8, 6, NULL, false, NULL, NULL, NULL),
(9, 91, 8, 5, 1, false, NULL, NULL, NULL),

-- Match 10 (2024-07-28, 용산 더베이스, team 101)
(10, 101, 2, 12, 9, false, NULL, NULL, NULL),
(10, 101, 4, 12, NULL, false, NULL, NULL, NULL),
(10, 101, 5, 3, 14, false, NULL, NULL, NULL),
(10, 101, 5, 14, NULL, false, NULL, NULL, NULL),
(10, 101, 6, 16, NULL, false, NULL, NULL, NULL),
(10, 101, 6, 3, NULL, false, NULL, NULL, NULL),
(10, 101, 7, 2, 1, false, NULL, NULL, NULL),
(10, 101, 7, 16, NULL, false, NULL, NULL, NULL),

-- Match 11 (2024-08-18/23, 수명고등학교, team 111) - this is 2024-08-23 based on data
-- Actually match 11 is 2024-08-18 per DB. The data for 2024-08-23 doesn't exist as a match yet.
-- Let me check: match 11 = 2024-08-18, match_id=11, has_detail_log=false
-- Skip match 11 - no detail data provided for 2024-08-18

-- Match 12 (2024-09-01, 도곡 로꼬풋살, team 121)
(12, 121, 1, 3, 1, false, NULL, NULL, NULL),
(12, 121, 1, 3, 1, false, NULL, NULL, NULL),
(12, 121, 2, 4, 16, false, NULL, NULL, NULL),
(12, 121, 4, 14, NULL, false, NULL, NULL, NULL),
(12, 121, 8, 1, 14, false, NULL, NULL, NULL),
(12, 121, 8, 2, NULL, false, NULL, NULL, NULL),

-- Match 13 (2024-09-14, 자체전, team 131=성민팀, 132=현석팀)
-- Need to map goals to correct team. All goals from data are 버니즈 players in custom match
-- For custom matches, map to appropriate team based on quarter goal events
(13, 131, 2, 11, 2, false, NULL, NULL, NULL),
(13, 132, 2, 6, NULL, false, NULL, NULL, NULL),
(13, 131, 2, 3, 12, false, NULL, NULL, NULL),
(13, 131, 3, 6, 17, false, NULL, NULL, NULL),
(13, 131, 3, 11, 6, false, NULL, NULL, NULL),
(13, 132, 3, 12, 3, false, NULL, NULL, NULL),
(13, 131, 4, 1, NULL, false, NULL, NULL, NULL),
(13, 131, 5, 11, NULL, false, NULL, NULL, NULL),
(13, 132, 5, 1, NULL, false, NULL, NULL, NULL),
(13, 131, 5, 5, 12, false, NULL, NULL, NULL),
(13, 131, 6, 6, NULL, false, NULL, NULL, NULL),
(13, 132, 6, 11, 6, false, NULL, NULL, NULL),
(13, 131, 7, 11, 17, false, NULL, NULL, NULL),
(13, 132, 7, 17, NULL, false, NULL, NULL, NULL),
(13, 131, 8, 1, 12, false, NULL, NULL, NULL),

-- Match 14 (2024-09-29, 수명고등학교, team 141)
(14, 141, 1, 11, 3, false, NULL, NULL, NULL),
(14, 141, 1, 11, 3, false, NULL, NULL, NULL),
(14, 141, 1, 11, NULL, false, NULL, NULL, NULL),
(14, 141, 1, 3, NULL, false, NULL, NULL, NULL),
(14, 141, 2, 3, 19, false, NULL, NULL, NULL),
(14, 141, 2, 14, NULL, false, NULL, NULL, NULL),
(14, 141, 3, 1, 9, false, NULL, NULL, NULL),
(14, 141, 3, 14, NULL, false, NULL, NULL, NULL),
(14, 141, 3, 2, 9, false, NULL, NULL, NULL),
(14, 141, 4, 11, 18, false, NULL, NULL, NULL),
(14, 141, 4, 11, 19, false, NULL, NULL, NULL),
(14, 141, 4, 11, 9, false, NULL, NULL, NULL),
(14, 141, 4, 18, 3, false, NULL, NULL, NULL),
(14, 141, 4, 19, 11, false, NULL, NULL, NULL),
(14, 141, 5, 2, 12, false, NULL, NULL, NULL),
(14, 141, 5, 2, 12, false, NULL, NULL, NULL),
(14, 141, 5, 2, 1, false, NULL, NULL, NULL),
(14, 141, 5, 12, 2, false, NULL, NULL, NULL),
(14, 141, 6, 19, 11, false, NULL, NULL, NULL),
(14, 141, 6, 14, 19, false, NULL, NULL, NULL),

-- Match 15 (2024-10-13, 잠실, team 151)
(15, 151, 1, 2, NULL, false, NULL, NULL, NULL),
(15, 151, 4, 9, 2, false, NULL, NULL, NULL),
(15, 151, 5, 3, 1, false, NULL, NULL, NULL),
(15, 151, 5, 1, NULL, false, NULL, NULL, NULL),
(15, 151, 6, 9, 3, false, NULL, NULL, NULL),
(15, 151, 8, 12, 1, false, NULL, NULL, NULL);

NOTIFY pgrst, 'reload schema';
