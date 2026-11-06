# cards API

Spring Boot account and card API for cards (UI: `../cards-ui`), backed by the `users` and `cards` tables in the app's own schema of a shared PostgreSQL database (`DATABASE_SCHEMA`; `cards` for cards). Hibernate validates the tables at startup and does not create or modify database objects; `..\scripts\apply-migrations.ps1` does.

All application endpoints are under `/api/account` and `/api/cards` and require a verified Cognito ID token; editing a card also requires membership in the Cognito group `admins` (`..\scripts\add-card-admin.ps1`), which the token lists in `cognito:groups`. The health check and API documentation endpoints are public.

## Requirements

- Java 21
- Maven 3.6.3 or later
- PostgreSQL connection details for the shared database

## Database migrations

Each app has its own schema in the shared database: `database.schema` in `..\project.json`, or else the app name in lower case with other characters as underscores (`project-1` → `project_1`). Run `..\scripts\apply-migrations.ps1` to create the schema and apply `db\migrations\*.sql` to it, in file-name order, each in its own transaction (`${schema}` in a file is replaced with the schema name). It reads the connection from `.env`. Every file is applied on every run, so migrations must be idempotent (`IF NOT EXISTS`). Run `..\scripts\apply-migrations.ps1 -DryRun` to apply them and roll back.

`001-account-identity.sql` creates the `users` table, or for an existing table adds the Cognito subject and a case-insensitive unique email index; it fails if an existing table has duplicate emails. Before running it against existing data, back it up and resolve any duplicates found by:

```sql
SELECT lower(email), count(*) FROM <schema>.users
WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1;
```

`002-cards.sql` creates the `cards` table and fills it with the collection: sport, year, set, card number, player, variety, PSA grade and cert number, and the photo ID that names the card's photos in the photo bucket (`..\scripts\upload-card-photos.ps1`). To add a card, add its row there and re-run the migrations. Re-running leaves cards already in the table alone, so details edited through `PUT /api/cards/{photoId}` are kept; correct existing cards that way rather than in the file.

`003-ebay-listing.sql` adds `ebay_url`, the card's eBay listing (an http or https URL), set through `PUT /api/cards/{photoId}`.

Nothing is applied automatically: the application cannot start against an out-of-date schema because Hibernate validates it (`ddl-auto=validate`).

## Configuration

All settings are supplied through environment variables; nothing is stored in source. All six are required to start the application. `..\scripts\start-all.ps1` and `deploy-api` set `DATABASE_SCHEMA` from `..\project.json` and the Cognito settings from `..\state\cognito-pool.json`; the database login comes from `.env` (for runs outside those scripts, e.g. from the IDE, put all six in `.env`).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | JDBC URL, e.g. `jdbc:postgresql://HOST/DBNAME?sslmode=require` |
| `DATABASE_USERNAME` | Database role |
| `DATABASE_PASSWORD` | Database password |
| `DATABASE_SCHEMA` | The app's schema in the shared database, e.g. `cards` for cards |
| `COGNITO_ISSUER` | Issuer URL of your Cognito user pool, `https://cognito-idp.REGION.amazonaws.com/POOL_ID` |
| `COGNITO_CLIENT_ID` | Cognito app client ID that ID tokens must be issued for |

Optional: `CORS_ALLOWED_ORIGINS`, comma-separated browser origins allowed to call the API cross-origin (e.g. `https://cards.acombs-dev.com`). Unset allows none. `deploy-api` sets it to the UI's domain.

```powershell
$env:DATABASE_URL = "jdbc:postgresql://HOST/DBNAME?sslmode=require"
$env:DATABASE_USERNAME = "YOUR_DATABASE_ROLE"
$env:DATABASE_PASSWORD = "YOUR_DATABASE_PASSWORD"
$env:DATABASE_SCHEMA = "cards"
$env:COGNITO_ISSUER = "https://cognito-idp.REGION.amazonaws.com/POOL_ID"
$env:COGNITO_CLIENT_ID = "YOUR_APP_CLIENT_ID"
```

There are deliberately no defaults for the Cognito settings. The backend validates the ID token's signature, issuer, expiration, audience, token use, subject, and verified email using the pool's public keys.

## Build and run

From this directory:

```powershell
mvn --batch-mode --no-transfer-progress verify   # build and run the unit tests
mvn spring-boot:run                              # run (requires the environment variables above)
```

The unit tests do not need a database or Cognito. Running the application requires a reachable PostgreSQL database with the expected schema and a Cognito pool.

## Endpoints

With the API running locally, open Swagger UI at
`http://localhost:8080/swagger-ui.html` or retrieve the generated OpenAPI JSON
at `http://localhost:8080/v3/api-docs`. Documentation covers `/api/account`
and `/api/cards` only. In Swagger UI, use **Authorize** with a valid Cognito ID token to call it.
Both documentation endpoints are public; when deployed they are served at the API's own
host, e.g. `https://api.cards.acombs-dev.com/swagger-ui.html`.

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/account` | Get current user's details, linking an existing row by verified email if necessary; `404` if absent |
| `PUT` | `/api/account` | Create or update current user's details |
| `GET` | `/api/cards` | List the cards, oldest first, each with its sport and photo ID |
| `PUT` | `/api/cards/{photoId}` | Edit a card's details (admins only, else `403`); `404` for an unknown card, `409` for a cert number another card has |

The account endpoint takes `firstName` and `lastName` (required, maximum 100 characters) and `phoneNumber` (optional, maximum 40 characters). It obtains email and subject exclusively from the verified ID token; the client cannot change email. IDs and account audit fields are system-managed. A row linked to a different subject or a changed verified email causes `409` and requires administrative resolution.
