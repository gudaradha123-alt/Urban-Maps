
import type { Feature, FeatureCollection, Geometry } from 'geojson';

type CivicProperties = {
  name: string;
  source: 'demonstration';
  layer: number;
};

const polygon = (
  name: string,
  coordinates: number[][][],
  layer: number,
): Feature<Geometry, CivicProperties> => ({
  type: 'Feature',
  properties: { name, source: 'demonstration', layer },
  geometry: { type: 'Polygon', coordinates },
});

const line = (
  name: string,
  coordinates: number[][],
  layer: number,
): Feature<Geometry, CivicProperties> => ({
  type: 'Feature',
  properties: { name, source: 'demonstration', layer },
  geometry: { type: 'LineString', coordinates },
});

// Approximate locations around central Hyderabad.
// These are illustrative shapes, not verified flood or drainage records.
const inundationAreas: Feature<Geometry, CivicProperties>[] = [
  polygon(
    'Illustrative waterlogging area A',
    [[
      [78.465, 17.395],
      [78.474, 17.395],
      [78.476, 17.401],
      [78.467, 17.403],
      [78.465, 17.395],
    ]],
    1,
  ),
  polygon(
    'Illustrative waterlogging area B',
    [[
      [78.485, 17.373],
      [78.493, 17.374],
      [78.495, 17.380],
      [78.487, 17.382],
      [78.485, 17.373],
    ]],
    1,
  ),
];

const drainageLines: Feature<Geometry, CivicProperties>[] = [
  line(
    'Illustrative drainage route A',
    [
      [78.450, 17.410],
      [78.461, 17.402],
      [78.474, 17.395],
      [78.486, 17.385],
      [78.498, 17.378],
    ],
    2,
  ),
  line(
    'Illustrative drainage route B',
    [
      [78.471, 17.418],
      [78.477, 17.405],
      [78.481, 17.393],
      [78.490, 17.381],
    ],
    2,
  ),
];

const proposedRoutes: Feature<Geometry, CivicProperties>[] = [
  line(
    'Illustrative proposed improvement route A',
    [
      [78.451, 17.405],
      [78.465, 17.399],
      [78.480, 17.390],
      [78.495, 17.381],
    ],
    3,
  ),
];

const layers: Record<number, Feature<Geometry, CivicProperties>[]> = {
  1: inundationAreas,
  2: drainageLines,
  3: proposedRoutes,
};


export async function fetchCivicData(
  layerId: number,
  isCurrent?: (() => boolean) | AbortSignal,
): Promise<FeatureCollection<Geometry, CivicProperties>> {
  const empty: FeatureCollection<Geometry, CivicProperties> = {
    type: 'FeatureCollection',
    features: [],
  };

  // Support both a callback and an AbortSignal.
  if (typeof isCurrent === 'function' && !isCurrent()) {
    return empty;
  }

  if (
    typeof isCurrent !== 'function' &&
    isCurrent?.aborted
  ) {
    return empty;
  }

  return {
    type: 'FeatureCollection',
    features: layers[layerId] ?? [],
  };
}
