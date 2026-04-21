# Development Timeline — Hostel Management System

**Project:** Hostel Management System (HMS)
**Owner:** Final Year CS Student (solo developer)
**Planning horizon:** 16 weeks
**Stack:** Django 5.x + DRF (backend), Next.js 14 (frontend), SQLite (dev) / PostgreSQL (prod), Arkesel (SMS), Paystack (payments)

> This timeline assumes ~20–25 focused hours per week alongside other coursework. If you can give it 35+ hours per week, compress each phase by roughly 25%. If you're falling behind by Week 8, fall back to the pure-Django path in PRD §4.2 — this is your pre-committed contingency, not a failure.

---

## Milestone Overview

| # | Milestone | Weeks | End state |
|---|---|---|---|
| M1 | Foundation & Auth | 1–3 | User can register via phone+OTP, JWT works, Django admin reachable |
| M2 | Hostels & Rooms (Admin side) | 4–6 | Hostel Admin can submit hostel with photos, video, variants, rooms |
| M3 | Approval Flow & Public Browsing | 7–8 | Super Admin approves; Student can browse and view hostel details |
| M4 | Booking & Payment | 9–11 | Full booking + Paystack round-trip, shared-occupancy pricing working |
| M5 | Notifications, Roommates, Privacy | 12–13 | SMS notifications live; roommate info renders with privacy toggles |
| M6 | Polish, Testing, Deployment | 14–15 | All tests pass, deployed to a public URL, seed data in place |
| M7 | Documentation, Defense Prep | 16 | Report, slides, dry-run of defense |

---

## Phase 0 — Pre-Flight (Before Week 1)

Do these **before you start the clock**. They can block you for days if you start them in-sprint.

- [ ] Register Arkesel account → request Sender ID approval (24–48h lead time).
- [ ] Register Paystack account → get test keys immediately; start business verification for live keys in parallel.
- [ ] Create GitHub repo, initialize with README, `.gitignore`, MIT or similar license.
- [ ] Set up project board (GitHub Projects or Linear) with the PRD's functional requirement IDs (FR-1 … FR-12) as epics.
- [ ] Pick a branch strategy (recommend: trunk-based, feature branches merged daily).
- [ ] Agree with supervisor on defense date → work backwards from there; the 16 weeks below should end **at least 1 week before defense**.

---

## Week 1 — Scaffolding

**Goal:** Empty-but-wired Django + Next.js apps talking to each other.

- Day 1–2: Django project. Virtualenv, `django-admin startproject`, create the 7 apps listed in PRD §5.2. Custom `User` model using `phone` as `USERNAME_FIELD`. Run initial migrations on SQLite.
- Day 3: DRF installed, `SimpleJWT` wired, dummy `/api/v1/ping/` endpoint returning `{"status": "ok"}`.
- Day 4: Next.js 14 app scaffolded with App Router + Tailwind. API client (axios or fetch wrapper) set up with JWT interceptor stub.
- Day 5: `.env.example` written for both repos. `django-environ` reading secrets. CORS configured on Django for `localhost:3000`.
- Day 6–7: Seed script (`manage.py seed_demo`) that creates 1 super admin, 2 hostel admins, 5 students. README explains how to run both servers.

**Exit criteria:** `git pull && make dev` (or equivalent) brings the whole system up. `/api/v1/ping/` returns OK when called from the Next.js frontend.

---

## Week 2 — Phone+OTP Auth (FR-1)

**Goal:** Users can register and log in with phone + OTP. This is the single highest-risk module — Arkesel, rate limiting, OTP lifecycle, and JWT rotation all meet here.

