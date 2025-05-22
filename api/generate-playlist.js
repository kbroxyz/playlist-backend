// generate-playlist.js
const fetch = require('node-fetch');
require('dotenv').config();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Missing film or TV title' });
  }

  try {
    // Step 1: Use OpenAI to analyze the film/TV show
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You're a music supervisor helping curate playlists inspired by film and TV." },
          { role: "user", content: `Break the story of '${title}' into 5 emotional/mood stages and describe each in a sentence.` }
        ]
      })
    });

    const openaiData = await openaiResponse.json();
    const moodsText = openaiData.choices?.[0]?.message?.content || '';
    const moodStages = moodsText.split('\n').filter(line => line.trim().length > 0);

    // Step 2: Use Spotify API to search for tracks for each mood
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: "grant_type=client_credentials"
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const trackResults = [];
    for (const mood of moodStages) {
      const moodQuery = encodeURIComponent(mood);
      const trackRes = await fetch(`https://api.spotify.com/v1/search?q=${moodQuery}&type=track&limit=1`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const trackData = await trackRes.json();
      const track = trackData.tracks?.items?.[0];
      if (track) {
        trackResults.push({
          mood,
          track: {
            name: track.name,
            artist: track.artists[0].name,
            url: track.external_urls.spotify,
            id: track.id
          }
        });
      }
    }

    res.status(200).json({ playlist: trackResults });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
