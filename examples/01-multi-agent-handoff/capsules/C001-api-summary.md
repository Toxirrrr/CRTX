# Capsule

Task: T001

Objective:
Implement GitHub API pagination logic for Issues.

Context:
Research completed. Evidence is stored in `E001-api-research.md`.

Important conclusions:
- Use Link headers, not manual `page` counter parameters.
- Always request `page=1` initially.
- Respect rate limits.
- If receiving a rate limit error, retry only after `Retry-After` seconds.

Next engineer should:
1. Create a `GitHubClient` class.
2. Parse `Link` headers from the response to find the `next` page URL.
3. Implement an async iterator to yield issues one by one.
4. Add unit tests for the pagination behavior.
