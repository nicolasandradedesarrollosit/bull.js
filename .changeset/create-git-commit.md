---
"@bull-js/cli": patch
"@bull-js/create": patch
---

`bull create` makes the first git commit on Windows too: commands no longer go through a shell that
joined their arguments unquoted, which broke the commit message and printed a DEP0190 warning. New
projects also ignore `.env` files.
