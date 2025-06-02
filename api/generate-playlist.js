// Fixed logic for getSongBPM API integration
// The key changes:
// 1. First get a larger shortlist from Spotify (more candidates)
// 2. Then enrich with getSongBPM data 
// 3. Use BPM data to filter for film relevance
// 4. Score and select final tracks

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
        console.log(`  BPM: ${bmp.bpm}, Key: ${bpm.key}, Energy: ${bpm.energy}`);
      }
    }
  }

  return finalPlaylist;
}

// NEW FUNCTION: Filter tracks based on BPM data for film relevance
function filterTracksForFilmRelevance(enrichedTracks) {
  const relevantTracks = [];
  
  for (const track of enrichedTracks) {
    let isRelevant = false;
    const beat = track.beatInfo;
    
    // If we have BPM data, use it for filtering
    if (track.bpmData) {
      const bmpData = track.bpmData;
      
      // 1. Check BPM range relevance
      const targetRange = energyBPMRanges[beat.energy];
      if (bmpData.bpm && bmpData.bpm >= targetRange.min && bmpData.bpm <= targetRange.max) {
        isRelevant = true;
      }
      
      // 2. Check energy level match
      if (bmpData.energy !== null) {
        const trackEnergy = bmpData.energy;
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
      if (bmpData.key && keyEmotionMap[bmpData.key]) {
        const keyInfo = keyEmotionMap[bmpData.key];
        if (keyInfo.mood.includes(beat.mood) || keyInfo.energy === beat.energy) {
          isRelevant = true;
        }
      }
      
      // 4. Danceability filter for cinematic genres
      if (bmpData.danceability !== null) {
        const danceability = bmpData.danceability;
        
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
      if (bmpData.happiness !== null) {
        const happiness = bmpData.happiness;
        
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
  
  // Log filtering stats
  const withBPM = relevantTracks.filter(t => t.bpmData).length;
  const withoutBPM = relevantTracks.length - withBPM;
  console.log(`  - ${withBPM} tracks with BPM data`);
  console.log(`  - ${withoutBPM} tracks without BPM data (kept as fallback)`);
  
  return relevantTracks;
}

// UPDATED: Main handler function with improved logic
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
    
    // Test connectivity
    console.log("🧪 Testing Spotify connectivity...");
    const testResult = await spotifyApi.searchTracks('electronic', { limit: 1, market: 'US' });
    if (testResult.body.tracks.items.length === 0) {
      throw new Error("Spotify API not returning results");
    }
    console.log("✅ Spotify connectivity confirmed");
    
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
      // Include BPM data in response (fixed typo)
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

    console.log(`✅ Final playlist: ${simplifiedPlaylist.length} unique tracks`);
    console.log(`📊 BPM enrichment: ${tracksWithBPM.length}/${simplifiedPlaylist.length} tracks (${Math.round(tracksWithBPM.length/simplifiedPlaylist.length*100)}%)`);
    if (avgBPM) console.log(`🎵 Average BPM: ${avgBPM}`);
    
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
