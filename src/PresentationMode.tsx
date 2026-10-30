
import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Construction,
  Gauge,
  MapPin,
  Play,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';

type Props = {
  map: MapLibreMap | null;
  onExit: () => void;
};

const demoIssues = [
  { category: 'Damaged road', area: 'Central district', severity: 92, cost: 45000, status: 'Open', exposure: 85 },
  { category: 'Waterlogging', area: 'Low-lying district', severity: 88, cost: 35000, status: 'Confirmed', exposure: 90 },
  { category: 'Broken streetlight', area: 'Residential district', severity: 61, cost: 12000, status: 'Open', exposure: 55 },
  { category: 'Footpath damage', area: 'Market district', severity: 73, cost: 18000, status: 'In Progress', exposure: 75 },
  { category: 'Illegal dumping', area: 'Public park area', severity: 68, cost: 10000, status: 'Resolved', exposure: 65 },
];

const steps = [
  {
    eyebrow: '01 / PLATFORM OVERVIEW',
    title: 'A smarter way to understand our cities.',
    description:
      'URBAN MAPS brings civic issue reporting, geographic visualization, repair prioritization, and progress tracking into one urban intelligence prototype.',
    icon: Gauge,
    center: [78.4867, 17.385] as [number, number],
    zoom: 12,
  },
  {
    eyebrow: '02 / URBAN ISSUES',
    title: 'See problems where they happen.',
    description:
      'Issue markers and the heatmap help demonstrate where reported infrastructure problems may be concentrated. These locations are illustrative sample data, not official municipal records.',
    icon: MapPin,
    center: [78.4867, 17.385] as [number, number],
    zoom: 14,
  },
  {
    eyebrow: '03 / PRIORITY SCORING',
    title: 'Address the most important issues first.',
    description:
      'A transparent rule-based score combines severity, public exposure, safety sensitivity, persistence, and recurrence to help compare repair needs.',
    icon: Target,
    center: [78.4867, 17.385] as [number, number],
    zoom: 13,
  },
  {
    eyebrow: '04 / BUDGET OPTIMIZATION',
    title: 'Make limited budgets go further.',
    description:
      'Compare illustrative repair costs and prioritize a feasible combination of projects. Real optimization requires verified estimates, an approved budget, and local constraints.',
    icon: CircleDollarSign,
    center: [78.491, 17.389] as [number, number],
    zoom: 13,
  },
  {
    eyebrow: '05 / REPAIR TRACKING',
    title: 'From a reported issue to a completed repair.',
    description:
      'A proposed workflow follows each issue through review, assignment, active repair, and resolution, making progress and outstanding work easier to understand.',
    icon: Construction,
    center: [78.482, 17.381] as [number, number],
    zoom: 13,
  },
  {
    eyebrow: '06 / ANALYTICS',
    title: 'Turn sample records into useful insights.',
    description:
      'Category, severity, status, and cost summaries illustrate how a city team could identify patterns, monitor work, and communicate performance.',
    icon: BarChart3,
    center: [78.4867, 17.385] as [number, number],
    zoom: 12,
  },
  {
    eyebrow: '07 / IMPACT & FUTURE SCOPE',
    title: 'Build cities that work better for everyone.',
    description:
      'The long-term vision is a more transparent, accessible, and data-informed approach to infrastructure maintenance. Integration with verified municipal systems and validated AI are future work.',
    icon: ShieldCheck,
    center: [78.4867, 17.385] as [number, number],
    zoom: 12,
  },
];

function getPriority(issue: (typeof demoIssues)[number]) {
  return Math.round(
    issue.severity * 0.35 +
      issue.exposure * 0.25 +
      70 * 0.2 +
      60 * 0.1 +
      50 * 0.1,
  );
}

