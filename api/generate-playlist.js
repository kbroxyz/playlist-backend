const { Configuration, OpenAIApi } = require("openai");

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const openaiApiKey = process.env.OPENAI_API_KEY;

async function getSpotifyAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(spotifyClientId + ":" + spotifyClientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get Spotify access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function searchSpotifyTracks(token, query, limit = 5) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", limit);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Spotify search failed");
  }

  const data = await response.json();
  return data.tracks.items;
}

async function getStoryBeatsFromGPT(title) {
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  const openai = new OpenAIApi(configuration);

  const prompt = `Break down the story of the film or TV series titled "${title}" into 3-5 emotional beats. For each beat, suggest a music genre, mood, and tempo in this format:
Beat 1: Genre: ..., Mood: ..., Tempo: ...
Beat 2: Genre: ..., Mood: ..., Tempo: ...
...`;

  const response = await openai.createChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a creative assistant for music and film curation." },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
  });

  const content = response.data.choices[0].message.content;
  return parseGPTResponse(content);
}

function parseGPTResponse(content) {
  const lines = content
    .split("\n")
    .filter((line) => line.toLowerCase().includes("genre") && line.toLowerCase().includes("mood") && line.toLowerCase().includes("tempo"));

  return lines.map((line) => {
    const genreMatch = line.match(/Genre:\s*([^,]+)/i);
    const moodMatch = line.match(/Mood:\s*([^,]+)/i);
    const tempoMatch = line.match(/Tempo:\s*(.+)$/i);

    return {
      genre: genreMatch ? genreMatch[1].trim() : "ambient",
      mood: moodMatch ? moodMatch[1].trim() : "mysterious",
      tempo: tempoMatch ? tempoMatch[1].trim() : "slow",
    };
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://soundstory.webflow.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Missing title in request body" });
    }

    const storyBeats = await getStoryBeatsFromGPT(title);
    const spotifyToken = await getSpotifyAccessToken();

    const playlist = [];
    for (const beat of storyBeats) {
      // Search Spotify for each beat using genre, mood, tempo
      const query = `${beat.genre} ${beat.mood} ${beat.tempo}`;
      const tracks = await searchSpotifyTracks(spotifyToken, query, 3);
      playlist.push(...tracks);
    }

    return res.status(200).json({ playlist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    return res.status(500).json({ error: "Failed to generate playlist" });
  }
};
