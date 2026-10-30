# SignBridge AI — Database Configuration & Migration Guide

SignBridge AI supports resilient dual-mode persistence:
1. **MongoDB Atlas Cloud (Indexed Document Store & Custom Auth)**
2. **Local Embedded SQLite (Zero-configuration fallback)**

---

## 1. Setting up MongoDB Atlas Cloud

If you have a MongoDB Atlas account (Project: `69ba6bd5b08f2ff79b9aa170`):

1. Create a database cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database named `signbridge_ai` (or use the default from `MONGODB_DB_NAME`).
3. Under **Database Access**, create a user with read and write privileges.
4. Under **Network Access**, allow access from your deployment IP addresses (or `0.0.0.0/0` for cloud PaaS deployments).
5. Retrieve your connection string (URI) from the Atlas dashboard:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/signbridge_ai?retryWrites=true&w=majority
   ```
6. Update your root `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/signbridge_ai?retryWrites=true&w=majority
   MONGODB_DB_NAME=signbridge_ai
   JWT_SECRET=your_secure_jwt_secret_key_here
   ```
7. Start or restart the backend:
   ```powershell
   .\venv\Scripts\uvicorn backend.app.main:app --reload
   ```
   The backend will automatically initialize the necessary collections and indexes:
   - `users` (unique on `email`, `id`)
   - `profiles` (unique on `id`, `email`)
   - `auth_sessions` (unique on `token`, indexed on `user_id`, `expires_at`)
   - `recognition_history` (unique on `id`, indexed on `user_id`, `created_at`)
   - `sentence_history` (unique on `id`, indexed on `user_id`, `created_at`)

---

## 2. Migrating Data from SQLite to MongoDB Atlas

If you have existing historical data in local SQLite that you want copied into MongoDB Atlas:

1. Authenticate or login as any registered user.
2. Send a `POST` request to `/auth/migrate-to-mongo` with the bearer token:
   ```bash
   curl -X POST http://localhost:8000/auth/migrate-to-mongo -H "Authorization: Bearer <TOKEN>"
   ```
3. The migration utility will copy:
   - All users & password hashes
   - User profiles & language preferences
   - Active auth sessions
   - Frame recognition history
   - Confirmed sentence history
4. Existing documents are preserved without duplicate key collisions.

---

## 3. Local SQLite Fallback

If you don't have MongoDB Atlas credentials or are developing offline:
- Leave `MONGODB_URI` empty in `.env`.
- SignBridge AI will automatically initialize and write records to `backend/app/database/signbridge_local.db`.
- The dashboard will display `Storage: SQLite Local` in the navigation bar.
- No external services, Docker, or external database setup is required.
