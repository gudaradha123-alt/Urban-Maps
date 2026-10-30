
import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  Play,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import './DemoMode.css';

const CATEGORIES = [
  'Potholes and damaged roads',
  'Garbage and illegal dumping',
  'Broken streetlights',
  'Waterlogging and drainage',
  'Water leaks and damaged pipes',
  'Traffic and parking problems',
  'Broken footpaths and public infrastructure',
  'Other civic issues',
];

type DemoStatus = 'Pending Review' | 'Approved' | 'Rejected';

type DemoReport = {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  status: DemoStatus;
  rejectionReason?: string;
};

type ApprovedReport = {
  id: string;
  category: string;
  description: string;
  coordinates: [number, number];
};

type DemoModeProps = {
  onExit: () => void;
  onApproved: (report: ApprovedReport) => void;
};

const STARTER_REPORT: DemoReport = {
  id: 'expo-demo-001',
  title: 'Pothole near Abids',
  category: CATEGORIES[0],
  description:
    'Demonstration report: a road pothole that may pose a safety risk to two-wheelers.',
  location: 'Abids, Hyderabad',
  status: 'Pending Review',
};

export default function DemoMode({
  onExit,
  onApproved,
}: DemoModeProps) {
  const [reports, setReports] = useState<DemoReport[]>([
    STARTER_REPORT,
  ]);
  const [activeTab, setActiveTab] = useState<'citizen' | 'admin'>(
    'citizen',
  );
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState('Abids, Hyderabad');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState(STARTER_REPORT.id);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState('');

  const selectedReport =
    reports.find((report) => report.id === selectedId) ??
    reports.find((report) => report.status === 'Pending Review') ??
    reports[0];

  const pendingCount = reports.filter(
    (report) => report.status === 'Pending Review',
  ).length;
  const approvedCount = reports.filter(
    (report) => report.status === 'Approved',
  ).length;
  const rejectedCount = reports.filter(
    (report) => report.status === 'Rejected',
  ).length;

  function submitDemoReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!location.trim() || !description.trim()) {
      setMessage('Enter a location and describe the issue.');
      return;
    }

    if (description.trim().length > 1500) {
      setMessage('Description must be 1,500 characters or fewer.');
      return;
    }

    const newReport: DemoReport = {
      id: `expo-demo-${Date.now()}`,
      title: category,
      category,
      description: description.trim(),
      location: location.trim(),
      status: 'Pending Review',
    };

    setReports((current) => [newReport, ...current]);
    setSelectedId(newReport.id);
    setDescription('');
    setMessage('Demo report submitted for admin review.');
    setActiveTab('admin');
  }

  function approveReport(report: DemoReport) {
    if (report.status !== 'Pending Review') return;

    setReports((current) =>
      current.map((item) =>
        item.id === report.id
          ? { ...item, status: 'Approved' }
          : item,
      ),
    );

    // Demo coordinates are intentionally fixed to central Hyderabad.
    // This prototype does not geocode the typed location.
    onApproved({
      id: report.id,
      category: report.category,
      description: `${report.description} (Demo location: ${report.location})`,
      coordinates: [78.4867, 17.385],
    });

    setRejectionReason('');
    setMessage(
      'Demo report approved. A temporary issue marker was added to the map.',
    );
  }

  function rejectReport(report: DemoReport) {
    if (report.status !== 'Pending Review') return;

    if (!rejectionReason.trim()) {
      setMessage('Enter a short reason before rejecting the report.');
      return;
    }

    setReports((current) =>
      current.map((item) =>
        item.id === report.id
          ? {
              ...item,
              status: 'Rejected',
              rejectionReason: rejectionReason.trim(),
            }
          : item,
      ),
    );

    setRejectionReason('');
    setMessage('Demo report rejected. No map marker was created.');
  }

  function clearDemoReports() {
    setReports([]);
    setSelectedId('');
    setMessage('Demo queue cleared. Exit and re-enter to restore the sample.');
  }

  return (
    <div className="demo-mode-overlay">
      <header className="demo-mode-header">
        <div className="demo-mode-brand">
          <span className="demo-mode-logo">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>URBAN MAPS</strong>
            <span>EXHIBITION DEMO MODE</span>
          </div>
        </div>

        <div className="demo-mode-header-right">
          <span className="demo-isolated-badge">
            <span />
            Isolated simulation
          </span>
          <button
            type="button"
            className="demo-exit-button"
            onClick={onExit}
          >
            <ArrowLeft size={16} />
            Exit demo
          </button>
        </div>
      </header>

      <div className="demo-mode-content">
        <section className="demo-intro">
          <div>
            <span className="demo-eyebrow">INTERACTIVE EXHIBITION SCENARIO</span>
            <h1>From citizen report to verified issue.</h1>
            <p>
              Demonstrate how a civic issue can be reported, reviewed,
              and approved before appearing on the city map.
            </p>
          </div>
          <div className="demo-intro-icon">
            <Play size={30} />
          </div>
        </section>

        <section className="demo-stat-grid" aria-label="Demo queue statistics">
          <div className="demo-stat-card">
            <span>Pending review</span>
            <strong>{pendingCount}</strong>
            <Clock3 size={19} />
          </div>
          <div className="demo-stat-card">
            <span>Approved</span>
            <strong>{approvedCount}</strong>
            <CheckCircle2 size={19} />
          </div>
          <div className="demo-stat-card">
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
            <XCircle size={19} />
          </div>
        </section>

        <div className="demo-tab-row">
          <button
            type="button"
            className={activeTab === 'citizen' ? 'active' : ''}
            onClick={() => {
              setActiveTab('citizen');
              setMessage('');
            }}
          >
            <MapPin size={17} />
            Citizen reporting
          </button>
          <button
            type="button"
            className={activeTab === 'admin' ? 'active' : ''}
            onClick={() => {
              setActiveTab('admin');
              setMessage('');
            }}
          >
            <ShieldCheck size={17} />
            Admin review
            {pendingCount > 0 && (
              <span className="demo-tab-count">{pendingCount}</span>
            )}
          </button>
        </div>

        {message && (
          <div className="demo-message" role="status">
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {activeTab === 'citizen' ? (
          <section className="demo-workspace demo-citizen-workspace">
            <div className="demo-section-heading">
              <div>
                <span className="demo-eyebrow">STEP 01</span>
                <h2>Report a civic issue</h2>
                <p>
                  Submit a sample report as a citizen. It will enter
                  the simulated admin queue.
                </p>
              </div>
              <span className="demo-step-label">Citizen view</span>
            </div>

            <form className="demo-report-form" onSubmit={submitDemoReport}>
              <label>
                Issue category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  required
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Location or landmark
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Example: Abids, Hyderabad"
                  maxLength={180}
                  required
                />
              </label>

              <label className="demo-description-field">
                Describe the issue
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is the problem, and who might it affect?"
                  rows={5}
                  maxLength={1500}
                  required
                />
                <span className="demo-character-count">
                  {description.length}/1500
                </span>
              </label>

              <div className="demo-form-note">
                <ShieldCheck size={17} />
                <span>
                  Simulation only. This report is not sent to a real
                  municipality or saved to Supabase.
                </span>
              </div>

              <button type="submit" className="demo-primary-button">
                Submit demo report
                <ArrowLeft className="demo-arrow-rotate" size={17} />
              </button>
            </form>
          </section>
        ) : (
          <section className="demo-workspace">
            <div className="demo-section-heading">
              <div>
                <span className="demo-eyebrow">STEP 02</span>
                <h2>Review incoming reports</h2>
                <p>
                  Approve a report to add a temporary marker to the
                  map, or reject it with a reason.
                </p>
              </div>
              <span className="demo-step-label">Admin view</span>
            </div>

            <div className="demo-admin-layout">
              <aside className="demo-queue">
                <div className="demo-queue-heading">
                  <strong>Demo report queue</strong>
                  <span>{reports.length} total</span>
                </div>

                {reports.length === 0 ? (
                  <div className="demo-empty-state">
                    No reports in the queue. Submit a report from the
                    Citizen reporting tab.
                  </div>
                ) : (
                  reports.map((report) => (
                    <button
                      type="button"
                      key={report.id}
                      className={`demo-queue-item ${
                        selectedId === report.id ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setSelectedId(report.id);
                        setRejectionReason('');
                      }}
                    >
                      <span className="demo-queue-item-top">
                        <strong>{report.category}</strong>
                        <span
                          className={`demo-status-pill demo-status-${report.status
                            .toLowerCase()
                            .replaceAll(' ', '-')}`}
                        >
                          {report.status}
                        </span>
                      </span>
                      <span className="demo-queue-location">
                        <MapPin size={14} />
                        {report.location}
                      </span>
                    </button>
                  ))
                )}

                {reports.length > 0 && (
                  <button
                    type="button"
                    className="demo-clear-button"
                    onClick={clearDemoReports}
                  >
                    <Trash2 size={15} />
                    Clear demo queue
                  </button>
                )}
              </aside>

              <div className="demo-review-detail">
                {!selectedReport ? (
                  <div className="demo-empty-state">
                    Select a report to review, or submit a new one.
                  </div>
                ) : (
                  <>
                    <div className="demo-review-title-row">
                      <div>
                        <span className="demo-eyebrow">REPORT DETAILS</span>
                        <h3>{selectedReport.title}</h3>
                      </div>
                      <span
                        className={`demo-status-pill demo-status-${selectedReport.status
                          .toLowerCase()
                          .replaceAll(' ', '-')}`}
                      >
                        {selectedReport.status}
                      </span>
                    </div>

                    <div className="demo-detail-field">
                      <span>Category</span>
                      <strong>{selectedReport.category}</strong>
                    </div>

                    <div className="demo-detail-field">
                      <span>Reported location</span>
                      <strong>{selectedReport.location}</strong>
                    </div>

                    <div className="demo-detail-field">
                      <span>Description</span>
                      <p>{selectedReport.description}</p>
                    </div>

                    {selectedReport.rejectionReason && (
                      <div className="demo-rejection-note">
                        <strong>Rejection reason</strong>
                        <p>{selectedReport.rejectionReason}</p>
                      </div>
                    )}

                    {selectedReport.status === 'Pending Review' ? (
                      <div className="demo-review-actions">
                        <label>
                          Rejection reason (required to reject)
                          <input
                            value={rejectionReason}
                            onChange={(event) =>
                              setRejectionReason(event.target.value)
                            }
                            placeholder="Example: Insufficient details"
                            maxLength={300}
                          />
                        </label>

                        <div className="demo-action-buttons">
                          <button
                            type="button"
                            className="demo-reject-button"
                            onClick={() => rejectReport(selectedReport)}
                          >
                            <XCircle size={17} />
                            Reject report
                          </button>
                          <button
                            type="button"
                            className="demo-approve-button"
                            onClick={() => approveReport(selectedReport)}
                          >
                            <CheckCircle2 size={17} />
                            Approve & map
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="demo-reviewed-note">
                        <CheckCircle2 size={17} />
                        This report has already been reviewed in this demo.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        <footer className="demo-footer">
          <span>URBAN MAPS · DEMONSTRATION SCENARIO</span>
          <span>
            Locations entered here are illustrative; approved markers use
            a fixed Hyderabad coordinate.
          </span>
        </footer>
      </div>
    </div>
  );
}
