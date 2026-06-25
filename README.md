# WAJOOD — Pakistan's Unified Missing Persons Platform

WAJOOD is a centralized platform designed to consolidate missing and unidentified person records across Pakistan. It uses AI face recognition, SMS/Console notifications, and real-time dashboard syncs to help reunite families with their missing loved ones.

---

## Run in 3 commands:

```bash
git clone https://github.com/yourusername/wajood.git
cd wajood
docker-compose up --build
```

---

## Access:

*   **Frontend Portal:** [http://localhost:3000](http://localhost:3000)
*   **Backend REST API:** [http://localhost:8000](http://localhost:8000)
*   **Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
*   **MinIO Console (Object Storage):** [http://localhost:9001](http://localhost:9001)

---

## Login Credentials

All passwords are **`Test1234!`** (except the Administrator account, which uses **`Admin1234!`**).

| Role | Email | Password | Target Portal & Access Scope |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@wajood.pk` | `Admin1234!` | **Admin Dashboard**: System administration, user verification, full record access. |
| **PUBLIC** | `public@wajood.pk` | `Test1234!` | **Citizen Portal**: Report sightings, search public cases, receive alerts. |
| **NGO WORKER** | `ngo@wajood.pk` | `Test1234!` | **Shelter Portal (Edhi Foundation)**: Manage shelter check-ins, record details of found persons. |
| **OFFICER** | `officer@wajood.pk` | `Test1234!` | **Investigation Portal (FIA)**: Run investigations, trigger and confirm match findings. |
| **DOCTOR** | `doctor@wajood.pk` | `Test1234!` | **Hospital Portal (Jinnah Hospital)**: Record check-ins of unidentified or unconscious patients. |
| **VOLUNTEER** | `volunteer@wajood.pk` | `Test1234!` | **Field Worker Portal**: Participate in active search efforts and receive area alerts. |
| **JOURNALIST** | `media@wajood.pk` | `Test1234!` | **Press Room**: Access public stats, trends, and verified report summaries. |
| **GOVT OFFICIAL** | `govt@wajood.pk` | `Test1234!` | **coordination Portal (NDMA)**: National status dashboards, trigger emergency disaster alerts. |
| **FORENSICS** | `forensics@wajood.pk` | `Test1234!` | **Labs Portal**: Manage biometric data, DNA profiling references, and dental scans. |

---

## How to Test AI Matching

The system is equipped with an AI facial matching backend powered by **DeepFace** and **SQLAlchemy Vector Cosine Similarity**. Follow these steps to test the automatic match pipeline:

### Step 1: Login and Upload a Case
1. Open the **Frontend Portal** ([http://localhost:3000](http://localhost:3000)) or use the **Swagger API Docs** ([http://localhost:8000/docs](http://localhost:8000/docs)).
2. Login as the Public Citizen (`public@wajood.pk`) to access the case registration tool.
3. Register a new **Missing Person** record. Make sure to upload a clear face portrait image of the missing person. 
   *(Alternatively, use the seeded case `Muhammad Bilal` (WJD-2024-KHI01) which already has a seeded Unsplash portrait photo).*

### Step 2: Upload a Sighting / Found Person Record
1. Login as an NGO Worker (`ngo@wajood.pk`) or Hospital Doctor (`doctor@wajood.pk`).
2. Register a new **Found Person** check-in record.
3. Upload a face photo of the person found. For a successful match, upload the same picture (or a similar face picture) to simulate matching.
4. The system automatically triggers face embedding extraction using **DeepFace** in the background.

### Step 3: Trigger the AI Matching Engine
1. Login as an FIA Officer (`officer@wajood.pk`) or Admin (`admin@wajood.pk`).
2. Locate the registered case in the Investigation Portal.
3. Click the **"Trigger AI Matching"** button on the case dashboard. 
   * (API equivalent: Send a `POST` request to `/api/matching/trigger/{case_id}` with the UUID of the missing person case).
4. The Celery worker runs the background task `run_ai_matching_task`, calculates vector cosine similarity between the missing person's face embedding and all found persons' embeddings, and records potential matches above the confidence threshold.

### Step 4: Review and Confirm Matches
1. Refresh the Officer Portal to view the **Match Results**.
2. Potential matches are ranked by confidence score.
3. If a match is correct, the Officer clicks **"Confirm Match"**.
   * (API equivalent: Send a `PATCH` request to `/api/matching/results/{match_id}/confirm`).
4. Once confirmed, the system:
   * Sets the match status to `CONFIRMED`.
   * Dispatches a notification alert to the case's original reporter (Public Citizen).
   * Generates a tamper-proof blockchain-style Audit Log chain entry for the record.
