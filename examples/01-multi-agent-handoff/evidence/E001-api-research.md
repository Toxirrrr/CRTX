# Evidence

Task: T001

## Findings

- GitHub REST API uses Link headers for pagination.
- Maximum page size is 100 (`per_page=100`).
- Rate limit heavily depends on authentication (5000 requests/hour for authenticated users vs 60 for unauthenticated).
- Conditional requests (using `ETag` or `If-Modified-Since`) reduce quota usage and should be used when polling issues.

## References

- [GitHub REST API docs: Using Pagination in the REST API](https://docs.github.com/en/rest/guides/using-pagination-in-the-rest-api)
- [GitHub REST API docs: Rate Limits](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)

## Confidence

High. The core pagination strategy is well-documented and standard across the GitHub API.
