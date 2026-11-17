/* Chart.js initialization helpers for EvilTwin Detector */
window.EvilTwinCharts = (function () {
  function renderDashboardCharts(chartsData) {
    const distCanvas = document.getElementById("classificationChart");
    const timeCanvas = document.getElementById("timelineChart");
    const alertCanvas = document.getElementById("alertTrendChart");
    const compCanvas = document.getElementById("comparisonChart");

    if (!window.Chart) return;

    const commonGrid = { color: "rgba(148, 163, 184, 0.12)" };
    const commonTick = { color: "#94a3b8", font: { family: "JetBrains Mono", size: 11 } };

    if (distCanvas) {
      new Chart(distCanvas, {
        type: "doughnut",
        data: {
          labels: ["Authorised", "Suspicious", "Unknown"],
          datasets: [
            {
              data: [
                chartsData.distribution.Authorised || 0,
                chartsData.distribution.Suspicious || 0,
                chartsData.distribution.Unknown || 0,
              ],
              backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          plugins: { legend: { labels: { color: "#cbd5e1" } } },
        },
      });
    }

    if (timeCanvas) {
      new Chart(timeCanvas, {
        type: "line",
        data: {
          labels: chartsData.timeline.labels || [],
          datasets: [
            {
              label: "Authorised",
              data: chartsData.timeline.authorised || [],
              borderColor: "#10b981",
              tension: 0.25,
            },
            {
              label: "Suspicious",
              data: chartsData.timeline.suspicious || [],
              borderColor: "#ef4444",
              tension: 0.25,
            },
            {
              label: "Unknown",
              data: chartsData.timeline.unknown || [],
              borderColor: "#f59e0b",
              tension: 0.25,
            },
          ],
        },
        options: {
          scales: {
            x: { grid: commonGrid, ticks: commonTick },
            y: { beginAtZero: true, grid: commonGrid, ticks: commonTick },
          },
          plugins: { legend: { labels: { color: "#cbd5e1" } } },
        },
      });
    }

    if (alertCanvas) {
      new Chart(alertCanvas, {
        type: "bar",
        data: {
          labels: chartsData.alert_trends.labels || [],
          datasets: [
            {
              label: "Security Alerts",
              data: chartsData.alert_trends.counts || [],
              backgroundColor: "#ef4444",
            },
          ],
        },
        options: {
          scales: {
            x: { grid: commonGrid, ticks: commonTick },
            y: { beginAtZero: true, grid: commonGrid, ticks: commonTick },
          },
          plugins: { legend: { labels: { color: "#cbd5e1" } } },
        },
      });
    }

    if (compCanvas) {
      new Chart(compCanvas, {
        type: "bar",
        data: {
          labels: ["Authorised", "Suspicious"],
          datasets: [
            {
              label: "Network Count",
              data: [
                chartsData.distribution.Authorised || 0,
                chartsData.distribution.Suspicious || 0,
              ],
              backgroundColor: ["#10b981", "#ef4444"],
            },
          ],
        },
        options: {
          scales: {
            x: { grid: commonGrid, ticks: commonTick },
            y: { beginAtZero: true, grid: commonGrid, ticks: commonTick },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
  }

  return { renderDashboardCharts };
})();
