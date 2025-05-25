export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Missing film or show title" });

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "You're a creative music supervisor generating playlists inspired by films and TV series."
          },
          {
            role: "user",
            content: `Given the film or show titled "${title}", break its story into 4-5 emotional beats. 
Each beat should return a JSON object with:
- scene: short description of the story beat,
- genre: fitting music genre,
- mood: emotional tone,
- tempo: slow, medium or fast,
- keywords: 2-3 useful search terms for music discovery.`
          }
        ],
        temperature: 0.8
      })
    });

    const { choices } = await openaiRes.json();
    const responseText = choices?.[0]?.message?.content || "";

    // Expecting structured JSON-like list from GPT
    const beats = JSON.parse(responseText.match(/\[.*\]/s)?.[0] || "[]");

    const spotifyTokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")
      },
      body: "grant_type=client_credentials"
    });

    const spotifyToken = await spotifyTokenRes.json();
    const accessToken = spotifyToken.access_token;

    const playlist = [];

    for (const beat of beats) {
      const query = encodeURIComponent(`${beat.keywords?.join(" ") || ""} ${beat.genre} ${beat.mood}`);
      const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=10`;

      const trackRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const trackData = await trackRes.json();
      const tracks = trackData.tracks?.items || [];

      const formattedTracks = tracks.slice(0, 2).map((track) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        spotify_url: track.external_urls.spotify,
        image: track.album.images?.[0]?.url
      }));

      playlist.push(...formattedTracks);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ playlist });
  } catch (error) {
    console.error("Error generating playlist:", error);
    res.status(500).json({ error: "Failed to generate playlist" });
  }
}
