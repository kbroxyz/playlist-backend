<script>
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("submitButton").addEventListener("click", async function (event) {
    event.preventDefault(); // Prevent form submission

    const title = document.getElementById("filmTitle").value;
    const container = document.getElementById("playlistContainer");
    container.innerHTML = "Loading...";

    try {
      const response = await fetch("https://playlist-backend-mu.vercel.app/api/generate-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });

      const data = await response.json();
      container.innerHTML = "";

      if (data.playlist && data.playlist.length > 0) {
        data.playlist.forEach((song) => {
          const trackIdMatch = song.spotify_url?.match(/\/track\/([a-zA-Z0-9]+)/);
          const trackId = trackIdMatch ? trackIdMatch[1] : null;

          if (trackId) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
            iframe.width = "100%";
            iframe.height = "80";
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            iframe.loading = "lazy";
            iframe.style.borderRadius = "12px";
            iframe.style.marginBottom = "16px";

            container.appendChild(iframe);
          }
        });
      } else {
        container.innerHTML = "No playlist found.";
      }
    } catch (error) {
      console.error(error);
      container.innerHTML = "Something went wrong.";
    }
  });
});
</script>
