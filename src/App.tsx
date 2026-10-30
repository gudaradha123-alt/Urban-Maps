import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Filter,
  LocateFixed,
  MapPin,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  X,
  CalendarDays,
} from 'lucide-react';
import type { FeatureCollection, Point } from 'geojson';
import { supabase, ISSUE_PHOTO_BUCKET } from './lib/supabase';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';
import PresentationMode from './PresentationMode';
import DemoMode from './DemoMode';

const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined;
const HYDERABAD: [number, number] = [78.4867, 17.385];

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

const STATUSES = ['Open', 'Confirmed', 'Resolved'];

type SearchResult = {
  id: string;
  label: string;
  lon: number;
  lat: number;
};

type VerificationStatus = 'pending' | 'verified' | 'rejected';

type UrbanIssue = {
  id: string;
  coordinates: [number, number];
  category: string;
  color: string;
  status: string;
  icon: string;
  description?: string;
  photo_url?: string | null;
  createdAt?: string;
  userId?: string | null;
  verificationStatus: VerificationStatus;
  reviewReason?: string | null;
  confirmationCount: number;
  hasConfirmed: boolean;
  isDemo: boolean;
};

type SupabaseIssue = {
  id: string;
  category: string;
  description: string;
  longitude: number;
  latitude: number;
  photo_url: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
  verification_status?: VerificationStatus | null;
  review_reason?: string | null;
};

type DemoReport = {
  id: string;
  category: string;
  description: string;
  coordinates: [number, number];
};

type IconDefinition = {
  color: string;
  path: string;
};

type DuplicateCandidate = {
  issue: UrbanIssue;
  distance: number;
};

type StatusHistoryEntry = {
  id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  [CATEGORIES[0]]: { color: '#f4b740', icon: 'issue-road' },
  [CATEGORIES[1]]: { color: '#ff6b6b', icon: 'issue-trash' },
  [CATEGORIES[2]]: { color: '#f4b740', icon: 'issue-light' },
  [CATEGORIES[3]]: { color: '#4ed8ce', icon: 'issue-water' },
  [CATEGORIES[4]]: { color: '#60a5fa', icon: 'issue-pipe' },
  [CATEGORIES[5]]: { color: '#a78bfa', icon: 'issue-traffic' },
  [CATEGORIES[6]]: { color: '#60a5fa', icon: 'issue-footpath' },
  [CATEGORIES[7]]: { color: '#d1d5db', icon: 'issue-other' },
};

const ISSUE_ICONS: Record<string, IconDefinition> = {
  'issue-road': {
    color: '#f4b740',
    path: '<path d="M24 13 L17 51 M40 13 L47 51 M32 16 V23 M32 29 V36 M32 42 V49"/>',
  },
  'issue-trash': {
    color: '#ff6b6b',
    path: '<path d="M19 22 H45 L42 51 H22 Z M16 17 H48 M25 17 V12 H39 V17 M27 28 V44 M37 28 V44"/>',
  },
  'issue-light': {
    color: '#f4b740',
    path: '<path d="M23 29 A9 9 0 1 1 41 29 C41 35 37 36 36 41 H28 C27 36 23 35 23 29 Z M28 46 H36 M29 51 H35 M32 7 V12 M14 18 L19 22 M50 18 L45 22"/>',
  },
  'issue-water': {
    color: '#4ed8ce',
    path: '<path d="M32 12 C27 21 19 29 19 37 A13 13 0 0 0 45 37 C45 29 37 21 32 12 Z M26 39 C27 43 30 45 34 45"/>',
  },
  'issue-pipe': {
    color: '#60a5fa',
    path: '<path d="M13 25 H25 V18 H39 V25 H51 V39 H39 V46 H25 V39 H13 Z M25 25 V39 M39 25 V39"/>',
  },
  'issue-traffic': {
    color: '#a78bfa',
    path: '<path d="M17 43 L21 23 H43 L47 43 Z M24 23 L27 16 H37 L40 23 M24 30 H40 M22 36 H42"/><circle cx="24" cy="43" r="4"/><circle cx="40" cy="43" r="4"/>',
  },
  'issue-footpath': {
    color: '#60a5fa',
    path: '<circle cx="34" cy="15" r="5"/><path d="M31 22 L26 34 L35 38 L39 29 L45 34 M26 34 L21 46 M35 38 L39 51 M28 27 L19 32"/>',
  },
  'issue-other': {
    color: '#d1d5db',
    path: '<path d="M22 23 A11 11 0 1 1 41 31 C36 35 32 37 32 43"/><circle cx="32" cy="51" r="2"/>',
  },
};

const PENDING_MARKER_COLOR = '#f5b82e';
const REJECTED_MARKER_COLOR = '#ef4444';

function categoryStyle(category: string) {
  const match = CATEGORIES.find(
    (item) => item.toLowerCase() === category.trim().toLowerCase(),
  );

  return CATEGORY_STYLES[match ?? CATEGORIES[7]];
}

function normalizeStatus(status: string): string {
  const value = status.trim().toLowerCase();

  if (value === 'open') return 'Open';
  if (value === 'confirmed') return 'Confirmed';
  if (value === 'resolved') return 'Resolved';

  return status;
}

function normalizeVerification(
  value: string | null | undefined,
): VerificationStatus {
  if (value === 'verified' || value === 'rejected') return value;
  return 'pending';
}

