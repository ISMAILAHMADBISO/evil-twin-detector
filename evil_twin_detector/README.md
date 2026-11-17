# EvilTwin Detector — Complete System Documentation

**Application Name:** EvilTwin Detector  
**Subtitle:** Wi-Fi Security Monitoring System  
**Academic Project Title:** Design and Implementation of a Rule-Based Client-Side Evil-Twin Wi-Fi Access Point Detection System

---

## 1. Academic Project Information
- **Institution:** Capital City University, Kano
- **Department:** Computer Science
- **Student Name:** Zainab Bashir Mainasara
- **Matriculation Number:** U23CYS1014
- **Project Supervisor:** Mr. Munir Iro

---

## 2. How the System Works (End-to-End Architecture)

EvilTwin Detector operates strictly as a **defensive, passive, client-side wireless monitoring application**. Browsers cannot access a computer's wireless adapter directly, so scanning happens exclusively on the backend host:

1. **Client Wireless Adapter Layer (`scanner/`)**:
   - On **Windows 10/11**, `WindowsScanner` executes `netsh wlan show networks mode=bssid` via Python's `subprocess` module and parses every visible SSID, BSSID (MAC address), signal percentage (converted to approximate RSSI in dBm), wireless channel, radio type / frequency band (`2.4 GHz`, `5 GHz`, `6 GHz`), and security protocol (`WPA3`, `WPA2`, `WPA`, `WEP`, `Open`).
   - On **Linux**, `LinuxScanner` executes `nmcli -t -f SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY dev wifi list`.
   - In virtualized/cloud containers without physical Wi-Fi hardware, an explicitly labeled, isolated **Demo Mode** can be enabled so users can test all detection rules and dashboards without mixing synthetic records with real scans.
2. **Rule-Based Detection Engine (`detection/rule_engine.py`)**:
   - Compares every discovered access point against the active **Approved Access Points** baseline in SQLite.
   - Outputs one of three classifications (`AUTHORISED`, `SUSPICIOUS`, `UNKNOWN`) with the exact rule triggered, human-readable explanation, and supporting indicators.
3. **Database Persistence (`database/` & SQLite `instance/eviltwin_detector.db`)**:
   - Stores `users`, `approved_access_points`, `scan_sessions`, `wireless_observations`, `detection_events`, `security_alerts`, `evaluation_cases`, and `application_settings`.
4. **Services & API Layer (`services/`, `routes/`, and `server.ts`)**:
   - Orchestrates scan sessions, automatically generates security alerts for `SUSPICIOUS` detections, computes evaluation metrics, and handles authentication and database backup/restore.
5. **Security Monitoring Dashboard**:
   - Displays real-time database metrics, Chart.js analytics, live scanner controls, alert triage, historical logs, administrator management, and system settings.

---

## 3. Detection Rules Explained

| Rule | Condition | Classification | Meaning |
| :--- | :--- | :--- | :--- |
| **Rule 1: Registered Access Point** | Observed BSSID matches an active registered AP and security matches expected configuration. | `AUTHORISED` (Green) | Legitimate, verified access point. |
| **Rule 2: Same SSID, Different BSSID** | Observed SSID matches an approved network, but the BSSID is not in the approved registry. | `SUSPICIOUS` (Red) | Possible Evil Twin impersonating a trusted SSID. |
| **Rule 3: Unknown Access Point** | Neither BSSID nor SSID matches any approved baseline entry. | `UNKNOWN` (Amber) | Unregistered neighbor/external AP (not automatically labeled malicious). |
| **Rule 4: Unexpected Security Configuration** | Registered BSSID advertises a weaker or altered security mode (e.g., `Open` instead of `WPA2`) or mismatched SSID. | `SUSPICIOUS` (Red) | Configuration tampering or downgrade anomaly. |
| **Rule 5: Supporting Indicators** | Signal strength (RSSI in dBm) and channel/band metadata. | *Advisory Only* | Displayed to assist investigation; signal or channel shifts alone never trigger an Evil Twin verdict. |

---

## 4. Application Modules & Functions

1. **Authentication & Administrator Management (`/login`, `Administrators` page)**
   - Protects all dashboard views and API routes using `scrypt` / `Werkzeug` salted password hashes and signed HTTP-only cookies + Bearer tokens.
   - Administrators can register new administrator accounts, assign roles (`Primary Administrator`, `Administrator`, `Security Analyst`), enable/disable accounts, reset passwords, and remove other accounts (preventing self-deletion or removing the last active administrator).
   - **Logout** is available in both the top header bar and the bottom of the sidebar.
2. **Dashboard**
   - Displays 5 live KPI cards (Total Discovered, Authorised, Suspicious, Unknown, Security Alerts), 4 Chart.js visualizations (Classification Distribution, Discoveries Over Time, Alert Trends, Authorised vs. Suspicious Comparison), recent discoveries, recent alerts, scanner status, and recent scan sessions.
3. **Live Network Scanner**
   - Includes **Live Adapter | Demo Mode** selector, **Scan Now** button, configurable **Auto-Refresh** countdown timer, hardware capability check, explainability modal per network, and a one-click **Approve** button for `UNKNOWN` networks.
4. **Detected Networks**
   - Shows the latest completed scan's access points with live search and classification filter buttons (`All`, `Authorised`, `Suspicious`, `Unknown`).
5. **Approved Access Points**
   - Full Create, Read, Update, Delete (CRUD) registry for trusted APs, supporting multiple BSSIDs per SSID, MAC address format validation (`XX:XX:XX:XX:XX:XX`), duplicate prevention, search, and status filtering (`Active` / `Inactive`).
6. **Security Alerts**
   - Automatically raises alerts when `SUSPICIOUS` access points are detected. Supports filtering by severity (`High`, `Medium`) and status (`Open`, `Reviewed`, `Resolved`), inspecting alert details, marking as reviewed, and resolving.
7. **Detection History**
   - Searchable audit log of all past `wireless_observations` with classification filter and start/end date range filters.
8. **Performance Analytics**
   - Evaluates the rule-based engine against labelled ground-truth test cases (`Legitimate`, `Unknown`, `Simulated Evil Twin`) and computes:
     - **Precision** = `TP / (TP + FP)`
     - **Detection Rate (Recall)** = `TP / (TP + FN)`
     - **False Positive Rate** = `FP / (FP + TN)`
     - **Average Detection Time** (milliseconds)
     - Safely handles division by zero and displays a clear empty state when no test cases have been added.
9. **Settings**
   - Persistently configures automatic scan interval (5–3600s), scheduled scanning toggle, alert generation toggle, Demo Mode isolation toggle, preferred interface, SQLite `.db` backup download, and `.db` restore upload.
10. **About Project**
    - Displays full academic project metadata, objectives, ethical scope, and detection methodology.

---

## 5. Ethical & Defensive Scope

EvilTwin Detector **only** performs passive wireless scanning via the host computer's adapter. It does **not** perform deauthentication attacks, Wi-Fi jamming, packet sniffing, credential harvesting, or unauthorized network access.

---

## 6. Installation & Running Locally (Flask Python App)

```bash
cd evil_twin_detector
python -m venv venv
# Windows: .\venv\Scripts\Activate.ps1
# Linux:   source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Run automated Python tests:
```bash
pytest
# or:
python3 -m unittest discover -s tests -v
```
