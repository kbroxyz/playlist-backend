const SpotifyWebApi = require("spotify-web-api-node");
const { Configuration, OpenAIApi } = require("openai");

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// Helper: get Spotify access token
async function getAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
  console.log("Spotify access token set");
}

// Parse GPT output into structured beats
function parseGPTResponse(content) {
  const lines = content.split("\n").filter((line) =>
    line.toLowerCase().includes("genre") &&
    line.toLowerCase().includes("mood") &&
    line.toLowerCase().includes("tempo")
  );

  const beats = lines.map((line) => {
    const genreMatch = line.match(/Genre:\s*([^,]+)/i);
    const moodMatch = line.match(/Mood:\s*([^,]+)/i);
    const tempoMatch = line.match(/Tempo:\s*([^,]+)/i);

    return {
      genre: genreMatch ? genreMatch[1].trim() : "ambient",
      mood: moodMatch ? moodMatch[1].trim() : "mysterious",
      tempo: tempoMatch ? tempoMatch[1].trim() : "slow",
    };
  });

  return beats;
}

// Get story beats from GPT with enhanced prompt
async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the story of the film or TV series titled "${title}" into 3-5 emotional beats. For each beat, suggest a music genre, mood, and tempo. Provide the response in the following format, each beat on a new line:
Genre: <genre>, Mood: <mood>, Tempo: <tempo>
Example:
Genre: ambient, Mood: tense, Tempo: slow`;

  const response = await openai.createChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a creative assistant for music and film curation." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.data.choices[0].message.content;
  console.log("GPT raw response:", content);

  const beats = parseGPTResponse(content);
  console.log("Parsed beats from GPT:", beats);

  return beats;
}

// Search Spotify tracks based on filters (genre, mood, tempo)
async function searchSpotify({ genre, mood, tempo }) {
  const query = `${genre} ${mood} ${tempo}`;
  console.log("Spotify search query:", query);

  const result = await spotifyApi.searchTracks(query, { limit: 15 });
  console.log(`Spotify returned ${result.body.tracks.items.length} tracks for query: ${query}`);

  return result.body.tracks.items;
}

// Fetch audio features for a list of track IDs
async function getAudioFeatures(trackIds) {
  if (trackIds.length === 0) return [];

  const featuresResponse = await spotifyApi.getAudioFeaturesForTracks(trackIds);
  console.log(`Fetched audio features for ${featuresResponse.body.audio_features.length} tracks`);
  return featuresResponse.body.audio_features;
}

// Calculate a simple match score between target beat and track audio features
function calculateMatchScore(beat, features) {
  if (!features) return 0;

  let score = 0;

  // Map moods to valence ranges (just an example)
  const moodValenceMap = {
    happy: [0.7, 1.0],
    sad: [0.0, 0.3],
    tense: [0.2, 0.5],
    mysterious: [0.3, 0.6],
    energetic: [0.6, 1.0],
    calm: [0.0, 0.4],
  };

  const moodRange = moodValenceMap[beat.mood.toLowerCase()] || [0.3, 0.7];

  // Check valence (positivity)
  if (features.valence >= moodRange[0] && features.valence <= moodRange[1]) {
    score += 1;
  }

  // Check tempo: convert beat.tempo string to numeric range
  // Example mappings - you can refine this
  const tempoMap = {
    slow: [0, 80],
    medium: [80, 120],
    fast: [120, 1000],
  };

  const tempoRange = tempoMap[beat.tempo.toLowerCase()] || [80, 120];
  if (features.tempo >= tempoRange[0] && features.tempo <= tempoRange[1]) {
    score += 1;
  }

  // Check energy threshold for genre moods
  const energyThresholds = {
    ambient: 0.3,
    pop: 0.6,
    rock: 0.7,
    electronic: 0.5,
  };
  const minEnergy = energyThresholds[beat.genre.toLowerCase()] || 0.4;

  if (features.energy >= minEnergy) {
    score += 1;
  }

  return score; // max 3
}

module.exports.handler = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res
      .status(200)
      .set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      })
      .send("OK");
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Missing 'title' parameter" });
  }

  try {
    const beats = await getStoryBeatsFromGPT(title);

    if (!beats || beats.length === 0) {
      console.log("No beats parsed from GPT response");
      return res.status(500).json({ error: "Failed to parse story beats from GPT" });
    }

    await getAccessToken();

    const playlist = [];

    for (const beat of beats) {
      const tracks = await searchSpotify(beat);
      const trackIds = tracks.map((t) => t.id).filter(Boolean);

      if (trackIds.length === 0) {
        console.log(`No tracks found for beat: ${JSON.stringify(beat)}`);
        continue;
      }

      const audioFeatures = await getAudioFeatures(trackIds);

      // Map tracks to objects with features for scoring
      const scoredTracks = tracks
        .map((track, index) => {
          return {
            track,
            features: audioFeatures[index],
            score: calculateMatchScore(beat, audioFeatures[index]),
          };
        })
        .filter((t) => t.features !== null) // Remove tracks without features
        .sort((a, b) => b.score - a.score);

      // Include top 3 scored tracks, fallback to top 3 if no scoring
      const topTracks = scoredTracks.length > 0
        ? scoredTracks.slice(0, 3).map((t) => t.track)
        : tracks.slice(0, 3);

      // Push formatted track info
      topTracks.forEach((track) => {
        playlist.push({
          id: track.id,
          name: track.name,
          artists: track.artists.map((a) => a.name).join(", "),
          album: track.album.name,
          image: track.album.images[0]?.url || null,
          spotify_url: track.external_urls.spotify,
          preview_url: track.preview_url,
        });
      });
    }

    console.log(`Final playlist length: ${playlist.length}`);

    return res.status(200).json({ playlist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    return res.status(500).json({ error: "Failed to generate playlist" });
  }
};
