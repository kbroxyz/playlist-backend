export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Missing title" });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
  const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  try {
    // 1. Ask GPT to return emotional/musical story beats
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a creative assistant helping generate emotionally resonant music playlists inspired by film and TV plots."
          },
          {
            role: "user",
            content: `Break down the film or TV show "${title}" into 4-5 emotional beats. For each, return a genre, mood, energy (low, medium, high), and valence (dark, neutral, uplifting). Format your response as a JSON array like:
[
  {
    "section": "Opening",
    "genre": "ambient",
    "mood": "mysterious",
    "energy": "low",
    "valence": "dark"
  }
]`
          }
        ],
        temperature: 0.7
      })
    });

    const gptData = await gptResponse.json();
    const beats = JSON.parse(gptData.choices[0].message.content);

    // 2. Get Spotify Access Token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const { access_token } = await tokenRes.json();

    const results = [];

    // 3. Search Spotify and filter with audio features
    for (const beat of beats) {
      const query = `${beat.genre} ${beat.mood}`;
      const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const searchData = await searchRes.json();
      const tracks = searchData.tracks?.items || [];

      // Get audio features
      const ids = tracks.map(t => t.id).join(",");
      const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const featuresData = await featuresRes.json();

      const mapped = tracks.map((track, i) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(", "),
        album: track.album.name,
        image: track.album.images?.[0]?.url || "",
        spotify_url: track.external_urls.spotify,
        audio: featuresData.audio_features[i]
      }));

      const filtered = mapped.filter(t => {
        if (!t.audio) return false;
        const valence = t.audio.valence;
        const energy = t.audio.energy;

        const energyLevel = beat.energy === "high" ? 0.6 : beat.energy === "medium" ? 0.3 : 0;
        const valenceTarget = beat.valence === "uplifting" ? 0.6 : beat.valence === "neutral" ? 0.3 : 0;

        return energy >= energyLevel && valence >= valenceTarget;
      });

      results.push(...filtered.slice(0, 4));
    }

    res.status(200).json({ playlist: results });
  } catch (err) {
    console.error("Error generating playlist:", err);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
}
