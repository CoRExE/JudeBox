export interface FSoundTrack {
  id: number;
  name: string;
  artists: { name: string; image_small?: string }[];
  album?: { name: string; image?: string };
}

export interface SessionData {
  cookieHeader: string;
  csrfToken: string;
  timestamp: number;
}

let cachedSession: SessionData | null = null;

// Helper to retrieve/renew session and cookies
export const getSession = async (forceRefresh = false): Promise<SessionData> => {
  // Session is valid for 15 minutes
  if (!forceRefresh && cachedSession && Date.now() - cachedSession.timestamp < 15 * 60 * 1000) {
    return cachedSession;
  }

  console.log("[FSound] Initializing new session...");
  const res = await fetch('https://fsound.lol/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to load homepage (Status ${res.status})`);
  }

  const html = await res.text();
  const csrfMatch = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  let setCookies: string[] = [];
  if (res.headers.getSetCookie) {
    setCookies = res.headers.getSetCookie();
  } else if (res.headers.get('set-cookie')) {
    const rawCookies = res.headers.get('set-cookie');
    setCookies = rawCookies ? rawCookies.split(/,(?=[^;]*=)/) : [];
  }

  const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');

  cachedSession = {
    cookieHeader,
    csrfToken,
    timestamp: Date.now()
  };

  return cachedSession;
};

// Search tracks on fsound.lol
export const searchTracks = async (query: string): Promise<FSoundTrack[]> => {
  if (!query.trim()) return [];

  const session = await getSession();
  const searchUrl = `https://fsound.lol/api/v1/search?query=${encodeURIComponent(query)}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': session.cookieHeader,
    'X-CSRF-TOKEN': session.csrfToken,
    'Referer': 'https://fsound.lol/',
    'Accept': 'application/json, text/plain, */*'
  };

  let res = await fetch(searchUrl, { headers });

  if (res.status === 401) {
    console.log("[FSound] Search returned 401, refreshing session...");
    const newSession = await getSession(true);
    res = await fetch(searchUrl, {
      headers: {
        ...headers,
        'Cookie': newSession.cookieHeader,
        'X-CSRF-TOKEN': newSession.csrfToken,
      }
    });
  }

  if (!res.ok) {
    throw new Error(`Search failed (Status ${res.status})`);
  }

  const data = await res.json();
  return data.results?.tracks?.data || [];
};

// Resolve track virtual URI to audio stream URL
export const resolveTrack = async (trackId: string, artist: string, title: string): Promise<string> => {
  const session = await getSession();

  const doubleEncodedArtist = encodeURIComponent(encodeURIComponent(artist));
  const doubleEncodedTitle = encodeURIComponent(encodeURIComponent(title));
  const resolveUrl = `https://fsound.lol/api/v1/search/audio/${trackId}/${doubleEncodedArtist}/${doubleEncodedTitle}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': session.cookieHeader,
    'X-CSRF-TOKEN': session.csrfToken,
    'Referer': 'https://fsound.lol/',
    'Accept': 'application/json, text/plain, */*'
  };

  let res = await fetch(resolveUrl, { headers });

  if (res.status === 401) {
    console.log("[FSound] Resolve returned 401, refreshing session...");
    const newSession = await getSession(true);
    res = await fetch(resolveUrl, {
      headers: {
        ...headers,
        'Cookie': newSession.cookieHeader,
        'X-CSRF-TOKEN': newSession.csrfToken,
      }
    });
  }

  if (!res.ok) {
    throw new Error(`Resolve failed (Status ${res.status})`);
  }

  const data = await res.json();
  const candidates = data.results || [];
  if (candidates.length === 0 || !candidates[0].id) {
    throw new Error("No streamable source found on FSound");
  }

  const youtubeId = candidates[0].id;
  return `https://fsound.lol/audio-stream.php?v=${youtubeId}`;
};
