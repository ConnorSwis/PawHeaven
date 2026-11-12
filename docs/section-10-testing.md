# Section 10: Testing

## 10.1 Test Cases

This section defines requirements-based (functional) tests for the five main
PawHeaven use cases in the project’s end-to-end adoption journey:

1. **Test Case Group 10.1 / UC-1 — Administrator manages pet records**
2. **Test Case Group 10.2 / UC-2 — Visitor browses and searches available pets**
3. **Test Case Group 10.3 / UC-3 — Visitor creates an account or logs in**
4. **Test Case Group 10.4 / UC-4 — Member submits an adoption application**
5. **Test Case Group 10.5 / UC-5 — Staff member reviews an adoption application**

All tests are run against a reset PawHeaven test environment with test-only
accounts, pets, and images. A test never uses a real applicant's data.

### Use-case and requirement references

Use these traceability IDs in the **Requirement / Use Case** field of the
template. If an earlier report section already assigns requirement IDs, replace
the `FR-` IDs below with those existing IDs rather than creating duplicates.

- **UC-1:** Administrator manages pet records.
  - **FR-1.1:** Authorized staff can create pet records.
  - **FR-1.2:** Pet records must validate required information and intake dates.
  - **FR-1.3:** Only staff and superusers can manage pet records.
  - **FR-1.4:** Pet photos must be JPEG, PNG, or WebP and no larger than 5 MB.
- **UC-2:** Visitor browses and searches available pets.
  - **FR-2.1:** Visitors can search available pets by matching text or tag.
  - **FR-2.2:** The directory explains when a search has no matches.
  - **FR-2.3:** Only Available pets are publicly displayed.
- **UC-3:** Visitor creates an account or logs in.
  - **FR-3.1:** Visitors can register a PawHeaven account with valid credentials.
  - **FR-3.2:** Registration validates email address and password requirements.
  - **FR-3.3:** A confirmed account can log in and start a session.
  - **FR-3.4:** Invalid login credentials are rejected without creating a session.
- **UC-4:** Member submits an adoption application.
  - **FR-4.1:** A signed-in adult can apply for an Available pet using valid information.
  - **FR-4.2:** A visitor must sign in before applying.
  - **FR-4.3:** Applicants must be at least 18 years old.
  - **FR-4.4:** A member can submit only one application for the same pet.
- **UC-5:** Staff member reviews an adoption application.
  - **FR-5.1:** Staff can change a Pending application to an allowed review status.
  - **FR-5.2:** Approving an application does not automatically change the pet's availability.
  - **FR-5.3:** Only staff and superusers can review applications.

### Test Case Group 10.1 — Administrator manages pet records (UC-1)

**Features:** create a pet record, validate pet information, upload a pet
photo, and restrict pet management to staff or superusers.

**Equivalence classes**

- Staff role: Valid—`staff` or `superuser`; invalid—signed-out visitor or `member`.
- Required pet fields: Valid—name, species, breed, age, intake date (today or earlier), summary, and permitted status supplied; invalid—a required field is blank or exceeds its limit.
- Intake date: Valid—real date on/before today; invalid—malformed date or future date.
- Weight: Valid—blank or whole number 1–400; invalid—0, over 400, decimal, or nonnumeric.
- Pet photo: Valid—non-empty JPEG, PNG, or WebP up to 5 MB; invalid—other type, empty file, or file over 5 MB.

**Test specifications for UC-1**

- 10.1.1: Staff role + complete valid pet data + valid JPEG image.
- 10.1.2: Staff role + future intake date.
- 10.1.3: Member role + otherwise valid pet data.
- 10.1.4: Staff role + image larger than 5 MB.

#### Test Case ID: 10.1.1 — Create an available pet with a valid photo

**Requirement / Use Case:** UC-1 — Administrator manages pet records; FR-1.1 — Authorized staff can create pet records; FR-1.4 — Pet photo validation.

**Test Inputs:** Staff account; pet name `Maple`; species `Dog`; breed `Labrador mix`; age `2 years`; intake date `2026-11-01`; status `Available`; valid summary; weight `48`; tags `large`, `friendly`; JPEG photo `maple.jpg` (1 MB).

**Expected Results:** The pet record is saved, receives an identifier, displays Maple and its photo in the staff inventory, and is visible in the public available-pet directory. The stored fields match the submitted values.

**Dependencies:** Running API, database, and public image storage; a staff account; a valid test JPEG.

**Initialization:** Sign in to the administrator portal as a staff user. Confirm no test pet named Maple exists.