- `OTPCode` model + hashing.
- `ArkeselAdapter` class with a `send(phone, message)` method and a `ConsoleAdapter` sibling for dev (prints to stdout instead of sending real SMS).
- `/auth/otp/request/` endpoint with the rate-limits from PRD FR-1.5.
- `/auth/otp/verify/` endpoint — if phone is new, create user in the role the request header declares (`X-HMS-Registration-Role: STUDENT|HOSTEL_ADMIN`).
- JWT issue + refresh + logout endpoints.
- Phone normalization using the `phonenumbers` library (supports `0244…`, `+233244…`, `233244…`).
- Frontend: two login pages (`/student/login`, `/admin/login`), shared OTP input component with resend countdown.
- **Tests:** OTP rate limit, expired OTP, wrong OTP, happy path, role-at-registration, phone normalization edge cases.

**Exit criteria:** You can register a student from a real phone via the Next.js UI using the console SMS adapter locally, and switch to Arkesel by flipping one env var.

---

## Week 3 — User Profiles, Roles, Privacy Settings (FR-12)

**Goal:** The account layer is feature-complete before you touch hostels.

- `StudentProfile` and `HostelAdminProfile` with the fields from PRD §10.2–10.3.
- `/me/` endpoint returning user + appropriate profile.
- `/me/student-profile/` and `/me/privacy/` PATCH endpoints.
- Profile photo upload (Pillow resize, store in `media/profile/`).
- Frontend: Student profile/settings page with privacy toggles (`NOBODY | ROOMMATES | HOSTELMATES`).
- DRF permission classes: `IsSuperAdmin`, `IsHostelAdmin`, `IsStudent`, `IsOwnerOfHostel`.
- **Tests:** privacy serializer applies correctly in both directions; a Hostel Admin cannot hit `/me/student-profile/`.

**Buffer:** 1 day at end of week for anything that slipped from Weeks 1–2.

---

## Week 4 — Hostels & Amenities (FR-2 partial)

**Goal:** A Hostel Admin can create a hostel (without rooms yet) via the API.

- `Hostel` model with full field set (PRD §10.4).
- `Amenity` seed command with ~15 common amenities (Wi-Fi, water tank, generator, kitchen, ensuite, study desk, …).
- `/admin/hostels/` CRUD endpoints (Hostel Admin role only). Create puts the hostel in `PENDING`.
- Frontend: Admin dashboard shell (sidebar with "My Hostels" / "Bookings" / "SMS" / "Settings").
- Frontend: Multi-step "Create Hostel" wizard — Step 1 (basic info) and Step 2 (amenities) only this week.
- **Tests:** a Hostel Admin cannot edit another admin's hostel (FR-6.3 cross-tenant isolation test).

---

## Week 5 — Media Uploads (FR-4)

**Goal:** Photo and video upload pipeline robust enough for real-world use.

