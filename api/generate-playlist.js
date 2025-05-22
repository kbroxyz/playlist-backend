const SpotifyWebApi = require("spotify-web-api-node");
const OpenAI = require("openai");

// Init OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Spotify setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function getSpotifyAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the story of the film or TV series titled "${title}" into 3–5 emotional beats. For each beat, suggest a music genre, mood, and tempo in this exact format:

Beat 1:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>

Beat 2:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: "You are a creative assistant for music and film curation." },
      { role: "user", content: prompt },
    ],
  });

  return parseGPTResponse(response.choices[0].message.content);
}

function parseGPTResponse(content) {
  const lines = content.split("\n").filter(line => line.match(/Genre:|Mood:|Tempo:/i));
  const beats = [];

  for (let i = 0; i < lines.length; i += 3) {
    const genre = lines[i]?.split("Genre:")[1]?.trim() || "ambient";
    const mood = lines[i + 1]?.split("Mood:")[1]?.trim() || "mysterious";
    const tempo = lines[i + 2]?.split("Tempo:")[1]?.trim() || "slow";
    beats.push({ genre, mood, tempo });
  }

  return beats;
}

async function searchSpotify({ genre, mood, tempo }) {
  const query = `${genre} ${mood} ${tempo}`;
  const result = await spotifyApi.searchTracks(query, { limit: 5 });
  return result.body.tracks.items;
}

// Vercel Serverless Function Entry Point
module.exports = async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // or use your Webflow domain instead of "*"
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Missing 'title' in request body" });
  }

  try {
    await getSpotifyAccessToken();
    const storyBeats = await getStoryBeatsFromGPT(title);

    const playlist = [];
    for (const beat of storyBeats) {
      const tracks = await searchSpotify(beat);
      playlist.push(...tracks.slice(0, 4));
    }

    const simplifiedPlaylist = playlist.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify,
      image: track.album.images[0]?.url || null,
    }));

    res.status(200).json({ playlist: simplifiedPlaylist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