**Test Steps:**

1. Open **Animals** and choose **Add animal**.
2. Enter the test inputs and select `maple.jpg`.
3. Save the record.
4. Open the public pet directory and search for `Maple`.

**Tear Down:** Delete the Maple test record and its uploaded test image.

#### Test Case ID: 10.1.2 — Reject a pet with a future intake date

**Requirement / Use Case:** UC-1 — Administrator manages pet records; FR-1.2 — Pet record validation.

**Test Inputs:** Staff account; otherwise valid pet data; intake date one day after the test date.

**Expected Results:** The record is not saved. The intake-date field explains that the date must be today or earlier, and no public or staff listing is created.

**Dependencies:** Running API and database; a staff account.

**Initialization:** Sign in as staff and open a blank animal form.

**Test Steps:**

1. Enter all required valid values.
2. Enter tomorrow's date as the intake date.
3. Save the record.

**Tear Down:** Confirm no record was created; discard the form.

#### Test Case ID: 10.1.3 — Prevent a member from creating a pet record

**Requirement / Use Case:** UC-1 — Administrator manages pet records; FR-1.3 — Pet-management authorization.

**Test Inputs:** Signed-in member account; otherwise valid pet payload.

**Expected Results:** The member cannot access the animal-management action or API. No pet record or image is created.

**Dependencies:** Running API and database; a member account without staff privileges.

**Initialization:** Sign in as the member and record the current pet count.

**Test Steps:**

1. Attempt to open the administrator Animals page.
2. If exercising the API, submit the valid create-pet request using the member session.
3. Check the public and administrator pet lists.

**Tear Down:** Sign out; verify the pet count is unchanged.

#### Test Case ID: 10.1.4 — Reject an oversized pet image

**Requirement / Use Case:** UC-1 — Administrator manages pet records; FR-1.4 — Pet photo validation.

**Test Inputs:** Staff account; an existing test pet; a JPEG larger than 5 MB.

**Expected Results:** The image is rejected with a message limiting images to JPEG, PNG, or WebP smaller than 5 MB. The existing image remains unchanged.

**Dependencies:** Running API, storage, staff account, existing test pet, and a >5 MB test JPEG.

**Initialization:** Sign in as staff and note the existing pet image URL.

**Test Steps:**

1. Open the test pet in the administrator portal.
2. Select the oversized JPEG.
3. Save/upload the image.
4. Refresh the pet record.

**Tear Down:** Remove the oversized local test file if it was created for this test; keep the original pet image.

### Test Case Group 10.2 — Visitor browses and searches available pets (UC-2)

**Features:** list public pets alphabetically, search public pet details and tags, open a pet detail page, show no-results feedback, and exclude non-available pets.

**Equivalence classes**

- Search query: Valid matching text/tag; valid nonmatching text; blank query; input with leading/trailing spaces or different letter case.
- Pet availability: Public—`Available`; excluded—`Pending`, `Adopted`, `Fostered`, or `Unavailable`.
- Search result count: One or more matches; zero matches.

**Test specifications for UC-2**

- 10.2.1: Matching query/tag + Available pet.
- 10.2.2: Nonmatching query + directory with pets.
- 10.2.3: Query matching an Adopted (non-Available) pet.

#### Test Case ID: 10.2.1 — Find an available pet by tag

**Requirement / Use Case:** UC-2 — Visitor browses and searches available pets; FR-2.1 — Search available pets by text or tag.

**Test Inputs:** Public directory with Available pet `Baxter` tagged `big dog`; search query `big dog`.

**Expected Results:** Baxter appears in the results and his detail page opens successfully. The result identifies the matching pet; only available pets are shown.

**Dependencies:** Running public site and API; seed data containing Available Baxter with the `big dog` tag.

**Initialization:** Sign out or use a new browser session; open the public pet directory.

**Test Steps:**

1. Enter `big dog` in the search field.
2. Submit the search.
3. Select Baxter from the results.
4. Verify the pet details page.

**Tear Down:** Clear the search and return to the directory.

#### Test Case ID: 10.2.2 — Show feedback when no pet matches

**Requirement / Use Case:** UC-2 — Visitor browses and searches available pets; FR-2.2 — No-results feedback.

**Test Inputs:** Search query `zzzxqv-nomatch`.

**Expected Results:** The directory shows no pet cards and clearly states that no animals match the search criteria. The page remains usable and does not report a system failure.

**Dependencies:** Running public site and API; at least one available test pet.

**Initialization:** Open the public pet directory with no active filters.

**Test Steps:**

