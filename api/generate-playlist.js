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
  const prompt = `Analyze the film/TV series "${title}" and break down its narrative arc into 4-5 distinct emotional beats. For each beat, provide:

- Mood: One primary emotional descriptor (mysterious, hopeful, intense, melancholic, triumphant, eerie, romantic, etc.)
- Energy: low, medium, high, or intense
- Vibe: One general musical style preference (cinematic, electronic, acoustic, orchestral, ambient, rock, etc.)
- Keywords: 2-3 searchable terms that capture the feeling

Focus on emotions and searchable terms rather than technical musical details. Use this exact format:

Beat 1:
Mood: <emotional descriptor>
Energy: <energy level>
Vibe: <musical style>
Keywords: <searchable terms>

Beat 2:
Mood: <emotional descriptor>
Energy: <energy level>
Vibe: <musical style>
Keywords: <searchable terms>`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music curator who understands how to find music that matches emotional moments. Focus on moods, feelings, and searchable terms rather than technical musical details." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    
    console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);
    return parseGPTResponse(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    return [
      { mood: "mysterious", energy: "medium", vibe: "cinematic", keywords: "dark atmospheric" },
      { mood: "intense", energy: "high", vibe: "electronic", keywords: "driving powerful" },
      { mood: "melancholic", energy: "low", vibe: "acoustic", keywords: "sad beautiful" },
      { mood: "triumphant", energy: "high", vibe: "orchestral", keywords: "epic victory" }
    ];
  }
}

function parseGPTResponse(content) {
  const beats = [];
  const beatSections = content.split(/Beat \d+:/i).filter(section => section.trim());

  for (const section of beatSections) {
    const lines = section.split('\n').filter(line => line.trim());
    let mood = "cinematic";
    let energy = "medium";
    let vibe = "cinematic";
    let keywords = "atmospheric";

    for (const line of lines) {
      if (line.match(/Mood:/i)) {
        mood = line.split(/Mood:/i)[1]?.trim() || "cinematic";
      } else if (line.match(/Energy:/i)) {
        energy = line.split(/Energy:/i)[1]?.trim() || "medium";
      } else if (line.match(/Vibe:/i)) {
        vibe = line.split(/Vibe:/i)[1]?.trim() || "cinematic";
      } else if (line.match(/Keywords:/i)) {
        keywords = line.split(/Keywords:/i)[1]?.trim() || "atmospheric";
      }
    }

    beats.push({ mood, energy, vibe, keywords });
  }

  console.log("🎬 Parsed story beats:", beats);
  return beats.length > 0 ? beats : [{ mood: "cinematic", energy: "medium", vibe: "cinematic", keywords: "atmospheric" }];
}

async function searchSpotify({ mood, energy, vibe, keywords }, usedTrackIds = new Set()) {
  // Create search strategies that work well with Spotify's algorithm
  const queries = [
    // Genre + mood combinations
    `${vibe} ${mood}`,
    `${mood} music`,
    `${keywords} ${vibe}`,
    
    // Energy-based searches
    energy === 'low' ? `ambient ${mood}` : energy === 'high' ? `energetic ${mood}` : `${mood} soundtrack`,
    
    // Broader genre searches
    `${vibe} instrumental`,
    `${mood} ${keywords}`,
    
    // Fallback searches
    `cinematic ${mood}`,
    `${keywords} music`,
    `${vibe} ${energy}`,
    `atmospheric ${mood}`
  ];

  // Try each query until we find good results
  for (const query of queries) {
    try {
      console.log("🔍 Searching Spotify with query:", query);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 50,
        market: 'US'
      });
      
      const tracks = result.body.tracks.items;
      console.log(`Found ${tracks.length} tracks for query: ${query}`);
      
      // Filter and score tracks
      const validTracks = tracks
        .filter(track => 
          track.id && 
          track.external_urls?.spotify &&
          track.name &&
          track.artists?.length > 0 &&
          !usedTrackIds.has(track.id) &&
          track.preview_url // Prefer tracks with previews
        )
        .map(track => ({
          ...track,
          relevanceScore: calculateRelevanceScore(track, { mood, energy, vibe, keywords })
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      console.log(`Valid tracks found: ${validTracks.length}`);
      
      if (validTracks.length >= 3) {
        return validTracks;
      }
    } catch (error) {
      console.error(`❌ Error searching with query "${query}":`, error);
      continue;
    }
  }

  console.log("⚠️ No sufficient tracks found for any query");
  return [];
}

function calculateRelevanceScore(track, { mood, energy, vibe, keywords }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  const allText = `${trackName} ${albumName} ${artistNames}`;
  
  let score = 0;
  
  // Base popularity score (but not dominant)
  score += Math.min(track.popularity * 0.1, 10);
  
  // Keyword matching
  const keywordList = keywords.toLowerCase().split(' ');
  keywordList.forEach(keyword => {
    if (allText.includes(keyword)) score += 3;
  });
  
  // Mood matching
  if (allText.includes(mood.toLowerCase())) score += 5;
  
  // Vibe/genre matching
  if (allText.includes(vibe.toLowerCase())) score += 4;
  
  // Energy level adjustments
  const energyKeywords = {
    low: ['ambient', 'calm', 'peaceful', 'quiet', 'soft', 'gentle'],
    medium: ['moderate', 'balanced', 'steady'],
    high: ['energetic', 'powerful', 'driving', 'intense', 'fast'],
    intense: ['aggressive', 'heavy', 'extreme', 'brutal', 'fierce']
  };
  
  if (energyKeywords[energy]) {
    energyKeywords[energy].forEach(keyword => {
      if (allText.includes(keyword)) score += 2;
    });
  }
  
  // Prefer instrumental/cinematic content
  const cinematicBoost = ['instrumental', 'cinematic', 'soundtrack', 'score', 'theme'];
  cinematicBoost.forEach(term => {
    if (allText.includes(term)) score += 2;
  });
  
  // Penalize explicit content for cinematic playlists
  if (track.explicit) score -= 3;
  
  // Prefer tracks with reasonable duration (2-8 minutes)
  const durationMinutes = track.duration_ms / 60000;
  if (durationMinutes >= 2 && durationMinutes <= 8) score += 1;
  
  return score;
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
    const maxTracksPerBeat = 4; // Allow more variety
    const usedTrackIds = new Set();
    
    for (let i = 0; i < storyBeats.length; i++) {
      const beat = storyBeats[i];
      console.log(`🎵 Processing beat ${i + 1}:`, beat);
      
      try {
        const tracks = await searchSpotify(beat, usedTrackIds);
        const selectedTracks = tracks.slice(0, maxTracksPerBeat);
        playlist.push(...selectedTracks);
        console.log(`Added ${selectedTracks.length} tracks for beat ${i + 1}`);
        
        // Add track IDs to used set
        selectedTracks.forEach(track => usedTrackIds.add(track.id));
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error processing beat ${i + 1}:`, error);
        continue;
      }
    }

    if (playlist.length === 0) {
      return res.status(404).json({ 
        error: "No valid tracks found",
        message: "Try a different title or check if tracks are available in your region"
      });
    }

    // Remove duplicate tracks and prepare final playlist
    const uniquePlaylist = playlist.filter((track, index, self) => 
      index === self.findIndex(t => t.id === track.id)
    );

    // Simplify playlist data for frontend
    const simplifiedPlaylist = uniquePlaylist.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      image: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      preview_url: track.preview_url,
      relevanceScore: track.relevanceScore
    }));

    console.log(`✅ Final playlist generated with ${simplifiedPlaylist.length} tracks`);
    
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
