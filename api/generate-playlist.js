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
const GETSONGBPM_BASE_URL = "https://api.getsongbpm.com";

// Enhanced BPM ranges for different energy levels
const energyBPMRanges = {
  low: { min: 60, max: 90, ideal: [70, 80] },
  medium: { min: 85, max: 130, ideal: [100, 120] },
  high: { min: 125, max: 180, ideal: [130, 150] }
};

// Musical key emotion mapping with expanded key variations
const keyEmotionMap = {
  // Major keys - generally brighter/happier
  'C': { mood: ['epic', 'journey'], energy: 'medium', variations: ['C', 'C major'] },
  'D': { mood: ['epic', 'power'], energy: 'high', variations: ['D', 'D major'] },
  'E': { mood: ['intense', 'fight'], energy: 'high', variations: ['E', 'E major'] },
  'F': { mood: ['nostalgic', 'spiritual'], energy: 'low', variations: ['F', 'F major'] },
  'G': { mood: ['journey', 'nature'], energy: 'medium', variations: ['G', 'G major'] },
  'A': { mood: ['epic', 'power'], energy: 'high', variations: ['A', 'A major'] },
  'B': { mood: ['intense', 'ominous'], energy: 'high', variations: ['B', 'B major'] },
  
  // Minor keys - generally darker/more emotional
  'Cm': { mood: ['dark', 'ominous'], energy: 'medium', variations: ['Cm', 'C minor', 'C♭m'] },
  'Dm': { mood: ['mystery', 'guilt'], energy: 'low', variations: ['Dm', 'D minor', 'D♭m'] },
  'Em': { mood: ['dark', 'spiritual'], energy: 'medium', variations: ['Em', 'E minor', 'E♭m'] },
  'Fm': { mood: ['scary', 'corrupt'], energy: 'low', variations: ['Fm', 'F minor', 'F♭m'] },
  'Gm': { mood: ['mystery', 'betrayal'], energy: 'medium', variations: ['Gm', 'G minor', 'G♭m'] },
  'Am': { mood: ['nostalgic', 'guilt'], energy: 'low', variations: ['Am', 'A minor', 'A♭m'] },
  'Bm': { mood: ['dark', 'intense'], energy: 'medium', variations: ['Bm', 'B minor', 'B♭m'] }
};

// Mood to genre mapping (kept from previous version)
const moodToGenreMapping = {
  dark: {
    primary: ['dark ambient', 'industrial', 'post-rock', 'drone'],
    keys: ['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'],
    energy: {
      low: { bpm: [60, 80], keys: ['Dm', 'Fm', 'Am'] },
      medium: { bpm: [80, 110], keys: ['Cm', 'Em', 'Gm'] },
      high: { bpm: [110, 160], keys: ['Bm', 'Em', 'Cm'] }
    }
  },
  ominous: {
    primary: ['dark ambient', 'industrial', 'horror soundtrack'],
    keys: ['Cm', 'Fm', 'Bm', 'Em'],
    energy: {
      low: { bpm: [60, 85], keys: ['Fm', 'Cm'] },
      medium: { bpm: [85, 120], keys: ['Em', 'Bm'] },
      high: { bpm: [120, 170], keys: ['Bm', 'Em'] }
    }
  },
  epic: {
    primary: ['orchestral', 'symphonic metal', 'film score'],
    keys: ['C', 'D', 'G', 'A'],
    energy: {
      low: { bpm: [70, 90], keys: ['C', 'F'] },
      medium: { bpm: [90, 130], keys: ['G', 'D'] },
      high: { bpm: [130, 180], keys: ['D', 'A', 'E'] }
    }
  },
  intense: {
    primary: ['electronic', 'metal', 'industrial'],
    keys: ['E', 'B', 'A', 'Em', 'Bm'],
    energy: {
      low: { bpm: [80, 100], keys: ['Em', 'Am'] },
      medium: { bpm: [100, 140], keys: ['E', 'A'] },
      high: { bpm: [140, 180], keys: ['E', 'B', 'Bm'] }
    }
  },
  mystery: {
    primary: ['jazz', 'ambient', 'neo-noir'],
    keys: ['Dm', 'Gm', 'F', 'Am'],
    energy: {
      low: { bpm: [60, 90], keys: ['Dm', 'Am'] },
      medium: { bpm: [90, 120], keys: ['Gm', 'F'] },
      high: { bpm: [120, 150], keys: ['Em', 'Bm'] }
    }
  },
  // Add more moods as needed...
  default: {
    primary: ['ambient', 'electronic', 'orchestral'],
    keys: ['C', 'G', 'Am', 'Em'],
    energy: {
      low: { bpm: [70, 90], keys: ['C', 'Am'] },
      medium: { bpm: [90, 120], keys: ['G', 'F'] },
      high: { bpm: [120, 150], keys: ['E', 'A'] }
    }
  }
};

