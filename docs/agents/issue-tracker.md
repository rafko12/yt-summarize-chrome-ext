# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in [`rafko12/yt-summarize-chrome-ext`](https://github.com/rafko12/yt-summarize-chrome-ext). Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --repo rafko12/yt-summarize-chrome-ext --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --repo rafko12/yt-summarize-chrome-ext --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --repo rafko12/yt-summarize-chrome-ext --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --repo rafko12/yt-summarize-chrome-ext --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --repo rafko12/yt-summarize-chrome-ext --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo rafko12/yt-summarize-chrome-ext --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents.

## When a skill says “publish to the issue tracker”

Create a GitHub issue in `rafko12/yt-summarize-chrome-ext`.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --repo rafko12/yt-summarize-chrome-ext --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is a single issue with child issues as tickets. Use the repository's GitHub Issues and the `gh` CLI for map, child ticket, blocking, frontier, claim, and resolve operations.
