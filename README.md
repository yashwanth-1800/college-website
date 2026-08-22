Use this as your `README.md`:

# Campus Emergency Response

A mobile-friendly campus emergency reporting prototype with role-based dashboards for Students, Volunteers, and Doctors.

## Features

- Students can submit emergency reports with type, location, description, and reported urgency.
- Reports receive a unique ID and remain saved after refresh.
- Volunteers can view incoming reports and update response progress.
- Doctors can view and resolve medical emergency cases.
- Filter reports by urgency, report status, and volunteer task status.
- Responsive design for mobile and desktop.
- Accessible form labels, validation messages, live status updates, and keyboard focus states.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `student@campus.edu` | `student123` |
| Volunteer | `volunteer@campus.edu` | `volunteer123` |
| Doctor | `doctor@campus.edu` | `doctor123` |

## Run locally

1. Download or clone this repository.
2. Open C:/Users/yashwanth/Documents/Codex/2026-08-22/github-plugin-github-openai-curated-remote-2/outputs/campus-emergency-app/index.html in a modern web browser.
3. Choose a role and sign in using a demo account.

No installation, backend, or API key is required.

## Workflow

- **Student:** submits and tracks their emergency reports.
- **Volunteer:** reviews all reports and sets a task to `Not yet`, `On it`, or `Done`.
- **Doctor:** reviews medical reports and marks completed medical cases as `Resolved`.

## Technology

- HTML
- CSS
- JavaScript
- Browser `localStorage` for reports
- Browser `sessionStorage` for the demo session

## Important note

This is an educational prototype. The login system uses hard-coded demo credentials in the browser and is **not secure**. A real emergency-response system would require a backend, secure authentication, server-side role authorization, encryption, auditing, and privacy controls.

## Project structure

```text
├── index.html
├── style.css
├── script.js
└── auth.js
```
