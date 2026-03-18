const API_BASE = import.meta.env.VITE_API_URL || '';

export interface PhotoData {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  uploaded_at: string;
  url: string;
}

export interface CheckinData {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  location_name: string | null;
  note: string | null;
  checked_in_at: string;
  photos: PhotoData[];
}

export interface TripData {
  id: string;
  name: string;
  public_slug: string;
  created_at: string;
  started_at: string | null;
  checkins: CheckinData[];
}

export interface TripStats {
  total_distance_km: number;
  total_duration_seconds: number;
  average_speed_kmh: number;
  checkin_count: number;
  started_at: string | null;
  latest_checkin_at: string | null;
}

export interface TripCreated {
  public_slug: string;
  secret_code: string;
  name: string;
}

export async function createTrip(name: string): Promise<TripCreated> {
  const res = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create trip');
  return res.json();
}

export async function getTrip(slug: string): Promise<TripData> {
  const res = await fetch(`${API_BASE}/api/trips/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Trip not found');
  return res.json();
}

export async function getTripStats(slug: string): Promise<TripStats> {
  const res = await fetch(`${API_BASE}/api/trips/${encodeURIComponent(slug)}/stats`);
  if (!res.ok) throw new Error('Failed to get stats');
  return res.json();
}

export async function submitCheckin(
  slug: string,
  secret: string,
  data: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number | null;
    note?: string;
  },
  photos?: File[],
): Promise<CheckinData> {
  const formData = new FormData();
  formData.append('latitude', String(data.latitude));
  formData.append('longitude', String(data.longitude));
  if (data.altitude != null) formData.append('altitude', String(data.altitude));
  if (data.accuracy != null) formData.append('accuracy', String(data.accuracy));
  if (data.note) formData.append('note', data.note);
  if (photos) {
    for (const photo of photos) {
      formData.append('photos', photo);
    }
  }

  const res = await fetch(`${API_BASE}/api/trips/${encodeURIComponent(slug)}/checkins`, {
    method: 'POST',
    headers: { 'X-Trip-Secret': secret },
    body: formData,
  });
  if (res.status === 403) throw new Error('Invalid secret code');
  if (!res.ok) throw new Error('Failed to check in');
  return res.json();
}