1. Enter `zzzxqv-nomatch` in the search field.
2. Submit the search.
3. Inspect the result area.

**Tear Down:** Clear the query.

#### Test Case ID: 10.2.3 — Hide a non-available pet from public search

**Requirement / Use Case:** UC-2 — Visitor browses and searches available pets; FR-2.3 — Display only Available pets publicly.

**Test Inputs:** Pet `PrivateTestPet` with status `Adopted`; search query `PrivateTestPet`.

**Expected Results:** PrivateTestPet is absent from public results and its public detail route is unavailable. Its record remains available to authorized staff in the administrator portal.

**Dependencies:** Running public site, API, and database; staff-created test pet with status `Adopted`.

**Initialization:** Confirm PrivateTestPet is present in the staff inventory and not included in the public directory.

**Test Steps:**

1. In a signed-out browser, search for `PrivateTestPet`.
2. Attempt to open the pet's public detail URL if known.
3. Sign in as staff and locate the same record in the animal inventory.

**Tear Down:** Delete or restore the test pet to its seed state.

### Test Case Group 10.3 — Visitor creates an account or logs in (UC-3)

**Features:** register an account, enforce email/password validation, start email confirmation when configured, establish an authenticated session on valid login, and reject invalid credentials.

**Equivalence classes**

- Email: Valid well-formed unused email; invalid/malformed email; existing email.
- Password: Valid—8–1,024 characters containing uppercase, lowercase, number, and special character; invalid—fewer than 8 characters, missing a required character class, or over 1,024 characters.
- Login credentials: Valid confirmed account and matching password; invalid password, unknown email, or unconfirmed account.

**Test specifications for UC-3**

- 10.3.1: Unused valid email + compliant password.
- 10.3.2: Malformed email + weak password.
- 10.3.3: Confirmed account + matching password.
- 10.3.4: Confirmed account + nonmatching password.

#### Test Case ID: 10.3.1 — Register a new account with valid credentials

**Requirement / Use Case:** UC-3 — Visitor creates an account or logs in; FR-3.1 — Register an account with valid credentials.

**Test Inputs:** Name `Test Applicant`; unique email `test.applicant+<run-id>@example.test`; password `PawHeaven!42`.

**Expected Results:** The account is created. If email confirmation is enabled, the user sees instructions to check the inbox and cannot proceed as authenticated until confirmation; otherwise a session is established. The password is never displayed or returned.

**Dependencies:** Running public site, API, and authentication service; access to the test email inbox when confirmation is enabled.

**Initialization:** Confirm the unique test email is not registered; open the **Create your account** page.

**Test Steps:**

1. Enter the name, email, and password.
2. Submit the form.
3. Verify the registration confirmation response.
4. If required, confirm the test email and sign in.

**Tear Down:** Delete the test account through the test administration process.

#### Test Case ID: 10.3.2 — Validate malformed email and weak password during registration

**Requirement / Use Case:** UC-3 — Visitor creates an account or logs in; FR-3.2 — Registration validation.

**Test Inputs:** Name `Test Applicant`; email `not-an-email`; password `password`.

**Expected Results:** Registration is not submitted successfully. The email field asks for a valid email address, and the password field explains the uppercase, lowercase, number, special-character, and eight-character requirement. No account is created.

**Dependencies:** Running public site and API.

**Initialization:** Open the **Create your account** page.

**Test Steps:**

1. Enter the test inputs.
2. Submit the form.
3. Check the validation messages and account state.

**Tear Down:** Clear the form.

#### Test Case ID: 10.3.3 — Log in with valid confirmed credentials

**Requirement / Use Case:** UC-3 — Visitor creates an account or logs in; FR-3.3 — Confirmed-account login.

**Test Inputs:** Confirmed member account `member@example.test`; its correct password.

**Expected Results:** A secure authenticated session is created and the user reaches their PawHeaven account area, where their account state is visible.

**Dependencies:** Running public site, API, and authentication service; a confirmed member test account.

**Initialization:** Sign out and clear the existing PawHeaven session cookies for the test browser.

**Test Steps:**

1. Open **Log in**.
2. Enter the confirmed member email and correct password.
3. Submit the form.
4. Open **My PawHeaven**.

**Tear Down:** Log out and clear the test browser session.

#### Test Case ID: 10.3.4 — Reject an incorrect login password

**Requirement / Use Case:** UC-3 — Visitor creates an account or logs in; FR-3.4 — Reject invalid login credentials.

**Test Inputs:** Confirmed member email `member@example.test`; incorrect password `WrongPaw!42`.

