const fetch = require("node-fetch");
const { Configuration, OpenAIApi } = require("openai");
const SpotifyWebApi = require("spotify-web-api-node");

// OpenAI configuration
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// Spotify API configuration
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let spotifyTokenExpiresAt = 0;

// Get or refresh Spotify access token
async function ensureSpotifyAccessToken() {
  if (Date.now() < spotifyTokenExpiresAt) return;

  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body.access_token);
  spotifyTokenExpiresAt = Date.now() + data.body.expires_in * 1000;
}

// Helper to get story beats
async function getStoryBeatsFromGPT(title) {
  try {
    const prompt = `
You are a screenwriter. Break down the narrative structure of the film or TV show titled "${title}" into 5 to 7 key story beats. Focus on emotional tone, character development, and atmosphere. Return the result strictly as a JSON array of objects, each with a 'beat' and a 'mood' property, no commentary or formatting.

Example:
[
  { "beat": "Opening scene in a desolate town introduces a lonely protagonist", "mood": "melancholy" },
  { "beat": "Protagonist meets an enigmatic stranger", "mood": "curious, tense" },
  ...
]
`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const raw = completion.data.choices[0].message.content.trim();
    const json = raw.replace(/^```(?:json)?|```$/g, ""); // strip markdown if present
    return JSON.parse(json);
  } catch (err) {
    console.error("Error fetching story beats from GPT:", err);
    throw err;
  }
}

// Search Spotify for tracks based on beat/mood
async function searchTracksForBeat(beatObj) {
  const query = `${beatObj.mood} ${beatObj.beat}`;
  try {
    const response = await spotifyApi.searchTracks(query, { limit: 10 });
    const tracks = response.body.tracks.items;

    return tracks.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      image: track.album.images[0]?.url || "",
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify,
    }));
  } catch (err) {
    console.error("Error searching Spotify:", err);
    return [];
  }
}

// API handler
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  try {
    await ensureSpotifyAccessToken();

    const beats = await getStoryBeatsFromGPT(title);
    console.log("Story Beats:", beats);

    const trackResults = await Promise.all(beats.map(searchTracksForBeat));

    // Flatten and dedupe
    const allTracks = trackResults.flat().filter((t) => !!t.spotify_url);
    const uniqueTracks = Array.from(
      new Map(allTracks.map((t) => [t.spotify_url, t])).values()
    );

    const playlist = uniqueTracks.slice(0, 20); // Limit to 20 tracks
    res.status(200).json({ playlist });
  } catch (err) {
    console.error("Error generating playlist:", err);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
