export type Classification = 'AUTHORISED' | 'SUSPICIOUS' | 'UNKNOWN';

export type NavPage =
  | 'dashboard'
  | 'scanner'
  | 'networks'
  | 'approved'
  | 'alerts'
  | 'history'
  | 'analytics'
  | 'admins'
  | 'settings'
  | 'about';

export interface UserInfo {
  id: number;
  username: string;
  full_name: string;
  role: string;
  status: 'Active' | 'Disabled';
  created_at: string;
  last_login_at?: string | null;
}

export interface ApprovedAccessPoint {
  id: number;
  ssid: string;
  bssid: string;
  expected_security: string;
  description: string;
  created_at: string;
  status: 'Active' | 'Inactive';
}

export interface ScanSession {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  networks_found: number;
  error_message: string | null;
  is_demo: number;
}

export interface WirelessObservation {
  id: number;
  scan_session_id: number;
  ssid: string;
  bssid: string;
  signal_strength: number | null;
  channel: number | null;
  security: string;
  frequency: string | null;
  classification: Classification;
  detection_reason: string;
  triggered_rule?: string;
  supporting_indicators?: string[];
  is_demo: number;
  created_at: string;
}

export interface SecurityAlert {
  id: number;
  detection_event_id: number;
  title: string;
  severity: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  created_at: string;
  reviewed_at: string | null;
  triggered_rule: string;
  detection_reason: string;
  ssid: string;
  bssid: string;
  signal_strength?: number | null;
  channel?: number | null;
  security?: string;
}

export interface EvaluationCase {
  id: number;
  ssid: string;
  bssid: string;
  expected_security: string;
  observed_security: string;
  expected_classification: 'Legitimate' | 'Unknown' | 'Simulated Evil Twin';
  actual_classification: Classification;
  detection_time_ms: number;
  test_description: string;
  created_at: string;
}

export interface EvaluationMetrics {
  has_data: boolean;
  total_cases: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number | null;
  detection_rate: number | null;
  false_positive_rate: number | null;
  avg_detection_time_ms: number | null;
}

export interface DashboardSummary {
  summary: {
    total_discovered: number;
    authorised: number;
    suspicious: number;
    unknown: number;
    total_alerts: number;
    open_alerts: number;
    approved_count: number;
  };
  scanner_status: {
    demo_mode: boolean;
    auto_scan_enabled: boolean;
    scan_interval_seconds: number;
    host_platform: string;
    last_scan: ScanSession | null;
  };
  charts: {
    distribution: {
      Authorised: number;
      Suspicious: number;
      Unknown: number;
    };
    timeline: {
      labels: string[];
      authorised: number[];
      suspicious: number[];
      unknown: number[];
    };
    alert_trends: {
      labels: string[];
      counts: number[];
    };
  };
  recent_observations: WirelessObservation[];
  recent_alerts: SecurityAlert[];
  recent_sessions: ScanSession[];
}

export interface AppSettings {
  scan_interval_seconds: string;
  auto_scan_enabled: string;
  alerts_enabled: string;
  alert_on_unknown: string;
  demo_mode: string;
  preferred_interface: string;
}
