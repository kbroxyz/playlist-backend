const SpotifyWebApi = require("spotify-web-api-node");
const OpenAI = require("openai");

// Init OpenAI client (make sure OPENAI_API_KEY is in your env vars)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Spotify client setup (make sure your env vars are set)
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Helper to get Spotify access token
async function getSpotifyAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
}

// Use OpenAI GPT to parse story beats and generate music filters
async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the story of the film or TV series titled "${title}" into 3-5 emotional beats. For each beat, suggest a music genre, mood, and tempo in this exact format:

Beat 1:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>

Beat 2:
Genre: <genre>
Mood: <mood>
Tempo: <tempo>

...and so on.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // or "gpt-4" if you have access
    messages: [
      { role: "system", content: "You are a creative assistant for music and film curation." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0].message.content;
  return parseGPTResponse(content);
}

// Naive parser for GPT response into beat objects
function parseGPTResponse(content) {
  const lines = content.split("\n").filter(line => line.match(/Genre:|Mood:|Tempo:/i));

  const beats = [];
  for (let i = 0; i < lines.length; i += 3) {
    const genreMatch = lines[i].match(/Genre:\s*(.*)/i);
    const moodMatch = lines[i + 1].match(/Mood:\s*(.*)/i);
    const tempoMatch = lines[i + 2].match(/Tempo:\s*(.*)/i);

    beats.push({
      genre: genreMatch ? genreMatch[1].trim() : "ambient",
      mood: moodMatch ? moodMatch[1].trim() : "mysterious",
      tempo: tempoMatch ? tempoMatch[1].trim() : "slow",
    });
  }
  return beats;
}

// Search Spotify tracks by combining genre, mood, tempo
async function searchSpotify({ genre, mood, tempo }) {
  // Construct a search query - can be improved for better filtering
  const query = `${genre} ${mood} ${tempo}`;

  const result = await spotifyApi.searchTracks(query, { limit: 5 });
  return result.body.tracks.items;
}

// Main handler for Vercel serverless function
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Missing 'title' in request body" });
  }

  try {
    // Get Spotify token
    await getSpotifyAccessToken();

    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title);

    // Fetch tracks for each beat
    const playlist = [];
    for (const beat of storyBeats) {
      const tracks = await searchSpotify(beat);
      playlist.push(...tracks.slice(0, 4)); // limit per beat to 4 tracks
    }

    // Return assembled playlist (simplify the track objects)
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
