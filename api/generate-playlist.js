const express = require("express");
const bodyParser = require("body-parser");
const SpotifyWebApi = require("spotify-web-api-node");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(bodyParser.json());

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
);

async function getAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `
You are a music supervisor curating soundtracks that reflect emotional story arcs.

Break down the emotional progression of the story in "${title}" into 4–5 narrative beats. For each beat, return the following as a JSON array:
[
  {
    "beat": "Intro",
    "genre": "ambient",
    "mood": "mysterious",
    "tempo": "slow"
  },
  ...
]
Only return the JSON array.
`;

  const response = await openai.createChatCompletion({
    model: "gpt-4.1",
    temperature: 0.7,
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          "You are a music supervisor curating emotionally resonant playlists based on film story arcs."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = response.data.choices[0].message.content.trim();

  // Attempt to parse GPT's JSON output safely
  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    const jsonString = raw.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse GPT response:", raw);
    throw new Error("LLM returned invalid format");
  }
}

async function searchSpotifyTrack(beat) {
  const query = `${beat.genre} ${beat.mood} ${beat.tempo}`;
  const result = await spotifyApi.searchTracks(query, { limit: 5 });

  return result.body.tracks.items.map((track) => ({
    title: track.name,
    artist: track.artists[0].name,
    preview_url: track.preview_url,
    spotify_url: track.external_urls.spotify,
    id: track.id
  }));
}

app.post("/generate-playlist", async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Missing film/show title" });
  }

  try {
    await getAccessToken();
    const storyBeats = await getStoryBeatsFromGPT(title);

    const playlist = [];
    for (const beat of storyBeats) {
      const tracks = await searchSpotifyTrack(beat);
      playlist.push(...tracks.slice(0, 3));
    }

    res.json({ playlist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