function formatRupees(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

export default function PresentationMode({ map, onExit }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (!started) return;

    map?.flyTo({
      center: step.center,
      zoom: step.zoom,
      duration: 1200,
      essential: true,
    });
  }, [map, step, started]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit();
      } else if (event.key === 'ArrowRight') {
        setStarted(true);
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setStarted(true);
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  const next = () => {
    setStarted(true);
    if (stepIndex === steps.length - 1) {
      onExit();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const previous = () => {
    setStarted(true);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  if (!started) {
    return (
      <div className="expo-presentation">
        <div className="expo-topline">
          <span className="expo-brand">
            <Activity size={20} /> URBAN MAPS
          </span>
          <button className="expo-icon-button" onClick={onExit} aria-label="Exit presentation">
            <X size={19} />
          </button>
        </div>

        <div className="expo-intro">
          <span className="expo-kicker">EXHIBITION PRESENTATION · 3–5 MIN</span>
          <h1>Urban intelligence.<br /><span>Better repair decisions.</span></h1>
          <p>
            A guided walkthrough of the URBAN MAPS infrastructure monitoring
            and smart repair planning prototype.
          </p>

          <div className="expo-intro-stats">
            <div><strong>07</strong><span>Guided chapters</span></div>
            <div><strong>05</strong><span>Sample issue records</span></div>
            <div><strong>01</strong><span>Connected map view</span></div>
          </div>

          <button className="expo-primary-button" onClick={() => setStarted(true)}>
            <Play size={17} fill="currentColor" /> Start presentation
          </button>
          <button className="expo-text-button" onClick={onExit}>Return to live map</button>
          <p className="expo-disclaimer">
            Demonstration scenario only. Sample metrics are not official city statistics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="expo-presentation">
      <div className="expo-topline">
        <span className="expo-brand">
          <Activity size={20} /> URBAN MAPS
        </span>
        <span className="expo-live-label"><span /> DEMONSTRATION MODE</span>
        <button className="expo-icon-button" onClick={onExit} aria-label="Exit presentation">
          <X size={19} />
        </button>
      </div>

      <div className="expo-progress-track">
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="expo-layout">
        <section className="expo-main-content">
          <span className="expo-kicker">{step.eyebrow}</span>
          <div className="expo-feature-icon"><StepIcon size={25} /></div>
          <h1>{step.title}</h1>
          <p className="expo-description">{step.description}</p>

          {stepIndex === 0 && (
            <div className="expo-metric-grid">
              <Metric label="Sample issues" value="05" />
              <Metric label="Categories represented" value="05" />
              <Metric label="Workflow statuses" value="04" />
              <Metric label="Data source" value="Demo" />
            </div>
          )}

          {stepIndex === 1 && (
            <div className="expo-issue-list">
              {demoIssues.slice(0, 4).map((issue) => (
                <div className="expo-issue-row" key={issue.category}>
                  <span className="expo-issue-dot" />
                  <div><strong>{issue.category}</strong><small>{issue.area}</small></div>
                  <span className="expo-issue-score">{issue.severity}/100</span>
                </div>
              ))}
            </div>
          )}

          {stepIndex === 2 && (
            <div className="expo-scoring-card">
              <strong>Illustrative priority formula</strong>
              <div className="expo-formula">35% Severity + 25% Public Exposure</div>
              <div className="expo-formula">20% Safety + 10% Persistence</div>
              <div className="expo-formula">10% Recurrence</div>
              <p>
                Example: the damaged-road record scores approximately{' '}
                <strong>{getPriority(demoIssues[0])}/100</strong> with these
                demonstration inputs. This is a rule-based score, not a trained AI prediction.
              </p>
            </div>
          )}

          {stepIndex === 3 && (
            <div className="expo-budget-card">
              <div className="expo-budget-heading">
                <span>Illustrative repair budget</span>
                <strong>₹60,000</strong>
              </div>
              {demoIssues.slice(0, 4).map((issue) => (
                <div className="expo-budget-row" key={issue.category}>
                  <span>{issue.category}</span>
                  <strong>{formatRupees(issue.cost)}</strong>
                </div>
              ))}
              <p>
                Costs are examples only. Actual allocations should consider verified
                quotes, safety requirements, and feasible project combinations.
              </p>
            </div>
          )}

          {stepIndex === 4 && (
            <div className="expo-workflow">
              {['Reported', 'Reviewed', 'Assigned', 'In Progress', 'Resolved'].map(
                (status, index) => (
                  <div className="expo-workflow-step" key={status}>
                    <span>{index + 1}</span>
                    <div><strong>{status}</strong><small>{[
                      'Issue received',
                      'Validity checked',
                      'Team and resources allocated',
                      'Repair underway',
                      'Completion verified',
                    ][index]}</small></div>
                  </div>
                ),
              )}
            </div>
          )}

          {stepIndex === 5 && (
            <div className="expo-analytics-grid">
              <Metric label="Open" value="02" />
              <Metric label="Confirmed" value="01" />
              <Metric label="In progress" value="01" />
              <Metric label="Resolved" value="01" />
              <div className="expo-analytics-note">
                <BarChart3 size={18} />
                <span>Example distribution from five demonstration records.</span>
              </div>
            </div>
          )}

          {stepIndex === 6 && (
            <div className="expo-impact-list">
              <div><CheckCircle2 size={19} /><span>SDG 9 — resilient infrastructure and innovation</span></div>
              <div><CheckCircle2 size={19} /><span>SDG 11 — more inclusive and sustainable cities</span></div>
              <div><CheckCircle2 size={19} /><span>SDG 13 — potential support for climate-resilient planning</span></div>
              <div><Clock3 size={19} /><span>Future: verified civic data, validated AI, and authorized municipal integration</span></div>
            </div>
          )}

          <div className="expo-footer">
            <span>Use ← → to navigate · Esc to exit</span>
            <div className="expo-nav-buttons">
              <button onClick={previous} disabled={stepIndex === 0}>
                <ArrowLeft size={17} /> Previous
              </button>
              <button className="expo-primary-button" onClick={next}>
                {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                {stepIndex !== steps.length - 1 && <ArrowRight size={17} />}
              </button>
            </div>
          </div>
        </section>

        <aside className="expo-side-content">
          <div className="expo-chapter-card">
            <span className="expo-kicker">PRESENTATION GUIDE</span>
            {steps.map((item, index) => {
              const ChapterIcon = item.icon;
              return (
                <button
                  className={`expo-chapter ${index === stepIndex ? 'selected' : ''}`}
                  key={item.eyebrow}
                  onClick={() => {
                    setStarted(true);
                    setStepIndex(index);
                  }}
                >
                  <ChapterIcon size={17} />
                  <span>{item.eyebrow.split('/ ')[1]}</span>
                  {index < stepIndex && <CheckCircle2 size={15} />}
                </button>
              );
            })}
          </div>

          <div className="expo-map-note">
            <MapPin size={18} />
            <div>
              <strong>Map-linked walkthrough</strong>
              <p>The live map moves to relevant demonstration locations as you advance.</p>
            </div>
          </div>

          <div className="expo-trust-note">
            <ShieldCheck size={18} />
            <p>Prototype note: sample data, rule-based scoring, and illustrative costs. No live municipal feed is claimed.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="expo-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
