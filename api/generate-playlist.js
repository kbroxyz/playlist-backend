const querystring = require('querystring');

// Helper: Get Spotify access token
async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: querystring.stringify({ grant_type: 'client_credentials' })
  });

  const data = await response.json();
  return data.access_token;
}

// Helper: Get GPT-4-generated track themes based on film/show
async function getTrackThemesFromGPT(prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a music supervisor curating emotionally resonant music.'
        },
        {
          role: 'user',
          content: `Generate a list of 10 emotional and thematic song ideas (one per line) that match the story beats and tone of the film or series "${prompt}". Only provide keywords or phrases (not artist names).`
        }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  const output = data.choices[0].message.content;
  return output.split('\n').map(line => line.trim()).filter(Boolean);
}

// Helper: Search Spotify track for a theme
async function searchSpotifyTrack(query, token) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();
  const track = data.tracks.items[0];

  return track
    ? {
        title: track.name,
        artist: track.artists[0].name,
        url: track.external_urls.spotify,
        preview_url: track.preview_url,
        id: track.id
      }
    : null;
}

// API handler
module.exports = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const [accessToken, themes] = await Promise.all([
      getSpotifyAccessToken(),
      getTrackThemesFromGPT(prompt)
    ]);

    const tracks = [];

    for (const theme of themes) {
      const track = await searchSpotifyTrack(theme, accessToken);
      if (track) tracks.push(track);
    }

    return res.status(200).json({ tracks });
  } catch (err) {
    console.error('Error generating playlist:', err);
    return res.status(500).json({ error: 'Failed to generate playlist' });
  }
};