**Expected Results:** Login is refused with a credentials error. No authenticated session or account data is exposed.

**Dependencies:** Running public site, API, and a confirmed member test account.

**Initialization:** Sign out and clear the browser session.

**Test Steps:**

1. Open **Log in**.
2. Enter the member email and incorrect password.
3. Submit the form.
4. Attempt to open **My PawHeaven**.

**Tear Down:** Clear the form and browser session.

### Test Case Group 10.4 — Member submits an adoption application (UC-4)

**Features:** require sign-in, validate contact and household information, require adult applicants, accept one application per member/pet, accept applications only for Available pets, and set a valid submission to `Pending` without reserving the pet.

**Equivalence classes**

- Authentication: Valid—signed-in member; invalid—signed-out visitor.
- Pet status: Valid—`Available`; invalid—any non-Available status.
- Phone: Valid—10–15 digits using allowed punctuation; invalid—blank, fewer than 10 digits, or more than 15 digits.
- Address: Valid—5–300 characters; invalid—blank, shorter than 5, or longer than 300.
- Age: Valid—18–120 years; invalid—under 18, future/invalid date, or over 120 years.
- Household and experience answers: Valid—household 20–2,000 characters and experience 20–1,000 characters; invalid—either below minimum or above maximum.
- Application history: Valid—no application by this member for this pet; invalid—duplicate application for the same member/pet.

**Test specifications for UC-4**

- 10.4.1: Signed-in adult + Available pet + all valid required fields.
- 10.4.2: Signed-out visitor + Available pet.
- 10.4.3: Signed-in applicant under 18 + otherwise valid form.
- 10.4.4: Signed-in member + existing application for the same Available pet.

#### Test Case ID: 10.4.1 — Submit a valid adoption application

**Requirement / Use Case:** UC-4 — Member submits an adoption application; FR-4.1 — Submit a valid application for an Available pet.

**Test Inputs:** Signed-in adult member; Available pet `Maple`; phone `404-555-0123`; address `123 Test Street, Atlanta, GA 30303`; date of birth `1990-06-15`; household and care summary of 20–2,000 characters; experience answer of 20–1,000 characters; optional note.

**Expected Results:** A single application is created for Maple with status `Pending`. It appears in the member's applications and in the staff review list. Maple remains `Available`; the submission does not approve or reserve her.

**Dependencies:** Running public site, API, and database; confirmed adult member account; Available Maple test pet.

**Initialization:** Sign in as the member. Confirm the member has no existing application for Maple.

**Test Steps:**

1. Open Maple's public detail page.
2. Choose **Apply**.
3. Complete the form using the test inputs.
4. Submit the application.
5. Check **My PawHeaven** and, as staff, the application review list.

**Tear Down:** Delete the test member or remove its test application according to the test database reset process.

#### Test Case ID: 10.4.2 — Require sign-in before an adoption application

**Requirement / Use Case:** UC-4 — Member submits an adoption application; FR-4.2 — Sign-in required before applying.

**Test Inputs:** Signed-out visitor; Available pet `Maple`.

**Expected Results:** The visitor is prompted or redirected to sign in. No adoption application form submission or application record is accepted while unauthenticated.

**Dependencies:** Running public site and API; Available Maple test pet.

**Initialization:** Sign out and clear session cookies; record the number of Maple applications in the staff portal.

**Test Steps:**

1. Open Maple's public detail page.
2. Choose **Apply**.
3. Attempt to continue without signing in.
4. Check the staff application count.

**Tear Down:** Remain signed out; confirm the application count is unchanged.

#### Test Case ID: 10.4.3 — Reject an underage applicant

**Requirement / Use Case:** UC-4 — Member submits an adoption application; FR-4.3 — Applicant must be at least 18.

**Test Inputs:** Signed-in member; Available pet; otherwise valid form; date of birth that makes the applicant 17 on the test date.

**Expected Results:** The application is not created. The date-of-birth field states that applicants must be at least 18 years old.

**Dependencies:** Running public site, API, and database; signed-in member; Available test pet.

**Initialization:** Sign in as a member who has no application for the selected pet.

**Test Steps:**

1. Open the selected pet's application form.
2. Enter all valid fields except the underage date of birth.
3. Submit the form.
4. Check the validation message and application list.

**Tear Down:** Clear the form; confirm no application was created.

#### Test Case ID: 10.4.4 — Prevent a duplicate adoption application

**Requirement / Use Case:** UC-4 — Member submits an adoption application; FR-4.4 — One application per member/pet.

