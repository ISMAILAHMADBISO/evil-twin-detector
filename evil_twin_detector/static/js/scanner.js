/* Live wireless scanner controller for EvilTwin Detector */
document.addEventListener("DOMContentLoaded", function () {
  const scanBtn = document.getElementById("scan-now-btn");
  const statusEl = document.getElementById("scanner-feedback");
  const tableBody = document.getElementById("scanner-results-body");

  if (!scanBtn) return;

  scanBtn.addEventListener("click", async function () {
    scanBtn.disabled = true;
    if (statusEl) {
      statusEl.textContent = "Scanning wireless spectrum...";
      statusEl.className = "text-info small";
    }

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (statusEl) {
          statusEl.textContent = data.error || "Wireless scan failed.";
          statusEl.className = "text-danger small";
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent =
          "Scan completed (" + data.observations.length + " networks found).";
        statusEl.className = "text-success small";
      }

      if (tableBody) {
        tableBody.innerHTML = "";
        data.observations.forEach(function (obs) {
          const row = document.createElement("tr");
          const clsClass =
            obs.classification === "AUTHORISED"
              ? "status-authorised"
              : obs.classification === "SUSPICIOUS"
              ? "status-suspicious"
              : "status-unknown";
          row.innerHTML =
            "<td>" +
            obs.ssid +
            "</td><td class='mono-tabular'>" +
            obs.bssid +
            "</td><td class='mono-tabular'>" +
            (obs.signal_strength ?? "N/A") +
            " dBm</td><td class='mono-tabular'>" +
            (obs.channel ?? "N/A") +
            "</td><td>" +
            obs.security +
            "</td><td class='" +
            clsClass +
            "'>" +
            obs.classification +
            "</td><td class='small text-secondary'>" +
            obs.detection_reason +
            "</td>";
          tableBody.appendChild(row);
        });
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = "Network error communicating with Flask scanner backend.";
        statusEl.className = "text-danger small";
      }
    } finally {
      scanBtn.disabled = false;
    }
  });
});
