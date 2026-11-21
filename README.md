# Library Management System

A server-rendered Library Management System built with **Node.js, Express, MongoDB/Mongoose and EJS**.

## Features

- Admin sign-in with credentials stored in environment variables.
- Dashboard counts for students, seats, books, available copies, issued books and overdue books.
- Student create, list, search, view, edit and delete.
- Seat creation, assignment to one active student, release, maintenance mode and deletion.
- Book inventory create, list, search, edit and delete.
- Book issue and return workflow with automatic available-copy updates.
- Issue history with Issued, Returned and Overdue filters.
- JSON backup download for the library collections.
- MongoDB-backed session storage, CSRF checks, login rate limiting and security headers.

## Requirements

- Node.js 18.18 or newer
- npm
- MongoDB Atlas or another MongoDB deployment

## Setup

1. Extract the project folder.
2. Open a terminal inside `library-management-system`.
3. Install packages:

   ```bash
   npm install
   ```

4. Create your environment file:

   **Windows PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**
   ```bash
   cp .env.example .env
   ```

5. Open `.env` and update these values:
   - `MONGODB_URI`: your MongoDB connection string. Replace the placeholders with your Atlas username, password, cluster host and database name.
   - `SESSION_SECRET`: a long random secret of at least 32 characters.
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD`: credentials for the Admin Panel.

6. In MongoDB Atlas, add your current public IP in **Network Access** and ensure the database user has read/write access to the target database.
7. Start the project:

   ```bash
   npm run dev
   ```

   For normal use:

   ```bash
   npm start
   ```

8. Open `http://localhost:3000/admin/login` in your browser and sign in with the admin credentials from `.env`.

## MongoDB notes

The application connects to the database configured in `MONGODB_URI`. Mongoose creates the required collections and indexes when records are first saved. The session store uses the same MongoDB connection.

Do not commit `.env` or share your MongoDB URI. Keep database credentials private. For production, use a strong unique admin password, a long random `SESSION_SECRET`, HTTPS, and a restricted MongoDB Network Access allowlist.

## Project structure

```text
library-management-system/
├── app.js
├── package.json
├── .env.example
├── config/
│   └── database.js
├── controllers/
│   ├── authController.js
│   ├── backupController.js
│   ├── booksController.js
│   ├── dashboardController.js
│   ├── issuesController.js
│   ├── seatsController.js
│   └── studentsController.js
├── middleware/
│   ├── auth.js
│   ├── csrf.js
│   ├── errorHandler.js
│   └── flash.js
├── models/
│   ├── Book.js
│   ├── Issue.js
│   ├── Seat.js
│   └── Student.js
├── routes/
│   ├── adminRoutes.js
│   └── authRoutes.js
├── utils/
│   ├── asyncHandler.js
│   └── validation.js
├── views/
│   ├── auth/
│   ├── books/
│   ├── dashboard/
│   ├── issues/
│   ├── partials/
│   ├── seats/
│   ├── students/
│   └── error.ejs
└── public/
    ├── css/app.css
    └── js/app.js
```

## Important workflow rules

- A student can have only one seat assigned at a time.
- An assigned seat must be released before it can be deleted or placed under maintenance.
- A student cannot be deleted while a seat is assigned or a book is still issued to them.
- An inactive student cannot receive a new seat or book issue.
- A book cannot be deleted while any copy is currently issued.
- Editing a book's total copies preserves the number of copies already issued. The new total cannot be lower than the number currently issued.
- Returning an issue increases the book's available-copy count once. An already returned issue cannot be returned again.
- Due dates earlier than issue dates are rejected.

## Backup

Use **Download Backup** in the sidebar to download a JSON file containing the students, seats, books and issue records. Store backup files securely; they contain library records and personal information.

## Notes / scope

This is a single-organisation Admin Panel. It does not include public student login, online registration approval, fine calculation, email/SMS notifications, multi-branch support or role-based staff accounts. Those can be added separately if required.
