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

// ENHANCED: Mood to Genre Mapping System
const moodToGenreMapping = {
  dark: {
    primary: ['dark ambient', 'industrial', 'post-rock', 'drone'],
    secondary: ['black metal', 'darkwave', 'gothic', 'doom metal'],
    energy: {
      low: ['dark ambient', 'drone', 'post-rock'],
      medium: ['industrial', 'darkwave', 'gothic'],
      high: ['black metal', 'doom metal', 'industrial metal']
    }
  },
  ominous: {
    primary: ['dark ambient', 'industrial', 'horror soundtrack', 'drone'],
    secondary: ['doom metal', 'black metal', 'darkwave'],
    energy: {
      low: ['dark ambient', 'drone', 'horror soundtrack'],
      medium: ['industrial', 'darkwave'],
      high: ['doom metal', 'black metal', 'industrial metal']
    }
  },
  scary: {
    primary: ['horror soundtrack', 'dark ambient', 'industrial'],
    secondary: ['black metal', 'death metal', 'noise'],
    energy: {
      low: ['horror soundtrack', 'dark ambient'],
      medium: ['industrial', 'darkwave'],
      high: ['black metal', 'death metal', 'grindcore']
    }
  },
  mystery: {
    primary: ['ambient', 'jazz', 'neo-noir soundtrack', 'trip hop'],
    secondary: ['downtempo', 'lounge', 'film noir'],
    energy: {
      low: ['ambient', 'lounge', 'trip hop'],
      medium: ['jazz', 'downtempo', 'neo-soul'],
      high: ['bebop', 'fusion jazz', 'drum and bass']
    }
  },
  betrayal: {
    primary: ['neo-classical', 'chamber music', 'piano', 'string quartet'],
    secondary: ['post-rock', 'ambient', 'modern classical'],
    energy: {
      low: ['piano', 'chamber music', 'ambient'],
      medium: ['neo-classical', 'string quartet'],
      high: ['post-rock', 'modern classical', 'orchestral']
    }
  },
  guilt: {
    primary: ['piano', 'chamber music', 'ambient', 'singer-songwriter'],
    secondary: ['indie folk', 'neo-classical', 'minimalist'],
    energy: {
      low: ['piano', 'ambient', 'singer-songwriter'],
      medium: ['chamber music', 'indie folk'],
      high: ['post-rock', 'alternative rock']
    }
  },
  nostalgic: {
    primary: ['indie folk', 'ambient', 'piano', 'acoustic'],
    secondary: ['singer-songwriter', 'chamber pop', 'dream pop'],
    energy: {
      low: ['ambient', 'piano', 'acoustic'],
      medium: ['indie folk', 'singer-songwriter'],
      high: ['indie rock', 'alternative rock']
    }
  },
  intense: {
    primary: ['electronic', 'techno', 'industrial', 'metal'],
    secondary: ['drum and bass', 'hardcore', 'progressive metal'],
    energy: {
      low: ['ambient techno', 'downtempo', 'trip hop'],
      medium: ['electronic', 'techno', 'industrial'],
      high: ['hardcore', 'drum and bass', 'metal']
    }
  },
  fight: {
    primary: ['metal', 'hardcore', 'electronic', 'rock'],
    secondary: ['thrash metal', 'drum and bass', 'industrial'],
    energy: {
      low: ['post-metal', 'sludge metal'],
      medium: ['metal', 'hard rock', 'industrial'],
      high: ['thrash metal', 'hardcore', 'speed metal']
    }
  },
  epic: {
    primary: ['orchestral', 'symphonic metal', 'progressive rock', 'film score'],
    secondary: ['post-rock', 'cinematic', 'trailer music'],
    energy: {
      low: ['orchestral', 'film score', 'ambient orchestral'],
      medium: ['symphonic metal', 'progressive rock'],
      high: ['symphonic metal', 'progressive metal', 'power metal']
    }
  },
  power: {
    primary: ['symphonic metal', 'orchestral', 'epic music', 'progressive metal'],
    secondary: ['power metal', 'film score', 'trailer music'],
    energy: {
      low: ['orchestral', 'film score'],
      medium: ['symphonic metal', 'progressive metal'],
      high: ['power metal', 'symphonic metal', 'epic metal']
    }
  },
  journey: {
    primary: ['folk', 'world music', 'acoustic', 'ambient'],
    secondary: ['indie folk', 'celtic', 'new age'],
    energy: {
      low: ['ambient', 'new age', 'acoustic'],
      medium: ['folk', 'world music', 'indie folk'],
      high: ['celtic rock', 'folk rock', 'world fusion']
    }
  },
  spiritual: {
    primary: ['ambient', 'new age', 'world music', 'gospel'],
    secondary: ['sacred music', 'meditation', 'drone'],
    energy: {
      low: ['ambient', 'meditation', 'drone'],
      medium: ['new age', 'world music'],
      high: ['gospel', 'spiritual jazz', 'world fusion']
    }
  },
  crime: {
    primary: ['hip hop', 'trip hop', 'jazz', 'electronic'],
    secondary: ['gangsta rap', 'noir jazz', 'downtempo'],
    energy: {
      low: ['trip hop', 'noir jazz', 'downtempo'],
      medium: ['hip hop', 'jazz', 'electronic'],
      high: ['gangsta rap', 'hardcore hip hop', 'breakbeat']
    }
  },
  corrupt: {
    primary: ['industrial', 'dark electronic', 'noise', 'experimental'],
    secondary: ['dark ambient', 'harsh noise', 'power electronics'],
    energy: {
      low: ['dark ambient', 'drone', 'noise'],
      medium: ['industrial', 'dark electronic'],
      high: ['harsh noise', 'power electronics', 'digital hardcore']
    }
  },
  future: {
    primary: ['synthwave', 'cyberpunk', 'electronic', 'ambient techno'],
    secondary: ['retrowave', 'vaporwave', 'dark synthwave'],
    energy: {
      low: ['ambient techno', 'vaporwave', 'drone'],
      medium: ['synthwave', 'electronic', 'cyberpunk'],
      high: ['dark synthwave', 'industrial electronic', 'hardcore techno']
    }
  },
  nature: {
    primary: ['ambient', 'folk', 'world music', 'new age'],
    secondary: ['field recording', 'acoustic', 'celtic'],
    energy: {
      low: ['ambient', 'field recording', 'new age'],
      medium: ['folk', 'world music', 'acoustic'],
      high: ['celtic rock', 'folk rock', 'world fusion']
    }
  },
  // Fallback for unmapped moods
  default: {
    primary: ['ambient', 'electronic', 'orchestral', 'indie'],
    secondary: ['cinematic', 'instrumental', 'soundtrack'],
    energy: {
      low: ['ambient', 'piano', 'acoustic'],
      medium: ['electronic', 'indie', 'orchestral'],
      high: ['rock', 'metal', 'electronic']
    }
  }
};

