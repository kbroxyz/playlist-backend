const SpotifyWebApi = require("spotify-web-api-node");
const OpenAI = require("openai");
const axios = require("axios");

// Init OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Spotify setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// GetSongBPM API configuration
const GETSONGBPM_API_KEY = "74f0fbb0fff7055b193d8fdf6b42605a";
const GETSONGBPM_BASE_URL = "https://api.getsongbpm.com/song/";

// Enhanced BPM ranges for different energy levels
const energyBPMRanges = {
  low: { min: 60, max: 90, ideal: [70, 80] },
  medium: { min: 85, max: 130, ideal: [100, 120] },
  high: { min: 125, max: 180, ideal: [130, 150] }
};

// Musical key emotion mapping
const keyEmotionMap = {
  // Major keys - generally brighter/happier
  'C': { mood: ['epic', 'journey'], energy: 'medium' },
  'D': { mood: ['epic', 'power'], energy: 'high' },
  'E': { mood: ['intense', 'fight'], energy: 'high' },
  'F': { mood: ['nostalgic', 'spiritual'], energy: 'low' },
  'G': { mood: ['journey', 'nature'], energy: 'medium' },
  'A': { mood: ['epic', 'power'], energy: 'high' },
  'B': { mood: ['intense', 'ominous'], energy: 'high' },
  
  // Minor keys - generally darker/more emotional
  'Cm': { mood: ['dark', 'ominous'], energy: 'medium' },
  'Dm': { mood: ['mystery', 'guilt'], energy: 'low' },
  'Em': { mood: ['dark', 'spiritual'], energy: 'medium' },
  'Fm': { mood: ['scary', 'corrupt'], energy: 'low' },
  'Gm': { mood: ['mystery', 'betrayal'], energy: 'medium' },
  'Am': { mood: ['nostalgic', 'guilt'], energy: 'low' },
  'Bm': { mood: ['dark', 'intense'], energy: 'medium' }
};

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

// IMPROVED: GetSongBPM API integration with enhanced debugging
async function getSongBPMData(artist, title) {
  try {
    const encodedArtist = encodeURIComponent(artist);
    const encodedTitle = encodeURIComponent(title);
    const url = `${GETSONGBPM_BASE_URL}?api_key=${GETSONGBPM_API_KEY}&artist=${encodedArtist}&title=${encodedTitle}`;
    
    console.log(`🎵 Fetching BPM data for: ${artist} - ${title}`);
    console.log(`🔗 API URL: ${url}`); // DEBUG: Log the actual URL
    
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        'User-Agent': 'Playlist-Generator/1.0'
      }
    });
    
    console.log(`📊 Raw API response:`, response.data); // DEBUG: Log raw response
    
    if (response.data && response.data.song) {
      const songData = response.data.song;
      console.log(`✅ BPM data found: BPM=${songData.tempo}, Key=${songData.key_of}, Energy=${songData.energy}`);
      
      const enrichedData = {
        bpm: parseFloat(songData.tempo) || null,
        key: songData.key_of || null,
        energy: parseFloat(songData.energy) || null,
        danceability: parseFloat(songData.danceability) || null,
        happiness: parseFloat(songData.mood) || null
      };
      
      console.log(`🎼 Parsed BPM data:`, enrichedData); // DEBUG: Log parsed data
      return enrichedData;
    }
    
    console.log(`⚠️ No BPM data found for: ${artist} - ${title}`);
    console.log(`📋 Response structure:`, JSON.stringify(response.data, null, 2)); // DEBUG
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching BPM data for ${artist} - ${title}:`, error.message);
    if (error.response) {
      console.error(`📋 Error response:`, error.response.data); // DEBUG: Log error response
    }
    return null;
  }
}

// DEBUGGING: Add a test function to verify BPM API
async function testBPMAPI() {
  console.log("🧪 Testing getSongBPM API...");
  
  // Test with a known popular song
  const testResult = await getSongBPMData("The Weeknd", "Blinding Lights");
  
  if (testResult) {
    console.log("✅ BPM API test successful:", testResult);
    return true;
  } else {
    console.log("❌ BPM API test failed");
    return false;
  }
}

// FIXED: Batch process BPM data with rate limiting
async function enrichTracksWithBPMData(tracks) {
  console.log(`🔍 Enriching ${tracks.length} tracks with BPM data...`);
  
  const enrichedTracks = [];
  const batchSize = 5; // Process in small batches
  const delayBetweenBatches = 1000; // 1 second delay
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (track) => {
      const primaryArtist = track.artists[0]?.name || 'Unknown';
      const bpmData = await getSongBPMData(primaryArtist, track.name);
      
      return {
        ...track,
        bpmData: bpmData // FIXED: Consistent naming
      };
    });
    
    const enrichedBatch = await Promise.all(batchPromises);
    enrichedTracks.push(...enrichedBatch);
    
    console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tracks.length/batchSize)}`);
    
    // Rate limiting delay
    if (i + batchSize < tracks.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // FIXED: Correct variable name
  const tracksWithBPM = enrichedTracks.filter(track => track.bpmData);
  console.log(`📊 Successfully enriched ${tracksWithBPM.length}/${tracks.length} tracks with BPM data`);
  
  return enrichedTracks;
}

