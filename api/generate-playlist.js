// Enable native fetch in Node.js 18+ (used by Vercel)
const { Buffer } = require('buffer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Missing title in request body' });
  }

  try {
    // Step 1: Use OpenAI to get thematic keywords
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a music curator. Based on story, emotion, and atmosphere, recommend music for films or TV shows.'
          },
          {
            role: 'user',
            content: `Generate a list of 10 search terms (genres, moods, instruments) for a playlist inspired by the film or show: "${title}". Return as a comma-separated string.`
          }
        ],
        temperature: 0.7
      })
    });

    const gptData = await gptResponse.json();

if (!gptResponse.ok || !gptData.choices || !gptData.choices[0]?.message?.content) {
  console.error('OpenAI API error:', gptData);
  return res.status(500).json({ error: 'Failed to generate search terms from OpenAI.' });
}

const searchTerms = gptData.choices[0].message.content;


    // Step 2: Get Spotify access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 3: Search Spotify for each term
    const terms = searchTerms.split(',').map(term => term.trim());
    const uniqueTracks = new Map();

    for (const term of terms) {
      const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=5`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const searchData = await searchRes.json();
      const tracks = searchData.tracks?.items || [];

      for (const track of tracks) {
        if (!uniqueTracks.has(track.id)) {
          uniqueTracks.set(track.id, {
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            id: track.id,
            url: track.external_urls.spotify
          });
        }
      }

      if (uniqueTracks.size >= 20) break;
    }

    const playlist = Array.from(uniqueTracks.values()).slice(0, 20);
    return res.status(200).json({ playlist });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