**Test Inputs:** Signed-in member with an existing Pending application for Available pet `Maple`; a second otherwise valid application for Maple.

**Expected Results:** The second submission is refused and explains that an application was already submitted for this pet. Exactly one application remains for this member and Maple.

**Dependencies:** Running public site, API, and database; signed-in member; Available Maple; existing Pending Maple application for that member.

**Initialization:** Create or seed one valid Pending application for the member and Maple.

**Test Steps:**

1. Open Maple's application form as the same member.
2. Enter valid application values.
3. Submit the form.
4. Check the member and staff application lists.

**Tear Down:** Remove the seeded test application or reset the test database.

### Test Case Group 10.5 — Staff member reviews an adoption application (UC-5)

**Features:** display submitted applications to authorized staff, change a Pending application to an allowed review outcome, preserve application ownership, and avoid changing pet availability unless staff explicitly request a valid status change with an approval.

**Equivalence classes**

- Reviewer role: Valid—`staff` or `superuser`; invalid—member or signed-out visitor.
- Requested application status: Valid—`In review`, `Approved`, `Declined`; invalid—`Pending`, blank, or another value.
- Optional pet-status change: Valid—`Pending`, `Adopted`, `Fostered`, or `Unavailable` with `Approved`; no change requested; invalid—`Available` or a change requested with a non-approved outcome.

**Test specifications for UC-5**

- 10.5.1: Staff reviewer + Pending application + `In review`.
- 10.5.2: Staff reviewer + Pending application + `Approved` and no pet-status request.
- 10.5.3: Member reviewer + otherwise valid review request.

#### Test Case ID: 10.5.1 — Staff marks a Pending application as In review

**Requirement / Use Case:** UC-5 — Staff member reviews an adoption application; FR-5.1 — Staff changes a Pending application to an allowed review status.

**Test Inputs:** Staff account; Pending adoption application for Maple; requested status `In review`.

**Expected Results:** The application status changes to `In review`; review date and reviewer are recorded. The applicant can see the updated status on their own account. Maple's availability is unchanged.

**Dependencies:** Running administrator portal, API, and database; staff account; a member-owned Pending test application for Maple.

**Initialization:** Sign in as staff. Confirm the test application is Pending and Maple's current status is Available.

**Test Steps:**

1. Open **Requests** in the administrator portal.
2. Open the Pending Maple application.
3. Select `In review` and save.
4. Refresh the staff list and inspect the applicant's account view.

**Tear Down:** Return the application to its seeded test state or reset the test database.

#### Test Case ID: 10.5.2 — Approve an application without automatically changing pet availability

**Requirement / Use Case:** UC-5 — Staff member reviews an adoption application; FR-5.2 — Approval does not automatically change pet availability.

**Test Inputs:** Staff account; Pending test application for Available pet Maple; requested status `Approved`; no requested pet-status change.

**Expected Results:** The application status becomes `Approved` and the reviewer is recorded. Maple remains `Available`; approval alone does not alter the pet record.

**Dependencies:** Running administrator portal, API, and database; staff account; Pending test application; Available Maple.

**Initialization:** Sign in as staff and confirm the test application's status is Pending and Maple is Available.

**Test Steps:**

1. Open the Pending application.
2. Select `Approved`.
3. Leave the optional pet-status change unset.
4. Save and inspect both the application and Maple's pet record.

**Tear Down:** Restore the application and Maple to the test seed state or reset the database.

#### Test Case ID: 10.5.3 — Prevent a member from reviewing an application

**Requirement / Use Case:** UC-5 — Staff member reviews an adoption application; FR-5.3 — Only staff and superusers can review applications.

**Test Inputs:** Signed-in member account; identifier for another member's Pending application; requested status `Approved`.

**Expected Results:** The member cannot access the staff review page or perform the review request. The target application's status, reviewer, and timestamp remain unchanged.

**Dependencies:** Running public site, administrator portal, API, and database; member account; a Pending application belonging to a different member.

**Initialization:** Record the target application's current status and review fields. Sign in as the non-staff member.

**Test Steps:**

1. Attempt to open the administrator Requests page.
2. If exercising the API, submit the review request with the member session.
3. Sign in as staff and reload the target application.

**Tear Down:** Sign out; confirm the application's recorded fields are unchanged.

### Test coverage summary

The set includes successful, invalid-input, authorization, availability, and
duplicate-submission tests for each major use case. Together, the tests verify
that public users see only adoptable animals, members can submit a safe and
validated application, and only authorized staff can change shelter records or
application outcomes.