// FIXED: Filter tracks based on BPM data for film relevance
function filterTracksForFilmRelevance(enrichedTracks) {
  const relevantTracks = [];
  
  for (const track of enrichedTracks) {
    let isRelevant = false;
    const beat = track.beatInfo;
    
    // FIXED: Consistent variable naming
    if (track.bpmData) {
      const bpmData = track.bpmData; // FIXED: Was bmpData
      
      // 1. Check BPM range relevance
      const targetRange = energyBPMRanges[beat.energy];
      if (bpmData.bpm && bpmData.bpm >= targetRange.min && bpmData.bpm <= targetRange.max) {
        isRelevant = true;
      }
      
      // 2. Check energy level match
      if (bpmData.energy !== null) {
        const trackEnergy = bpmData.energy;
        let targetEnergyRange;
        
        switch (beat.energy) {
          case 'low': targetEnergyRange = [0, 0.5]; break;
          case 'medium': targetEnergyRange = [0.3, 0.8]; break;
          case 'high': targetEnergyRange = [0.6, 1.0]; break;
        }
        
        if (trackEnergy >= targetEnergyRange[0] && trackEnergy <= targetEnergyRange[1]) {
          isRelevant = true;
        }
      }
      
      // 3. Check musical key emotion mapping
      if (bpmData.key && keyEmotionMap[bpmData.key]) {
        const keyInfo = keyEmotionMap[bpmData.key];
        if (keyInfo.mood.includes(beat.mood) || keyInfo.energy === beat.energy) {
          isRelevant = true;
        }
      }
      
      // 4. Danceability filter for cinematic genres
      if (bpmData.danceability !== null) {
        const danceability = bpmData.danceability;
        
        // For cinematic/atmospheric tracks, prefer lower danceability
        if (['cinematic', 'ambient', 'dark', 'mystery'].includes(beat.genre)) {
          if (danceability <= 0.6) {
            isRelevant = true;
          }
        }
        // For electronic/dance genres, prefer higher danceability  
        else if (['electronic', 'house', 'techno', 'trance'].includes(beat.genre)) {
          if (danceability >= 0.4) {
            isRelevant = true;
          }
        }
        // For other genres, moderate danceability is fine
        else {
          if (danceability >= 0.2 && danceability <= 0.8) {
            isRelevant = true;
          }
        }
      }
      
      // 5. Happiness/mood filter (if available)
      if (bpmData.happiness !== null) {
        const happiness = bpmData.happiness;
        
        // Dark/ominous moods should have lower happiness
        if (['dark', 'ominous', 'scary', 'corrupt', 'betrayal'].includes(beat.mood)) {
          if (happiness <= 0.6) {
            isRelevant = true;
          }
        }
        // Epic/power moods can have higher happiness
        else if (['epic', 'power', 'journey'].includes(beat.mood)) {
          if (happiness >= 0.4) {
            isRelevant = true;
          }
        }
        // Other moods - moderate happiness is fine
        else {
          if (happiness >= 0.2 && happiness <= 0.8) {
            isRelevant = true;
          }
        }
      }
    } else {
      // If no BPM data available, keep track but with lower priority
      // This ensures we still have tracks even if BPM lookup fails
      isRelevant = true;
    }
    
    // Additional text-based relevance check as fallback
    if (!isRelevant) {
      const trackName = track.name.toLowerCase();
      const albumName = track.album.name.toLowerCase();
      const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
      const allText = `${trackName} ${albumName} ${artistNames}`;
      
      // Check for strong mood/genre indicators in text
      const moodSynonyms = moodExpansion[beat.mood] || [];
      const genreVariations = genreExpansion[beat.genre] || [];
      
      const hasStrongMoodMatch = [beat.mood, ...moodSynonyms].some(term => 
        allText.includes(term)
      );
      
      const hasStrongGenreMatch = [beat.genre, ...genreVariations].some(term => 
        allText.includes(term)
      );
      
      if (hasStrongMoodMatch || hasStrongGenreMatch) {
        isRelevant = true;
      }
    }
    
    if (isRelevant) {
      relevantTracks.push(track);
    }
  }
  
  console.log(`🎯 Filtered ${enrichedTracks.length} tracks to ${relevantTracks.length} relevant tracks`);
  
  // FIXED: Correct variable name
  const withBPM = relevantTracks.filter(t => t.bpmData).length;
  const withoutBPM = relevantTracks.length - withBPM;
  console.log(`  - ${withBPM} tracks with BPM data`);
  console.log(`  - ${withoutBPM} tracks without BPM data (kept as fallback)`);
  
  return relevantTracks;
}

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

  return allTracks;
}

