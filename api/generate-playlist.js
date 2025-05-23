const fetch = require("node-fetch");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function getSpotifyAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  return data.access_token;
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the narrative of "${title}" into 3-5 emotional story beats. For each beat, suggest:
- Genre
- Mood
- Tempo (slow, medium, fast)
Respond in this format:
1. [Story beat description]
   Genre: [value], Mood: [value], Tempo: [value]`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a creative music supervisor curating songs based on story emotion and tone.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Failed to parse GPT response");

  return parseGPTResponse(content);
}

function parseGPTResponse(content) {
  const blocks = content.split(/\n(?=\d+\.)/); // Split by numbered lines
  return blocks.map((block) => {
    const genre = block.match(/Genre:\s*([^\n,]+)/i)?.[1]?.trim() || "ambient";
    const mood = block.match(/Mood:\s*([^\n,]+)/i)?.[1]?.trim() || "melancholy";
    const tempo = block.match(/Tempo:\s*([^\n,]+)/i)?.[1]?.trim() || "slow";
    return { genre, mood, tempo };
  });
}

async function fetchSpotifyTracks(accessToken, { genre, mood, tempo }) {
  const query = `${genre} ${mood}`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  const tracks = data.tracks?.items || [];

  // Filter by audio features (e.g., valence, energy, tempo)
  const trackIds = tracks.map((t) => t.id).join(",");
  const audioRes = await fetch(
    `https://api.spotify.com/v1/audio-features?ids=${trackIds}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const audioData = await audioRes.json();
  const audioFeatures = audioData.audio_features || [];

  const desiredTempo = tempo === "slow" ? 0.3 : tempo === "fast" ? 0.7 : 0.5;

  return tracks
    .map((track, index) => {
      const features = audioFeatures[index];
      if (!features) return null;

      const matchScore =
        1 -
        Math.abs(features.valence - (mood.includes("happy") ? 0.8 : mood.includes("dark") ? 0.2 : 0.5)) -
        Math.abs(features.energy - desiredTempo);

      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        image: track.album.images[0]?.url,
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify,
        matchScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title } = req.body;

    if (!title) return res.status(400).json({ error: "Missing film or TV title" });

    const accessToken = await getSpotifyAccessToken();
    const beats = await getStoryBeatsFromGPT(title);

    const trackPromises = beats.map((beat) => fetchSpotifyTracks(accessToken, beat));
    const results = await Promise.all(trackPromises);
    const playlist = results.flat();

    res.status(200).json({ playlist });
  } catch (err) {
    console.error("Error generating playlist:", err);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
