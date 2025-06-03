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
const GETSONGBPM_SEARCH_URL = "https://api.getsongbpm.com/search/";
const GETSONGBPM_SONG_URL = "https://api.getsongbpm.com/song/";

// Enhanced BPM ranges for different energy levels
const energyBPMRanges = {
  low: { min: 60, max: 90, ideal: [70, 80] },
  medium: { min: 85, max: 130, ideal: [100, 120] },
  high: { min: 125, max: 180, ideal: [130, 150] }
};

// Musical key emotion mapping
const keyEmotionMap = {
  'C': { mood: ['epic', 'journey'], energy: 'medium' },
  'D': { mood: ['epic', 'power'], energy: 'high' },
  'E': { mood: ['intense', 'fight'], energy: 'high' },
  'F': { mood: ['nostalgic', 'spiritual'], energy: 'low' },
  'G': { mood: ['journey', 'nature'], energy: 'medium' },
  'A': { mood: ['epic', 'power'], energy: 'high' },
  'B': { mood: ['intense', 'ominous'], energy: 'high' },
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

// FIXED: Correct getSongBPM API integration (two-step process)
async function getSongBPMData(artist, title) {
  try {
    // Step 1: Search for the song to get its ID
    const searchQuery = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `${GETSONGBPM_SEARCH_URL}?api_key=${GETSONGBPM_API_KEY}&type=song&lookup=${searchQuery}`;
    
    console.log(`🔍 Searching for song: ${artist} - ${title}`);
    
    const searchResponse = await axios.get(searchUrl, {
      timeout: 3000, // Reduced timeout
      headers: {
        'User-Agent': 'Playlist-Generator/1.0'
      }
    });
    
    if (!searchResponse.data || !searchResponse.data.search || searchResponse.data.search.length === 0) {
      console.log(`⚠️ No search results for: ${artist} - ${title}`);
      return null;
    }
    
    // Find the best matching song (look for artist match)
    let songId = null;
    const searchResults = searchResponse.data.search;
    
    // First try exact artist match
    for (const result of searchResults) {
      if (result.artist && result.artist.name && 
          result.artist.name.toLowerCase().includes(artist.toLowerCase())) {
        songId = result.id;
        break;
      }
    }
    
    // If no exact match, take the first result
    if (!songId && searchResults.length > 0) {
      songId = searchResults[0].id;
    }
    
    if (!songId) {
      console.log(`⚠️ No song ID found for: ${artist} - ${title}`);
      return null;
    }
    
    // Step 2: Get BPM data using the song ID
    const songUrl = `${GETSONGBPM_SONG_URL}?api_key=${GETSONGBPM_API_KEY}&id=${songId}`;
    
    const songResponse = await axios.get(songUrl, {
      timeout: 3000, // Reduced timeout
      headers: {
        'User-Agent': 'Playlist-Generator/1.0'
      }
    });
    
    if (songResponse.data && songResponse.data.song) {
      const songData = songResponse.data.song;
      console.log(`✅ BPM data found: BPM=${songData.tempo}, Key=${songData.key_of}`);
      
      return {
        bpm: parseFloat(songData.tempo) || null,
        key: songData.key_of || null,
        energy: parseFloat(songData.energy) || null,
        danceability: parseFloat(songData.danceability) || null,
        happiness: parseFloat(songData.mood) || null
      };
    }
    
    console.log(`⚠️ No song data returned for ID: ${songId}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching BPM data for ${artist} - ${title}:`, error.message);
    return null;
  }
}

// OPTIMIZED: Faster BPM enrichment with reduced processing
async function enrichTracksWithBPMData(tracks) {
  console.log(`🔍 Enriching ${tracks.length} tracks with BPM data...`);
  
  const enrichedTracks = [];
  const batchSize = 3; // Reduced batch size for faster processing
  const delayBetweenBatches = 500; // Reduced delay
  const maxTracksToEnrich = Math.min(tracks.length, 20); // Limit total tracks to prevent timeout
  
  console.log(`⚡ Processing only first ${maxTracksToEnrich} tracks to prevent timeout`);
  
  for (let i = 0; i < maxTracksToEnrich; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (track) => {
      const primaryArtist = track.artists[0]?.name || 'Unknown';
      
      // Skip tracks with problematic artist names
      if (primaryArtist.toLowerCase().includes('various') || 
          primaryArtist.toLowerCase().includes('soundtrack') ||
          primaryArtist.length > 50) {
        return { ...track, bpmData: null };
      }
      
      const bpmData = await getSongBPMData(primaryArtist, track.name);
      return { ...track, bpmData: bpmData };
    });
    
    const enrichedBatch = await Promise.all(batchPromises);
    enrichedTracks.push(...enrichedBatch);
    
    console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(maxTracksToEnrich/batchSize)}`);
    
    // Rate limiting delay
    if (i + batchSize < maxTracksToEnrich) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Add remaining tracks without BPM data
  if (tracks.length > maxTracksToEnrich) {
    const remainingTracks = tracks.slice(maxTracksToEnrich).map(track => ({
      ...track,
      bpmData: null
    }));
    enrichedTracks.push(...remainingTracks);
  }
  
  const tracksWithBPM = enrichedTracks.filter(track => track.bpmData);
  console.log(`📊 Successfully enriched ${tracksWithBPM.length}/${enrichedTracks.length} tracks with BPM data`);
  
  return enrichedTracks;
}

// SIMPLIFIED: Less strict filtering to prevent empty playlists
function filterTracksForFilmRelevance(enrichedTracks) {
  const relevantTracks = [];
  
  for (const track of enrichedTracks) {
    let isRelevant = false;
    const beat = track.beatInfo;
    
    // If we have BPM data, use it for filtering (more lenient)
    if (track.bpmData) {
      const bpmData = track.bpmData;
      
      // 1. Check BPM range relevance (more lenient ranges)
      const targetRange = energyBPMRanges[beat.energy];
      if (bpmData.bpm && bpmData.bpm >= (targetRange.min - 20) && bpmData.bpm <= (targetRange.max + 20)) {
        isRelevant = true;
      }
      
      // 2. Any energy level match is acceptable
      if (bpmData.energy !== null && bpmData.energy >= 0 && bpmData.energy <= 1) {
        isRelevant = true;
      }
      
      // 3. Any key is acceptable
      if (bpmData.key) {
        isRelevant = true;
      }
      
      // 4. Any reasonable danceability
      if (bpmData.danceability !== null && bpmData.danceability >= 0 && bpmData.danceability <= 1) {
        isRelevant = true;
      }
    }
    
    // Always include tracks with strong text matches or no BPM data
    if (!isRelevant) {
      const trackName = track.name.toLowerCase();
      const albumName = track.album.name.toLowerCase();
      const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
      const allText = `${trackName} ${albumName} ${artistNames}`;
      
      const moodSynonyms = moodExpansion[beat.mood] || [];
      const genreVariations = genreExpansion[beat.genre] || [];
      
      const hasTextMatch = [beat.mood, beat.genre, ...moodSynonyms, ...genreVariations]
        .some(term => allText.includes(term));
      
      if (hasTextMatch || !track.bpmData) {
        isRelevant = true;
      }
    }
    
    if (isRelevant) {
      relevantTracks.push(track);
    }
  }
  
  console.log(`🎯 Filtered ${enrichedTracks.length} tracks to ${relevantTracks.length} relevant tracks`);
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

// OPTIMIZED: Faster Spotify search with fewer queries
async function multiQuerySearch({ mood, energy, genre }, usedTrackIds = new Set()) {
  console.log(`🔍 Multi-query search for: ${mood} ${energy} ${genre}`);
  
  const moodSynonyms = moodExpansion[mood] || [mood];
  const genreVariations = genreExpansion[genre] || [genre];
  
  // Reduced query set for faster processing
  let queries = [
    mood,
    genre,
    `${mood} ${genre}`,
    `${genre} instrumental`,
    `${mood} music`,
    moodSynonyms[0],
    genreVariations[0],
    'cinematic',
    'soundtrack'
  ];
  
  queries = queries.slice(0, 8); // Limit to 8 queries max

  const allTracks = [];
  const seenTrackIds = new Set();
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    
    try {
      console.log(`Query ${i + 1}: "${query}"`);
      
      const result = await spotifyApi.searchTracks(query, { 
        limit: 15, // Reduced from 20
        market: 'US'
      });
      
      const tracks = result.body.tracks.items;
      
      const validTracks = tracks.filter(track => {
        return track && 
          track.id && 
          track.name && 
          track.artists?.length > 0 &&
          track.external_urls &&
          !usedTrackIds.has(track.id) &&
          !seenTrackIds.has(track.id);
      });
      
      validTracks.forEach(track => seenTrackIds.add(track.id));
      allTracks.push(...validTracks);
      
      console.log(`  Added ${validTracks.length} valid tracks`);
      
      // Minimal delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`❌ Error with query "${query}":`, error);
      continue;
    }
  }

  console.log(`🎵 Total unique tracks found: ${allTracks.length}`);
  return allTracks;
}

function calculateEnhancedScore(track, { mood, energy, genre }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  const allText = `${trackName} ${albumName} ${artistNames}`;
  
  let score = 0;
  
  // Base popularity
  score += Math.min(track.popularity * 0.2, 20);
  
  // Text-based matching
  if (allText.includes(mood)) score += 100;
  if (allText.includes(genre)) score += 80;
  
  const moodSynonyms = moodExpansion[mood] || [];
  moodSynonyms.forEach(synonym => {
    if (allText.includes(synonym)) score += 50;
  });
  
  const genreVariations = genreExpansion[genre] || [];
  genreVariations.forEach(variation => {
    if (allText.includes(variation)) score += 40;
  });
  
  // BPM-based scoring (if available)
  if (track.bpmData && track.bpmData.bpm) {
    const targetRange = energyBPMRanges[energy];
    const bpm = track.bpmData.bpm;
    
    if (bpm >= targetRange.ideal[0] && bpm <= targetRange.ideal[1]) {
      score += 60;
    } else if (bpm >= targetRange.min && bpm <= targetRange.max) {
      score += 35;
    }
  }
  
  // Key matching
  if (track.bpmData && track.bpmData.key && keyEmotionMap[track.bpmData.key]) {
    const keyInfo = keyEmotionMap[track.bpmData.key];
    if (keyInfo.mood.includes(mood)) score += 40;
    if (keyInfo.energy === energy) score += 30;
  }
  
  // Instrumental bonus
  if (allText.includes('instrumental')) score += 40;
  if (allText.includes('cinematic')) score += 35;
  if (allText.includes('soundtrack')) score += 30;
  
  return score;
}

// OPTIMIZED: Streamlined playlist generation
async function generatePlaylistWithBPMFiltering(title, storyBeats) {
  const allCandidateTracks = [];
  const usedTrackIds = new Set();
  
  console.log("🎵 Step 1: Collecting candidate tracks from Spotify...");
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beat = storyBeats[i];
    console.log(`🔍 Processing beat ${i + 1}: ${beat.mood} ${beat.energy} ${beat.genre}`);
    
    try {
      const tracks = await multiQuerySearch(beat, usedTrackIds);
      
      if (tracks.length > 0) {
        const selectedTracks = tracks.slice(0, 10); // Reduced from 15
        allCandidateTracks.push(...selectedTracks.map(track => ({ 
          ...track, 
          beatIndex: i, 
          beatInfo: beat 
        })));
        
        selectedTracks.forEach(track => usedTrackIds.add(track.id));
        console.log(`✅ Collected ${selectedTracks.length} candidate tracks for beat ${i + 1}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced delay
    } catch (error) {
      console.error(`❌ Error processing beat ${i + 1}:`, error);
      continue;
    }
  }

  console.log(`📊 Total candidate tracks collected: ${allCandidateTracks.length}`);

  if (allCandidateTracks.length === 0) {
    throw new Error("No candidate tracks found from Spotify");
  }

  console.log("🎼 Step 2: Enriching tracks with BPM data...");
  const enrichedTracks = await enrichTracksWithBPMData(allCandidateTracks);

  console.log("🎯 Step 3: Filtering tracks based on relevance...");
  const relevantTracks = filterTracksForFilmRelevance(enrichedTracks);

  console.log("🏆 Step 4: Scoring and selecting final tracks...");
  const scoredTracks = relevantTracks.map(track => ({
    ...track,
    relevanceScore: calculateEnhancedScore(track, track.beatInfo)
  }));

  const finalPlaylist = [];
  const maxTracksPerBeat = 3;
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beatTracks = scoredTracks
      .filter(track => track.beatIndex === i)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTracksPerBeat);
    
    if (beatTracks.length > 0) {
      finalPlaylist.push(...beatTracks);
      console.log(`✅ Selected ${beatTracks.length} tracks for beat ${i + 1}`);
    }
  }

  return finalPlaylist;
}

