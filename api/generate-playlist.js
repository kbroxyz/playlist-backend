const { Configuration, OpenAIApi } = require("openai");
const SpotifyWebApi = require("spotify-web-api-node");

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function authenticateSpotify() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body.access_token);
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `
You are a screenwriter helping to adapt a film or TV series into a soundtrack. Break the story down into 4-6 key emotional or narrative beats in JSON format. Each beat should have a 'label' (short description) and a 'mood' (emotional tone).

Only output valid JSON as an array of objects like:
[
  { "label": "Opening Scene", "mood": "mysterious, calm" },
  { "label": "Conflict Arises", "mood": "tense, dramatic" },
  ...
]

Title: "${title}"
`;

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  if (
    !completion ||
    !completion.data ||
    !completion.data.choices ||
    !completion.data.choices[0]?.message?.content
  ) {
    throw new Error("OpenAI response is missing expected structure.");
  }

  console.log("GPT response:", completion.data.choices[0].message.content);

  return JSON.parse(completion.data.choices[0].message.content);
}

async function searchTracksForBeat(beat) {
  const query = `${beat.label} ${beat.mood}`;
  const result = await spotifyApi.searchTracks(query, { limit: 10 });

  if (!result.body.tracks || !result.body.tracks.items.length) {
    console.warn("No tracks found for:", query);
    return null;
  }

  const selectedTrack = result.body.tracks.items.find(
    (track) => !!track.preview_url || !!track.external_urls?.spotify
  );

  if (!selectedTrack) {
    console.warn("No valid preview or Spotify URL for:", query);
    return null;
  }

  return {
    id: selectedTrack.id,
    name: selectedTrack.name,
    artists: selectedTrack.artists.map((a) => a.name).join(", "),
    album: selectedTrack.album.name,
    image: selectedTrack.album.images?.[0]?.url,
    preview_url: selectedTrack.preview_url,
    spotify_url: selectedTrack.external_urls.spotify,
  };
}

module.exports = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Missing title in request body" });
    }

    await authenticateSpotify();

    const storyBeats = await getStoryBeatsFromGPT(title);

    console.log("Story beats:", storyBeats);

    const trackPromises = storyBeats.map((beat) => searchTracksForBeat(beat));
    const tracks = (await Promise.all(trackPromises)).filter(Boolean);

    console.log("Selected tracks:", tracks);

    res.status(200).json({ tracks });
  } catch (err) {
    console.error("Error generating playlist:", err);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
};