// Comprehensive mood/theme expansion dictionary (kept for fallback and additional scoring)
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

// Genre expansion (kept for fallback)
const genreExpansion = {
  ambient: ['atmospheric', 'drone', 'meditation', 'space', 'new age', 'soundscape'],
  cinematic: ['film score', 'movie soundtrack', 'orchestral', 'epic', 'trailer music'],
  electronic: ['synth', 'digital', 'edm', 'electronica', 'synthetic'],
  progressive: ['prog', 'evolving', 'journey', 'buildup', 'cinematic']
};

// FIXED: Correct getSongBPM API integration with better error handling
async function getSongBPMData(artist, title) {
  try {
    // Clean up artist and title names
    const cleanArtist = artist.replace(/[^\w\s-]/g, '').trim();
    const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s*-\s*(remastered|version|remix|edit).*$/i, '').trim();
    
    const searchQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
    const searchUrl = `${GETSONGBPM_SEARCH_URL}?api_key=${GETSONGBPM_API_KEY}&type=song&lookup=${searchQuery}`;
    
    console.log(`🔍 BPM API search for: "${cleanArtist}" - "${cleanTitle}"`);
    console.log(`🔗 Search URL: ${searchUrl}`);
    
    const searchResponse = await axios.get(searchUrl, {
      timeout: 4000,
      headers: { 'User-Agent': 'Playlist-Generator/1.0' }
    });
    
    console.log(`📊 Search response:`, JSON.stringify(searchResponse.data, null, 2));
    
    // Handle different response structures
    let searchResults = null;
    
    if (searchResponse.data) {
      if (searchResponse.data.search) {
        searchResults = searchResponse.data.search;
      } else if (Array.isArray(searchResponse.data)) {
        searchResults = searchResponse.data;
      } else if (searchResponse.data.songs) {
        searchResults = searchResponse.data.songs;
      } else if (searchResponse.data.results) {
        searchResults = searchResponse.data.results;
      }
    }
    
    // Check if searchResults is actually iterable
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
      console.log(`⚠️ No search results or invalid structure for: ${cleanArtist} - ${cleanTitle}`);
      console.log(`📋 Response structure:`, typeof searchResults, searchResults);
      return null;
    }
    
    console.log(`🎵 Found ${searchResults.length} search results`);
    
    let songId = null;
    
    // Try to find exact artist match first
    for (const result of searchResults) {
      console.log(`🔍 Checking result:`, result);
      
      if (result.artist && result.artist.name) {
        const resultArtist = result.artist.name.toLowerCase();
        const searchArtist = cleanArtist.toLowerCase();
        
        if (resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist)) {
          songId = result.id;
          console.log(`✅ Found artist match: ${result.artist.name} (ID: ${songId})`);
          break;
        }
      } else if (result.id) {
        // Fallback if no artist info but has ID
        songId = result.id;
        console.log(`🔄 Using fallback result with ID: ${songId}`);
        break;
      }
    }
    
    // If no artist match, take the first result with an ID
    if (!songId) {
      for (const result of searchResults) {
        if (result.id) {
          songId = result.id;
          console.log(`🔄 Using first available result with ID: ${songId}`);
          break;
        }
      }
    }
    
    if (!songId) {
      console.log(`❌ No valid song ID found in results`);
      return null;
    }
    
    // Step 2: Get detailed song info using the ID
    const songUrl = `${GETSONGBPM_SONG_URL}?api_key=${GETSONGBPM_API_KEY}&id=${songId}`;
    console.log(`🎼 Fetching song details: ${songUrl}`);
    
    const songResponse = await axios.get(songUrl, {
      timeout: 4000,
      headers: { 'User-Agent': 'Playlist-Generator/1.0' }
    });
    
    console.log(`📊 Song response:`, JSON.stringify(songResponse.data, null, 2));
    
    if (songResponse.data && songResponse.data.song) {
      const songData = songResponse.data.song;
      console.log(`✅ BPM data found: BPM=${songData.tempo}, Key=${songData.key_of}, Energy=${songData.energy}`);
      
      const enrichedData = {
        bpm: parseFloat(songData.tempo) || null,
        key: songData.key_of || null,
        energy: parseFloat(songData.energy) || null,
        danceability: parseFloat(songData.danceability) || null,
        happiness: parseFloat(songData.mood) || null
      };
      
      console.log(`🎼 Parsed BPM data:`, enrichedData);
      return enrichedData;
    }
    
    console.log(`⚠️ No song data in response for ID: ${songId}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching BPM data for ${artist} - ${title}:`, error.message);
    if (error.response) {
      console.error(`📋 Error response status:`, error.response.status);
      console.error(`📋 Error response data:`, error.response.data);
    }
    return null;
  }
}