function createIssueSvg(circleColor: string, path: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="29" fill="${circleColor}" stroke="#ffffff" stroke-width="3"/>
      <g fill="none" stroke="#15202b" stroke-width="3.2"
         stroke-linecap="round" stroke-linejoin="round">
        ${path}
      </g>
    </svg>
  `;
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load a map marker icon.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function markerIconForIssue(issue: UrbanIssue): string {
  if (issue.verificationStatus === 'verified') return issue.icon;
  if (issue.verificationStatus === 'rejected') return `rejected-${issue.icon}`;
  return `pending-${issue.icon}`;
}

function createIssueGeoJSON(
  issues: UrbanIssue[],
  categories: string[],
  statuses: string[],
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: issues
      .filter(
        (issue) =>
          categories.length === 0 || categories.includes(issue.category),
      )
      .filter((issue) => statuses.includes(issue.status))
      .map((issue) => ({
        type: 'Feature' as const,
        properties: {
          id: issue.id,
          category: issue.category,
          color: issue.color,
          icon: markerIconForIssue(issue),
          status: issue.status,
          verificationStatus: issue.verificationStatus,
          description: issue.description ?? '',
          photo_url: issue.photo_url ?? '',
          createdAt: issue.createdAt ?? '',
          isDemo: issue.isDemo,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: issue.coordinates,
        },
      })),
  };
}

function formatDate(date?: string): string {
  if (!date) return 'Date unavailable';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';

  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function distanceInMeters(
  a: [number, number],
  b: [number, number],
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * 3D building rendering.
 * The extrusion layer starts hidden and is enabled by the 3D control.
 */
function add3DBuildings(map: MapLibreMap): void {
  const sourceId = 'urban-buildings-3d';
  const layerId = 'urban-buildings-3d';

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
  }

  if (map.getLayer(layerId)) return;

  const styleLayers = map.getStyle().layers ?? [];

  const firstLabelLayer = styleLayers.find(
    (layer) =>
      layer.type === 'symbol' &&
      layer.layout != null &&
      'text-field' in layer.layout,
  );

  const buildingLayer: maplibregl.FillExtrusionLayerSpecification = {
    id: layerId,
    type: 'fill-extrusion',
    source: sourceId,
    'source-layer': 'building',
    minzoom: 14,
    filter: [
      'any',
      ['>', ['to-number', ['get', 'render_height']], 0],
      ['>', ['to-number', ['get', 'height']], 0],
    ],
    layout: {
      visibility: 'none',
    },
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        [
          'coalesce',
          ['to-number', ['get', 'render_height']],
          ['to-number', ['get', 'height']],
          9,
        ],
        0, '#aab8c6',
        15, '#899bad',
        45, '#71869a',
        100, '#5b7186',
      ],
      'fill-extrusion-opacity': 1,
      'fill-extrusion-height': [
        'max',
        3,
        [
          'coalesce',
          ['to-number', ['get', 'render_height']],
          ['to-number', ['get', 'height']],
          9,
        ],
      ],
      'fill-extrusion-base': 0,
      'fill-extrusion-vertical-gradient': false,
    },
  };

  if (firstLabelLayer) {
    map.addLayer(buildingLayer, firstLabelLayer.id);
  } else {
    map.addLayer(buildingLayer);
  }
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const showReportRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [signedInUser, setSignedInUser] = useState<string | null>(null);
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoApprovedIssues, setDemoApprovedIssues] = useState<UrbanIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<UrbanIssue | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMyReports, setShowMyReports] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUSES);
  const [issues, setIssues] = useState<UrbanIssue[]>([]);

  const [reportLocation, setReportLocation] = useState<[number, number] | null>(null);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  // New: reporter resolution controls and action loading state.
  const [resolutionNote, setResolutionNote] = useState('');
  const [issueActionLoading, setIssueActionLoading] = useState(false);

  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyIssueId, setHistoryIssueId] = useState<string | null>(null);

  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [map3D, setMap3D] = useState(false);

  const latestIssuesRef = useRef<UrbanIssue[]>([]);
  const latestFiltersRef = useRef({
    categories: [] as string[],
    statuses: STATUSES,
  });

  const closeReport = useCallback(() => {
    showReportRef.current = false;
    setShowReport(false);
    setShowDuplicates(false);
    setDuplicateCandidates([]);
  }, []);

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setMessage('Supabase is not configured. Check your environment variables.');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (error) setMessage(`Google sign-in failed: ${error.message}`);
  };

  const handleSignOut = async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign-out failed: ${error.message}`);
    } else {
      setMessage('Signed out successfully.');
      setSelectedIssue(null);
      setShowMyReports(false);
      setIsAdmin(false);
      closeReport();
    }
  };

  const handleDemoApproved = useCallback((report: DemoReport) => {
    const style = categoryStyle(report.category);

    const newIssue: UrbanIssue = {
      id: report.id,
      coordinates: report.coordinates,
      category: report.category,
      color: style.color,
      status: 'Confirmed',
      icon: style.icon,
      description: report.description,
      verificationStatus: 'pending',
      confirmationCount: 0,
      hasConfirmed: false,
      isDemo: true,
    };

    setDemoApprovedIssues((current) => [
      ...current.filter((issue) => issue.id !== report.id),
      newIssue,
    ]);
  }, []);

  const exitDemoMode = useCallback(() => {
    setDemoMode(false);
    setDemoApprovedIssues([]);
  }, []);

  const updateUserMarker = useCallback(
    (map: MapLibreMap, longitude: number, latitude: number) => {
      if (!userMarkerRef.current) {
        const dot = document.createElement('div');
        dot.className = 'urban-maps-user-dot';
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', 'Your current location');

        Object.assign(dot.style, {
          width: '18px',
          height: '18px',
          boxSizing: 'border-box',
          borderRadius: '50%',
          background: '#2589ff',
          border: '3px solid #ffffff',
          boxShadow: '0 0 0 7px rgba(37,137,255,0.25), 0 1px 6px rgba(0,0,0,0.45)',
        });

        userMarkerRef.current = new maplibregl.Marker({
          element: dot,
          anchor: 'center',
        })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([longitude, latitude]);

        if (!userMarkerRef.current.getElement().isConnected) {
          userMarkerRef.current.addTo(map);
        }
      }
    },
    [],
  );

  const loadReports = useCallback(async () => {
    if (!supabase) {
      setIssues([]);
      return;
    }

    let data: Record<string, unknown>[] | null = null;

    const enhancedQuery = await supabase
      .from('issues')
      .select(`
        id,
        category,
        description,
        longitude,
        latitude,
        photo_url,
        status,
        created_at,
        user_id,
        verification_status,
        review_reason
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!enhancedQuery.error) {
      data = (enhancedQuery.data ?? []) as unknown as Record<string, unknown>[];
    } else {
      console.error(
        'Enhanced report query failed; trying basic columns:',
        enhancedQuery.error,
      );

      const basicQuery = await supabase
        .from('issues')
        .select(`
          id,
          category,
          description,
          longitude,
          latitude,
          photo_url,
          status,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (basicQuery.error) {
        console.error('Basic report query failed:', basicQuery.error);
        setMessage(`Could not load reports: ${basicQuery.error.message}`);
        setIssues([]);
        return;
      }

      data = (basicQuery.data ?? []) as unknown as Record<string, unknown>[];
    }

    const confirmationCounts = new Map<string, number>();
    const myConfirmedIds = new Set<string>();

    if (signedInUserId) {
      const { data: confirmationRows, error: confirmationError } = await supabase
        .from('issue_confirmations')
        .select('issue_id, user_id');

      if (confirmationError) {
        console.warn('Could not load confirmations:', confirmationError);
      } else {
        for (const row of confirmationRows ?? []) {
          confirmationCounts.set(
            row.issue_id,
            (confirmationCounts.get(row.issue_id) ?? 0) + 1,
          );

          if (row.user_id === signedInUserId) {
            myConfirmedIds.add(row.issue_id);
          }
        }
      }
    }

    const databaseIssues: UrbanIssue[] = ((data ?? []) as unknown as SupabaseIssue[])
      .filter(
        (report) =>
          Number.isFinite(Number(report.longitude)) &&
          Number.isFinite(Number(report.latitude)),
      )
      .map((report) => {
        const style = categoryStyle(report.category);

        return {
          id: report.id,
          coordinates: [Number(report.longitude), Number(report.latitude)],
          category: report.category,
          color: style.color,
          icon: style.icon,
          status: normalizeStatus(report.status),
          description: report.description,
          photo_url: report.photo_url,
          createdAt: report.created_at,
          userId: report.user_id,
          verificationStatus: normalizeVerification(report.verification_status),
          reviewReason: report.review_reason ?? null,
          confirmationCount: confirmationCounts.get(report.id) ?? 0,
          hasConfirmed: myConfirmedIds.has(report.id),
          isDemo: false,
        };
      });

    setIssues(databaseIssues);
  }, [signedInUserId]);

  // Restore the Supabase session.
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const updateUser = (session: {
      user: {
        id: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
      };
    } | null) => {
      if (!active) return;

      const metadata = session?.user.user_metadata;
      const name = metadata?.full_name ?? metadata?.name ?? session?.user.email;

      setSignedInUser(typeof name === 'string' ? name : null);
      setSignedInUserId(session?.user.id ?? null);
      setAuthLoading(false);
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Could not read Supabase session:', error);
      updateUser(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check administrator permission from Supabase.
  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      setIsAdmin(false);

      if (!supabase || !signedInUserId) {
        setAdminChecking(false);
        return;
      }

      setAdminChecking(true);

      try {
        const { data, error } = await supabase.rpc('is_urban_maps_admin');
        if (error) throw error;
        if (active) setIsAdmin(data === true);
      } catch (error) {
        console.error('Could not check administrator permission:', error);
        if (active) setIsAdmin(false);
      } finally {
        if (active) setAdminChecking(false);
      }
    };

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [signedInUserId]);

  // Load reports and subscribe to database changes.
  useEffect(() => {
    void loadReports();

    if (!supabase) return;

    const channel = supabase
      .channel('urban-maps-issue-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => void loadReports(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issue_confirmations' },
        () => void loadReports(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Supabase realtime subscription failed.');
        }
      });

    return () => {
      if (supabase) {
  void supabase.removeChannel(channel);
}
    };
  }, [loadReports]);

  // Initialize the Geoapify map.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!API_KEY || API_KEY === 'your_actual_geoapify_key') {
      setMapError('Add VITE_GEOAPIFY_API_KEY to .env.local and restart the dev server.');
      return;
    }

    let disposed = false;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=${encodeURIComponent(API_KEY)}`,
      center: HYDERABAD,
      zoom: 12,
      minZoom: 3,
      maxZoom: 20,
      maxPitch: 80,
      pitch: 0,
      bearing: 0,
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;
    setMapInstance(map);

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left',
    );

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      'bottom-right',
    );

    map.on('load', async () => {
      if (disposed || mapRef.current !== map) return;

      try {
        const loadedIcons: {
          id: string;
          image: HTMLImageElement;
        }[] = [];

        for (const [id, definition] of Object.entries(ISSUE_ICONS)) {
          loadedIcons.push({
            id,
            image: await loadSvgImage(
              createIssueSvg(definition.color, definition.path),
            ),
          });

          loadedIcons.push({
            id: `pending-${id}`,
            image: await loadSvgImage(
              createIssueSvg(PENDING_MARKER_COLOR, definition.path),
            ),
          });

          loadedIcons.push({
            id: `rejected-${id}`,
            image: await loadSvgImage(
              createIssueSvg(REJECTED_MARKER_COLOR, definition.path),
            ),
          });
        }

        if (disposed || mapRef.current !== map) return;

        for (const { id, image } of loadedIcons) {
          if (!map.hasImage(id)) {
            map.addImage(id, image, { pixelRatio: 2 });
          }
        }

        add3DBuildings(map);

        map.addSource('urban-issues', {
          type: 'geojson',
          data: createIssueGeoJSON(
            latestIssuesRef.current,
            latestFiltersRef.current.categories,
            latestFiltersRef.current.statuses,
          ),
        });

        // Heatmap stays visible at every zoom level.
        map.addLayer({
          id: 'urban-issue-heatmap',
          type: 'heatmap',
          source: 'urban-issues',
          maxzoom: 20,
          paint: {
            'heatmap-weight': [
              'match',
              ['get', 'status'],
              'Confirmed', 1.2,
              'Open', 1,
              0.8,
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 0.9,
              10, 1.2,
              15, 1.5,
              20, 1.8,
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 12,
              8, 22,
              12, 35,
              15, 45,
              20, 55,
            ],
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 0.38,
              12, 0.42,
              18, 0.45,
              20, 0.4,
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(40,205,202,0)',
              0.05, 'rgba(40,205,202,0.2)',
              0.15, 'rgba(40,205,202,0.45)',
              0.3, 'rgba(128,219,154,0.55)',
              0.45, 'rgba(243,209,102,0.62)',
              0.65, 'rgba(255,148,89,0.68)',
              0.85, 'rgba(255,83,100,0.72)',
              1, 'rgba(237,35,76,0.76)',
            ],
          },
        });

        // Issue icons smoothly fade as you zoom out.
        // At zoom 10 or below, icons are invisible.
        // From zoom 10 to 12, they gradually appear.
        map.addLayer({
          id: 'urban-issue-markers',
          type: 'symbol',
          source: 'urban-issues',
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 0,
              8, 0,
              9.5, 0,
              10.5, 0.2,
              11.5, 0.45,
              12.5, 0.7,
              13.5, 0.85,
              16, 0.9,
              20, 1,
            ],
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 0,
              9.5, 0,
              10.5, 0.12,
              11, 0.35,
              11.5, 0.65,
              12, 0.88,
              12.5, 1,
              20, 1,
            ],
          },
        });

        // Keep the heatmap underneath the individual issue icons.
        map.moveLayer('urban-issue-heatmap', 'urban-issue-markers');

        map.on('click', 'urban-issue-markers', (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          if (!id) return;

          // Ignore clicks on icons that are effectively faded out.
          if (map.getZoom() < 10.5) return;

          const issue = latestIssuesRef.current.find(
            (item) => item.id === String(id),
          );

          if (issue) {
            setSelectedIssue(issue);
            setShowReport(false);
            setShowFilters(false);
            setShowMyReports(false);
            showReportRef.current = false;
          }
        });

        map.on('mouseenter', 'urban-issue-markers', () => {
          map.getCanvas().style.cursor =
            map.getZoom() < 10.5 ? '' : 'pointer';
        });

        map.on('mouseleave', 'urban-issue-markers', () => {
          map.getCanvas().style.cursor = '';
        });

        // Keep the cursor correct while the zoom level changes.
        map.on('zoom', () => {
          if (map.getZoom() < 10.5) {
            map.getCanvas().style.cursor = '';
          }
        });

        setMapReady(true);
        setMapError('');

        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (disposed || mapRef.current !== map) return;

              const longitude = position.coords.longitude;
              const latitude = position.coords.latitude;

              updateUserMarker(map, longitude, latitude);
              map.flyTo({
                center: [longitude, latitude],
                zoom: 15,
                essential: true,
              });
            },
            (error) => console.warn('Could not get GPS location:', error.message),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000,
            },
          );
        }
      } catch (error) {
        console.error('Map initialization failed:', error);

        if (!disposed) {
          setMapError(
            'Could not initialize the map or its icons. Check your Geoapify key and browser console.',
          );
        }
      }
    });

    map.on('error', (event: maplibregl.ErrorEvent) => {
      if (event.error) console.error('MapLibre error:', event.error);
    });

    map.on('click', (event: maplibregl.MapMouseEvent) => {
      if (!showReportRef.current) return;
      setReportLocation([event.lngLat.lng, event.lngLat.lat]);
    });

    return () => {
      disposed = true;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();

      if (mapRef.current === map) mapRef.current = null;

      setMapInstance((current) => (current === map ? null : current));
      setMapReady(false);
    };
  }, [updateUserMarker]);

  // Update markers whenever report data or verification status changes.
  useEffect(() => {
    const mapIssues = demoMode ? [...issues, ...demoApprovedIssues] : issues;

    latestIssuesRef.current = mapIssues;
    latestFiltersRef.current = {
      categories: selectedCategories,
      statuses: selectedStatuses,
    };

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('urban-issues') as GeoJSONSource | undefined;

    source?.setData(
      createIssueGeoJSON(mapIssues, selectedCategories, selectedStatuses),
    );
  }, [
    issues,
    demoMode,
    demoApprovedIssues,
    selectedCategories,
    selectedStatuses,
  ]);

  const moveToUser = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!navigator.geolocation) {
      map.flyTo({ center: HYDERABAD, zoom: 12 });
      setMessage('Location is unavailable. Showing Hyderabad.');
      return;
    }

    setMessage('Finding your location…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (mapRef.current !== map) return;

        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;

        updateUserMarker(map, longitude, latitude);
        map.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          essential: true,
        });
        setMessage('Showing your current location.');
      },
      (error) => {
        console.warn('Location request failed:', error.message);
        setMessage('Could not get your location. Check browser location permission.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }, [updateUserMarker]);

  const searchPlaces = useCallback(async () => {
    if (!query.trim()) return;

    if (!API_KEY) {
      setMessage('Add your Geoapify key to enable search.');
      return;
    }

    setSearching(true);
    setResults([]);

    try {
      const params = new URLSearchParams({
        text: query.trim(),
        limit: '5',
        format: 'geojson',
        apiKey: API_KEY,
      });

      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?${params}`,
      );

      if (!response.ok) {
        throw new Error(`Search returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const found: SearchResult[] = (data.features ?? []).map(
        (feature: {
          properties: { place_id?: string; formatted?: string };
          geometry: { coordinates: [number, number] };
        }) => ({
          id:
            feature.properties.place_id ??
            feature.properties.formatted ??
            `${feature.geometry.coordinates[0]},${feature.geometry.coordinates[1]}`,
          label: feature.properties.formatted ?? 'Unknown location',
          lon: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
        }),
      );

      setResults(found);
      if (found.length === 0) setMessage('No matching places found.');
    } catch (error) {
      console.error('Place search failed:', error);
      setMessage('Search failed. Check your Geoapify key and network.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const chooseResult = (result: SearchResult) => {
    mapRef.current?.flyTo({
      center: [result.lon, result.lat],
      zoom: 15,
      essential: true,
    });

    setQuery(result.label);
    setResults([]);
    setMessage('');
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  };

  const startReport = () => {
    if (authLoading) {
      setMessage('Checking your sign-in status. Please try again in a moment.');
      return;
    }

    if (!signedInUserId) {
      setMessage('Please sign in with Google before submitting a report.');
      setShowReport(false);
      showReportRef.current = false;
      return;
    }

    const center = mapRef.current?.getCenter();
    if (center) setReportLocation([center.lng, center.lat]);

    setSelectedIssue(null);
    setShowMyReports(false);
    showReportRef.current = true;
    setShowReport(true);
    setShowFilters(false);
  };

  const findNearbyDuplicates = useCallback((): DuplicateCandidate[] => {
    if (!reportLocation || !reportCategory) return [];

    return issues
      .filter(
        (issue) =>
          !issue.isDemo &&
          issue.category === reportCategory &&
          issue.status !== 'Resolved',
      )
      .map((issue) => ({
        issue,
        distance: distanceInMeters(reportLocation, issue.coordinates),
      }))
      .filter((candidate) => candidate.distance <= 200)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [issues, reportLocation, reportCategory]);

  const submitReport = async () => {
    if (!supabase || !signedInUserId) {
      setMessage('You must sign in before submitting a report.');
      closeReport();
      return;
    }

    if (!reportLocation) {
      setMessage('Click the map to choose a report location.');
      return;
    }

    if (!reportCategory) {
      setMessage('Please select an issue category.');
      return;
    }

    if (!reportDescription.trim()) {
      setMessage('Please describe the issue.');
      return;
    }

    if (reportDescription.trim().length > 1500) {
      setMessage('The description must be 1,500 characters or fewer.');
      return;
    }

    if (!reportPhoto) {
      setMessage('Please attach a photo of the issue.');
      return;
    }

    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    if (!allowedTypes[reportPhoto.type]) {
      setMessage('Choose a JPG, PNG, WebP, or GIF image.');
      return;
    }

    if (reportPhoto.size > 5 * 1024 * 1024) {
      setMessage('The photo must be 5 MB or smaller.');
      return;
    }

    if (!showDuplicates) {
      const duplicates = findNearbyDuplicates();

      if (duplicates.length > 0) {
        setDuplicateCandidates(duplicates);
        setShowDuplicates(true);
        setMessage('Review the similar reports before submitting.');
        return;
      }
    }

    setSubmittingReport(true);
    setMessage('Uploading your report…');

    let uploadedPath: string | null = null;

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const currentUserId = sessionData.session?.user.id;

      if (!currentUserId || currentUserId !== signedInUserId) {
        setSignedInUser(null);
        setSignedInUserId(null);
        throw new Error('Your session has expired. Please sign in again.');
      }

      const filePath =
        `reports/${currentUserId}/${crypto.randomUUID()}.${allowedTypes[reportPhoto.type]}`;

      const { error: uploadError } = await supabase.storage
        .from(ISSUE_PHOTO_BUCKET)
        .upload(filePath, reportPhoto, {
          cacheControl: '3600',
          contentType: reportPhoto.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPath = filePath;

      const { data: photoData } = supabase.storage
        .from(ISSUE_PHOTO_BUCKET)
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('issues')
        .insert({
          user_id: currentUserId,
          category: reportCategory,
          description: reportDescription.trim(),
          longitude: reportLocation[0],
          latitude: reportLocation[1],
          photo_url: photoData.publicUrl,
          status: 'Open',
          verification_status: 'pending',
        });

      if (insertError) throw insertError;

      await loadReports();

      setReportCategory('');
      setReportDescription('');
      setReportPhoto(null);
      setDuplicateCandidates([]);
      setShowDuplicates(false);

      if (photoInputRef.current) photoInputRef.current.value = '';

      closeReport();
      setMessage('Report submitted. Its map marker is amber until admin review.');
    } catch (error) {
      console.error('Report submission failed:', error);

      if (uploadedPath && supabase) {
        const { error: cleanupError } = await supabase.storage
          .from(ISSUE_PHOTO_BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.warn('Could not remove unused uploaded photo:', cleanupError);
        }
      }

      setMessage(
        error instanceof Error
          ? `Could not submit report: ${error.message}`
          : 'Could not submit report. Check your Supabase configuration.',
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  const confirmSelectedIssue = async () => {
    if (!supabase || !signedInUserId || !selectedIssue || selectedIssue.isDemo) {
      setMessage('Sign in to confirm a saved community report.');
      return;
    }

    if (selectedIssue.userId === signedInUserId) {
      setMessage('You cannot community-confirm your own report.');
      return;
    }

    const { error } = await supabase.from('issue_confirmations').insert({
      issue_id: selectedIssue.id,
      user_id: signedInUserId,
    });

    if (error) {
      setMessage(
        error.code === '23505'
          ? 'You have already confirmed this report.'
          : `Could not confirm report: ${error.message}`,
      );
      return;
    }

    setMessage('Community confirmation recorded.');
    await loadReports();

    setSelectedIssue((current) =>
      current?.id === selectedIssue.id
        ? {
            ...current,
            hasConfirmed: true,
            confirmationCount: current.confirmationCount + 1,
          }
        : current,
    );
  };

  const reviewSelectedIssue = async (
    verificationStatus: 'verified' | 'rejected',
  ) => {
    if (!supabase || !isAdmin || !selectedIssue || selectedIssue.isDemo) {
      setMessage('Administrator access is required.');
      return;
    }

    const { error } = await supabase
      .from('issues')
      .update({
        verification_status: verificationStatus,
        review_reason: reviewReason.trim() || null,
        reviewed_by: signedInUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', selectedIssue.id);

    if (error) {
      setMessage(`Review failed: ${error.message}`);
      return;
    }

    const savedReason = reviewReason.trim() || null;
    setReviewReason('');

    setSelectedIssue((current) =>
      current?.id === selectedIssue.id
        ? {
            ...current,
            verificationStatus,
            reviewReason: savedReason,
          }
        : current,
    );

    setMessage(
      verificationStatus === 'verified'
        ? 'Report approved. Its original category marker will now be shown.'
        : 'Report rejected. Its marker will remain red.',
    );

    await loadReports();
  };

  // NEW: Original reporter can mark their own issue as resolved.
  const reportSelectedIssueResolved = async () => {
    if (!supabase || !signedInUserId || !selectedIssue || selectedIssue.isDemo) {
      setMessage('Sign in to report an issue as resolved.');
      return;
    }

    if (selectedIssue.userId !== signedInUserId) {
      setMessage('Only the original reporter can report this issue as resolved.');
      return;
    }

    if (selectedIssue.status === 'Resolved') {
      setMessage('This issue is already marked as resolved.');
      return;
    }

    setIssueActionLoading(true);

    try {
      const issueId = selectedIssue.id;

      const { error } = await supabase.rpc('report_urban_issue_resolved', {
        p_issue_id: issueId,
        p_note: resolutionNote.trim() || null,
      });

      if (error) throw error;

      setSelectedIssue((current) =>
        current?.id === issueId
          ? { ...current, status: 'Resolved' }
          : current,
      );

      setResolutionNote('');
      setMessage('Issue marked as resolved. Status history has been updated.');

      await loadReports();
      await loadStatusHistory(issueId);
    } catch (error) {
      console.error('Could not report issue as resolved:', error);

      setMessage(
        error instanceof Error
          ? `Could not update issue: ${error.message}`
          : 'Could not report this issue as resolved.',
      );
    } finally {
      setIssueActionLoading(false);
    }
  };

  // NEW: Admin can change the issue status, including reopening resolved reports.
  const adminSetIssueStatus = async (nextStatus: string) => {
    if (!supabase || !isAdmin || !selectedIssue || selectedIssue.isDemo) {
      setMessage('Administrator access is required.');
      return;
    }

    if (!STATUSES.includes(nextStatus)) {
      setMessage('Invalid issue status.');
      return;
    }

    if (selectedIssue.status === nextStatus) {
      setMessage(`This issue is already ${nextStatus.toLowerCase()}.`);
      return;
    }

    setIssueActionLoading(true);

    try {
      const issueId = selectedIssue.id;
      const isResolved = nextStatus === 'Resolved';

      const { error } = await supabase
        .from('issues')
        .update({
          status: nextStatus,
          resolution_note: isResolved ? reviewReason.trim() || null : null,
          resolved_at: isResolved ? new Date().toISOString() : null,
          resolved_by: isResolved ? signedInUserId : null,
        })
        .eq('id', issueId);

      if (error) throw error;

      setSelectedIssue((current) =>
        current?.id === issueId
          ? { ...current, status: nextStatus }
          : current,
      );

      setReviewReason('');
      setMessage(`Administrator updated the issue status to ${nextStatus}.`);

      await loadReports();
      await loadStatusHistory(issueId);
    } catch (error) {
      console.error('Administrator status update failed:', error);

      setMessage(
        error instanceof Error
          ? `Status update failed: ${error.message}`
          : 'Could not update the issue status.',
      );
    } finally {
      setIssueActionLoading(false);
    }
  };

  // NEW: Admin can permanently delete a saved issue.
  const deleteSelectedIssue = async () => {
    if (!supabase || !isAdmin || !selectedIssue || selectedIssue.isDemo) {
      setMessage('Administrator access is required to delete an issue.');
      return;
    }

    const issue = selectedIssue;

    const confirmed = window.confirm(
      `Permanently delete this ${issue.category} report? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setIssueActionLoading(true);

    try {
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', issue.id);

      if (error) throw error;

      setIssues((current) =>
        current.filter((item) => item.id !== issue.id),
      );

      setSelectedIssue(null);
      setStatusHistory([]);
      setHistoryIssueId(null);
      setMessage('Issue deleted successfully.');
    } catch (error) {
      console.error('Issue deletion failed:', error);

      setMessage(
        error instanceof Error
          ? `Could not delete issue: ${error.message}`
          : 'Could not delete the issue.',
      );
    } finally {
      setIssueActionLoading(false);
    }
  };

  const loadStatusHistory = async (issueId: string) => {
    if (!supabase || !signedInUserId) {
      setMessage('Sign in to view status history.');
      return;
    }

    const { data, error } = await supabase
      .from('issue_status_history')
      .select('id, old_status, new_status, note, created_at')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setMessage(`Could not load status history: ${error.message}`);
      return;
    }

    setStatusHistory((data ?? []) as StatusHistoryEntry[]);
    setHistoryIssueId(issueId);
  };

  const myReports = issues.filter(
    (issue) => !issue.isDemo && issue.userId === signedInUserId,
  );

  return (
    <main className="app-shell">
      <div className="map-canvas" ref={mapContainer} />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Urban Maps home">
          <span className="brand-icon">
            <MapPin size={21} strokeWidth={2.6} />
          </span>
          <span className="brand-copy">
            <strong>URBAN<span>MAPS</span></strong>
            <small>Make your city better.</small>
          </span>
        </a>

        <div className="search-wrap">
          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              void searchPlaces();
            }}
          >
            <Search size={19} />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search places, addresses or issues"
              aria-label="Search places and addresses"
            />

            {query && (
              <button
                className="icon-button clear-search"
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}

            <button
              className="search-submit"
              type="submit"
              disabled={searching}
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {results.length > 0 && (
            <div className="search-results">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => chooseResult(result)}
                >
                  <MapPin size={17} />
                  <span>{result.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="sign-in-button"
          type="button"
          onClick={() => {
            setShowFilters(false);
            setShowMyReports(false);
            closeReport();
            setDemoMode(false);
            setPresentationMode(true);
          }}
          title="Start the guided exhibition presentation"
        >
          <Play size={16} /> Presentation Mode
        </button>

        <button
          className="sign-in-button"
          type="button"
          onClick={() => {
            setShowFilters(false);
            setShowMyReports(false);
            closeReport();
            setPresentationMode(false);
            setDemoMode(true);
          }}
          title="Run the interactive exhibition demo"
        >
          <Play size={16} /> Demo Mode
        </button>

        <button
          className="sign-in-button"
          type="button"
          disabled={authLoading}
          onClick={() => {
            if (signedInUserId) void handleSignOut();
            else void handleGoogleSignIn();
          }}
          title={signedInUserId ? 'Click to sign out' : 'Sign in with Google'}
        >
          {authLoading
            ? 'Checking session…'
            : signedInUser
              ? `Signed in: ${signedInUser}`
              : 'Sign in with Google'}
          <ChevronDown size={15} />
        </button>
      </header>

      {/* The MAP LIVE / HYDERABAD strip has been removed. */}

      <div className="map-controls">
        <button
          className="map-control"
          type="button"
          onClick={moveToUser}
          aria-label="Go to my location"
          title="My location"
        >
          <LocateFixed size={20} />
        </button>

        <button
          className={`map-control ${showFilters ? 'active' : ''}`}
          type="button"
          onClick={() => {
            setShowFilters((open) => !open);
            closeReport();
            setShowMyReports(false);
            setSelectedIssue(null);
          }}
          aria-label="Filter issues"
          title="Filter issues"
        >
          <Filter size={20} />
          {(selectedCategories.length > 0 ||
            selectedStatuses.length !== STATUSES.length) && <i />}
        </button>

        <button
          className={`map-control ${showMyReports ? 'active' : ''}`}
          type="button"
          onClick={() => {
            if (!signedInUserId) {
              setMessage('Sign in to view your reports.');
              return;
            }

            setShowMyReports((current) => !current);
            setShowFilters(false);
            closeReport();
            setSelectedIssue(null);
          }}
          title="My reports"
          aria-label="My reports"
        >
          <ShieldCheck size={20} />
        </button>

        <button
          className={`map-control ${map3D ? 'active' : ''}`}
          type="button"
          onClick={() => {
            const map = mapRef.current;

            if (!map || !map.isStyleLoaded()) {
              setMessage('The map is still loading. Please try again.');
              return;
            }

            if (!map.getLayer('urban-buildings-3d')) {
              setMessage('3D buildings are not available yet. Please wait for the map to load.');
              return;
            }

            const next = !map3D;
            setMap3D(next);

            map.setLayoutProperty(
              'urban-buildings-3d',
              'visibility',
              next ? 'visible' : 'none',
            );

            if (next) {
              map.easeTo({
                pitch: Math.max(map.getPitch(), 55),
                zoom: Math.max(map.getZoom(), 15.5),
                duration: 700,
              });
            } else {
              map.easeTo({
                pitch: 0,
                duration: 500,
              });
            }
          }}
          title={map3D ? 'Hide 3D buildings' : 'Show 3D buildings'}
          aria-label="Toggle 3D buildings"
        >
          3D
        </button>
      </div>

      <div className="map-legend">
        <span className="legend-title">REPORT DENSITY</span>
        <div className="legend-gradient" />
        <div className="legend-labels">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <div className="verification-legend">
        <span><i className="verification-dot pending" /> Awaiting review</span>
        <span><i className="verification-dot verified" /> Verified</span>
        <span><i className="verification-dot rejected" /> Rejected</span>
      </div>

      <button className="report-button" type="button" onClick={startReport}>
        <AlertTriangle size={19} />
        <span>{signedInUserId ? 'Report an issue' : 'Sign in to report'}</span>
      </button>

      {!mapReady && !mapError && (
        <div className="map-status">
          <span className="spinner" />
          Loading city map…
        </div>
      )}

      {mapError && (
        <div className="error-banner">
          <AlertTriangle size={19} />
          <span>{mapError}</span>
        </div>
      )}

      {message && (
        <div className="toast-message">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {showMyReports && (
        <section className="side-panel my-reports-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR ACTIVITY</span>
              <h2>My reports</h2>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={() => setShowMyReports(false)}
              aria-label="Close My Reports"
            >
              <X size={19} />
            </button>
          </div>

          {!signedInUserId ? (
            <p className="panel-note">
              Your session is not signed in. Sign in with the Google account
              you used to submit your reports.
            </p>
          ) : myReports.length === 0 ? (
            <div className="panel-note">
              <p>No reports are linked to this account yet.</p>
              <p>
                Check that you submitted the report while signed in to this
                same Google account. Older reports may not have an owner recorded.
              </p>
              <button
                className="secondary-button full-width"
                type="button"
                onClick={() => void loadReports()}
              >
                Refresh reports
              </button>
            </div>
          ) : (
            myReports.map((issue) => (
              <button
                className="my-report-row"
                key={issue.id}
                type="button"
                onClick={() => {
                  setSelectedIssue(issue);
                  setShowMyReports(false);
                  mapRef.current?.flyTo({
                    center: issue.coordinates,
                    zoom: 16,
                    essential: true,
                  });
                }}
              >
                <strong>{issue.category}</strong>
                <span>
                  {issue.status} · {issue.verificationStatus}
                </span>
                <small>{formatDate(issue.createdAt)}</small>
              </button>
            ))
          )}
        </section>
      )}

      {selectedIssue && (
        <section className="side-panel issue-details-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CIVIC ISSUE DETAILS</span>
              <h2>{selectedIssue.category}</h2>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setSelectedIssue(null);
                setHistoryIssueId(null);
              }}
              aria-label="Close issue details"
            >
              <X size={19} />
            </button>
          </div>

          {selectedIssue.photo_url ? (
            <a
              className="issue-photo-link"
              href={selectedIssue.photo_url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open report photo in a new tab"
            >
              <img
                className="issue-detail-photo"
                src={selectedIssue.photo_url}
                alt={`Photo attached to ${selectedIssue.category} report`}
                loading="lazy"
              />
              <span><ExternalLink size={14} /> Open photo</span>
            </a>
          ) : (
            <div className="issue-photo-placeholder">
              <Camera size={28} />
              <span>No photo attached to this report</span>
            </div>
          )}

          <div className="issue-detail-status-row">
            <span className={`status-pill status-${selectedIssue.status.toLowerCase()}`}>
              <span className="status-dot" />
              {selectedIssue.status}
            </span>

            <span className="issue-source-label">
              {selectedIssue.isDemo ? 'Demonstration report' : 'Community report'}
            </span>
          </div>

          <div className="verification-status-card">
            <span
              className={`verification-dot ${
                selectedIssue.verificationStatus === 'verified'
                  ? 'verified'
                  : selectedIssue.verificationStatus === 'rejected'
                    ? 'rejected'
                    : 'pending'
              }`}
            />

            <div>
              <strong>
                {selectedIssue.verificationStatus === 'verified'
                  ? 'Admin verified'
                  : selectedIssue.verificationStatus === 'rejected'
                    ? 'Admin rejected'
                    : 'Awaiting admin review'}
              </strong>

              <small>
                {selectedIssue.verificationStatus === 'verified'
                  ? 'The original category marker is displayed.'
                  : selectedIssue.verificationStatus === 'rejected'
                    ? 'This report is marked red on the map.'
                    : 'The amber marker indicates that this report has not yet been reviewed.'}
              </small>
            </div>
          </div>

          <div className="issue-detail-section">
            <h3>Description</h3>
            <p className="issue-description">
              {selectedIssue.description?.trim() || 'No description was provided.'}
            </p>
          </div>

          <div className="issue-detail-meta">
            <div>
              <MapPin size={17} />
              <span>
                <strong>Coordinates</strong>
                <small>
                  {selectedIssue.coordinates[1].toFixed(6)},{' '}
                  {selectedIssue.coordinates[0].toFixed(6)}
                </small>
              </span>
            </div>

            <div>
              <CalendarDays size={17} />
              <span>
                <strong>Reported on</strong>
                <small>{formatDate(selectedIssue.createdAt)}</small>
              </span>
            </div>

            <div>
              <ShieldCheck size={17} />
              <span>
                <strong>Verification</strong>
                <small>
                  {selectedIssue.verificationStatus === 'verified'
                    ? 'Verified by an administrator'
                    : selectedIssue.verificationStatus === 'rejected'
                      ? 'Rejected by an administrator'
                      : 'Pending administrator review'}
                </small>
              </span>
            </div>
          </div>

          {selectedIssue.reviewReason && (
            <p className="panel-note">
              <strong>Review note:</strong> {selectedIssue.reviewReason}
            </p>
          )}

          <button
            className="primary-button full-width"
            type="button"
            onClick={() => {
              mapRef.current?.flyTo({
                center: selectedIssue.coordinates,
                zoom: 17,
                essential: true,
              });
              setSelectedIssue(null);
            }}
          >
            <Crosshair size={16} /> View location on map
          </button>

          {!selectedIssue.isDemo && (
            <>
              <p className="panel-note">
                Community confirmations: {selectedIssue.confirmationCount}
              </p>

              {signedInUserId &&
                selectedIssue.userId !== signedInUserId &&
                !selectedIssue.hasConfirmed && (
                  <button
                    className="secondary-button full-width"
                    type="button"
                    onClick={() => void confirmSelectedIssue()}
                  >
                    <Check size={16} /> Confirm this report
                  </button>
                )}

              {selectedIssue.hasConfirmed && (
                <p className="panel-note">You have confirmed this report.</p>
              )}

              {/* NEW: Only the original reporter sees this resolution control. */}
              {signedInUserId && selectedIssue.userId === signedInUserId && (
                selectedIssue.status === 'Resolved' ? (
                  <p className="panel-note">You reported this issue as resolved.</p>
                ) : (
                  <div className="issue-detail-section">
                    <h3>Report resolution</h3>
                    <p className="panel-note">
                      If this issue has been fixed, mark it as resolved. This
                      change will be recorded in its status history.
                    </p>

                    <label className="field-label">
                      Resolution note (optional)
                      <textarea
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Describe how the issue was resolved…"
                        disabled={issueActionLoading}
                      />
                    </label>

                    <button
                      className="primary-button full-width"
                      type="button"
                      disabled={issueActionLoading}
                      onClick={() => void reportSelectedIssueResolved()}
                    >
                      <Check size={16} />
                      {issueActionLoading
                        ? 'Saving…'
                        : 'Mark my issue as resolved'}
                    </button>
                  </div>
                )
              )}

              <button
                className="secondary-button full-width"
                type="button"
                onClick={() => void loadStatusHistory(selectedIssue.id)}
              >
                View status history
              </button>

              {historyIssueId === selectedIssue.id && (
                <div className="issue-detail-section">
                  <h3>Status history</h3>

                  {statusHistory.length === 0 ? (
                    <p className="panel-note">No status changes recorded yet.</p>
                  ) : (
                    statusHistory.map((entry) => (
                      <div className="history-entry" key={entry.id}>
                        <strong>
                          {entry.old_status ?? 'Created'} → {entry.new_status}
                        </strong>
                        <small>{formatDate(entry.created_at)}</small>
                        {entry.note && <p>{entry.note}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {isAdmin && (
                <div className="admin-review-section">
                  <h3>Administrator review</h3>

                  <p className="panel-note">
                    {adminChecking
                      ? 'Checking administrator access…'
                      : 'Review this community report.'}
                  </p>

                  <label className="field-label">
                    Review note (optional)
                    <textarea
                      value={reviewReason}
                      onChange={(event) => setReviewReason(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="Explain the review decision…"
                      disabled={issueActionLoading}
                    />
                  </label>

                  <button
                    className="primary-button full-width"
                    type="button"
                    disabled={issueActionLoading}
                    onClick={() => void reviewSelectedIssue('verified')}
                  >
                    <ShieldCheck size={16} /> Approve and verify
                  </button>

                  <button
                    className="secondary-button full-width"
                    type="button"
                    disabled={issueActionLoading}
                    onClick={() => void reviewSelectedIssue('rejected')}
                  >
                    Reject report
                  </button>

                  {/* NEW: Admin status management, including reopening issues. */}
                  <div className="issue-detail-section">
                    <h3>Manage issue status</h3>

                    <p className="panel-note">
                      Administrator changes are saved to the status history.
                      You can reopen a resolved issue when necessary.
                    </p>

                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        className={
                          status === selectedIssue.status
                            ? 'primary-button full-width'
                            : 'secondary-button full-width'
                        }
                        type="button"
                        disabled={
                          issueActionLoading ||
                          status === selectedIssue.status
                        }
                        onClick={() => void adminSetIssueStatus(status)}
                      >
                        {status === selectedIssue.status
                          ? `Current status: ${status}`
                          : `Change status to ${status}`}
                      </button>
                    ))}
                  </div>

                  {/* NEW: Admin-only permanent deletion. */}
                  <button
                    className="secondary-button full-width"
                    type="button"
                    disabled={issueActionLoading}
                    onClick={() => void deleteSelectedIssue()}
                  >
                    <Trash2 size={16} />
                    {issueActionLoading
                      ? 'Please wait…'
                      : 'Delete issue permanently'}
                  </button>
                </div>
              )}
            </>
          )}

          <p className="panel-note">
            Community-submitted information is not automatically verified by a municipal authority.
          </p>
        </section>
      )}

      {showFilters && (
        <section className="side-panel filter-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MAP SETTINGS</span>
              <h2>Filter issues</h2>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={() => setShowFilters(false)}
              aria-label="Close filters"
            >
              <X size={19} />
            </button>
          </div>

          <div className="panel-section">
            <h3>Status</h3>

            {STATUSES.map((status) => (
              <label className="check-row" key={status}>
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                <span className={`status-dot status-${status.toLowerCase()}`} />
                <span>{status}</span>
              </label>
            ))}
          </div>

          <div className="panel-section">
            <h3>Category</h3>

            {CATEGORIES.map((category) => (
              <label className="check-row" key={category}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>

          <div className="panel-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSelectedCategories([]);
                setSelectedStatuses(STATUSES);
              }}
            >
              Reset
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => setShowFilters(false)}
            >
              <Check size={16} /> Apply filters
            </button>
          </div>

          <p className="panel-note">
            Amber markers are awaiting review. Verified reports use their original category icons.
          </p>
        </section>
      )}

      {showReport && (
        <section className="side-panel report-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HELP YOUR COMMUNITY</span>
              <h2>Report an issue</h2>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={closeReport}
              aria-label="Close report form"
              disabled={submittingReport}
            >
              <X size={19} />
            </button>
          </div>

          <div className="location-preview">
            <Crosshair size={18} />
            <div>
              <strong>Selected map location</strong>
              <span>
                {reportLocation
                  ? `${reportLocation[1].toFixed(5)}, ${reportLocation[0].toFixed(5)}`
                  : 'Click the map to choose a location'}
              </span>
            </div>
          </div>

          <p className="panel-note">
            Signed in as {signedInUser}. Click the map to set the location,
            attach a photo, and describe the problem.
          </p>

          <button
            type="button"
            className="upload-placeholder"
            onClick={() => photoInputRef.current?.click()}
            disabled={submittingReport}
          >
            <Camera size={24} />
            <strong>{reportPhoto ? 'Change photo' : 'Add a photo'}</strong>
            <span>
              {reportPhoto
                ? `${reportPhoto.name} · ${(reportPhoto.size / 1024 / 1024).toFixed(2)} MB`
                : 'Required · JPG, PNG, WebP or GIF · Max 5 MB'}
            </span>
          </button>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => setReportPhoto(event.target.files?.[0] ?? null)}
          />

          <label className="field-label">
            Issue category
            <select
              value={reportCategory}
              onChange={(event) => {
                setReportCategory(event.target.value);
                setShowDuplicates(false);
                setDuplicateCandidates([]);
              }}
              required
              disabled={submittingReport}
            >
              <option value="" disabled>Select a category</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Description
            <textarea
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              placeholder="Briefly describe the problem…"
              rows={3}
              maxLength={1500}
              required
              disabled={submittingReport}
            />
          </label>

          {showDuplicates && duplicateCandidates.length > 0 && (
            <div className="duplicate-warning">
              <strong>Similar reports nearby</strong>
              <p>
                These reports have the same category within 200 metres. Check
                them before submitting. You can still submit if this is a
                separate issue.
              </p>

              {duplicateCandidates.map(({ issue, distance }) => (
                <button
                  key={issue.id}
                  type="button"
                  className="duplicate-candidate"
                  onClick={() => {
                    setSelectedIssue(issue);
                    closeReport();
                    mapRef.current?.flyTo({
                      center: issue.coordinates,
                      zoom: 17,
                      essential: true,
                    });
                  }}
                >
                  <span>{issue.category}</span>
                  <small>{Math.round(distance)} m away · {issue.status}</small>
                </button>
              ))}

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowDuplicates(false)}
              >
                Continue with my report
              </button>
            </div>
          )}

          <button
            className="primary-button full-width"
            type="button"
            onClick={() => void submitReport()}
            disabled={submittingReport || !signedInUserId}
          >
            {submittingReport ? 'Submitting…' : 'Submit report'}
          </button>

          <p className="panel-note">
            New reports appear with an amber marker while awaiting administrator
            review. Verified reports return to their original category colour.
          </p>
        </section>
      )}

      <div className="bottom-note">
        <span className="bottom-note-dot" />
        Community-reported civic issues
      </div>

      {presentationMode && (
        <PresentationMode
          map={mapInstance}
          onExit={() => setPresentationMode(false)}
        />
      )}

      {demoMode && (
        <DemoMode
          onExit={exitDemoMode}
          onApproved={handleDemoApproved}
        />
      )}
    </main>
  );
}