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
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body["access_token"]);
    console.log("✅ Spotify access token obtained");
  } catch (error) {
    console.error("❌ Failed to get Spotify access token:", error);
    throw error;
  }
}

async function getStoryBeatsFromGPT(title) {
  const prompt = `Break down the narrative arc of "${title}" into 3–5 distinct emotional beats. For each beat, return only the most fitting:
- Music genre (e.g., indie rock, synthwave, orchestral, electronic, folk, jazz, classical)
- Mood (e.g., hopeful, tense, melancholic, uplifting, dark, mysterious, energetic)

Use this exact format:

Beat 1:
Genre: <genre>
Mood: <mood>

Beat 2:
Genre: <genre>
Mood: <mood>

Beat 3:
Genre: <genre>
Mood: <mood>`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a creative assistant for music and film curation. Provide exactly 3-5 beats in the requested format." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    
    console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);
    return parseGPTResponse(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    // Fallback beats if OpenAI fails
    return [
      { genre: "cinematic", mood: "dramatic" },
      { genre: "ambient", mood: "mysterious" },
      { genre: "orchestral", mood: "emotional" }
    ];
  }
}

function parseGPTResponse(content) {
  const beats = [];
  const beatSections = content.split(/Beat \d+:/i).filter(section => section.trim());

  for (const section of beatSections) {
    const lines = section.split('\n').filter(line => line.trim());
    let genre = "ambient";
    let mood = "mysterious";

    for (const line of lines) {
      if (line.match(/Genre:/i)) {
        genre = line.split(/Genre:/i)[1]?.trim() || "ambient";
      } else if (line.match(/Mood:/i)) {
        mood = line.split(/Mood:/i)[1]?.trim() || "mysterious";
      }
    }

    beats.push({ genre, mood });
  }

  console.log("🎬 Parsed story beats:", beats);
  return beats.length > 0 ? beats : [{ genre: "ambient", mood: "mysterious" }];
}

async function searchSpotify({ genre, mood }) {
  const queries = [
    `${genre} ${mood}`,
    `${genre}`,
    `${mood}`,
    `soundtrack ${genre}`,
    `instrumental ${mood}`
  ];

  for (const query of queries) {
    try {
      console.log("🔍 Searching Spotify with query:", query);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 20, // Increased limit to have more options
        market: 'US' // Specify market for better preview availability
      });
      
      const tracks = result.body.tracks.items;
      console.log(`Found ${tracks.length} tracks for query: ${query}`);
      
      // Since we're using Spotify embeds, we don't need preview URLs
      // Just filter out tracks without proper IDs or external URLs
      const validTracks = tracks.filter(track => 
        track.id && 
        track.external_urls && 
        track.external_urls.spotify &&
        track.name &&
        track.artists &&
        track.artists.length > 0
      );
      
      console.log(`Valid tracks for embedding: ${validTracks.length}`);
      
      if (validTracks.length >= 3) {
        return validTracks;
      }
    } catch (error) {
      console.error(`❌ Error searching with query "${query}":`, error);
      continue; // Try next query
    }
  }

  console.log("⚠️ No valid tracks found for any query");
  return [];
}

// Vercel Serverless Function Entry Point
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: "Missing or empty 'title' in request body" });
  }

  console.log(`🎬 Processing request for title: "${title}"`);

  try {
    // Get Spotify access token
    await getSpotifyAccessToken();
    
    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Search for tracks for each beat
    const playlist = [];
    const maxTracksPerBeat = 4;
    
    for (let i = 0; i < storyBeats.length; i++) {
      const beat = storyBeats[i];
      console.log(`🎵 Processing beat ${i + 1}:`, beat);
      
      try {
        const tracks = await searchSpotify(beat);
        const selectedTracks = tracks.slice(0, maxTracksPerBeat);
        playlist.push(...selectedTracks);
        console.log(`Added ${selectedTracks.length} tracks for beat ${i + 1}`);
      } catch (error) {
        console.error(`❌ Error processing beat ${i + 1}:`, error);
        continue; // Skip this beat and continue with others
      }
    }

    if (playlist.length === 0) {
      return res.status(404).json({ 
        error: "No valid tracks found",
        message: "Try a different title or check if tracks are available in your region"
      });
    }

    // Simplify playlist data for frontend
    const simplifiedPlaylist = playlist.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      image: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      popularity: track.popularity
    }));

    console.log(`✅ Final playlist generated with ${simplifiedPlaylist.length} tracks`);
    console.log("Spotify URLs check:", simplifiedPlaylist.map(t => ({ name: t.name, spotify_url: t.spotify_url })));
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats
    });

  } catch (error) {
    console.error("❌ Error generating playlist:", error);
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message 
    });
  }
};
