# Product Requirements Document (PRD)
## Hostel Management System (HMS)

**Document Version:** 1.0
**Last Updated:** April 2026
**Prepared for:** Final Year Undergraduate Project — Computer Science
**Author:** [Your Name]
**Institution:** [Your University]

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Objectives](#2-problem-statement--objectives)
3. [Target Users & Personas](#3-target-users--personas)
4. [Tech Stack Rationale](#4-tech-stack-rationale)
5. [System Architecture](#5-system-architecture)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Functional Requirements](#7-functional-requirements)
8. [Detailed Feature Specifications](#8-detailed-feature-specifications)
9. [Room Variant & Shared-Occupancy Pricing Logic](#9-room-variant--shared-occupancy-pricing-logic)
10. [Data Model](#10-data-model)
11. [API Design Overview](#11-api-design-overview)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Security & Privacy](#14-security--privacy)
15. [Assumptions, Constraints & Out of Scope](#15-assumptions-constraints--out-of-scope)
16. [Success Metrics / Acceptance Criteria](#16-success-metrics--acceptance-criteria)
17. [Risks & Mitigations](#17-risks--mitigations)
18. [Glossary](#18-glossary)

---

## 1. Executive Summary

The Hostel Management System (HMS) is a web-based platform that connects students with verified hostel accommodation around their university. It supports three classes of users: a **Super Admin** who oversees the platform, **Hostel Admins** (owners/managers) who list and manage their properties, and **Students** who browse, book, and pay for rooms.

The system handles the full booking lifecycle: hostel and room listing with photos and video walkthroughs, room browsing and filtering, booking of individual rooms or individual slots within shared rooms, mobile money / card payment via Paystack, and transactional + marketing SMS notifications via Arkesel. Authentication for all end users is phone-number based with OTP verification.

Scope is tailored for a Ghanaian university context, with all pricing in GHS, SMS sender IDs registered with Arkesel, and payment flows via Paystack Ghana.

---

## 2. Problem Statement & Objectives

### 2.1 Problem

At most Ghanaian universities, hostel booking is informal: students physically walk from hostel to hostel, often during a short registration window, to inspect rooms and pay cash or mobile money directly to caretakers. This creates several recurring problems:

- Freshers, who don't yet know the area, have no reliable way to compare hostels before arriving on campus.
- Hostel owners have no central channel to advertise available rooms or communicate with booked students.
- Room availability information is stale by the time a student travels to view a room.
- There is no verifiable record of booking, payment, or roommate pairing.

### 2.2 Objectives

The system must:

1. Let students browse hostels, view photos **and a short video walkthrough** of each room, and filter by price, location, and amenities.
2. Let students book a whole room or a slot within a shared room, with pricing that adjusts fairly based on chosen occupancy.
3. Handle payments digitally via Paystack (card + mobile money).
4. Let hostel owners manage their hostels, rooms, bookings, and communicate with booked students via SMS.
5. Let a Super Admin gate hostel listings through an approval workflow to prevent fraudulent or substandard listings.
6. Authenticate users by phone + OTP (no passwords for students), because phone numbers are the primary identifier in this context.

### 2.3 Non-Goals (for this version)

- No in-app chat (SMS is sufficient for v1).
- No long-term lease management beyond one academic year.
- No utilities billing, maintenance ticketing, or visitor logs.
- No native mobile app (mobile-responsive web only).

---

## 3. Target Users & Personas

### 3.1 Student — "Ama, 19, Fresher"
First year, has never been to the campus town. Has a smartphone, pays with MTN MoMo. Wants to secure a room *before* arriving, compare prices, and know who her roommate will be.

### 3.2 Student — "Kwame, 21, Continuing"
Lived in a hostel last year, knows the area. Wants to rebook quickly, possibly switch hostels, and wants to see which of his friends have booked where.

### 3.3 Hostel Admin — "Mr. Owusu, 48, Tech-Shy Owner"
Owns a 40-room hostel. Owns a smartphone but avoids complex apps. Needs the Super Admin to set up his hostel for him, but wants to send bulk SMS updates to his tenants himself.

### 3.4 Hostel Admin — "Akosua, 32, Multi-Hostel Manager"
Manages two hostels on behalf of her uncle. Comfortable with technology. Needs to switch between hostels in a single session.

### 3.5 Super Admin — Platform Operator
Reviews and approves new hostel submissions, onboards tech-shy owners, monitors platform health, handles disputes, manages payouts reconciliation (manual in v1).

---

## 4. Tech Stack Rationale

### 4.1 Recommended Stack — Django + DRF + Next.js

| Layer | Choice | Reason |
|---|---|---|
| Backend | Django 5.x + Django REST Framework | Batteries-included admin, ORM, auth, migrations. DRF gives clean API surface. |
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Good SEO for public hostel listings (server-rendered), clean client-side booking flows. |
| Database (dev) | SQLite 3 | Zero-config for defense demo. |
| Database (prod recommendation) | PostgreSQL 15+ | See §4.3 — important for booking concurrency. |
| File storage | Django `FileField` → local disk (dev), S3-compatible (prod recommendation) | Videos especially benefit from object storage. |
| Task queue | Django-Q2 or Celery + Redis | For async SMS sending and Paystack webhook retries. |
| Auth | Custom phone+OTP via DRF SimpleJWT | No passwords for students; JWT sessions. |

### 4.2 Alternative — Pure Django (Templates + HTMX)

Viable if the timeline tightens. You'd lose the REST API layer but gain roughly 2–3 weeks of build time. Recommended only if you fall behind. For a final-year project being graded, the split stack demonstrates more skills (API design, CORS, JWT, SPA routing) and is likely to score better — assuming you budget the extra time.

### 4.3 On SQLite vs. PostgreSQL

SQLite is fine for development and for the defense demo. However, call out in your defense that production should use PostgreSQL because:

- **Booking concurrency.** Two students tapping "Book" on the last slot of a shared room at the same moment must not both succeed. This requires `SELECT ... FOR UPDATE` row-level locking, which SQLite does not support (SQLite serializes the entire database on writes, which happens to work but doesn't scale past a handful of concurrent users).
- **Full-text search** on hostel names and descriptions is much better in Postgres.
- **JSON field indexing** for amenities filtering is better in Postgres.

Examiners often ask about this. Have the answer ready.

### 4.4 On Next.js vs. Pure Django — What To Decide Today

Pick **Django + DRF + Next.js** if:
- You have ~16 weeks or more.
- You want a stronger portfolio piece.
- You're comfortable writing two codebases.

Pick **Django templates + HTMX** if:
- You have under 12 weeks.
- You have other heavy coursework running in parallel.
- You'd rather ship a polished monolith than a half-finished SPA.

This PRD is written such that either choice works — the API contracts in §11 are the authoritative interface regardless of whether the frontend is Next.js or Django templates.

---

## 5. System Architecture

### 5.1 High-Level Components

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                          │
│   (Public site · Student dashboard · Hostel Admin panel ·    │
│                   Super Admin panel)                          │
└─────────────────────────┬────────────────────────────────────┘
                          │  HTTPS / JSON (JWT)
┌─────────────────────────▼────────────────────────────────────┐
│                Django + DRF REST API                          │
│  ┌───────────────┬─────────────┬───────────────┬──────────┐  │
│  │ accounts (OTP)│   hostels   │   bookings    │ payments │  │
│  ├───────────────┼─────────────┼───────────────┼──────────┤  │
│  │notifications  │  reviews    │   uploads     │  admin   │  │
│  └───────────────┴─────────────┴───────────────┴──────────┘  │
└─────┬───────────────────┬──────────────────┬────────────────┘
      │                   │                  │
┌─────▼──────┐    ┌───────▼───────┐   ┌──────▼───────┐
│ PostgreSQL │    │  Arkesel SMS  │   │   Paystack   │
│  / SQLite  │    │    Gateway    │   │   Payments   │
└────────────┘    └───────────────┘   └──────────────┘
      ▲
      │
┌─────┴──────┐
│   Redis +  │
│   Q2/Celery│
│  (async)   │
└────────────┘
```

### 5.2 Django App Breakdown

| App | Responsibility |
|---|---|
| `accounts` | User model (custom), phone+OTP login, roles, profile, privacy settings |
| `hostels` | Hostel, RoomVariant, Room, Amenity, HostelMedia (photos + videos) |
| `bookings` | Booking, BookingSlot, booking state machine, roommate linkage |
| `payments` | PaystackTransaction, webhook receipt, refund record |
| `notifications` | SMS templates, send log, Arkesel adapter, broadcast jobs |
| `reviews` | Student reviews of hostels (optional v1.1) |
| `core` | Shared utilities, permissions, pagination, throttling |

---

## 6. User Roles & Permissions

Four roles, enforced at both the DRF permission layer and the frontend:

### 6.1 Super Admin
- Approves/rejects hostel submissions.
- Creates hostels on behalf of tech-shy owners, then transfers ownership to a Hostel Admin account.
- Can impersonate any Hostel Admin for support (audit-logged).
- Can deactivate any user or hostel.
- Views platform-wide metrics.

### 6.2 Hostel Admin
- Registers self via phone+OTP.
- Creates one or more hostels (each pending Super Admin approval).
- Manages rooms, room variants, photos, videos.
- Views bookings for their hostels only.
- Sends SMS notifications to their bookers only.
- Marks bookings as checked-in / checked-out.
- Cannot see other admins' hostels or data.

### 6.3 Student
- Registers via phone+OTP.
- Browses all approved hostels (public + authenticated views).
- Books rooms and pays via Paystack.
- Sees their own bookings and, subject to privacy settings, limited info about roommates.
- Updates own profile and privacy preferences.

### 6.4 Anonymous Visitor
- Browses approved hostels and views photos/videos.
- Sees pricing and availability.
- Must register + verify phone before attempting to book.

---

## 7. Functional Requirements

Numbered for traceability — reference these IDs in commit messages and test cases.

### FR-1 Authentication
- **FR-1.1** Phone number is the primary identifier for Students and Hostel Admins. Super Admin may additionally log in with email+password (seeded, not self-registered).
- **FR-1.2** OTP (6-digit numeric, 5-minute TTL, max 5 attempts, 60-second resend cooldown) sent via Arkesel SMS.
- **FR-1.3** Phone numbers must normalize to E.164 (`+233XXXXXXXXX`) regardless of how entered (`0244...`, `+233244...`, `233244...`).
- **FR-1.4** Successful OTP verification returns a JWT access token (1h) + refresh token (14d).
- **FR-1.5** OTP requests are rate-limited: max 3 per phone per 15 min, max 10 per IP per hour.

### FR-2 Hostel Listing & Approval
- **FR-2.1** A Hostel Admin can submit a new hostel with name, description, location (GPS point + text address), amenities, gender policy (male/female/mixed), and owner contact details (phone, optional WhatsApp).
- **FR-2.2** A submitted hostel is in status `PENDING` and not publicly visible.
- **FR-2.3** Super Admin sees a queue of pending hostels and can `APPROVE` or `REJECT` (with reason).
- **FR-2.4** On approval, the hostel becomes publicly visible and an SMS is sent to the Hostel Admin.
- **FR-2.5** Edits to an already-approved hostel re-enter pending status only if the change affects core fields (name, location, owner contact). Price, photo, and video edits are live immediately.

### FR-3 Rooms & Room Variants
- **FR-3.1** A hostel contains one or more **Room Variants**. A Room Variant describes a category of rooms that share identical features and pricing (e.g., "Standard Single", "Deluxe Double with AC").
- **FR-3.2** A Room Variant defines: name, description, total price (GHS), min occupancy, max occupancy, features (list), photos, optional video.
- **FR-3.3** A hostel admin creates individual **Rooms** belonging to a Variant. Each Room has a room number/label and belongs to exactly one Variant.
- **FR-3.4** A hostel may have any number of Variants; a Variant may contain any number of Rooms.
- **FR-3.5** Example (from spec): a 13-room hostel where rooms 1–5 are "Deluxe" variant (different price/features) and rooms 6–13 are "Standard" — this is representable as two Variants with 5 and 8 Rooms respectively.

### FR-4 Media (Photos + Videos)
- **FR-4.1** Each hostel has a gallery of photos (min 3 required at submission, no hard max; soft cap 20).
- **FR-4.2** Each Room Variant can have its own photos (min 1) and an optional **video walkthrough** (max 60 seconds, max 50 MB, mp4/webm).
- **FR-4.3** Videos are uploaded directly to the backend (v1) with a progress indicator; server transcodes are out of scope for v1 (uploaded video served as-is).
- **FR-4.4** Photos are resized server-side to 3 variants: thumbnail (400px), medium (1000px), full (original).

### FR-5 Browsing & Search
- **FR-5.1** Public listing page showing approved hostels with thumbnail, name, starting price, location.
- **FR-5.2** Filters: price range, gender policy, amenities (multi-select), distance from campus (if GPS available).
- **FR-5.3** Hostel detail page showing: gallery, video walkthroughs per variant, all variants with live availability, owner contact (phone + WhatsApp deep-link), location on map.
- **FR-5.4** Sort: price ascending/descending, newest, most booked.

### FR-6 Booking Flow
- **FR-6.1** Student selects a Room Variant, then selects a specific available Room, then selects desired occupancy (between variant's min and max).
- **FR-6.2** System computes `price_per_slot = total_price / chosen_occupancy` and shows the student the amount due.
- **FR-6.3** If the chosen occupancy is less than the variant max, the remaining slots remain bookable by others **at the same per-slot price the first booker established** (see §9 for full rules).
- **FR-6.4** Booking is created in status `PENDING_PAYMENT`; a Paystack payment intent is initiated.
- **FR-6.5** On successful Paystack webhook, booking transitions to `CONFIRMED` and the slot(s) are decremented from availability.
- **FR-6.6** If payment is not completed within 15 minutes, the reservation is released and the slot(s) return to the pool.

### FR-7 Roommate Information
- **FR-7.1** When a student is booked into a shared room, they can see other confirmed occupants of the same room in their dashboard.
- **FR-7.2** Fields visible by default: first name, program, level.
- **FR-7.3** Fields visible only if the other student's privacy settings allow it: full name, phone number, profile photo.
- **FR-7.4** A student can toggle each field's visibility to "Roommates only", "Nobody", or "Anyone in my hostel".

### FR-8 Hostel Admin Operations
- **FR-8.1** Dashboard showing: total rooms, occupied rooms, this-month revenue, pending check-ins.
- **FR-8.2** Bookings list filterable by status, date, variant.
- **FR-8.3** Ability to send an SMS blast to all currently-booked students of a given hostel (with character count and Arkesel cost estimate).
- **FR-8.4** Ability to send an SMS to a single student.
- **FR-8.5** Ability to mark a booking as checked-in, checked-out, or cancelled.

### FR-9 Super Admin Operations
- **FR-9.1** Hostel approval queue.
- **FR-9.2** User management (list, search, deactivate).
- **FR-9.3** "Create hostel on behalf of owner" flow: Super Admin fills the hostel form, then selects/creates a Hostel Admin account to assign ownership to.
- **FR-9.4** Platform metrics: total bookings, revenue (gross), active hostels, SMS credits consumed.
- **FR-9.5** Audit log of sensitive actions (approvals, deactivations, impersonations).

### FR-10 Notifications (SMS)
- **FR-10.1** Automated: OTP, booking confirmation, payment receipt, check-in reminder (1 day before), hostel approval decision.
- **FR-10.2** Manual broadcasts: Hostel Admin composes message → queued → delivered via Arkesel → delivery status logged.
- **FR-10.3** All SMS are logged with: recipient, sender role, template used, Arkesel message ID, delivery status, cost.

### FR-11 Payments
- **FR-11.1** Paystack Standard checkout (hosted) for v1 — simpler than inline and handles 3-D Secure, MoMo, and cards without custom UI.
- **FR-11.2** Webhook endpoint (`/api/payments/paystack/webhook/`) verifies signature, idempotently updates booking status.
- **FR-11.3** Every payment logs: amount, currency (GHS), Paystack reference, channel (card / mobile_money / bank), timestamp.
- **FR-11.4** Refunds are manual in v1: Super Admin triggers, Paystack API call is made, state recorded.

### FR-12 Privacy Controls
- **FR-12.1** Every student has a Privacy Settings page with per-field visibility toggles.
- **FR-12.2** Hostel owner phone number and WhatsApp are **always public** on the hostel detail page — the owner's contact is explicitly public by product design.

---

## 8. Detailed Feature Specifications

### 8.1 Phone + OTP Registration Flow

```
1. User enters phone number → normalized to E.164 → POST /api/auth/otp/request
2. Server rate-checks, generates 6-digit code, stores hashed code + expiry
3. Arkesel SMS sent: "Your HMS code is 482910. Valid for 5 minutes."
4. User enters code → POST /api/auth/otp/verify
5. On first verify for this number → account created in role chosen at entry
   (student flow vs. hostel-admin flow uses different entry pages)
6. JWT issued → user lands on role-appropriate dashboard
7. New users are prompted to complete their profile (name, etc.) as a one-time onboarding step
```

### 8.2 Hostel Submission Flow (Admin)

```
Step 1: Basic info (name, description, gender policy, address, GPS)
Step 2: Amenities (multi-select: Wi-Fi, water tank, generator, kitchen, etc.)
Step 3: Upload ≥3 hostel photos
Step 4: Create at least one Room Variant:
        - Variant name, description, total price, min/max occupancy
        - Features list (AC, ensuite bathroom, study desk, etc.)
        - ≥1 photo, optional video walkthrough
Step 5: Add Rooms to the Variant (room numbers/labels)
Step 6: (Optional) Add another Variant (back to Step 4)
Step 7: Review & submit → status PENDING → SMS to admin: "Your hostel is under review"
```

### 8.3 Booking Flow (Student)

```
1. Student on hostel detail page → picks a Variant → sees list of rooms in that variant
   (each labeled AVAILABLE, PARTIALLY_BOOKED [2/4 slots taken], or FULL)
2. Student picks a Room
3. Occupancy selector appears — range = [current_remaining_floor, max_occupancy]
   (see §9 for how current_remaining_floor is computed)
4. Student confirms occupancy → system shows price_per_slot × 1 = their total
5. Student clicks "Pay" → booking row created with status PENDING_PAYMENT
   → slots tentatively held (countdown 15:00)
6. Redirect to Paystack Standard checkout
7. On success callback → frontend polls /api/bookings/{id}
   OR webhook confirms server-side
8. Status → CONFIRMED → SMS to student + Hostel Admin
9. Booking appears in Student dashboard with room details + roommate info (if any)
```

### 8.4 Roommate Matching Display

When a student views a booking where `chosen_occupancy > 1`, the dashboard shows a "Roommates" section with one card per confirmed co-occupant. If slots are still open, it shows `"1 slot still open — another student may book this"`. Fields on each card are rendered only if the co-occupant's privacy settings permit.

### 8.5 Hostel Admin "Broadcast SMS" Flow

```
1. Admin picks hostel → "Send SMS to all bookers"
2. Compose area: up to 459 chars (3 SMS segments), live character counter + segment count
3. Audience preview: "Will reach 27 students"
4. Cost estimate: "Estimated cost: GHS 2.70 (27 recipients × 1 segment × GHS 0.10)"
   [rate is fetched from platform config, editable by Super Admin]
5. Admin clicks Send → job queued → each SMS dispatched via Arkesel
6. Delivery report auto-updates in the log view
```

### 8.6 Super Admin "Create Hostel on Behalf" Flow

```
1. Super Admin → "Create on behalf of owner"
2. Either pick existing Hostel Admin account OR
   enter owner's phone → system creates a Hostel Admin account in INVITED state
3. Super Admin fills the entire hostel form
4. On save → hostel is auto-APPROVED (skips the queue since Super Admin created it)
5. Ownership is assigned to the Hostel Admin account
6. SMS to owner: "A hostel '{name}' has been set up for you on HMS.
   Reply with code XXXXX to log in and manage it."
7. Owner completes OTP → lands in admin dashboard with hostel already populated
```

---

## 9. Room Variant & Shared-Occupancy Pricing Logic

This is the most subtle part of the system. Spec carefully and write tests first.

### 9.1 Terminology

- **Variant total_price** (`P`) — the price of the entire room when fully occupied, set by the hostel admin.
- **Variant min_occupancy** (`m`) — minimum occupants per room.
- **Variant max_occupancy** (`M`) — maximum occupants per room.
- **Chosen occupancy** (`k`) — the occupancy level the *first booker* of a given room commits to. `m ≤ k ≤ M`.
- **Price per slot** (`p`) — `P / k`, paid by every booker of that room.
- **Slots remaining** — `k − (count of confirmed bookings on the room)`.

### 9.2 Rules

1. The first person to book a room **sets `k`** by choosing their desired occupancy. Once set, `k` is locked for that room until all bookings on that room are cancelled/checked-out.
2. Subsequent bookers of the same room **cannot choose occupancy**; they inherit `k` and pay `p = P/k`.
3. If `k = 1` (solo booking), the room is immediately marked `FULL`.
4. If `k > 1`, the room is marked `PARTIALLY_BOOKED` until `k` slots are filled, then `FULL`.
5. A booker may only book **one slot at a time** per room (no "I'll pay for 2 slots myself" flow in v1).

### 9.3 Worked Example

Variant "Standard Double", P = GHS 3000, m = 1, M = 2. Room 7.

| Event | k | Slots filled | Slots remaining | Price paid this event | Room status |
|---|---|---|---|---|---|
| Initial | — | 0 | — | — | AVAILABLE |
| Ama books, chooses occupancy = 2 | 2 (locked) | 1 | 1 | GHS 1,500 | PARTIALLY_BOOKED |
| Kwame books Room 7 | 2 (inherited) | 2 | 0 | GHS 1,500 | FULL |

Alternative: Ama chose occupancy = 1 at step 2. Then k = 1, she pays GHS 3,000, Room 7 is immediately FULL, and Kwame cannot book Room 7.

### 9.4 Edge Cases

- **What if Ama cancels before Kwame books?** Room 7 reverts to AVAILABLE, k is unset, the next booker restarts the decision.
- **What if Ama cancels after Kwame has confirmed?** Ama's slot becomes available but k remains = 2. A new third party can claim the open slot at `p = 1500`. Kwame is not affected, is not re-billed.
- **What if the hostel admin wants to change P after a booking exists?** The change applies only to *future* bookings on currently-unoccupied rooms. Rooms with active bookings keep their locked `k` and `p`.
- **What if admin wants to change M downward?** Only allowed if no room in the variant currently has `k > newM`.
- **Concurrency.** Two people hitting "Book" on the last slot simultaneously: resolved by a `SELECT ... FOR UPDATE` on the Room row inside a DB transaction when creating the BookingSlot. (This is why PostgreSQL is recommended for production — see §4.3.)

### 9.5 Tests to Write (hand these directly to pytest)

- `test_solo_booking_locks_room_full`
- `test_shared_booking_locks_k_for_subsequent_bookers`
- `test_subsequent_booker_cannot_change_k`
- `test_cancellation_before_k_locked_resets_room`
- `test_cancellation_after_k_locked_keeps_k`
- `test_admin_cannot_reduce_max_below_active_k`
- `test_concurrent_last_slot_only_one_wins` (uses threading + transaction.atomic)

---

## 10. Data Model

Key tables. `FK` = foreign key, `→` = reference. Nullable fields marked `?`.

### 10.1 `User` (custom, extends AbstractBaseUser)
```
id (UUID, PK)
phone (str, unique, E.164)
role (enum: SUPER_ADMIN | HOSTEL_ADMIN | STUDENT)
first_name, last_name, email?
is_active, is_verified
date_joined, last_login
```

### 10.2 `StudentProfile` (1:1 with User where role=STUDENT)
```
user FK → User
program (str)
level (enum: 100..400, Masters, PhD)
gender
profile_photo (ImageField?)
privacy_phone (enum: NOBODY | ROOMMATES | HOSTELMATES)
privacy_full_name (enum)
privacy_photo (enum)
```

### 10.3 `HostelAdminProfile` (1:1 with User where role=HOSTEL_ADMIN)
```
user FK → User
business_name (str)
whatsapp_number? (str)
id_document? (FileField)  # optional KYC
is_tech_setup_required (bool)  # set true if onboarded by Super Admin
```

### 10.4 `Hostel`
```
id (UUID, PK)
owner FK → User (HOSTEL_ADMIN)
name (str)
slug (str, unique)
description (text)
address_text (str)
latitude, longitude (decimal?)
gender_policy (enum: MALE | FEMALE | MIXED)
owner_contact_phone (str)   # displayed publicly
owner_contact_whatsapp? (str)
status (enum: DRAFT | PENDING | APPROVED | REJECTED | SUSPENDED)
rejection_reason? (text)
created_by_super_admin (bool)
created_at, updated_at
```

### 10.5 `Amenity`
```
id (PK), name (str, unique), icon (str)   # seeded list
```

### 10.6 `HostelAmenity` (M2M)
```
hostel FK, amenity FK
```

### 10.7 `HostelMedia`
```
id, hostel FK → Hostel
type (enum: PHOTO | VIDEO)
file (File/Image)
caption?
display_order (int)
```

### 10.8 `RoomVariant`
```
id (UUID, PK)
hostel FK → Hostel
name (str)
description (text)
total_price (decimal, GHS)
min_occupancy (int, ≥1)
max_occupancy (int, ≥ min_occupancy)
features (JSONField: list of str)
created_at
```

### 10.9 `RoomVariantMedia`
```
id, variant FK → RoomVariant
type (PHOTO | VIDEO)
file, caption?, display_order
```

### 10.10 `Room`
```
id (UUID, PK)
variant FK → RoomVariant
label (str, e.g. "A12", "Room 7")
locked_k (int?)     # null if no active bookings; set when first booking confirms
status (enum: AVAILABLE | PARTIALLY_BOOKED | FULL | UNAVAILABLE)

UNIQUE(variant, label)
```

### 10.11 `Booking`
```
id (UUID, PK)
student FK → User
room FK → Room
chosen_occupancy_at_booking (int)   # = locked_k for this booking
price_paid (decimal)
status (enum: PENDING_PAYMENT | CONFIRMED | CANCELLED | CHECKED_IN | CHECKED_OUT | EXPIRED)
reservation_expires_at (datetime?)   # for the 15-min hold
created_at, updated_at
```

### 10.12 `Payment`
```
id, booking FK → Booking
paystack_reference (str, unique)
amount, currency (default GHS)
channel (str: card | mobile_money | ...)
status (enum: INITIATED | SUCCESS | FAILED | REFUNDED)
paystack_raw (JSONField)
created_at, verified_at?
```

### 10.13 `OTPCode`
```
id, phone (str), code_hash (str), attempts (int), expires_at, consumed_at?
```

### 10.14 `SMSMessage`
```
id, to_phone, from_role (SUPER_ADMIN|HOSTEL_ADMIN|SYSTEM),
sent_by FK → User?, body (text), template_key?,
arkesel_message_id?, status, cost?, created_at
```

### 10.15 `AuditLog`
```
id, actor FK → User?, action (str), target_type, target_id, meta (JSON), created_at
```

### 10.16 Key Indexes
- `User.phone` (unique)
- `Hostel.status` (partial index on PENDING for admin queue)
- `Room.status`, `Room.variant` (composite for availability queries)
- `Booking.student`, `Booking.room`, `Booking.status`
- `Payment.paystack_reference` (unique)

---

## 11. API Design Overview

REST, JSON, JWT-bearer auth. Prefix: `/api/v1/`. All list endpoints paginated (page size 20 default, 100 max).

### 11.1 Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/otp/request/` | Request OTP for phone |
| POST | `/auth/otp/verify/` | Verify OTP, return JWTs |
| POST | `/auth/refresh/` | Refresh JWT |
| POST | `/auth/logout/` | Revoke refresh token |
| GET  | `/auth/me/` | Current user + profile |

### 11.2 Students
| Method | Path | Description |
|---|---|---|
| PATCH | `/me/student-profile/` | Update profile |
| PATCH | `/me/privacy/` | Update privacy settings |
| GET   | `/me/bookings/` | List my bookings |
| GET   | `/me/bookings/{id}/roommates/` | Roommate info (filtered by privacy) |

### 11.3 Public Hostels
| Method | Path | Description |
|---|---|---|
| GET | `/hostels/` | List approved hostels, filters via query params |
| GET | `/hostels/{slug}/` | Detail with variants, rooms, media |
| GET | `/hostels/{slug}/variants/{id}/availability/` | Real-time slot availability |

### 11.4 Hostel Admin
| Method | Path | Description |
|---|---|---|
| POST  | `/admin/hostels/` | Create (pending) |
| GET   | `/admin/hostels/` | Mine only |
| PATCH | `/admin/hostels/{id}/` | Edit (may reset status) |
| POST  | `/admin/hostels/{id}/media/` | Upload photo/video |
| POST  | `/admin/hostels/{id}/variants/` | Create variant |
| POST  | `/admin/variants/{id}/rooms/` | Create room |
| GET   | `/admin/hostels/{id}/bookings/` | Bookings on my hostel |
| POST  | `/admin/hostels/{id}/sms-broadcast/` | Bulk SMS to bookers |
| POST  | `/admin/bookings/{id}/check-in/` | Mark checked-in |

### 11.5 Bookings
| Method | Path | Description |
|---|---|---|
| POST | `/bookings/` | Create (room_id, chosen_occupancy) → initiates payment |
| GET  | `/bookings/{id}/` | Detail (owner or hostel admin only) |
| POST | `/bookings/{id}/cancel/` | Cancel (student, before check-in) |

### 11.6 Payments
| Method | Path | Description |
|---|---|---|
| POST | `/payments/initialize/` | Called by booking creation; returns Paystack authorization_url |
| POST | `/payments/paystack/webhook/` | Paystack → us (verify signature) |
| GET  | `/payments/{id}/` | Status poll |

### 11.7 Super Admin
| Method | Path | Description |
|---|---|---|
| GET  | `/superadmin/hostels/pending/` | Approval queue |
| POST | `/superadmin/hostels/{id}/approve/` | Approve |
| POST | `/superadmin/hostels/{id}/reject/` | Reject with reason |
| POST | `/superadmin/hostels/on-behalf/` | Create-on-behalf flow |
| GET  | `/superadmin/users/` | User list + deactivate |
| GET  | `/superadmin/metrics/` | Platform KPIs |
| GET  | `/superadmin/audit-log/` | Audit entries |

---

## 12. Third-Party Integrations

### 12.1 Arkesel SMS

- **Endpoint (send):** `POST https://sms.arkesel.com/api/v2/sms/send` (confirm against their current docs during setup — Arkesel versions their API).
- **Auth:** `api-key` header.
- **Sender ID:** Registered short alphanumeric, e.g. `HMS` or your chosen brand name (must be approved by Arkesel — allow 24–48 hours).
- **Expected payload fields:** `sender`, `message`, `recipients[]`.
- **Use for:** OTP (synchronous, blocking), booking confirmations (async via queue), broadcasts (async), check-in reminders (cron).
- **Error handling:** Arkesel non-200 → retry with exponential backoff up to 3 times. Persistent failure → log + surface to admin.
- **Cost tracking:** Parse Arkesel response `cost` field (if present) into `SMSMessage.cost`; else apply a configured per-segment rate.

**Implementation note:** wrap all Arkesel calls behind a single `notifications.adapters.arkesel.ArkeselAdapter` class so the rest of the codebase doesn't touch the HTTP client directly. This lets you swap providers or fake in tests easily.

### 12.2 Paystack

- **Mode:** Standard (redirect) checkout for v1.
- **Endpoints:**
  - Initialize: `POST https://api.paystack.co/transaction/initialize` → returns `authorization_url` and `reference`.
  - Verify: `GET https://api.paystack.co/transaction/verify/{reference}` (fallback polling).
  - Webhook: Paystack POSTs to your `/api/v1/payments/paystack/webhook/`.
- **Auth:** `Authorization: Bearer <SECRET_KEY>` header. Use test keys in dev, live keys only after Paystack approves your business.
- **Amount units:** Paystack expects amounts in **kobo/pesewas** (smallest unit) — always multiply GHS amount by 100 when sending, divide by 100 when displaying.
- **Webhook verification:** Verify the `x-paystack-signature` HMAC-SHA512 header using your Paystack secret key. Reject any request that fails verification.
- **Idempotency:** Store `paystack_reference` as the unique key on Payment. Webhook handler is idempotent — receiving the same event twice must not double-update the booking.
- **Channels enabled:** Card, Mobile Money (MTN, Vodafone/Telecel, AirtelTigo).

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Hostel list page < 1.5s TTFB on 4G (≈30 hostels). Room availability endpoint < 300ms. |
| Availability | 99% monthly uptime goal (defense-scale). Not SLA-bound. |
| Scale target (v1) | 1,000 students, 50 hostels, ~2,000 bookings across an academic year. |
| Browser support | Latest 2 versions of Chrome, Safari, Firefox, Edge. Mobile Safari and Chrome on Android a priority. |
| Accessibility | WCAG 2.1 AA for student-facing pages. Keyboard-navigable booking flow. Alt text on photos. |
| Responsiveness | Mobile-first. Primary breakpoints: 360px, 768px, 1024px. |
| Localization | English only in v1. Currency GHS fixed. |
| Data retention | Audit logs: 2 years. SMS logs: 1 year. Deleted users anonymized (PII nulled, ID preserved for booking history integrity). |

---

## 14. Security & Privacy

- **Password storage:** Argon2 for the Super Admin password. Students/Hostel Admins have no password (OTP-only).
- **OTP storage:** Only the hash of the OTP is stored, not the code itself.
- **JWT:** Short-lived access tokens (1h). Refresh tokens stored server-side and revocable. Refresh rotation on use.
- **Rate limiting:** OTP endpoints (see FR-1.5). Booking creation throttled to 10/hour per student. SMS broadcast throttled to 3/hour per hostel admin.
- **Input validation:** All phone numbers parsed with `phonenumbers` library. All file uploads checked for MIME type + max size server-side (do not trust the frontend).
- **File upload safety:** Videos served with `Content-Disposition: inline` and strict `Content-Type`. Reject files exceeding variant limits (images 10MB, videos 50MB).
- **CSRF:** Disabled on API routes (JWT-protected), enabled on Django admin.
- **CORS:** Next.js origin whitelisted only.
- **Webhook:** Paystack signature verification is mandatory. Rejected webhooks logged and alerted.
- **Privacy:** Student privacy toggles enforced at the serializer layer (never at the frontend only). Hostel Admins never see student passwords/OTPs (they don't exist) or raw phone numbers of non-booking students.
- **Audit:** Every Super Admin sensitive action (approve, reject, deactivate, impersonate, create-on-behalf) writes to AuditLog.
- **Secrets:** `.env` file, never committed. `django-environ` for loading.

---

## 15. Assumptions, Constraints & Out of Scope

### Assumptions
- Ghanaian mobile phones with SMS-capable numbers.
- Paystack Ghana business account available to the deploying institution for a live demo; otherwise test mode is acceptable for the defense.
- Arkesel sender ID provisioned before demo day (24–48 hour lead time).
- Hostel photos and videos are supplied by owners (no photography service in v1).

### Constraints
- Solo developer. Defense deadline typically 12–16 weeks out.
- Final demo must run on free or cheap infra (e.g., Railway / Render free tier or a $5 VPS).
- SQLite in dev, with Postgres migration path documented and tested.

### Out of Scope (v1)
- In-app chat.
- Utility billing (water, electricity).
- Maintenance ticket system.
- Visitor log.
- Native mobile app.
- Reviews/ratings (pushed to v1.1).
- Referral program.
- Multi-currency.
- Full KYC for hostel owners (accept self-declared for v1; Super Admin approval is the check).

---

## 16. Success Metrics / Acceptance Criteria

The system passes review when all of the following are demonstrable in a live run-through:

- [ ] A new Hostel Admin can register via OTP, submit a hostel with ≥3 photos, ≥1 variant with video, and ≥2 rooms. Submission enters PENDING.
- [ ] Super Admin can approve the hostel; the admin receives an SMS confirmation.
- [ ] A new Student can register via OTP and see the hostel in the public listing.
- [ ] The student can filter, view the hostel detail page, and play the room video walkthrough.
- [ ] The student can book a shared-occupancy room at k=2, pay via Paystack test mode, and see their booking CONFIRMED.
- [ ] A second student can book the same room at the inherited k=2 price and appears as a roommate in the first student's dashboard, respecting privacy toggles.
- [ ] The Hostel Admin can see both bookings and send a broadcast SMS that both students receive.
- [ ] Super Admin can create a hostel on behalf of an owner and that owner can log in via OTP to manage it.
- [ ] All §9.5 unit tests pass, including the concurrent-last-slot test.
- [ ] README includes setup, seed data, and how to run tests.

---

## 17. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Arkesel sender ID approval delayed | Medium | High (no OTP → no login) | Apply in Week 1. Have a fallback "console SMS backend" in Django for dev/demo. |
| Paystack live-mode account rejected | Medium | Medium | Demo in test mode if needed. Document both flows. |
| Concurrency bug in shared booking | Medium | High | Write the concurrency test (§9.5) **first** before writing the booking code. TDD this module. |
| Video uploads fail on slow connections | High | Medium | Chunked upload + resumable (`tus` protocol) is a stretch goal. For v1, enforce 50MB cap, show progress, allow retry. |
| Scope creep ("add a chat feature") | High | High | Hold the line on §15 "Out of Scope". Any new feature request → v1.1 backlog. |
| SQLite lock errors during demo | Low | Medium | Have Postgres migration ready; be prepared to `DATABASE_URL=postgres://...` for the live demo if needed. |
| Examiner asks "how does this scale to 100k users?" | Certain | Low | Have the answer: Postgres + read replicas + move media to S3 + background jobs to Celery + cache hostel listings in Redis. |

---

## 18. Glossary

| Term | Meaning |
|---|---|
| Variant | A category of rooms within a hostel sharing identical pricing and features. |
| Room | A specific physical room belonging to exactly one Variant. |
| Slot | One occupancy place within a room. A Variant with max_occupancy=2 has 2 slots per room. |
| k (locked_k) | The occupancy level chosen by the first booker of a room, locked for subsequent bookers. |
| OTP | One-Time Password, 6-digit numeric code sent via SMS. |
| E.164 | International phone number format, e.g., +233241234567. |
| PENDING / APPROVED | Hostel lifecycle status. |
| PENDING_PAYMENT / CONFIRMED | Booking lifecycle status. |
| JWT | JSON Web Token used for API authentication. |

---

*End of PRD.*
