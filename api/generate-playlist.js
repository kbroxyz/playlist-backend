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

// Comprehensive mood/theme expansion dictionary
const moodExpansion = {
  ambush: ['attack', 'surprise', 'strike', 'assault', 'sudden', 'stealth'],
  betrayal: ['treachery', 'deception', 'backstab', 'unfaithful', 'dishonest', 'double cross'],
  bureaucracy: ['corporate', 'system', 'administration', 'office', 'institutional', 'formal'],
  corrupt: ['evil', 'twisted', 'rotten', 'decayed', 'tainted', 'poisoned', 'vile'],
  crime: ['criminal', 'underworld', 'gang', 'mafia', 'illegal', 'outlaw', 'thug'],
  dark: ['noir', 'shadow', 'haunting', 'ominous', 'eerie', 'gothic', 'brooding', 'black'],
  deception: ['lies', 'illusion', 'fake', 'false', 'trick', 'manipulate', 'deceit'],
  destruction: ['chaos', 'ruin', 'apocalypse', 'devastation', 'wreckage', 'collapse'],
  dystopia: ['dystopian', 'oppression', 'totalitarian', 'bleak', 'authoritarian', 'nightmare'],
  ecology: ['nature', 'environment', 'forest', 'earth', 'green', 'organic', 'natural'],
  epic: ['heroic', 'grand', 'majestic', 'triumphant', 'powerful', 'legendary', 'massive'],
  existential: ['philosophical', 'meaning', 'purpose', 'void', 'existence', 'abstract'],
  fight: ['battle', 'combat', 'war', 'conflict', 'struggle', 'aggressive', 'warrior'],
  future: ['futuristic', 'sci-fi', 'space', 'technology', 'cyber', 'digital', 'tomorrow'],
  gritty: ['rough', 'raw', 'harsh', 'street', 'urban', 'tough', 'hardcore'],
  guilt: ['shame', 'regret', 'sorry', 'remorse', 'burden', 'weight', 'heavy'],
  intense: ['aggressive', 'powerful', 'driving', 'fierce', 'dramatic', 'heavy', 'strong'],
  journey: ['travel', 'adventure', 'quest', 'voyage', 'expedition', 'path', 'road'],
  mystery: ['enigmatic', 'cryptic', 'secretive', 'hidden', 'unknown', 'puzzle', 'riddle'],
  nature: ['forest', 'wilderness', 'earth', 'organic', 'wild', 'natural', 'green'],
  'neo-noir': ['noir', 'detective', 'crime', 'urban', 'night', 'city', 'shadow'],
  nostalgic: ['memories', 'past', 'longing', 'wistful', 'reminiscent', 'vintage', 'old'],
  ominous: ['threatening', 'foreboding', 'menacing', 'sinister', 'warning', 'danger'],
  power: ['strength', 'force', 'dominance', 'control', 'authority', 'mighty', 'ruler'],
  prophecy: ['fate', 'destiny', 'oracle', 'vision', 'future', 'prediction', 'divine'],
  resistance: ['rebellion', 'revolt', 'fight back', 'uprising', 'defiant', 'revolution'],
  scary: ['horror', 'terror', 'frightening', 'creepy', 'spooky', 'nightmare', 'fear'],
  secrecy: ['hidden', 'secret', 'covert', 'underground', 'classified', 'mysterious'],
  spiritual: ['sacred', 'divine', 'meditation', 'soul', 'transcendent', 'ethereal'],
  survival: ['struggle', 'endurance', 'harsh', 'wilderness', 'fight', 'persist'],
  suspense: ['tension', 'thriller', 'anxiety', 'edge', 'waiting', 'unknown', 'build'],
  tribe: ['tribal', 'community', 'clan', 'group', 'indigenous', 'ancient', 'ritual']
};

