/* Dashboard hydration for EvilTwin Detector */
document.addEventListener("DOMContentLoaded", function () {
  const payloadEl = document.getElementById("dashboard-data-json");
  if (payloadEl && window.EvilTwinCharts) {
    try {
      const data = JSON.parse(payloadEl.textContent || "{}");
      if (data.charts) {
        window.EvilTwinCharts.renderDashboardCharts(data.charts);
      }
    } catch (err) {
      console.error("Failed to parse dashboard chart payload", err);
    }
  }
});
