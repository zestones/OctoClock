/** Shared DOM utilities for content scripts. */

const ISSUE_PAGE_REGEX = /^\/[^/]+\/[^/]+\/issues\/\d+$/;

export function isIssuePage() {
    return ISSUE_PAGE_REGEX.test(location.pathname);
}

export function getIssueTitle() {
    return (
        document.querySelector('span.js-issue-title')?.textContent?.trim() ||
        document.querySelector("[data-testid='issue-title']")?.textContent?.trim() ||
        null
    );
}
