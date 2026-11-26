# Issue tracker: Jira (via Teamwork Graph CLI)

Issues and specs for this repo live in Jira, accessed through the Teamwork Graph CLI (`twg`). Jira calls issues "work items".

- **Site:** `<SITE>`
- **Project key:** `<KEY>`

If `twg` is not on PATH, ask the user to install it. Don't run setup, login or upgrade commands unless asked.

## Conventions

Run `twg help describe "<command>"` before an unfamiliar command; don't guess flags.

- **Create an issue**: `twg jira workitem create --space <KEY> --type <Task|Bug|...> --summary "..." --description "..." --description-format markdown`. Add `--labels a,b` and `--parent <KEY>-<n>` as needed. Before creating, run `twg jira workitem field create-metadata --space <KEY> --type <TYPE>` to discover required custom fields (`customfield_*` IDs).
- **Read an issue**: `twg jira workitem get <KEY>-123 --comments -o json`. Pass several keys in one call to batch-read. Use `--full` for all fields plus comments and remote links.
- **List / search issues**: `twg jira workitem query --jql 'project = <KEY> AND labels = "needs-triage" ORDER BY created DESC' --fields summary,status,labels,assignee -o json`. Use `twg jira workitem search "<text>"` for fuzzy text.
- **Comment on an issue**: `twg jira workitem comment create ...` (see `twg help describe "jira workitem comment create"`).
- **Apply / remove labels**: `twg jira workitem update --id <KEY>-123 --add-labels x --remove-labels y`.
- **Close**: Jira closes by workflow transition. Run `twg jira workitem transition --id <KEY>-123 --site <SITE> -o json` to list transitions, then pick one. Resolution is a user decision; ask if it isn't given. Post the explanation as a comment before closing.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs/MRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a Jira work item in project `<KEY>`.

## When a skill says "fetch the relevant ticket"

Run `twg jira workitem get <KEY>-<n> --comments -o json`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single work item with **child** work items as tickets.

- **Map**: an Epic labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a work item with `--parent <map key>` and label `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev (`--assignee me`).
- **Blocking**: Jira "Blocks" issue links (see `twg help describe "jira workitem link"`). A ticket is unblocked when every blocker is Done.
- **Frontier query**: JQL scoped to the map's children (`parent = <map key>`); drop any with an unresolved blocker or an assignee; first in map order wins.
- **Claim**: `twg jira workitem update --id <KEY>-<n> --assignee me`, the session's first write.
- **Resolve**: comment the answer, transition to Done, then append a context pointer (gist + link) to the map's Decisions-so-far.
