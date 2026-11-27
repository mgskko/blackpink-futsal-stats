# Architecture rules
- Keep recent-form statistics in a pure library module using the shared match AP calculator; this preserves historical/detail-log consistency and makes ranking rules testable.
- Pass the statistics page's filtered players and matches to the recent-form section; this keeps sport, season, and inactive/guest exclusions consistent without new data access rules.