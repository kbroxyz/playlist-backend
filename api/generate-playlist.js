const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // fallback if needed

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Example: call GPT-4 or logic to generate tracks from prompt
    const dummyTracks = Array.from({ length: 20 }, (_, i) => ({
      title: `Track ${i + 1} inspired by ${prompt}`,
      artist: `Artist ${i + 1}`,
      spotifyId: `7ouMYWpwJ422jRcDASZB7P` // placeholder ID
    }));

    return res.status(200).json({ tracks: dummyTracks });
  } catch (error) {
    console.error('Error generating playlist:', error);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
