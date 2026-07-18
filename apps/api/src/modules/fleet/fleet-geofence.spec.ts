/**
 * Pure geometry helpers mirrored from FleetService for acceptance coverage.
 * Keep in sync with fleet.service.ts pointInPolygon / haversineDistance.
 */

function pointInPolygon(lat: number, lng: number, polygon: any[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat ?? polygon[i][0];
    const yi = polygon[i].lng ?? polygon[i][1];
    const xj = polygon[j].lat ?? polygon[j][0];
    const yj = polygon[j].lng ?? polygon[j][1];
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

describe('fleet geofence geometry', () => {
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 },
  ];

  it('detects point inside polygon', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });

  it('detects point outside polygon', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });

  it('uses haversine for circular radius', () => {
    const d = haversineDistance(12.97, 77.59, 12.97, 77.59);
    expect(d).toBeLessThan(1);
    const far = haversineDistance(12.97, 77.59, 13.0, 77.59);
    expect(far).toBeGreaterThan(1000);
    expect(far).toBeLessThan(5000);
  });
});
