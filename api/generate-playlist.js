const express = require("express");
const bodyParser = require("body-parser");
const SpotifyWebApi = require("spotify-web-api-node");
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.json());

// Allow CORS from your frontend domain or all origins (adjust as needed)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Replace "*" with your domain in production
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// OpenAI API setup with new SDK usage
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get Spotify access token using client credentials flow
async function getAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body["access_token"]);
    console.log("Spotify access token retrieved");
  } catch (error) {
    console.error("Failed to get Spotify access token:", error);
    throw error;
  }
}

// Enhanced GPT prompt to extract story beats with genre, mood, tempo, and valence & energy for filtering
async function getStoryBeatsFromGPT(title) {
  const prompt = `
You are a creative assistant specializing in music curation for films and TV shows.

Break down the story of the film or TV series titled "${title}" into 3-5 emotional beats. For each beat, provide:

- A brief description
- Suggested music genre(s)
- Mood (one or two words)
- Tempo (slow, medium, fast)
- Valence (positivity scale from 0.0 to 1.0)
- Energy (intensity scale from 0.0 to 1.0)

Return the results as a JSON array with this structure:

[
  {
    "description": "...",
    "genre": "...",
    "mood": "...",
    "tempo": "...",
    "valence": number,
    "energy": number
  },
  ...
]
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a creative assistant for music and film curation." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    console.log("GPT response:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("Error fetching story beats from GPT:", error);
    throw error;
  }
}

// Search Spotify tracks based on genre, mood, tempo, valence, energy
async function searchSpotify({ genre, mood, tempo, valence, energy }) {
  try {
    // Basic query with genre and mood keywords
    const query = `${genre} ${mood}`;

    // Search tracks on Spotify
    const searchResult = await spotifyApi.searchTracks(query, { limit: 20 });
    const tracks = searchResult.body.tracks.items;

    // Fetch audio features for filtering
    const trackIds = tracks.map((t) => t.id);
    const featuresResult = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const audioFeatures = featuresResult.body.audio_features;

    // Filter tracks by tempo, valence, and energy ranges around GPT suggestions
    const tempoMap = { slow: [0, 90], medium: [90, 130], fast: [130, 300] };
    const [tempoMin, tempoMax] = tempoMap[tempo.toLowerCase()] || [0, 300];

    const filteredTracks = tracks.filter((track, idx) => {
      const feat = audioFeatures[idx];
      if (!feat) return false;

      return (
        feat.tempo >= tempoMin &&
        feat.tempo <= tempoMax &&
        feat.valence >= valence - 0.2 &&
        feat.valence <= valence + 0.2 &&
        feat.energy >= energy - 0.2 &&
        feat.energy <= energy + 0.2
      );
    });

    console.log(
      `Spotify search for genre="${genre}", mood="${mood}", tempo="${tempo}" returned ${filteredTracks.length} tracks after filtering`
    );

    // Map filtered tracks into simpler object for frontend
    return filteredTracks.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      image: track.album.images[0]?.url || "",
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify,
    }));
  } catch (error) {
    console.error("Error searching Spotify:", error);
    throw error;
  }
}

// Main playlist generation endpoint
app.post("/api/generate-playlist", async (req, res) => {
  const { title } = req.body;

  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "Missing or empty 'title' in request body" });
  }

  try {
    // Get story beats metadata from GPT
    const storyBeats = await getStoryBeatsFromGPT(title);

    // Authenticate Spotify API
    await getAccessToken();

    let playlist = [];

    // For each story beat, fetch relevant Spotify tracks
    for (const beat of storyBeats) {
      console.log("Processing beat:", beat.description);

      const tracks = await searchSpotify(beat);

      if (tracks.length === 0) {
        console.log(`No tracks found for beat: ${beat.description}`);
        continue;
      }

      // Take top 3 tracks per beat for playlist
      playlist.push(...tracks.slice(0, 3));
    }

    if (playlist.length === 0) {
      return res.status(404).json({ error: "No tracks found matching the film's mood and storyline." });
    }

    // Return the assembled playlist
    res.json({ playlist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    res.status(500).json({ error: "Failed to generate playlist." });
  }
});

// Start server (if running standalone, for local dev)
// Uncomment below if needed locally
// app.listen(3000, () => console.log("Server running on port 3000"));

module.exports = app; // For Vercel or serverless deployment