// Genre expansion and variations
const genreExpansion = {
  ambient: ['atmospheric', 'drone', 'meditation', 'space', 'new age', 'soundscape'],
  bass: ['heavy bass', 'sub bass', 'bass heavy', 'low end', 'bass music'],
  chill: ['relaxed', 'calm', 'peaceful', 'mellow', 'laid back', 'smooth'],
  chillstep: ['chill dubstep', 'melodic dubstep', 'liquid dubstep', 'future bass'],
  cinematic: ['film score', 'movie soundtrack', 'orchestral', 'epic', 'trailer music'],
  dark: ['darkwave', 'dark ambient', 'industrial', 'gothic', 'shadow'],
  'deep house': ['deep', 'soulful house', 'underground house', 'tech house'],
  downtempo: ['trip hop', 'lounge', 'chillout', 'slow', 'relaxed'],
  'drum & bass': ['dnb', 'jungle', 'liquid dnb', 'neurofunk', 'breakbeat'],
  dubstep: ['wobble', 'bass drop', 'electronic', 'glitch', 'step'],
  'electro house': ['electro', 'big room', 'festival', 'dance', 'club'],
  electronic: ['synth', 'digital', 'edm', 'electronica', 'synthetic'],
  electronica: ['idm', 'intelligent dance', 'experimental electronic', 'glitch'],
  experimental: ['avant-garde', 'abstract', 'noise', 'unconventional', 'art'],
  'future garage': ['uk garage', '2-step', 'future beats', 'bass music'],
  garage: ['uk garage', '2-step', 'speed garage', 'bass'],
  'hard techno': ['industrial techno', 'hardcore', 'hard dance', 'rave'],
  'hip-hop': ['rap', 'beats', 'urban', 'street', 'boom bap'],
  house: ['dance', 'club', '4/4', 'electronic dance', 'disco'],
  jazz: ['smooth jazz', 'fusion', 'bebop', 'swing', 'blues'],
  jungle: ['drum and bass', 'breakbeat', 'ragga', 'hardcore'],
  'low-fi': ['lofi', 'lo-fi hip hop', 'chill beats', 'study music', 'vinyl'],
  'melodic techno': ['progressive techno', 'deep techno', 'emotional techno'],
  'melodic house': ['progressive house', 'deep house', 'emotional house'],
  minimal: ['minimalist', 'stripped down', 'simple', 'repetitive', 'clean'],
  'organic house': ['natural', 'earthy', 'world music', 'ethnic', 'tribal'],
  pop: ['mainstream', 'radio', 'catchy', 'commercial', 'vocal'],
  progressive: ['prog', 'evolving', 'journey', 'buildup', 'cinematic'],
  'progressive house': ['prog house', 'uplifting', 'emotional', 'journey'],
  'progressive trance': ['prog trance', 'uplifting trance', 'emotional trance'],
  rock: ['alternative', 'indie rock', 'post-rock', 'guitar', 'band'],
  synth: ['synthesizer', 'analog', 'retro', 'vintage', 'electronic'],
  synthpop: ['new wave', '80s', 'retro pop', 'synth wave'],
  synthwave: ['retrowave', 'outrun', '80s', 'neon', 'cyberpunk', 'vaporwave'],
  'tech house': ['techno house', 'minimal house', 'underground'],
  techno: ['four on the floor', 'industrial', 'rave', 'electronic dance'],
  trance: ['uplifting', 'euphoric', 'psytrance', 'progressive trance'],
  trap: ['hip hop trap', 'electronic trap', 'bass', '808', 'hard']
};

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
  const availableMoods = Object.keys(moodExpansion).join(', ');
  const availableGenres = Object.keys(genreExpansion).join(', ');

  const prompt = `Analyze the film/TV series "${title}" and break down its narrative arc into 4-5 distinct emotional beats.

For each beat, choose from these specific options:

MOODS/THEMES: ${availableMoods}

GENRES: ${availableGenres}

Use this exact format:

Beat 1:
Mood: <choose one from the mood list>
Energy: <low/medium/high>
Genre: <choose one from the genre list>

Beat 2:
Mood: <choose one from the mood list>
Energy: <low/medium/high>
Genre: <choose one from the genre list>

Focus on the emotional journey and pick the most fitting mood/genre combinations.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music curator. Choose moods and genres from the provided lists only. Consider the emotional arc of the story." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    
    console.log("🧠 GPT response:", response.choices?.[0]?.message?.content);
    return parseGPTResponse(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ OpenAI API error:", error);
    return [
      { mood: "dark", energy: "medium", genre: "cinematic" },
      { mood: "intense", energy: "high", genre: "electronic" },
      { mood: "mystery", energy: "low", genre: "ambient" },
      { mood: "epic", energy: "high", genre: "progressive" }
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
    let genre = "cinematic";

    for (const line of lines) {
      if (line.match(/Mood:/i)) {
        const parsedMood = line.split(/Mood:/i)[1]?.trim().toLowerCase();
        if (moodExpansion[parsedMood]) {
          mood = parsedMood;
        }
      } else if (line.match(/Energy:/i)) {
        energy = line.split(/Energy:/i)[1]?.trim().toLowerCase() || "medium";
      } else if (line.match(/Genre:/i)) {
        const parsedGenre = line.split(/Genre:/i)[1]?.trim().toLowerCase();
        if (genreExpansion[parsedGenre]) {
          genre = parsedGenre;
        }
      }
    }

    beats.push({ mood, energy, genre });
  }

  console.log("🎬 Parsed story beats:", beats);
  return beats.length > 0 ? beats : [{ mood: "dark", energy: "medium", genre: "cinematic" }];
}

async function multiQuerySearch({ mood, energy, genre }, usedTrackIds = new Set()) {
  console.log(`🔍 Multi-query search for: ${mood} ${energy} ${genre}`);
  
  // Get expanded terms
  const moodSynonyms = moodExpansion[mood] || [mood];
  const genreVariations = genreExpansion[genre] || [genre];
  
  // Shuffle arrays to introduce randomness
  const shuffledMoodSynonyms = [...moodSynonyms].sort(() => Math.random() - 0.5);
  const shuffledGenreVariations = [...genreVariations].sort(() => Math.random() - 0.5);
  
  // Create comprehensive query list with randomization
  let queries = [
    // Direct terms
    mood,
    genre,
    
    // Basic combinations
    `${mood} ${genre}`,
    `${genre} ${mood}`,
    
    // With "music" keyword
    `${mood} music`,
    `${genre} music`,
    `${mood} ${genre} music`,
    
    // Instrumental variations
    `${genre} instrumental`,
    `${mood} instrumental`,
    `instrumental ${genre}`,
    
    // Synonym combinations (randomized selection)
    ...shuffledMoodSynonyms.slice(0, 3).map(syn => syn),
    ...shuffledGenreVariations.slice(0, 3).map(variation => variation),
    ...shuffledMoodSynonyms.slice(0, 2).map(syn => `${syn} ${genre}`),
    ...shuffledGenreVariations.slice(0, 2).map(variation => `${mood} ${variation}`),
    
    // Energy-based additions
    energy === 'low' ? `${genre} chill` : energy === 'high' ? `${genre} intense` : `${genre} moderate`,
    energy === 'low' ? `ambient ${mood}` : energy === 'high' ? `energetic ${mood}` : `${mood}`,
    
    // Soundtrack variations
    `${mood} soundtrack`,
    `${genre} soundtrack`,
    `cinematic ${mood}`,
    `film ${genre}`,
    
    // Additional variety queries
    `${shuffledMoodSynonyms[0] || mood} ${shuffledGenreVariations[0] || genre}`,
    `atmospheric ${genre}`,
    `epic ${mood}`,
    
    // Broader fallbacks
    'instrumental',
    'cinematic',
    'soundtrack'
  ];
  
  // Shuffle the entire query list for variety
  queries = queries.sort(() => Math.random() - 0.5);

  const allTracks = [];
  const seenTrackIds = new Set();
  
  // Execute searches with reasonable limits
  for (let i = 0; i < Math.min(queries.length, 15); i++) {
    const query = queries[i];
    
    try {
      console.log(`Query ${i + 1}: "${query}"`);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 20,
        market: 'US'
      });
      
      const tracks = result.body.tracks.items;
      console.log(`  Found ${tracks.length} tracks`);
      
      // Filter and deduplicate
      const validTracks = tracks.filter(track => {
        return track && 
          track.id && 
          track.name && 
          track.artists?.length > 0 &&
          track.external_urls &&
          !usedTrackIds.has(track.id) &&
          !seenTrackIds.has(track.id);
      });
      
      // Add to seen set
      validTracks.forEach(track => seenTrackIds.add(track.id));
      allTracks.push(...validTracks);
      
      console.log(`  Added ${validTracks.length} valid tracks`);
      
      // Small delay to be nice to API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error with query "${query}":`, error);
      continue;
    }
  }

  console.log(`🎵 Total unique tracks found: ${allTracks.length}`);
  
  if (allTracks.length === 0) {
    return [];
  }

  // Score and sort all tracks
  const scoredTracks = allTracks.map(track => ({
    ...track,
    relevanceScore: calculateAdvancedScore(track, { mood, energy, genre })
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(`✅ Returning top scored tracks (${Math.min(scoredTracks.length, 10)} tracks)`);
  return scoredTracks;
}

function calculateAdvancedScore(track, { mood, energy, genre }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  const allText = `${trackName} ${albumName} ${artistNames}`;
  
  let score = 0;
  
  // Base popularity (scaled down)
  score += Math.min(track.popularity * 0.2, 20);
  
  // Direct mood match (highest priority)
  if (allText.includes(mood)) score += 100;
  
  // Mood synonym matches
  const moodSynonyms = moodExpansion[mood] || [];
  moodSynonyms.forEach(synonym => {
    if (allText.includes(synonym)) score += 50;
  });
  
  // Direct genre match
  if (allText.includes(genre)) score += 80;
  
  // Genre variation matches
  const genreVariations = genreExpansion[genre] || [];
  genreVariations.forEach(variation => {
    if (allText.includes(variation)) score += 40;
  });
  
  // Energy level bonuses
  const energyKeywords = {
    low: ['ambient', 'calm', 'peaceful', 'quiet', 'soft', 'gentle', 'chill', 'relax'],
    medium: ['moderate', 'balanced', 'steady', 'mid', 'normal'],
    high: ['energetic', 'powerful', 'driving', 'intense', 'fast', 'aggressive', 'hard', 'strong']
  };
  
  if (energyKeywords[energy]) {
    energyKeywords[energy].forEach(keyword => {
      if (allText.includes(keyword)) score += 30;
    });
  }
  
  // Instrumental/cinematic bonus
  if (allText.includes('instrumental')) score += 40;
  if (allText.includes('cinematic')) score += 35;
  if (allText.includes('soundtrack')) score += 30;
  if (allText.includes('theme')) score += 25;
  
  // Duration preference (3-7 minutes ideal)
  const minutes = track.duration_ms / 60000;
  if (minutes >= 3 && minutes <= 7) score += 20;
  else if (minutes >= 2 && minutes <= 10) score += 10;
  
  // Recency bonus (slight preference for newer tracks)
  if (track.album.release_date) {
    const year = new Date(track.album.release_date).getFullYear();
    if (year >= 2015) score += 15;
    else if (year >= 2010) score += 10;
  }
  
  // Penalize explicit content for cinematic purposes
  if (track.explicit) score -= 25;
  
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
    
    // Test basic connectivity
    console.log("🧪 Testing Spotify connectivity...");
    const testResult = await spotifyApi.searchTracks('electronic', { limit: 1, market: 'US' });
    if (testResult.body.tracks.items.length === 0) {
      throw new Error("Spotify API not returning results");
    }
    console.log("✅ Spotify connectivity confirmed");
    
    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Search for tracks for each beat using multi-query approach
    const playlist = [];
    const usedTrackIds = new Set();
    const maxTracksPerBeat = 4;
    
    for (let i = 0; i < storyBeats.length; i++) {
      const beat = storyBeats[i];
      console.log(`🎵 Processing beat ${i + 1}: ${beat.mood} ${beat.energy} ${beat.genre}`);
      
      try {
        const tracks = await multiQuerySearch(beat, usedTrackIds);
        
        if (tracks.length > 0) {
          const selectedTracks = tracks.slice(0, maxTracksPerBeat);
          playlist.push(...selectedTracks);
          
          // Mark tracks as used
          selectedTracks.forEach(track => usedTrackIds.add(track.id));
          
          console.log(`✅ Added ${selectedTracks.length} tracks for beat ${i + 1}`);
          console.log(`  Top track: "${selectedTracks[0].name}" by ${selectedTracks[0].artists[0].name} (score: ${selectedTracks[0].relevanceScore})`);
        } else {
          console.log(`⚠️ No tracks found for beat ${i + 1}`);
        }
        
        // Delay between beats
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Error processing beat ${i + 1}:`, error);
        continue;
      }
    }

    console.log(`📊 Total tracks collected: ${playlist.length}`);

    if (playlist.length === 0) {
      return res.status(404).json({ 
        error: "No tracks found",
        message: "Unable to find tracks matching the story beats. This may be due to regional restrictions or very specific requirements.",
        storyBeats: storyBeats
      });
    }

    // Remove duplicates and prepare final playlist
    const uniquePlaylist = playlist.filter((track, index, self) => 
      index === self.findIndex(t => t.id === track.id)
    );

    const simplifiedPlaylist = uniquePlaylist.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      image: track.album.images?.[0]?.url || null,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      preview_url: track.preview_url || null,
      relevanceScore: track.relevanceScore
    }));

    console.log(`✅ Final playlist: ${simplifiedPlaylist.length} unique tracks`);
    console.log("Top 3 tracks by score:");
    simplifiedPlaylist.slice(0, 3).forEach((track, i) => {
      console.log(`  ${i + 1}. "${track.name}" by ${track.artists} (${track.relevanceScore})`);
    });
    
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
