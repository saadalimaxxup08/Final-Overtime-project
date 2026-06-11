# Overtime Tracker Pro (with Admin Panel)

A premium, production-ready enterprise overtime clock-in and manual logger web application. Built using Next.js 14 (App Router) + TypeScript + Tailwind CSS (v4) + Supabase database & authentication.

## Core Features
1. **Glassmorphic Dark Theme**: Sleek sci-fi look with glows, radial background gradient filters, and micro-interactions.
2. **Dual-Tab Authentication**: Password Sign-In/Up and passwordless OTP Magic Links.
3. **Punch Clock & Logger**:
   - Real-time digital ticking clock.
   - Live check-in/out records with calculation of total hours and overtime hours (hours worked beyond 8.00 hours/day) using `dayjs`.
   - Manual overtime backlogging with notes.
   - Interactive confetti showers on successful shift clock-out.
4. **Detailed Analytics**: Metric cards summing completed shifts, hours logged, overtime accumulated, and daily work averages.
5. **Secure PDF Generation**:
   - Generate official overtime log summaries via client-side `jsPDF`.
   - **Privacy rule**: PDF report headers include Name and Employee ID but omit email addresses.
6. **Robust Admin Dashboard (`/admin`)**:
   - Protected route with redirection logic.
   - Enterprise metrics: Total Registered Employees, Total Logs logged this month, Cumulative Overtime logged by all users, Active users checked-in today.
   - Searchable Employee Directory: Quick lookup by Name or Employee ID.
   - Drill-down "View Details" modal containing any employee's full log history.
   - PDF downloader: Download a report on behalf of any employee.
7. **Strict Security Policies**: Row Level Security (RLS) configured so standard users read/write their own logs, while admins can view all.

---

## Supabase Database Schema Setup

Go to your **Supabase Dashboard → SQL Editor**, create a new query, paste the script below, and run it to set up your tables, index constraints, and Row Level Security:

```sql
-- ==========================================
-- 1. CLEANUP PREVIOUS SYSTEM TABLES (IF ANY)
-- ==========================================
drop table if exists overtime_logs cascade;
drop table if exists employees cascade;
drop table if exists admins cascade;

-- ==========================================
-- 2. CREATE DATABASE TABLES
-- ==========================================

-- Admins Table
create table admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Employees Table (References auth.users)
create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  emp_id text unique not null,
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

-- Overtime Logs Table
create table overtime_logs (
  id uuid primary key default gen_random_uuid(),
  emp_id text references employees(emp_id) on delete cascade,
  employee_name text not null,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  total_hours numeric(5, 2) default 0.00,
  overtime_hours numeric(5, 2) default 0.00,
  notes text,
  created_at timestamptz default now()
);

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
alter table admins enable row level security;
alter table employees enable row level security;
alter table overtime_logs enable row level security;

-- ==========================================
-- 4. CONFIGURE RLS POLICIES
-- ==========================================

-- [Admins Table Policies]
-- Anyone can query the admins table to check if their email matches an admin record
create policy "Admins can view admins table" on admins
  for select using (true);

-- [Employees Table Policies]
-- A user can see their own profile info
create policy "Users can view own employee profile" on employees
  for select using (auth.uid() = id);

-- Admins can view all employee profiles
create policy "Admins can view all employee profiles" on employees
  for select using (
    exists (select 1 from admins where email = auth.jwt()->>'email')
  );

-- Users can insert their own profile info
create policy "Users can insert own employee profile" on employees
  for insert with check (auth.uid() = id);

-- Users can update their own profile info
create policy "Users can update own employee profile" on employees
  for update using (auth.uid() = id);


-- [Overtime Logs Table Policies]
-- Users can view their own overtime logs
create policy "Users can view own logs" on overtime_logs
  for select using (
    exists (
      select 1 from employees
      where employees.id = auth.uid()
      and employees.emp_id = overtime_logs.emp_id
    )
  );

-- Admins can view all logs
create policy "Admins can view all logs" on overtime_logs
  for select using (
    exists (select 1 from admins where email = auth.jwt()->>'email')
  );

-- Users can insert their own logs
create policy "Users can insert own logs" on overtime_logs
  for insert with check (
    exists (
      select 1 from employees
      where employees.id = auth.uid()
      and employees.emp_id = overtime_logs.emp_id
    )
  );

-- Users can update their own logs (clock-out or edit)
create policy "Users can update own logs" on overtime_logs
  for update using (
    exists (
      select 1 from employees
      where employees.id = auth.uid()
      and employees.emp_id = overtime_logs.emp_id
    )
  );

-- Users can delete their own logs
create policy "Users can delete own logs" on overtime_logs
  for delete using (
    exists (
      select 1 from employees
      where employees.id = auth.uid()
      and employees.emp_id = overtime_logs.emp_id
    )
  );

-- ==========================================
-- 5. SEED INITIAL ADMINISTRATOR (Optional)
-- ==========================================
-- Change the email below to match your administrator email:
-- insert into admins (email) values ('admin@company.com');
```

---

## Local Setup Instructions

### 1. Environment Configuration
Create a `.env.local` file in the root directory and insert your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anonymous-public-key
```

### 2. Installing Dependencies
Install the required packages:
```bash
npm install
```

### 3. Launching Development Server
Start the Next.js server locally:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Creating an Administrator User
To grant administrative capabilities to a user account:
1. Log in or sign up via the app using the desired email.
2. In the Supabase SQL editor, run this insert query:
   ```sql
   insert into admins (email) 
   values ('the-user-email@domain.com');
   ```
3. Log out and log back in. The application will detect the email in the `admins` table, set `isAdmin=true` in the context state, and add the **Admin Panel** link to the navigation bar.

---

## Packing Project for Production
Check TypeScript compilation and verify package integrity:
```bash
npm run build
```
This command compiles the NextJS application into static optimization nodes ready for production hosting.
