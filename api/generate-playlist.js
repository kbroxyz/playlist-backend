const { Configuration, OpenAIApi } = require("openai");
const SpotifyWebApi = require("spotify-web-api-node");

// Init OpenAI
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

// Init Spotify
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

async function getAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body["access_token"]);
}

async function searchSpotify({ genre, mood, tempo }) {
  const query = `${genre} ${mood} ${tempo}`;
  const result = await spotifyApi.searchTracks(query);
  return result.body.tracks.items;
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the story of the film or TV series titled "${title}" into 3–5 emotional beats. For each beat, suggest a music genre, mood, and tempo. Return each as a numbered list like this:
1. Genre: [genre], Mood: [mood], Tempo: [tempo]`;

  const response = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a creative assistant for music and film curation."
      },
      { role: "user", content: prompt }
    ]
  });

  return parseGPTResponse(response.data.choices[0].message.content);
}

function parseGPTResponse(content) {
  const lines = content.split("\n").filter(line => line.includes("Genre"));
  return lines.map(line => {
    const genre = line.match(/Genre: ([^,]+)/i)?.[1]?.trim() || "ambient";
    const mood = line.match(/Mood: ([^,]+)/i)?.[1]?.trim() || "mysterious";
    const tempo = line.match(/Tempo: ([^,]+)/i)?.[1]?.trim() || "slow";
    return { genre, mood, tempo };
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;

  try {
    const storyBeats = await getStoryBeatsFromGPT(title);
    await getAccessToken();

    const playlist = [];
    for (const beat of storyBeats) {
      const tracks = await searchSpotify(beat);
      playlist.push(...tracks.slice(0, 3));
    }

    res.status(200).json({ playlist });
  } catch (error) {
    console.error("Playlist generation error:", error);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
