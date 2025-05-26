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
  const prompt = `Analyze the film/TV series "${title}" and break down its narrative arc into 4-5 distinct emotional beats that capture the story's progression. For each beat, provide:

- Specific musical characteristics (e.g., "minor key strings with building percussion", "ambient synths with deep bass", "solo piano with reverb", "driving electronic beats with distorted guitars")
- Energy level (low, medium, high, intense)
- Tempo feel (slow, moderate, fast, variable)
- Sonic qualities (dark, bright, warm, cold, spacious, intimate, aggressive, gentle)

Focus on the SOUND and FEEL rather than genre labels. Use this exact format:

Beat 1:
Sound: <specific musical characteristics>
Energy: <energy level>
Tempo: <tempo feel>
Sonic: <sonic qualities>

Beat 2:
Sound: <specific musical characteristics>
Energy: <energy level>
Tempo: <tempo feel>
Sonic: <sonic qualities>`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert music analyst who focuses on sonic characteristics, instrumentation, and musical elements rather than genre labels or names. Describe music by its actual sound qualities." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    });
    
    console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);
    return parseGPTResponse(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    return [
      { sound: "orchestral strings minor key", energy: "medium", tempo: "slow", sonic: "dark mysterious" },
      { sound: "electronic beats synthesizers", energy: "high", tempo: "fast", sonic: "intense driving" },
      { sound: "ambient pads reverb", energy: "low", tempo: "slow", sonic: "spacious ethereal" },
      { sound: "piano strings emotional", energy: "medium", tempo: "moderate", sonic: "warm melancholic" }
    ];
  }
}

function parseGPTResponse(content) {
  const beats = [];
  const beatSections = content.split(/Beat \d+:/i).filter(section => section.trim());

  for (const section of beatSections) {
    const lines = section.split('\n').filter(line => line.trim());
    let sound = "orchestral strings";
    let energy = "medium";
    let tempo = "moderate";
    let sonic = "cinematic";

    for (const line of lines) {
      if (line.match(/Sound:/i)) {
        sound = line.split(/Sound:/i)[1]?.trim() || "orchestral strings";
      } else if (line.match(/Energy:/i)) {
        energy = line.split(/Energy:/i)[1]?.trim() || "medium";
      } else if (line.match(/Tempo:/i)) {
        tempo = line.split(/Tempo:/i)[1]?.trim() || "moderate";
      } else if (line.match(/Sonic:/i)) {
        sonic = line.split(/Sonic:/i)[1]?.trim() || "cinematic";
      }
    }

    beats.push({ sound, energy, tempo, sonic });
  }

  console.log("🎬 Parsed story beats:", beats);
  return beats.length > 0 ? beats : [{ sound: "orchestral strings", energy: "medium", tempo: "moderate", sonic: "cinematic" }];
}

async function searchSpotify({ sound, energy, tempo, sonic }, usedTrackIds = new Set()) {
  // Create search queries based purely on musical characteristics
  const soundKeywords = sound.split(' ').slice(0, 3).join(' '); // First 3 words of sound description
  const energyMap = {
    'low': 'ambient calm peaceful',
    'medium': 'moderate balanced',
    'high': 'energetic driving powerful',
    'intense': 'aggressive intense heavy'
  };
  const tempoMap = {
    'slow': 'slow ballad downtempo',
    'moderate': 'mid-tempo steady',
    'fast': 'fast upbeat rapid',
    'variable': 'dynamic changing'
  };
  
  const energyWords = energyMap[energy.toLowerCase()] || 'cinematic';
  const tempoWords = tempoMap[tempo.toLowerCase()] || 'moderate';
  
  const queries = [
    // Pure musical characteristics
    `${soundKeywords} ${sonic}`,
    `${soundKeywords} ${energyWords}`,
    `${sonic} ${tempoWords}`,
    `${soundKeywords} instrumental`,
    `${energyWords} ${sonic}`,
    `${soundKeywords} ${tempoWords}`,
    // Broader musical terms
    `instrumental ${sonic} ${energyWords}`,
    `${sonic} music ${tempoWords}`,
    `${soundKeywords} cinematic`,
    `${energyWords} instrumental`
  ];

  for (const query of queries) {
    try {
      console.log("🔍 Searching Spotify with query:", query);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 40, // Higher limit for more variety
        market: 'US'
      });
      
      const tracks = result.body.tracks.items;
      console.log(`Found ${tracks.length} tracks for query: ${query}`);
      
      // Filter for valid tracks and remove duplicates
      const validTracks = tracks.filter(track => 
        track.id && 
        track.external_urls && 
        track.external_urls.spotify &&
        track.name &&
        track.artists &&
        track.artists.length > 0 &&
        !usedTrackIds.has(track.id) // Avoid duplicates
      );
      
      // Sort by musical characteristics (deprioritize official soundtracks)
      const sortedTracks = validTracks.sort((a, b) => {
        const aScore = getMusicalRelevanceScore(a, { sound, energy, tempo, sonic });
        const bScore = getMusicalRelevanceScore(b, { sound, energy, tempo, sonic });
        return bScore - aScore;
      });
      
      console.log(`Valid tracks for embedding: ${sortedTracks.length}`);
      
      if (sortedTracks.length >= 2) {
        return sortedTracks;
      }
    } catch (error) {
      console.error(`❌ Error searching with query "${query}":`, error);
      continue;
    }
  }

  console.log("⚠️ No valid tracks found for any query");
  return [];
}

// Score tracks based on musical characteristics only, deprioritize soundtracks
function getMusicalRelevanceScore(track, { sound, energy, tempo, sonic }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  
  let score = 0;
  
  // DEPRIORITIZE official soundtracks
  const soundtrackIndicators = ['soundtrack', 'ost', 'original score', 'motion picture', 'theme from'];
  const isSoundtrack = soundtrackIndicators.some(indicator => 
    trackName.includes(indicator) || albumName.includes(indicator)
  );
  if (isSoundtrack) score -= 10; // Heavy penalty for soundtracks
  
  // Prioritize instrumental music (better for cinematic feel)
  const instrumentalIndicators = ['instrumental', 'piano', 'orchestra', 'symphony', 'quartet', 'ensemble', 'solo'];
  const isInstrumental = instrumentalIndicators.some(indicator => 
    trackName.includes(indicator) || albumName.includes(indicator) || artistNames.includes(indicator)
  );
  if (isInstrumental) score += 5;
  
  // Boost tracks that are likely to match the sonic qualities
  const genreBoosts = {
    'ambient': ['ambient', 'atmospheric', 'drone', 'meditation'],
    'electronic': ['electronic', 'synth', 'digital', 'electro'],
    'orchestral': ['orchestra', 'symphony', 'philharmonic', 'classical'],
    'piano': ['piano', 'keyboard', 'keys'],
    'strings': ['string', 'violin', 'cello', 'chamber'],
    'dark': ['dark', 'noir', 'shadow', 'night'],
    'bright': ['bright', 'light', 'morning', 'sun'],
    'intense': ['intense', 'dramatic', 'power', 'force']
  };
  
  const allText = `${trackName} ${albumName} ${artistNames}`;
  Object.entries(genreBoosts).forEach(([key, indicators]) => {
    if (sound.includes(key) || sonic.includes(key)) {
      indicators.forEach(indicator => {
        if (allText.includes(indicator)) score += 2;
      });
    }
  });
  
  // Slight boost for popularity (but not primary factor)
  score += track.popularity * 0.1;
  
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
    const maxTracksPerBeat = 3; // Reduced to avoid repetition
    const usedTrackIds = new Set(); // Track duplicates across all beats
    
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