// NEW: Search getSongBPM by BPM range
async function searchByBPMRange(minBPM, maxBPM, limit = 50) {
  try {
    console.log(`🎵 Searching getSongBPM for tracks with BPM ${minBPM}-${maxBPM}`);
    
    // Try different endpoint patterns for tempo search
    const possibleEndpoints = [
      `${GETSONGBPM_BASE_URL}/tempo/?api_key=${GETSONGBPM_API_KEY}&min=${minBPM}&max=${maxBPM}&limit=${limit}`,
      `${GETSONGBPM_BASE_URL}/search/?api_key=${GETSONGBPM_API_KEY}&type=tempo&min=${minBPM}&max=${maxBPM}&limit=${limit}`,
      `${GETSONGBPM_BASE_URL}/search/?api_key=${GETSONGBPM_API_KEY}&type=song&tempo_min=${minBPM}&tempo_max=${maxBPM}&limit=${limit}`
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          timeout: 5000,
          headers: { 'User-Agent': 'Playlist-Generator/1.0' }
        });
        
        console.log(`📊 BPM search response:`, JSON.stringify(response.data, null, 2));
        
        // Handle different response structures
        let songs = [];
        if (response.data.songs) {
          songs = response.data.songs;
        } else if (response.data.search) {
          songs = response.data.search;
        } else if (response.data.results) {
          songs = response.data.results;
        } else if (Array.isArray(response.data)) {
          songs = response.data;
        }
        
        if (songs && songs.length > 0) {
          console.log(`✅ Found ${songs.length} tracks in BPM range ${minBPM}-${maxBPM}`);
          return songs;
        }
        
      } catch (endpointError) {
        console.log(`❌ Endpoint failed: ${endpointError.message}`);
        continue;
      }
    }
    
    console.log(`⚠️ No tracks found in BPM range ${minBPM}-${maxBPM} using any endpoint`);
    return [];
    
  } catch (error) {
    console.error(`❌ Error searching by BPM range:`, error.message);
    return [];
  }
}

// NEW: Search getSongBPM by musical key
async function searchByKey(key, limit = 50) {
  try {
    console.log(`🎼 Searching getSongBPM for tracks in key: ${key}`);
    
    // Try different endpoint patterns for key search
    const possibleEndpoints = [
      `${GETSONGBPM_BASE_URL}/key/?api_key=${GETSONGBPM_API_KEY}&key=${encodeURIComponent(key)}&limit=${limit}`,
      `${GETSONGBPM_BASE_URL}/search/?api_key=${GETSONGBPM_API_KEY}&type=key&key=${encodeURIComponent(key)}&limit=${limit}`,
      `${GETSONGBPM_BASE_URL}/search/?api_key=${GETSONGBPM_API_KEY}&type=song&key_of=${encodeURIComponent(key)}&limit=${limit}`
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`🔍 Trying key endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          timeout: 5000,
          headers: { 'User-Agent': 'Playlist-Generator/1.0' }
        });
        
        console.log(`📊 Key search response:`, JSON.stringify(response.data, null, 2));
        
        // Handle different response structures
        let songs = [];
        if (response.data.songs) {
          songs = response.data.songs;
        } else if (response.data.search) {
          songs = response.data.search;
        } else if (response.data.results) {
          songs = response.data.results;
        } else if (Array.isArray(response.data)) {
          songs = response.data;
        }
        
        if (songs && songs.length > 0) {
          console.log(`✅ Found ${songs.length} tracks in key: ${key}`);
          return songs;
        }
        
      } catch (endpointError) {
        console.log(`❌ Key endpoint failed: ${endpointError.message}`);
        continue;
      }
    }
    
    console.log(`⚠️ No tracks found in key: ${key} using any endpoint`);
    return [];
    
  } catch (error) {
    console.error(`❌ Error searching by key:`, error.message);
    return [];
  }
}

// NEW: Get target tracks from getSongBPM based on story beat requirements
async function getTargetTracksFromBPM({ mood, energy, genre }) {
  console.log(`🎯 Getting target tracks for: ${mood} (${energy} energy)`);
  
  const moodMapping = moodToGenreMapping[mood] || moodToGenreMapping.default;
  const energySpec = moodMapping.energy[energy];
  
  if (!energySpec) {
    console.log(`⚠️ No energy specification found for ${mood}:${energy}`);
    return [];
  }
  
  const targetBPMRange = energySpec.bpm;
  const targetKeys = energySpec.keys;
  
  console.log(`🎵 Target BPM: ${targetBPMRange[0]}-${targetBPMRange[1]}`);
  console.log(`🎼 Target keys: ${targetKeys.join(', ')}`);
  
  const allTargetTracks = [];
  
  // Search by BPM range
  try {
    const bpmTracks = await searchByBPMRange(targetBPMRange[0], targetBPMRange[1], 30);
    allTargetTracks.push(...bpmTracks);
  } catch (error) {
    console.error(`❌ BPM search failed:`, error.message);
  }
  
  // Search by each target key
  for (const key of targetKeys.slice(0, 3)) { // Limit to 3 keys to avoid too many requests
    try {
      const keyTracks = await searchByKey(key, 20);
      allTargetTracks.push(...keyTracks);
      
      // Small delay between key searches
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Key search failed for ${key}:`, error.message);
      continue;
    }
  }
  
  // Remove duplicates based on song ID
  const uniqueTracks = [];
  const seenIds = new Set();
  
  for (const track of allTargetTracks) {
    const trackId = track.id || `${track.title}-${track.artist?.name}`;
    if (!seenIds.has(trackId)) {
      seenIds.add(trackId);
      uniqueTracks.push(track);
    }
  }
  
  console.log(`🎯 Found ${uniqueTracks.length} unique target tracks from getSongBPM`);
  return uniqueTracks;
}

