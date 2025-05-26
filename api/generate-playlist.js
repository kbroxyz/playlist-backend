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
  const prompt = `Break down the narrative arc of "${title}" into 3–5 distinct emotional beats. For each beat, return only the most fitting:
- Music genre (e.g., indie rock, synthwave, orchestral)
- Mood (e.g., hopeful, tense, melancholic)
- Tempo (e.g., slow, medium, fast)

Use this exact format:

Beat 1:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>

Beat 2:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a creative assistant for music and film curation." },
      { role: "user", content: prompt },
    ],
  });
  
  console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);

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

    console.log("🎬 Parsed story beats:", beats);
  }

  return beats;
}

async function searchSpotify({ genre, mood }) {
  const query = `${genre} ${mood} soundtrack`;
  console.log("Searching Spotify with query:", query);

  const result = await spotifyApi.searchTracks(query, { limit: 10 });
  const tracks = result.body.tracks.items;

  console.log("Found tracks:", tracks.map(t => t.name));

  const filtered = tracks.filter(track => track.preview_url);
  console.log("Filtered tracks with preview:", filtered.length);
  
  return filtered;
}

// Vercel Serverless Function Entry Point
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Missing 'title' in request body" });

  try {
    await getSpotifyAccessToken();
    const storyBeats = await getStoryBeatsFromGPT(title);

    const playlist = [];
    for (const beat of storyBeats) {
      const tracks = await searchSpotify(beat);
      playlist.push(...tracks.slice(0, 4)); // take top 4
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

    console.log("Final playlist:", simplifiedPlaylist);
    
    res.status(200).json({ playlist: simplifiedPlaylist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
