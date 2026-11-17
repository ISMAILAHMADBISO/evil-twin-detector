export function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <div className="text-xs text-cyan-400 font-medium mb-1">Academic Project Specification</div>
          <h2 className="text-xl font-bold text-slate-100 leading-snug">
            Design and Implementation of a Rule-Based Client-Side Evil-Twin Wi-Fi Access Point
            Detection System
          </h2>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Application Name</dt>
            <dd className="font-semibold text-slate-100 mt-0.5">EvilTwin Detector</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Institution</dt>
            <dd className="font-semibold text-slate-100 mt-0.5">Capital City University, Kano</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Department</dt>
            <dd className="font-semibold text-slate-100 mt-0.5">Computer Science</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Student Name</dt>
            <dd className="font-semibold text-slate-100 mt-0.5">Zainab Bashir Mainasara</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Matriculation Number</dt>
            <dd className="font-mono-tabular font-semibold text-slate-100 mt-0.5">U23CYS1014</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Project Supervisor</dt>
            <dd className="font-semibold text-slate-100 mt-0.5">Mr. Munir Iro</dd>
          </div>
        </dl>
      </div>

      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-100">Purpose &amp; Objectives</h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          EvilTwin Detector is a defensive client-side wireless monitoring application designed to
          detect potentially deceptive Wi-Fi access points attempting to impersonate legitimate
          networks. Operating strictly passively on the host computer&apos;s wireless adapter, the
          system gathers visible beacon parameters (SSID, BSSID, RSSI, channel, frequency band, and
          security profile) and evaluates them against an approved SQLite access point baseline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-[#0B1120] border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-cyan-300">Rule-Based Detection Methodology</h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Rule 1 (Authorised):</strong> Discovered BSSID and security match a
                registered approved access point.
              </li>
              <li>
                <strong>Rule 2 (Suspicious):</strong> Same SSID as an approved network, but
                advertised by an unregistered BSSID.
              </li>
              <li>
                <strong>Rule 3 (Unknown):</strong> Unregistered access point that does not violate
                impersonation rules.
              </li>
              <li>
                <strong>Rule 4 (Suspicious):</strong> Registered BSSID observed with an unexpected
                security configuration.
              </li>
              <li>
                <strong>Rule 5 (Supporting Indicators):</strong> Signal strength and channel
                metrics assist investigation without serving as sole proof.
              </li>
            </ul>
          </div>

          <div className="bg-[#0B1120] border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-cyan-300">
              Ethical &amp; Defensive Architecture
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Passive client-side observation via host WLAN facilities (`netsh` / `nmcli`).</li>
              <li>
                Zero offensive capabilities: no deauthentication, jamming, traffic interception,
                or credential harvesting.
              </li>
              <li>Transparent human-readable classification reasons for every observation.</li>
              <li>
                Empirical evaluation module supporting Precision, Recall, False Positive Rate, and
                Detection Time.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
