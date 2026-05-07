# Admin Auth Setup

This guide explains how to create an admin user who can log in to `/admin`.

## How it works

Admin login uses Supabase Auth (email + password). After authenticating, the app looks up the user's row in the `profiles` table to get their `company_id` and `role`.

A user with role `admin`, `company_admin`, `coordinator`, or `super_admin` can access the admin panel.

---

## Steps

### 1. Create a user in Supabase Auth

In the Supabase dashboard → **Authentication → Users → Add user**

Enter:
- Email address
- Password
- Click **Create user**

Copy the **User UID** shown in the users list.

---

### 2. Find your company ID

```sql
SELECT id, name FROM companies LIMIT 10;
```

Copy the `id` of the company this admin belongs to.

---

### 3. Insert a profile row

Run this SQL in the **Supabase SQL Editor**:

```sql
INSERT INTO profiles (id, company_id, role, first_name, last_name, email)
VALUES (
  '<paste-auth-user-uuid>',
  '<paste-company-uuid>',
  'company_admin',   -- or: admin | coordinator | super_admin
  'First',
  'Last',
  'admin@example.com'
);
```

Replace the placeholder values with real data.

---

### 4. Log in

Go to `/admin/login` and sign in with the email and password you set in step 1.

---

## Role reference

| Role | Access |
|---|---|
| `super_admin` | Full access across all companies |
| `company_admin` | Full access within their company |
| `coordinator` | Same as company_admin (for now) |
| `admin` | Legacy value — treated as company_admin |
| `staff` / `care_worker` | No admin access |

---

## Development

In development (`NODE_ENV=development`), `DEV_BYPASS_AUTH=true` and all admin routes are accessible without login. The dev context uses the first company in the database.

To test the real login flow locally, set `NODE_ENV=production` in your `.env.local`, or temporarily set `DEV_BYPASS_AUTH` to `false` in `lib/auth/requireAdmin.ts`.
