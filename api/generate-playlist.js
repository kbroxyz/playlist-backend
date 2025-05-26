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

- Mood: One word (dark, bright, sad, happy, intense, calm, mysterious, uplifting)
- Energy: low, medium, or high
- Genre: One broad genre (electronic, rock, classical, ambient, pop, indie, jazz, folk)

Keep it simple and searchable. Use this exact format:

Beat 1:
Mood: <one word>
Energy: <low/medium/high>
Genre: <broad genre>

Beat 2:
Mood: <one word>
Energy: <low/medium/high>
Genre: <broad genre>`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music curator. Keep responses simple with single-word moods and broad, searchable genres." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    
    console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);
    return parseGPTResponse(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    return [
      { mood: "dark", energy: "medium", genre: "electronic" },
      { mood: "intense", energy: "high", genre: "rock" },
      { mood: "sad", energy: "low", genre: "ambient" },
      { mood: "uplifting", energy: "high", genre: "indie" }
    ];
  }
}

function parseGPTResponse(content) {
  const beats = [];
  const beatSections = content.split(/Beat \d+:/i).filter(section => section.trim());

  for (const section of beatSections) {
    const lines = section.split('\n').filter(line => line.trim());
    let mood = "dark";
    let energy = "medium";
    let genre = "electronic";

    for (const line of lines) {
      if (line.match(/Mood:/i)) {
        mood = line.split(/Mood:/i)[1]?.trim().toLowerCase() || "dark";
      } else if (line.match(/Energy:/i)) {
        energy = line.split(/Energy:/i)[1]?.trim().toLowerCase() || "medium";
      } else if (line.match(/Genre:/i)) {
        genre = line.split(/Genre:/i)[1]?.trim().toLowerCase() || "electronic";
      }
    }

    beats.push({ mood, energy, genre });
  }

  console.log("🎬 Parsed story beats:", beats);
  return beats.length > 0 ? beats : [{ mood: "dark", energy: "medium", genre: "electronic" }];
}

async function searchSpotify({ mood, energy, genre }, usedTrackIds = new Set()) {
  // Very broad, guaranteed-to-work search terms
  const baseQueries = [
    // Single word searches (most reliable)
    genre,
    mood,
    
    // Simple combinations
    `${genre} music`,
    `${mood} music`,
    
    // Energy-based
    energy === 'low' ? 'chill' : energy === 'high' ? 'upbeat' : 'music',
    
    // Popular broad terms
    'instrumental',
    'soundtrack',
    'cinematic',
    
    // Fallback to very common terms
    'ambient',
    'electronic',
    'indie'
  ];

  console.log(`🔍 Searching for beat: ${mood} ${energy} ${genre}`);
  
  // Try each query with very permissive filtering
  for (const query of baseQueries) {
    try {
      console.log(`Trying query: "${query}"`);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 50,
        market: 'US'
      });
      
      const tracks = result.body.tracks.items;
      console.log(`Raw results: ${tracks.length} tracks`);
      
      if (!tracks || tracks.length === 0) {
        console.log("No tracks returned from Spotify");
        continue;
      }
      
      // Very minimal filtering - just check essentials
      const validTracks = tracks.filter(track => {
        const isValid = track && 
          track.id && 
          track.name && 
          track.artists && 
          track.artists.length > 0 &&
          track.external_urls &&
          !usedTrackIds.has(track.id);
        
        if (!isValid) {
          console.log(`Filtered out track: ${track?.name || 'unknown'} - missing required fields`);
        }
        
        return isValid;
      });
      
      console.log(`After filtering: ${validTracks.length} valid tracks`);
      
      if (validTracks.length > 0) {
        // Score and sort
        const scoredTracks = validTracks.map(track => ({
          ...track,
          relevanceScore: calculateSimpleScore(track, { mood, energy, genre })
        })).sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`✅ Found ${scoredTracks.length} tracks for query: ${query}`);
        return scoredTracks;
      }
    } catch (error) {
      console.error(`❌ Error with query "${query}":`, error);
      continue;
    }
  }

  console.log("⚠️ No tracks found for any query");
  return [];
}

function calculateSimpleScore(track, { mood, energy, genre }) {
  let score = 0;
  
  // Base popularity (most important factor)
  score += track.popularity || 0;
  
  // Text matching (bonus points)
  const allText = `${track.name} ${track.album.name} ${track.artists.map(a => a.name).join(' ')}`.toLowerCase();
  
  if (allText.includes(mood)) score += 20;
  if (allText.includes(genre)) score += 15;
  if (allText.includes('instrumental')) score += 10;
  if (allText.includes('soundtrack')) score += 5;
  
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
    
    // Test basic Spotify search first
    console.log("🧪 Testing basic Spotify search...");
    const testResult = await spotifyApi.searchTracks('electronic', { limit: 5, market: 'US' });
    console.log(`Test search returned ${testResult.body.tracks.items.length} tracks`);
    
    if (testResult.body.tracks.items.length === 0) {
      throw new Error("Spotify search is not returning any results - check API credentials");
    }
    
    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Search for tracks for each beat
    const playlist = [];
    const usedTrackIds = new Set();
    
    for (let i = 0; i < storyBeats.length; i++) {
      const beat = storyBeats[i];
      console.log(`🎵 Processing beat ${i + 1}:`, beat);
      
      try {
        const tracks = await searchSpotify(beat, usedTrackIds);
        
        if (tracks.length > 0) {
          // Take top 3 tracks per beat
          const selectedTracks = tracks.slice(0, 3);
          playlist.push(...selectedTracks);
          
          // Mark tracks as used
          selectedTracks.forEach(track => usedTrackIds.add(track.id));
          
          console.log(`✅ Added ${selectedTracks.length} tracks for beat ${i + 1}`);
        } else {
          console.log(`⚠️ No tracks found for beat ${i + 1}`);
        }
        
        // Small delay to be nice to Spotify API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Error processing beat ${i + 1}:`, error);
        continue;
      }
    }

    console.log(`📊 Total tracks collected: ${playlist.length}`);

    if (playlist.length === 0) {
      // Final fallback - just search for popular tracks
      console.log("🚨 No tracks found, using fallback search...");
      try {
        const fallbackResult = await spotifyApi.searchTracks('instrumental electronic', { limit: 10, market: 'US' });
        const fallbackTracks = fallbackResult.body.tracks.items.filter(track => 
          track && track.id && track.name && track.artists && track.external_urls
        );
        playlist.push(...fallbackTracks);
        console.log(`Added ${fallbackTracks.length} fallback tracks`);
      } catch (fallbackError) {
        console.error("❌ Fallback search also failed:", fallbackError);
      }
    }

    if (playlist.length === 0) {
      return res.status(404).json({ 
        error: "No tracks found",
        message: "Unable to find any tracks. This may be a regional availability issue or API problem.",
        debug: {
          storyBeats,
          testSearchWorked: testResult.body.tracks.items.length > 0
        }
      });
    }

    // Prepare final playlist
    const simplifiedPlaylist = playlist.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      image: track.album.images?.[0]?.url || null,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      preview_url: track.preview_url || null
    }));

    console.log(`✅ Final playlist: ${simplifiedPlaylist.length} tracks`);
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats
    });

  } catch (error) {
    console.error("❌ Error generating playlist:", error);
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