- `HostelMedia` model.
- `/admin/hostels/{id}/media/` POST accepting `multipart/form-data`.
- Server-side validation: MIME type, file size caps (image 10MB, video 50MB).
- Pillow thumbnail generation (400 / 1000 / full).
- Video: stored as-is in v1 (no transcoding). Expose metadata (duration) via `ffprobe` if available; otherwise skip.
- Frontend: drag-and-drop uploader with per-file progress bar (use `axios`'s `onUploadProgress`). Preview thumbs. Reorder by drag.
- **Tests:** oversized file rejected, non-image/video rejected, thumbnails generated on upload.
- **Gotcha to flag:** Next.js dev server proxy has a default body size limit — increase it, or upload directly to Django.

---

## Week 6 — Room Variants & Rooms (FR-3)

**Goal:** Full hostel creation wizard done; the 13-room / 2-variant example from the PRD works end-to-end in the admin UI.

- `RoomVariant` model with min/max/total_price (PRD §10.8).
- `Room` model (PRD §10.10) — `locked_k` starts as NULL.
- Validation: `min_occupancy ≥ 1`, `max_occupancy ≥ min_occupancy`, `total_price > 0`, room labels unique within variant.
- `/admin/hostels/{id}/variants/` POST.
- `/admin/variants/{id}/rooms/` POST — accepts bulk create (`["R1", "R2", "R3"]`).
- `/admin/variants/{id}/rooms/bulk/` for creating 8 rooms in one call (common case).
- Frontend: Wizard Step 3 (photos), Step 4 (create variants), Step 5 (add rooms to each variant), Step 6 (review & submit).
- **Tests:** variant validation, bulk-room creation, label uniqueness.

**Checkpoint end of Week 6:** A Hostel Admin can go from scratch to a fully submitted hostel with the 13-room / 2-variant structure described in the PRD. Show this to your supervisor.

---

## Week 7 — Super Admin Approval + "Create on Behalf" (FR-2.2–2.4, FR-9)

**Goal:** Approval gate in place and the tech-shy owner flow works.

- Super Admin dashboard scaffold (`/superadmin/*` routes, guarded by role).
- Pending hostel queue view with approve/reject actions.
- `/superadmin/hostels/{id}/approve/` and `/reject/` endpoints.
- "Create on behalf of owner" form — fills hostel form, picks/creates Hostel Admin account.
- `AuditLog` model + `@audit` decorator on approve/reject/on-behalf/deactivate actions.
- Email/SMS notification to owner on approval/rejection (stub the SMS for now, finalize in Week 12).
- **Tests:** only Super Admin can approve; on-behalf-created hostels auto-approve; audit log records all actions.

---

## Week 8 — Public Browsing & Hostel Detail Page (FR-5)

**Goal:** The student side starts looking like a product.

- `/hostels/` public endpoint with filters: price range, gender policy, amenities (multi), ordering.
- `/hostels/{slug}/` detail endpoint returning hostel + variants + rooms (availability summary) + media.
- Frontend: public landing page (hero, CTAs).
- Frontend: hostel grid with filters in a sidebar (desktop) / drawer (mobile).
- Frontend: hostel detail page with photo carousel, variant cards showing "3 rooms available / 1 partially booked / 2 full", embedded video player per variant.
- Frontend: "Contact owner" section displaying owner phone + WhatsApp deep link (`https://wa.me/233...`).
- **Tests:** only APPROVED hostels appear; filters combine correctly; pagination works.

**End of M3 demo moment.** Record a 2-minute screen capture for your supervisor.

---

## Week 9 — Booking Creation & Shared-Occupancy Logic (FR-6, §9)

**Goal:** The heart of the system. TDD this week — write §9.5 tests first.

- **Write all tests from PRD §9.5 first, red.**
- `Booking` and `Payment` models.
- `services/booking.py` with a `create_booking(student, room, chosen_occupancy)` function that:
  - Opens `transaction.atomic()`.
  - `SELECT ... FOR UPDATE` on Room.
  - If `room.locked_k` is NULL → validates `chosen_occupancy` in `[min, max]`, sets `locked_k`.
  - If not NULL → ignores `chosen_occupancy`, uses `locked_k`.
  - Validates slots remaining > 0.
  - Creates Booking in `PENDING_PAYMENT` with 15-minute expiry.
  - Returns booking.
- Background job (Django-Q2 scheduled task) that runs every minute, expires stale `PENDING_PAYMENT` bookings, releases their slots, unlocks `locked_k` if no other bookings remain.
- `/bookings/` POST endpoint calling the service.
- **All §9.5 tests green by Friday.**

---

## Week 10 — Paystack Integration (FR-11)

**Goal:** Money can move (in test mode, real flow).

- `services/paystack.py` adapter — `initialize(amount_ghs, email, reference, callback_url)`, `verify(reference)`.
- `/payments/initialize/` called by booking-create response.
- `/payments/paystack/webhook/` with HMAC-SHA512 signature verification — reject unsigned or wrongly-signed requests with 401.
- Webhook handler is idempotent: look up `Payment` by `paystack_reference`; if already SUCCESS, return 200 without mutation.
- On SUCCESS webhook → transition Booking to CONFIRMED, decrement room slots, trigger confirmation SMS job (next week).
- Frontend: Paystack redirect flow. Callback page polls `/bookings/{id}/` until status changes (max 30s), else shows "Still processing — we'll SMS you".
- **Tests:** webhook signature rejection, idempotency (same event twice), partial payment → still pending, failed payment → cancelled.
- **Smoke test:** full flow with Paystack test cards (`4084 0840 8408 4081` etc.) and the Paystack test MoMo number.

---

## Week 11 — Booking UI, Cancellation, Student Dashboard (FR-6 cont., FR-7)

**Goal:** The student-side booking experience is polished.

- Frontend: booking flow UI. Variant → room picker → occupancy slider → price preview → "Pay with Paystack" CTA.
- Student dashboard: "My Bookings" list with status pills, countdown timer for `PENDING_PAYMENT`.
- Booking detail page: shows room, hostel, payment, and a Roommates section (stub data this week; wire up Week 12).
- `/bookings/{id}/cancel/` endpoint (student-initiated, only while PENDING_PAYMENT or CONFIRMED-not-checked-in).
- Mobile responsive pass on all student screens.

**Buffer:** 2 days this week for bugs from Weeks 9–10, which will have shaken out by now.

---

## Week 12 — SMS Notifications & Broadcasts (FR-10)

**Goal:** All transactional SMS flowing through Arkesel; Hostel Admin can broadcast.

- Move `ArkeselAdapter` to production mode (it was behind console adapter during dev).
- Template keys: `otp`, `booking_confirmed`, `payment_received`, `hostel_approved`, `hostel_rejected`, `check_in_reminder`, `custom_broadcast`.
- `SMSMessage` logging on every send.
- Retry with exponential backoff (3 attempts, 30s / 2min / 10min).
- `/admin/hostels/{id}/sms-broadcast/` endpoint: accepts message body, enqueues one job per booked student.
- Frontend: Hostel Admin "Send SMS" page with character counter, segment count (160/306/459), audience preview, cost estimate.
- Scheduled task for `check_in_reminder` — runs daily at 08:00, SMS any booking with expected check-in tomorrow.
- **Tests:** retry on Arkesel 500, idempotency (don't double-send), broadcast only targets current hostel's bookers.

---

## Week 13 — Roommates & Privacy Enforcement (FR-7, FR-12 cont.)

**Goal:** The most human-facing feature done properly.

- `/me/bookings/{id}/roommates/` endpoint that:
  - Finds all other CONFIRMED bookings on the same Room.
  - Applies each other student's privacy settings to their fields before returning.
  - Includes a `"slots_open": N` field if the room isn't full.
- Frontend: "Roommates" section on booking detail page. Card per roommate. "Slot open" placeholder.
- Reverse test: when Student A's privacy is `NOBODY` on phone, Student B should see `phone: null` — assert serializer never leaks.
- Hostel Admin view of bookings: shows full student contact info (admin has a legitimate need).
- **Tests:** privacy matrix (3 privacy levels × 3 viewer contexts: roommate / hostel-mate / random student).

---

## Week 14 — Testing, Performance, Polish

**Goal:** The app feels shippable.

- Run full test suite in CI (GitHub Actions): lint, type-check (mypy or pyright — optional), pytest with coverage, frontend build.
- Target 80%+ backend coverage on the `bookings`, `payments`, `accounts` apps. Others 60%+ is fine.
- Lighthouse audit on the three key pages (landing, hostel detail, booking). Target Performance ≥85 on mobile.
- Add loading states to every async action. Empty states for every list view.
- 404 page, 500 page, maintenance banner support.
- Accessibility pass: keyboard-nav the booking flow, alt text on photos, focus rings, aria-labels.
- README in each repo: setup, env vars, seed data, test commands, deployment notes.

---

## Week 15 — Deployment & Monitoring

**Goal:** Publicly accessible on a URL your supervisor can hit.

- Migrate to PostgreSQL locally — fix any SQLite-specific queries.
- Backend deploy: Railway or Render (Django) with Postgres add-on. Or $5 DigitalOcean droplet + Caddy + systemd if you want the experience.
- Frontend deploy: Vercel (Next.js's native home).
- Media: for the demo, local disk + Whitenoise for static. **Noted in defense:** production should use S3-compatible (e.g., Backblaze B2 for cost).
- Environment variables set on both platforms. Paystack webhook URL updated in Paystack dashboard.
- Smoke test: register a student on the live URL with a real phone, book a real room at GHS 1.00, pay with a Paystack test card, receive real SMS.
- Set up Sentry (free tier) for error tracking on both FE and BE.
- Seed the production DB with 5–8 realistic hostels (Google real hostels around your campus, use stock photos, make up 2–3 variants each).

---

## Week 16 — Documentation & Defense Prep

**Goal:** Walk in confident.

- **Project report.** Stick to your institution's template. Map sections to this PRD where possible.
- **Architecture diagrams** (use draw.io or Excalidraw). Export as PNGs for the report.
- **ERD** of the data model. Use `pygraphviz` via `manage.py graph_models` (django-extensions) or hand-draw.
- **Slides.** Max 20 slides. Structure:
  1. Problem
  2. Objectives
  3. Literature review / existing solutions
  4. Methodology
  5. Architecture
  6. Key design decisions (tech stack, concurrency, shared-occupancy logic)
  7. Demo (4–5 min live demo — practice this 3 times)
  8. Testing approach & coverage
  9. Deployment
  10. Limitations & future work
  11. Conclusion
- **Dry-run the defense** twice with a friend. Record yourself once.
- **Prepare answers** to the likely questions:
  - "Why Django + Next.js instead of just Django?" → PRD §4.1
  - "How do you prevent double-booking?" → PRD §9.4 concurrency section
  - "Why SQLite and not PostgreSQL?" → PRD §4.3
  - "How is the student's data protected?" → PRD §14
  - "What happens if Paystack is down?" → webhook retries + manual verify fallback
  - "How does your pricing work for shared rooms?" → walk through the §9.3 example

---

## Risk-Adjusted Plan — If You Fall Behind

Three explicit descope points, each pre-committed. If you hit the trigger, take the cut — don't try to ship everything at a lower quality.

### Trigger 1 — End of Week 5, still fighting auth/media

**Cut:** Drop Next.js. Switch frontend to Django templates + HTMX + Alpine.js. You keep all backend work; you lose the SPA UX and ~1 week of frontend velocity but regain 3+ weeks going forward.

### Trigger 2 — End of Week 10, booking or Paystack still broken

**Cut:** Drop real Paystack. Implement a "Mark as Paid" button in the Hostel Admin view that simulates the webhook. Show the Paystack code in your report but run the demo with the stub. Paystack integration is a one-week task you can revisit post-submission.

### Trigger 3 — End of Week 13, notifications unreliable

**Cut:** Drop SMS broadcast (FR-10.2). Keep only transactional SMS (OTP, booking confirmation). This is the feature most likely to slip and least likely to be probed in defense if the core booking flow is solid.

---

## Weekly Rituals

- **Monday:** 30-minute planning. Pick tasks from this doc, break into ≤4-hour chunks, move to "In Progress".
- **Wednesday:** Mid-week check — am I on track? If not, what am I cutting?
- **Friday:** Demo to yourself. If something's not demoable, it's not done. Commit + push. Update supervisor once every 2 weeks.
- **Sunday:** Read next week's section of this doc. Pre-flight research (docs, examples) for unfamiliar tech.

---

## Definition of Done (for every feature)

A feature ships when:

1. Endpoint(s) return correct data with happy path + 2 error cases.
2. At least one unit test covers the core logic.
3. Frontend renders the feature on both mobile (360px) and desktop (1280px).
4. Loading state + error state designed.
5. Merged to main. Staging deploy updated (from Week 15 on).
6. Referenced functional requirement ID from PRD is ticked off in the project board.

---

*End of timeline. Good luck — ship steadily, cut ruthlessly, sleep sometimes.*