function calculateEnhancedScore(track, { mood, energy, genre }) {
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
  
  // Enhanced BPM-based scoring
  if (track.bpmData && track.bpmData.bpm) {
    const targetRange = energyBPMRanges[energy];
    const bpm = track.bpmData.bpm;
    
    // Perfect BPM match bonus
    if (bpm >= targetRange.ideal[0] && bpm <= targetRange.ideal[1]) {
      score += 60;
    }
    // Good BPM match bonus
    else if (bpm >= targetRange.min && bpm <= targetRange.max) {
      score += 35;
    }
    // Penalize if BPM is way off
    else if (bpm < targetRange.min - 20 || bpm > targetRange.max + 20) {
      score -= 25;
    }
  }
  
  // Musical key matching
  if (track.bpmData && track.bpmData.key) {
    const keyInfo = keyEmotionMap[track.bpmData.key];
    if (keyInfo) {
      // Boost if key matches mood
      if (keyInfo.mood.includes(mood)) {
        score += 40;
      }
      // Boost if key matches energy level
      if (keyInfo.energy === energy) {
        score += 30;
      }
    }
  }
  
  // GetSongBPM energy level matching
  if (track.bpmData && track.bpmData.energy !== null) {
    const trackEnergy = track.bpmData.energy;
    let targetEnergyRange;
    
    switch (energy) {
      case 'low': targetEnergyRange = [0, 0.4]; break;
      case 'medium': targetEnergyRange = [0.35, 0.75]; break;
      case 'high': targetEnergyRange = [0.6, 1.0]; break;
    }
    
    if (trackEnergy >= targetEnergyRange[0] && trackEnergy <= targetEnergyRange[1]) {
      score += 45;
    }
  }
  
  // Danceability considerations
  if (track.bpmData && track.bpmData.danceability !== null) {
    const danceability = track.bpmData.danceability;
    
    // For cinematic/ambient genres, lower danceability might be preferred
    if (['cinematic', 'ambient', 'dark'].includes(genre) && danceability < 0.5) {
      score += 25;
    }
    // For electronic/dance genres, higher danceability is preferred
    else if (['electronic', 'house', 'techno', 'trance'].includes(genre) && danceability > 0.6) {
      score += 30;
    }
  }
  
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

// NEW: Main playlist generation function with improved BPM filtering logic
async function generatePlaylistWithBPMFiltering(title, storyBeats) {
  const allCandidateTracks = [];
  const usedTrackIds = new Set();
  
  // STEP 1: Collect larger shortlist from Spotify for each beat
  console.log("🎵 Step 1: Collecting candidate tracks from Spotify...");
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beat = storyBeats[i];
    console.log(`🔍 Processing beat ${i + 1}: ${beat.mood} ${beat.energy} ${beat.genre}`);
    
    try {
      // Get more tracks initially for better filtering options
      const tracks = await multiQuerySearch(beat, usedTrackIds);
      
      if (tracks.length > 0) {
        // Take more tracks for the shortlist (increased from 8 to 15)
        const selectedTracks = tracks.slice(0, 15);
        allCandidateTracks.push(...selectedTracks.map(track => ({ 
          ...track, 
          beatIndex: i, 
          beatInfo: beat 
        })));
        
        // Add to used IDs to avoid duplicates across beats
        selectedTracks.forEach(track => usedTrackIds.add(track.id));
        
        console.log(`✅ Collected ${selectedTracks.length} candidate tracks for beat ${i + 1}`);
      } else {
        console.log(`⚠️ No tracks found for beat ${i + 1}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error processing beat ${i + 1}:`, error);
      continue;
    }
  }

  console.log(`📊 Total candidate tracks collected: ${allCandidateTracks.length}`);

  if (allCandidateTracks.length === 0) {
    throw new Error("No candidate tracks found from Spotify");
  }

  // STEP 2: Enrich shortlist with getSongBPM data
  console.log("🎼 Step 2: Enriching tracks with BPM data...");
  const enrichedTracks = await enrichTracksWithBPMData(allCandidateTracks);

  // STEP 3: Filter tracks based on BPM relevance to create refined shortlist
  console.log("🎯 Step 3: Filtering tracks based on BPM relevance...");
  const relevantTracks = filterTracksForFilmRelevance(enrichedTracks);

  console.log(`📋 Filtered to ${relevantTracks.length} relevant tracks`);

  // STEP 4: Score remaining tracks and select final playlist
  console.log("🏆 Step 4: Scoring and selecting final tracks...");
  const scoredTracks = relevantTracks.map(track => ({
    ...track,
    relevanceScore: calculateEnhancedScore(track, track.beatInfo)
  }));

  // Group by beat and select best tracks for each
  const finalPlaylist = [];
  const maxTracksPerBeat = 3; // Reduced since we're being more selective
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beatTracks = scoredTracks
      .filter(track => track.beatIndex === i)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTracksPerBeat);
    
    if (beatTracks.length > 0) {
      finalPlaylist.push(...beatTracks);
      console.log(`✅ Selected ${beatTracks.length} tracks for beat ${i + 1}`);
      console.log(`  Top track: "${beatTracks[0].name}" by ${beatTracks[0].artists[0].name} (score: ${beatTracks[0].relevanceScore})`);
      
      if (beatTracks[0].bpmData) {
        const bpm = beatTracks[0].bpmData;
        console.log(`  BPM: ${bpm.bpm}, Key: ${bpm.key}, Energy: ${bpm.energy}`);
      }
    }
  }

  return finalPlaylist;
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
    
    // ADDED: Test BPM API connectivity
    console.log("🧪 Testing BPM API connectivity...");
    const bpmTestSuccess = await testBPMAPI();
    if (!bpmTestSuccess) {
      console.log("⚠️ BPM API test failed, but continuing with Spotify data only");
    }
    
    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Use improved BPM filtering logic
    const finalPlaylist = await generatePlaylistWithBPMFiltering(title, storyBeats);

    // Remove duplicates and prepare response
    const uniquePlaylist = finalPlaylist.filter((track, index, self) => 
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
      relevanceScore: track.relevanceScore,
      // FIXED: Include BPM data in response with correct variable names
      bpm: track.bpmData?.bpm || null,
      key: track.bpmData?.key || null,
      energy: track.bpmData?.energy || null,
      danceability: track.bpmData?.danceability || null,
      happiness: track.bpmData?.happiness || null,
      beatIndex: track.beatIndex,
      beatMood: track.beatInfo.mood,
      beatEnergy: track.beatInfo.energy,
      beatGenre: track.beatInfo.genre
    }));

    // Calculate some statistics
    const tracksWithBPM = simplifiedPlaylist.filter(track => track.bpm !== null);
    const avgBPM = tracksWithBPM.length > 0 
      ? Math.round(tracksWithBPM.reduce((sum, track) => sum + track.bpm, 0) / tracksWithBPM.length)
      : null;

    console.log(`✅ Final playlist: ${simplifiedPlaylist.length} unique tracks`);
    console.log(`📊 BPM enrichment: ${tracksWithBPM.length}/${simplifiedPlaylist.length} tracks (${Math.round(tracksWithBPM.length/simplifiedPlaylist.length*100)}%)`);
    if (avgBPM) console.log(`🎵 Average BPM: ${avgBPM}`);
    
    // DEBUG: Log first few tracks with their BPM data
    console.log("🔍 Sample tracks with BPM data:");
    simplifiedPlaylist.slice(0, 3).forEach((track, i) => {
      const bpmInfo = track.bpm ? ` [BPM: ${track.bpm}, Key: ${track.key}, Energy: ${track.energy}]` : ' [No BPM data]';
      console.log(`  ${i + 1}. "${track.name}" by ${track.artists}${bpmInfo}`);
    });
    
    console.log("Top 3 tracks by enhanced score:");
    simplifiedPlaylist
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3)
      .forEach((track, i) => {
        const bpmInfo = track.bpm ? ` [BPM: ${track.bpm}]` : '';
        console.log(`  ${i + 1}. "${track.name}" by ${track.artists} (${track.relevanceScore})${bpmInfo}`);
      });
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats,
      stats: {
        tracksWithBPM: tracksWithBPM.length,
        bmpEnrichmentRate: Math.round(tracksWithBPM.length/simplifiedPlaylist.length*100),
        averageBPM: avgBPM,
        energyDistribution: {
          low: simplifiedPlaylist.filter(t => t.beatEnergy === 'low').length,
          medium: simplifiedPlaylist.filter(t => t.beatEnergy === 'medium').length,
          high: simplifiedPlaylist.filter(t => t.beatEnergy === 'high').length
        }
      }
    });

  } catch (error) {
    console.error("❌ Error generating playlist:", error);
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message
    });
  }
};