// Main handler with timeout optimization
module.exports = async function handler(req, res) {
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
  const startTime = Date.now();

  try {
    // Get Spotify access token
    await getSpotifyAccessToken();
    
    // Quick connectivity test
    console.log("🧪 Testing Spotify connectivity...");
    const testResult = await spotifyApi.searchTracks('electronic', { limit: 1, market: 'US' });
    if (testResult.body.tracks.items.length === 0) {
      throw new Error("Spotify API not returning results");
    }
    console.log("✅ Spotify connectivity confirmed");
    
    // Get story beats from GPT
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Check elapsed time before starting intensive operations
    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️ Elapsed time: ${elapsedTime}ms`);
    
    if (elapsedTime > 20000) { // If more than 20 seconds already
      console.log("⚠️ Approaching timeout, using fast mode");
    }

    // Generate playlist with optimizations
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
      // Include BPM data in response
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

    // Calculate statistics
    const tracksWithBPM = simplifiedPlaylist.filter(track => track.bpm !== null);
    const avgBPM = tracksWithBPM.length > 0 
      ? Math.round(tracksWithBPM.reduce((sum, track) => sum + track.bpm, 0) / tracksWithBPM.length)
      : null;

    const totalElapsedTime = Date.now() - startTime;
    console.log(`✅ Final playlist: ${simplifiedPlaylist.length} unique tracks`);
    console.log(`📊 BPM enrichment: ${tracksWithBPM.length}/${simplifiedPlaylist.length} tracks`);
    console.log(`⏱️ Total processing time: ${totalElapsedTime}ms`);
    
    // Show sample tracks with BPM data
    console.log("🔍 Sample tracks:");
    simplifiedPlaylist.slice(0, 3).forEach((track, i) => {
      const bpmInfo = track.bmp ? ` [BPM: ${track.bpm}]` : ' [No BPM]';
      console.log(`  ${i + 1}. "${track.name}" by ${track.artists}${bpmInfo}`);
    });
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats,
      processingTimeMs: totalElapsedTime,
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
    const totalElapsedTime = Date.now() - startTime;
    console.error("❌ Error generating playlist:", error);
    console.log(`⏱️ Error occurred after: ${totalElapsedTime}ms`);
    
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message,
      processingTimeMs: totalElapsedTime
    });
  }
};
