// /api/generate-playlist.js

module.exports = async (req, res) => {
  // Allow CORS for your frontend domain or * (for testing)
  res.setHeader("Access-Control-Allow-Origin", "https://soundstory.webflow.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    // Handle preflight requests
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Missing film or TV show title" });
  }

  try {
    // Step 1: Prompt GPT for story beats + moods
    const prompt = `Break down the story of "${title}" into 4–5 emotional beats. For each beat, suggest a music genre, mood, and tempo. Format your response as:

Beat: [Short Description]
Genre: [Genre]
Mood: [Mood]
Tempo: [Tempo]

Repeat this format for each beat.`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are a music curator and creative assistant that creates music playlists inspired by the emotional tone of films and TV shows.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const gptOutput = chatResponse.choices[0].message.content;
    const beats = parseGPTResponse(gptOutput);

    // Step 2: For each beat, query Spotify API for matching tracks
    const accessToken = await getSpotifyAccessToken();
    const playlist = [];

    for (const beat of beats) {
      const trackResults = await searchSpotifyTracks(
        beat.genre,
        beat.mood,
        beat.tempo,
        accessToken
      );
      playlist.push(...trackResults.slice(0, 3));
    }

    res.status(200).json({ playlist });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

// --- Helper Functions ---

function parseGPTResponse(content) {
  const sections = content.split(/Beat:/).slice(1);
  return sections.map((section) => {
    const genre = section.match(/Genre:\s*([^\n]+)/)?.[1]?.trim() || "ambient";
    const mood = section.match(/Mood:\s*([^\n]+)/)?.[1]?.trim() || "calm";
    const tempo = section.match(/Tempo:\s*([^\n]+)/)?.[1]?.trim() || "slow";
    return { genre, mood, tempo };
  });
}

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  return data.access_token;
}

async function searchSpotifyTracks(genre, mood, tempo, accessToken) {
  const query = encodeURIComponent(`${genre} ${mood} ${tempo}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

  const data = await response.json();
  return data.tracks?.items || [];
}
