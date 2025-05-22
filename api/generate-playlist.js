export default async function handler(req, res) {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "No title provided" });
  }

  const samplePlaylist = [
    { name: "Desert Dreams", artist: "Analog Sun", link: "#" },
    { name: "Star Path", artist: "Echoes Divide", link: "#" },
    { name: "Dust and Stars", artist: "Celestial", link: "#" }
  ];

  res.status(200).json({ playlist: samplePlaylist });
}
