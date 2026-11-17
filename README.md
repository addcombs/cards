# cards

A full-stack app: an Angular UI (`cards-ui`) and a Spring Boot API on AWS Lambda
(`cards-api`), with Cognito sign-in, a Neon PostgreSQL schema of its own, and one CloudFront
distribution at https://cards.acombs-dev.com that serves the UI, sends `/api/*`, `/actuator/*` and
the API docs to the API, and serves the card photos at `/images/photos/`. See each folder's README
for details.

`project.json` holds the only per-app settings: name, display name, AWS profile and region, domain,
Cognito domain prefix (with `autoConfirm`, so new accounts need no emailed code), the photo bucket
(`fileBuckets.photos`) and theme colors. `template.keep` lists the files this app keeps as its own
when it is brought up to date with `template-0`.

`infra\` is a CDK app (TypeScript) with every AWS resource the app runs on: the user pool, client,
sign-in domain and pre-sign-up trigger, the UI, photo and deploy buckets, the API's function, `live`
alias and function URL, the distribution and its Route 53 records, and the role GitHub Actions
deploys with. `scripts\provision.ps1` deploys it; the scripts' logs go to `logs\` (git-ignored), and
the Cognito IDs to `config\cognito-pool.json` (git-ignored).

GitHub Actions (`.github/workflows/ci.yml`) builds and tests the UI, the API and the infra code on
every push to `main` and every pull request, and checks the theme palettes match `project.json`.
Pushes to `main` that pass then deploy the UI and the API code, and give the Cognito sign-in page the
theme colors. To deploy without pushing, run the workflow from the repository's Actions tab (CI >
Run workflow). The deploy never changes the stack or the function's settings, so no secrets are
stored in GitHub; after changing `.env`, `project.json` or `infra\`, run `scripts\provision.ps1` again.

## Set up

The app was created from `template-0`; make further apps from that template, not from this one, and
bring this one up to date with the template's `scripts\sync-from-template.ps1 -Target ..\cards`.

1. `scripts\provision.ps1` - the GitHub repository's deploy role, the stack, the UI's settings, the
   database migrations and the first deploy
2. `scripts\add-card-admin.ps1 -Email <your sign-in email>` - lets that account edit the cards; sign
   out and back in afterwards
3. `scripts\start-all.ps1` - theme palettes, build, tests, and the app at http://localhost:4200/

To add cards, put PSA's photo downloads in `photos\` (git-ignored), run
`scripts\upload-card-photos.ps1`, add a row per card to `<app>-api\db\migrations\002-cards.sql`, and
run `scripts\apply-migrations.ps1`. The migration only adds cards that are missing; correct an existing
card's details in the app, with the pencil button an admin sees under each card.

After that, each push to `main` deploys. `scripts\start-all.ps1` builds and tests both apps locally
before starting them.
