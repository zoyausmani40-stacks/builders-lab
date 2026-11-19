# CivicGrid — Full-Stack Civic Issue Management Platform

A working academic prototype based on the supplied synopsis: citizens report civic issues with photos and map coordinates; officers review, prioritize and assign; field workers update progress and resolution evidence; admins monitor the system.

## Stack
- Frontend: React + Vite + React Router + Leaflet
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt
- Uploads: local disk via Multer (Cloudinary can be added later)
- Live updates: Socket.IO with JWT-authenticated user rooms

## Requirements
- Node.js 18+
- MongoDB Community Server or MongoDB Atlas connection string

## Run locally

### 1. Backend
```bash
cd backend
cp .env.example .env
# Edit MONGO_URI and JWT_SECRET in .env
npm install
npm run seed
npm run dev
```
Backend runs at http://localhost:5000

### 2. Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:5173

Vite proxies `/api`, `/uploads`, and `/socket.io` to the backend.

## Demo accounts
Run `npm run seed` in `backend` to create/update these demo accounts:
| Role | Email | Password |
|---|---|---|
| Admin | admin@civicgrid.local | Admin@123 |
| Officer | officer@civicgrid.local | Officer@123 |
| Field Worker | worker@civicgrid.local | Worker@123 |
| Citizen | citizen@civicgrid.local | Citizen@123 |

Use these only for local demonstration. Change credentials before deployment.

## Main workflow
1. Register as a citizen or log in with the demo citizen.
2. Submit an issue; select a category, priority suggestion, description, image and map location.
3. Log in as officer; verify the complaint, set priority and assign a field worker.
4. Log in as field worker; accept/start work and mark it resolved with a note and optional photo.
5. Citizen can track status and see the timeline. Admin sees platform-wide statistics.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/issues`, `POST /api/issues`, `GET /api/issues/:id`
- `PATCH /api/issues/:id/review` (officer/admin)
- `PATCH /api/issues/:id/assign` (officer/admin)
- `PATCH /api/issues/:id/status` (assigned worker/officer/admin)
- `GET /api/dashboard/stats` (officer/admin)
- `GET /api/users/workers` (officer/admin)

All issue endpoints require a JWT except public health check. Role checks are enforced on the server, not just hidden in the UI.

## Notes / limitations
- This is an academic prototype, not a production municipal service.
- Local uploads are stored in `backend/uploads`; use a managed object store for production.
- Map tiles come from OpenStreetMap; comply with its tile usage policy.
- Notifications are persisted in each issue's timeline and broadcast over Socket.IO. The client also refreshes periodically so updates still appear if sockets are unavailable.
- Geospatial search uses MongoDB `2dsphere` indexing and GeoJSON coordinates `[longitude, latitude]`.


## Advanced features added
After logging in, open **Advanced** from the top navigation.

- **AI complaint assistant:** provides local keyword-based category, priority and title suggestions from the description. This is an offline heuristic assistant, not a hosted LLM; review suggestions before applying them.
- **Issue heatmap:** officer/admin-only Leaflet heat layer based on complaint GeoJSON coordinates and priority.
- **Notifications:** notification records are stored in MongoDB; authenticated Socket.IO rooms deliver new notifications live. The Advanced page also refreshes the notification list periodically.
- **Duplicate detection:** checks complaints within 500 metres and compares description token similarity. It is advisory and does not block submission.
- **Worker performance:** officer/admin-only assigned, completed, pending and average resolution-hours metrics. Average time is available for complaints resolved after this update recorded `resolvedAt`.
- **Feedback and rating:** the reporting citizen can submit a 1–5 rating and optional review after a complaint is resolved; one submission per complaint.

### Install the heatmap dependency
After extracting this updated project:
```bash
cd frontend
npm install
```
This installs `leaflet.heat` in addition to the existing frontend dependencies. Then restart the frontend dev server.

### Advanced API routes
- `POST /api/advanced/ai/suggest`
- `GET /api/advanced/heatmap` (officer/admin)
- `GET /api/advanced/notifications`
- `PATCH /api/advanced/notifications/:id/read`
- `PATCH /api/advanced/notifications/read-all`
- `POST /api/advanced/duplicates/check`
- `GET /api/advanced/workers/performance` (officer/admin)
- `POST /api/advanced/issues/:id/feedback`
