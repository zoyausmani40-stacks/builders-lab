# Member 2 — Accounts & Administration
Ownership: backend startup, database connection, authentication, user model, authorization middleware, demo seeding, and admin worker/officer management UI.
Files in this archive are placed under `CivicGrid/`.

## Work rules
- Keep JWT payload and role values consistent with the frontend.
- Admin create/edit/deactivate functionality must use the existing `/api/users` routes.
- Never commit real credentials or `.env` files.
- Test login and admin management after integrating with the full project.

## Git workflow
Clone the team's main repository, copy these files into matching paths, create `feature/accounts-admin`, commit, push, and open a pull request. Do not create a separate repository.
