# cards

A full-stack app template: an Angular UI (`cards-ui`) and a Spring Boot API on AWS Lambda
(`cards-api`), with Cognito sign-in, a Neon PostgreSQL schema of its own, and CloudFront at
https://cards.acombs-dev.com and https://api.cards.acombs-dev.com. See each folder's
README for details.

`project.json` holds the only per-app settings: name, AWS profile and region, domain, Cognito
domain prefix and theme colors. The PowerShell scripts in `scripts\` derive every AWS resource
name from it. Their logs go to `logs\` and the IDs AWS assigns to `state\` (both git-ignored).

GitHub Actions (`.github/workflows/ci.yml`) builds and tests the UI and the API on every push to
`main` and every pull request, and checks the theme palettes match `project.json`. Pushes to `main`
that pass then deploy the UI and the API code, and give the Cognito sign-in page the theme colors,
through an IAM role made by `scripts\create-github-deploy-role.ps1` (step 8 below); to deploy
without pushing, run the workflow from the repository's Actions tab (CI > Run workflow). The
deploy never changes the function's settings, so no secrets are stored in GitHub; after changing
`.env` or the Cognito pool, run `scripts\deploy-api.ps1` again.

## Create a new app

```powershell
.\scripts\new-app.ps1 -Name project-1 -Primary '#RRGGBB' -Secondary '#RRGGBB'
```

copies this project to `..\project-1` with the folders, Java package, names, host
(`project-1.acombs-dev.com` unless `-HostName` is given), Cognito prefix, schema and colors
renamed, writes its `.env` with the shared database login, and starts a git repository. Then run,
from the new folder:

1. `scripts\create-cognito-pool.ps1` - the app's user pool, client and sign-in domain
2. `scripts\apply-migrations.ps1` - its schema and tables in the shared database
3. `scripts\start-all.ps1` - theme palettes, build, tests, and the app at http://localhost:4200/
4. `scripts\deploy-api.ps1` (builds, tests and creates the function), then
   `scripts\create-function-url.ps1` - the API on Lambda
5. `scripts\request-certificate.ps1` - add the CNAMEs it prints at the DNS provider and re-run it
   until both certificates are issued
6. `scripts\create-ui-bucket.ps1`, `scripts\create-cloudfront.ps1`, `scripts\create-api-cloudfront.ps1`
7. At the DNS provider: CNAMEs for the host and `api.` host to the CloudFront domains the scripts
   print
8. Commit `src\app\project.settings.ts` (step 1 filled in its Cognito IDs), push to a new GitHub
   repository as the git origin, run `scripts\create-github-deploy-role.ps1`, add the role ARN it
   prints as the repository's Actions variable `AWS_DEPLOY_ROLE_ARN`, then run the workflow (Actions
   > CI > Run workflow) for the first deploy of the UI and the sign-in page's colors
9. `scripts\create-photos-bucket.ps1` - the card-photo bucket, served at `https://<host>/photos/`
10. `scripts\add-card-admin.ps1 -Email <your sign-in email>` - lets that account edit the cards; sign
    out and back in afterwards

To add cards, put PSA's photo downloads in `photos\` (git-ignored), run
`scripts\upload-card-photos.ps1`, add a row per card to `<app>-api\db\migrations\002-cards.sql`, and
run `scripts\apply-migrations.ps1`. The migration only adds cards that are missing; correct an existing
card's details in the app, with the pencil button an admin sees under each card.

After that, each push to `main` deploys. `scripts\start-all.ps1` builds and tests both apps locally
before starting them.