// NEW: Search Spotify for specific tracks found in getSongBPM
async function findTracksOnSpotify(targetTracks) {
  console.log(`🔍 Searching Spotify for ${targetTracks.length} target tracks...`);
  
  const spotifyTracks = [];
  const batchSize = 5; // Process in batches to avoid overwhelming Spotify API
  
  for (let i = 0; i < Math.min(targetTracks.length, 25); i += batchSize) { // Limit to 25 total tracks
    const batch = targetTracks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (targetTrack) => {
      try {
        // Extract track info from getSongBPM response
        const trackTitle = targetTrack.title || targetTrack.name || '';
        const artistName = targetTrack.artist?.name || targetTrack.artist || '';
        
        if (!trackTitle || !artistName) {
          console.log(`⚠️ Missing track info: "${trackTitle}" by "${artistName}"`);
          return null;
        }
        
        // Create search query for Spotify
        const searchQuery = `track:"${trackTitle}" artist:"${artistName}"`;
        console.log(`🎵 Searching Spotify: ${searchQuery}`);
        
        const result = await spotifyApi.searchTracks(searchQuery, { 
          limit: 3, // Get top 3 matches
          market: 'US'
        });
        
        const tracks = result.body.tracks.items;
        
        if (tracks.length > 0) {
          // Find the best match (exact or closest)
          let bestMatch = tracks[0];
          
          for (const track of tracks) {
            const spotifyTitle = track.name.toLowerCase();
            const spotifyArtist = track.artists[0]?.name.toLowerCase() || '';
            const targetTitle = trackTitle.toLowerCase();
            const targetArtist = artistName.toLowerCase();
            
            // Prefer exact matches
            if (spotifyTitle.includes(targetTitle) && spotifyArtist.includes(targetArtist)) {
              bestMatch = track;
              break;
            }
          }
          
          // Attach the original BPM data from getSongBPM
          const enrichedTrack = {
            ...bestMatch,
            bpmData: {
              bpm: parseFloat(targetTrack.tempo) || null,
              key: targetTrack.key_of || null,
              energy: parseFloat(targetTrack.energy) || null,
              danceability: parseFloat(targetTrack.danceability) || null,
              happiness: parseFloat(targetTrack.mood) || null
            },
            getSongBPMSource: targetTrack
          };
          
          console.log(`✅ Found on Spotify: "${bestMatch.name}" by ${bestMatch.artists[0]?.name} (BPM: ${targetTrack.tempo})`);
          return enrichedTrack;
        } else {
          console.log(`❌ Not found on Spotify: "${trackTitle}" by "${artistName}"`);
          return null;
        }
        
      } catch (error) {
        console.error(`❌ Error searching Spotify for "${targetTrack.title}":`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    const validTracks = batchResults.filter(track => track !== null);
    spotifyTracks.push(...validTracks);
    
    console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Found ${validTracks.length}/${batch.length} tracks on Spotify`);
    
    // Rate limiting delay
    if (i + batchSize < Math.min(targetTracks.length, 25)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`🎯 Total tracks found on Spotify: ${spotifyTracks.length}`);
  return spotifyTracks;
}

// ENHANCED: Scoring function that prioritizes BPM/key accuracy
function calculateBPMKeyAwareScore(track, { mood, energy, genre }) {
  const trackName = track.name.toLowerCase();
  const albumName = track.album.name.toLowerCase();
  const artistNames = track.artists.map(a => a.name.toLowerCase()).join(' ');
  const allText = `${trackName} ${albumName} ${artistNames}`;
  
  let score = 0;
  
  // Base popularity (minimal weight since we're prioritizing musical accuracy)
  score += Math.min(track.popularity * 0.05, 5);
  
  // HIGHEST PRIORITY: BPM accuracy (since we pre-selected these tracks)
  if (track.bpmData && track.bpmData.bpm) {
    const bpm = track.bpmData.bpm;
    const targetRange = energyBPMRanges[energy];
    
    // Perfect BPM match gets massive bonus
    if (bpm >= targetRange.ideal[0] && bpm <= targetRange.ideal[1]) {
      score += 200; // Very high bonus
    } else if (bpm >= targetRange.min && bpm <= targetRange.max) {
      score += 150; // High bonus
    } else {
      score += 100; // Still good since it came from BPM search
    }
  }
  
  // HIGH PRIORITY: Musical key accuracy
  if (track.bpmData && track.bpmData.key) {
    const moodMapping = moodToGenreMapping[mood] || moodToGenreMapping.default;
    const energySpec = moodMapping.energy ? moodMapping.energy[energy] : null;
    
    if (energySpec && energySpec.keys && energySpec.keys.includes(track.bpmData.key)) {
      score += 180; // Very high bonus for target key match
    }
    
    // Check key emotion mapping
    const keyInfo = keyEmotionMap[track.bpmData.key];
    if (keyInfo) {
      if (keyInfo.mood.includes(mood)) {
        score += 120; // High bonus for mood-matching key
      }
      if (keyInfo.energy === energy) {
        score += 100; // High bonus for energy-matching key
      }
    }
  }
  
  // MEDIUM PRIORITY: Genre and mood matching
  const moodMapping = moodToGenreMapping[mood] || moodToGenreMapping.default;
  const primaryGenres = moodMapping.primary || [];
  
  primaryGenres.forEach(mappedGenre => {
    if (allText.includes(mappedGenre.toLowerCase().replace(/\s+/g, ' '))) {
      score += 80;
    }
  });
  
  // Direct mood match
  if (allText.includes(mood)) score += 70;
  
  // Original genre match
  if (allText.includes(genre)) score += 60;
  
  // Musical characteristics from getSongBPM
  if (track.bpmData) {
    // Energy level matching
    if (track.bpmData.energy !== null) {
      const trackEnergy = track.bpmData.energy;
      let targetEnergyRange;
      
      switch (energy) {
        case 'low': targetEnergyRange = [0, 0.4]; break;
        case 'medium': targetEnergyRange = [0.35, 0.75]; break;
        case 'high': targetEnergyRange = [0.6, 1.0]; break;
      }
      
      if (trackEnergy >= targetEnergyRange[0] && trackEnergy <= targetEnergyRange[1]) {
        score += 90;
      }
    }
    
    // Danceability considerations for film scoring
    if (track.bpmData.danceability !== null) {
      const danceability = track.bpmData.danceability;
      
      // For cinematic use, moderate danceability is often preferred
      if (danceability >= 0.2 && danceability <= 0.7) {
        score += 50;
      }
    }
  }
  
  // Cinematic bonuses
  if (allText.includes('instrumental')) score += 60;
  if (allText.includes('soundtrack')) score += 55;
  if (allText.includes('score')) score += 50;
  if (allText.includes('theme')) score += 45;
  
  // Duration preference for film use
  const minutes = track.duration_ms / 60000;
  if (minutes >= 2 && minutes <= 8) score += 30;
  else if (minutes >= 1.5 && minutes <= 10) score += 20;
  
  // Slight recency bonus
  if (track.album.release_date) {
    const year = new Date(track.album.release_date).getFullYear();
    if (year >= 2010) score += 10;
  }
  
  // Penalize explicit content for cinematic use
  if (track.explicit) score -= 30;
  
  return score;
}

// MAIN: BPM/Key-first playlist generation
async function generateBPMKeyFirstPlaylist(title, storyBeats) {
  const allCandidateTracks = [];
  
  console.log("🎯 Step 1: Finding target tracks from getSongBPM by BPM/Key...");
  
  for (let i = 0; i < storyBeats.length; i++) {
    const beat = storyBeats[i];
    console.log(`\n🔍 Processing beat ${i + 1}: ${beat.mood} (${beat.energy} energy)`);
    
    try {
      // Get target tracks from getSongBPM based on BPM and key requirements
      const targetTracks = await getTargetTracksFromBPM(beat);
      
      if (targetTracks.length > 0) {
        console.log(`✅ Found ${targetTracks.length} target tracks for beat ${i + 1}`);
        
        // Search Spotify for these specific tracks
        const spotifyTracks = await findTracksOnSpotify(targetTracks);
        
        if (spotifyTracks.length > 0) {
          const enrichedTracks = spotifyTracks.map(track => ({
            ...track,
            beatIndex: i,
            beatInfo: beat
          }));
          
          allCandidateTracks.push(...enrichedTracks);
          console.log(`✅ Added ${spotifyTracks.length} tracks from Spotify for beat ${i + 1}`);
        } else {
          console.log(`⚠️ No matching tracks found on Spotify for beat ${i + 1}`);
        }
      } else {
        console.log(`⚠️ No target tracks found for beat ${i + 1}`);
      }
      
      // Delay between beats
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error processing beat ${i + 1}:`, error);
      continue;
    }
  }

  console.log(`\n📊 Total BPM/Key-matched tracks collected: ${allCandidateTracks.length}`);

  if (allCandidateTracks.length === 0) {
    console.log("⚠️ No BPM/Key-matched tracks found, falling back to basic search...");
    
    // Fallback: do a simple genre-based search if no BPM matches found
    const fallbackTracks = [];
    for (let i = 0; i < storyBeats.length; i++) {
      const beat = storyBeats[i];
      try {
        console.log(`🔄 Fallback search for beat ${i + 1}: ${beat.mood}`);
        
        const result = await spotifyApi.searchTracks(beat.mood, { 
          limit: 5,
          market: 'US'
        });
        
        const tracks = result.body.tracks.items;
        if (tracks.length > 0) {
          const enrichedTracks = tracks.map(track => ({
            ...track,
            beatIndex: i,
            beatInfo: beat,
            bpmData: null // No BPM data for fallback tracks
          }));
          fallbackTracks.push(...enrichedTracks);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Fallback search failed for beat ${i + 1}:`, error);
      }
    }
    
    if (fallbackTracks.length === 0) {
      throw new Error("No tracks found using BPM/Key search or fallback method");
    }
    
    console.log(`🔄 Using ${fallbackTracks.length} fallback tracks`);
    allCandidateTracks.push(...fallbackTracks);
  }

  console.log("🏆 Step 2: Scoring tracks by BPM/Key accuracy...");
  const scoredTracks = allCandidateTracks.map(track => ({
    ...track,
    relevanceScore: calculateBPMKeyAwareScore(track, track.beatInfo)
  }));

  console.log("🎯 Step 3: Selecting final tracks...");
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
      
      const topTrack = beatTracks[0];
      console.log(`  Top track: "${topTrack.name}" by ${topTrack.artists[0].name}`);
      console.log(`  BPM: ${topTrack.bmpData?.bpm}, Key: ${topTrack.bmpData?.key} (score: ${topTrack.relevanceScore})`);
    }
  }

  return finalPlaylist;
}

// Standard functions (kept from previous versions)
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
  // Simplified mood list for testing
  const availableMoods = ['dark', 'ominous', 'epic', 'intense', 'mystery', 'nostalgic', 'spiritual'];
  const availableGenres = ['ambient', 'cinematic', 'electronic', 'progressive'];

  const prompt = `Analyze the film/TV series "${title}" and break down its narrative arc into 4-5 distinct emotional beats.

For each beat, choose from these specific options:

MOODS/THEMES: ${availableMoods.join(', ')}

GENRES: ${availableGenres.join(', ')}

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
        { role: "system", content: "You are a music curator. Choose moods and genres from the provided lists only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    
    return parseGPTResponse(response.choices[0].message.content, availableMoods, availableGenres);
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

function parseGPTResponse(content, availableMoods, availableGenres) {
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
        if (availableMoods.includes(parsedMood)) {
          mood = parsedMood;
        }
      } else if (line.match(/Energy:/i)) {
        energy = line.split(/Energy:/i)[1]?.trim().toLowerCase() || "medium";
      } else if (line.match(/Genre:/i)) {
        const parsedGenre = line.split(/Genre:/i)[1]?.trim().toLowerCase();
        if (availableGenres.includes(parsedGenre)) {
          genre = parsedGenre;
        }
      }
    }

    beats.push({ mood, energy, genre });
  }

  return beats.length > 0 ? beats : [{ mood: "dark", energy: "medium", genre: "cinematic" }];
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

  console.log(`🎬 Processing request for title: "${title}" using BPM/Key-first approach`);
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

    // Use BPM/Key-first approach
    const finalPlaylist = await generateBPMKeyFirstPlaylist(title, storyBeats);

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
      // BPM data from getSongBPM (pre-attached)
      bpm: track.bpmData?.bpm || null,
      key: track.bpmData?.key || null,
      energy: track.bpmData?.energy || null,
      danceability: track.bpmData?.danceability || null,
      happiness: track.bpmData?.happiness || null,
      beatIndex: track.beatIndex,
      beatMood: track.beatInfo.mood,
      beatEnergy: track.beatInfo.energy,
      beatGenre: track.beatInfo.genre,
      // Additional metadata
      source: "bpm-key-first",
      getSongBPMMatch: true
    }));

    const tracksWithBPM = simplifiedPlaylist.filter(track => track.bpm !== null);
    const avgBPM = tracksWithBPM.length > 0 
      ? Math.round(tracksWithBPM.reduce((sum, track) => sum + track.bpm, 0) / tracksWithBPM.length)
      : null;

    const totalElapsedTime = Date.now() - startTime;
    console.log(`✅ BPM/Key-first playlist: ${simplifiedPlaylist.length} tracks`);
    console.log(`📊 BPM coverage: ${tracksWithBPM.length}/${simplifiedPlaylist.length} tracks (${Math.round(tracksWithBPM.length/simplifiedPlaylist.length*100)}%)`);
    console.log(`⏱️ Total time: ${totalElapsedTime}ms`);
    
    // Show sample tracks
    console.log("🔍 Sample BPM/Key-matched tracks:");
    simplifiedPlaylist.slice(0, 3).forEach((track, i) => {
      const bpmInfo = track.bpm ? ` [BPM: ${track.bpm}, Key: ${track.key}]` : ' [No BPM data]';
      console.log(`  ${i + 1}. "${track.name}" by ${track.artists}${bpmInfo}`);
    });
    
    res.status(200).json({ 
      playlist: simplifiedPlaylist,
      totalTracks: simplifiedPlaylist.length,
      storyBeats: storyBeats,
      processingTimeMs: totalElapsedTime,
      approach: "bpm-key-first",
      stats: {
        tracksWithBPM: tracksWithBPM.length,
        bmpEnrichmentRate: Math.round(tracksWithBPM.length/simplifiedPlaylist.length*100),
        averageBPM: avgBPM,
        energyDistribution: {
          low: simplifiedPlaylist.filter(t => t.beatEnergy === 'low').length,
          medium: simplifiedPlaylist.filter(t => t.beatEnergy === 'medium').length,
          high: simplifiedPlaylist.filter(t => t.beatEnergy === 'high').length
        },
        keyDistribution: simplifiedPlaylist.reduce((acc, track) => {
          if (track.key) {
            acc[track.key] = (acc[track.key] || 0) + 1;
          }
          return acc;
        }, {})
      }
    });

  } catch (error) {
    const totalElapsedTime = Date.now() - startTime;
    console.error("❌ Error generating BPM/Key-first playlist:", error);
    
    res.status(500).json({ 
      error: "Failed to generate playlist",
      message: error.message,
      processingTimeMs: totalElapsedTime,
      approach: "bpm-key-first"
    });
  }
};