// OPTIMIZED: BPM enrichment
async function enrichTracksWithBPMData(tracks) {
  console.log(`🔍 Enriching ${tracks.length} tracks with BPM data...`);
  
  const enrichedTracks = [];
  const batchSize = 3;
  const maxTracksToEnrich = Math.min(tracks.length, 15);
  
  for (let i = 0; i < maxTracksToEnrich; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (track) => {
      const primaryArtist = track.artists[0]?.name || 'Unknown';
      
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
    
    if (i + batchSize < maxTracksToEnrich) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (tracks.length > maxTracksToEnrich) {
    const remainingTracks = tracks.slice(maxTracksToEnrich).map(track => ({
      ...track, bpmData: null
    }));
    enrichedTracks.push(...remainingTracks);
  }
  
  const tracksWithBPM = enrichedTracks.filter(track => track.bpmData);
  console.log(`📊 Successfully enriched ${tracksWithBPM.length}/${enrichedTracks.length} tracks with BPM data`);
  
  return enrichedTracks;
}

// ENHANCED: Genre-focused Spotify search
async function searchSpotifyByGenre({ mood, energy, genre }, usedTrackIds = new Set()) {
  console.log(`🎯 Genre-focused search for mood: ${mood}, energy: ${energy}`);
  
  const moodMapping = moodToGenreMapping[mood] || moodToGenreMapping.default;
  const energyGenres = moodMapping.energy[energy] || moodMapping.primary;
  const primaryGenres = moodMapping.primary;
  const secondaryGenres = moodMapping.secondary;
  
  const genresToSearch = [
    ...energyGenres,
    ...primaryGenres,
    ...secondaryGenres
  ].filter((genre, index, self) => self.indexOf(genre) === index);
  
  console.log(`🎵 Targeting genres: ${genresToSearch.slice(0, 5).join(', ')}...`);
  
  const allTracks = [];
  const seenTrackIds = new Set();
  
  for (let i = 0; i < Math.min(genresToSearch.length, 6); i++) {
    const searchGenre = genresToSearch[i];
    
    try {
      console.log(`🔍 Searching genre: "${searchGenre}"`);
      
      const genreQueries = [
        `genre:"${searchGenre}"`,
        searchGenre,
        `${searchGenre} instrumental`,
        `${searchGenre} soundtrack`
      ];
      
      for (const query of genreQueries.slice(0, 3)) {
        try {
          const result = await spotifyApi.searchTracks(query, { 
            limit: 20,
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
          
          console.log(`    Added ${validTracks.length} tracks from "${query}"`);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (queryError) {
          console.error(`❌ Error with query "${query}":`, queryError.message);
          continue;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Error searching genre "${searchGenre}":`, error.message);
      continue;
    }
  }
  
  console.log(`🎵 Total genre-matched tracks: ${allTracks.length}`);
  return allTracks;
}

// ENHANCED: Genre-aware scoring
function calculateGenreAwareScore(track, { mood, energy, genre }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  const allText = `${trackName} ${albumName} ${artistNames}`;
  
  let score = 0;
  
  // Base popularity
  score += Math.min(track.popularity * 0.1, 10);
  
  // Genre-based scoring (highest priority)
  const moodMapping = moodToGenreMapping[mood] || moodToGenreMapping.default;
  const energyGenres = moodMapping.energy[energy] || [];
  const primaryGenres = moodMapping.primary || [];
  const secondaryGenres = moodMapping.secondary || [];
  
  // Perfect genre match (energy-specific)
  energyGenres.forEach(mappedGenre => {
    if (allText.includes(mappedGenre.toLowerCase().replace(/\s+/g, ' '))) {
      score += 150;
    }
  });
  
  // Primary genre match
  primaryGenres.forEach(mappedGenre => {
    if (allText.includes(mappedGenre.toLowerCase().replace(/\s+/g, ' '))) {
      score += 100;
    }
  });
  
  // Secondary genre match
  secondaryGenres.forEach(mappedGenre => {
    if (allText.includes(mappedGenre.toLowerCase().replace(/\s+/g, ' '))) {
      score += 70;
    }
  });
  
  // Direct mood match
  if (allText.includes(mood)) score += 80;
  
  // Original genre match
  if (allText.includes(genre)) score += 60;
  
  // BPM-based scoring
  if (track.bpmData && track.bpmData.bpm) {
    const targetRange = energyBPMRanges[energy];
    const bpm = track.bpmData.bpm;
    
    if (bpm >= targetRange.ideal[0] && bpm <= targetRange.ideal[1]) {
      score += 50;
    } else if (bpm >= targetRange.min && bpm <= targetRange.max) {
      score += 30;
    }
  }
  
  // Key matching
  if (track.bpmData && track.bpmData.key && keyEmotionMap[track.bpmData.key]) {
    const keyInfo = keyEmotionMap[track.bpmData.key];
    if (keyInfo.mood.includes(mood)) score += 40;
    if (keyInfo.energy === energy) score += 30;
  }
  
  // Energy keywords
  const energyKeywords = {
    low: ['ambient', 'calm', 'peaceful', 'quiet', 'soft', 'gentle', 'slow'],
    medium: ['moderate', 'balanced', 'steady'],
    high: ['energetic', 'powerful', 'driving', 'intense', 'fast', 'aggressive', 'hard']
  };
  
  if (energyKeywords[energy]) {
    energyKeywords[energy].forEach(keyword => {
      if (allText.includes(keyword)) score += 25;
    });
  }
  
  // Cinematic bonuses
  if (allText.includes('instrumental')) score += 35;
  if (allText.includes('soundtrack')) score += 30;
  if (allText.includes('score')) score += 25;
  
  // Duration preference
  const minutes = track.duration_ms / 60000;
  if (minutes >= 2 && minutes <= 8) score += 20;
  
  // Recency bonus
  if (track.album.release_date) {
    const year = new Date(track.album.release_date).getFullYear();
    if (year >= 2010) score += 15;
  }
  
  // Penalize explicit content
  if (track.explicit) score -= 20;
  
  return score;
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

  return beats.length > 0 ? beats : [{ mood: "dark", energy: "medium", genre: "cinematic" }];
}

// MAIN: Genre-focused playlist generation
async function generateGenreFocusedPlaylist(title, storyBeats) {
  const allCandidateTracks = [];
  const usedTrackIds = new Set();
  
  console.log("🎯 Step 1: Genre-focused track collection...");
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beat = storyBeats[i];
    console.log(`🔍 Processing beat ${i + 1}: ${beat.mood} (${beat.energy} energy)`);
    
    try {
      const tracks = await searchSpotifyByGenre(beat, usedTrackIds);
      
      if (tracks.length > 0) {
        const selectedTracks = tracks.slice(0, 15);
        allCandidateTracks.push(...selectedTracks.map(track => ({ 
          ...track, 
          beatIndex: i, 
          beatInfo: beat 
        })));
        
        selectedTracks.forEach(track => usedTrackIds.add(track.id));
        console.log(`✅ Collected ${selectedTracks.length} genre-matched tracks for beat ${i + 1}`);
      } else {
        console.log(`⚠️ No genre-matched tracks found for beat ${i + 1}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error processing beat ${i + 1}:`, error);
      continue;
    }
  }

  if (allCandidateTracks.length === 0) {
    throw new Error("No genre-matched tracks found");
  }

  console.log("🎼 Step 2: Enriching with BPM data...");
  const enrichedTracks = await enrichTracksWithBPMData(allCandidateTracks);

  console.log("🎯 Step 3: Genre-aware scoring...");
  const scoredTracks = enrichedTracks.map(track => ({
    ...track,
    relevanceScore: calculateGenreAwareScore(track, track.beatInfo)
  }));

  console.log("🏆 Step 4: Final selection...");
  const finalPlaylist = [];
  const maxTracksPerBeat = 4;
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beatTracks = scoredTracks
      .filter(track => track.beatIndex === i)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTracksPerBeat);
    
    if (beatTracks.length > 0) {
      finalPlaylist.push(...beatTracks);
      console.log(`✅ Selected ${beatTracks.length} tracks for beat ${i + 1}`);
      
      const topTrack = beatTracks[0];
      const moodMapping = moodToGenreMapping[topTrack.beatInfo.mood] || moodToGenreMapping.default;
      const targetGenres = moodMapping.energy[topTrack.beatInfo.energy] || moodMapping.primary;
      console.log(`  Target genres: ${targetGenres.slice(0, 3).join(', ')}`);
      console.log(`  Top track: "${topTrack.name}" by ${topTrack.artists[0].name} (score: ${topTrack.relevanceScore})`);
    }
  }

  return finalPlaylist;
}

// Main handler
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
    await getSpotifyAccessToken();
    
    console.log("🧪 Testing Spotify connectivity...");
    const testResult = await spotifyApi.searchTracks('electronic', { limit: 1, market: 'US' });
    if (testResult.body.tracks.items.length === 0) {
      throw new Error("Spotify API not returning results");
    }
    console.log("✅ Spotify connectivity confirmed");
    
    const storyBeats = await getStoryBeatsFromGPT(title.trim());
    console.log(`📖 Generated ${storyBeats.length} story beats`);

    // Use genre-focused approach
    const finalPlaylist = await generateGenreFocusedPlaylist(title, storyBeats);

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

    const tracksWithBPM = simplifiedPlaylist.filter(track => track.bpm !== null);
    const avgBPM = tracksWithBPM.length > 0 
      ? Math.round(tracksWithBPM.reduce((sum, track) => sum + track.bpm, 0) / tracksWithBPM.length)
      : null;

    const totalElapsedTime = Date.now() - startTime;
    console.log(`✅ Genre-focused playlist: ${simplifiedPlaylist.length} tracks`);
    console.log(`📊 BPM enrichment: ${tracksWithBPM.length}/${simplifiedPlaylist.length} tracks`);
    console.log(`⏱️ Total time: ${totalElapsedTime}ms`);
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats,
      processingTimeMs: totalElapsedTime,
      approach: "genre-focused",
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
    
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message,
      processingTimeMs: totalElapsedTime
    });
  }
};
