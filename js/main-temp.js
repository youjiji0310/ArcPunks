const PUNK_COUNT = 17;

const punkImages = Array.from(
  { length: PUNK_COUNT },
  (_, i) => `assets/images/punks/${i + 1}.png`
);


// GRID
const grid = document.getElementById("punkGrid");

if (grid) {

  grid.innerHTML = "";

  for (let i = 0; i < 20; i++) {

    const card = document.createElement("div");
    card.className = "punk-card";

    const img = document.createElement("img");
    img.src = punkImages[i % PUNK_COUNT];
    img.alt = "ArcPunk";

    img.onerror = () => {
      console.log("IMAGE ERROR:", img.src);
    };

    card.appendChild(img);
    grid.appendChild(card);
  }

}


// MARQUEE
const track = document.getElementById("marqueeTrack");

if (track) {

  track.innerHTML = "";

  [...punkImages, ...punkImages].forEach(src => {

    const img = document.createElement("img");

    img.src = src;
    img.className = "marquee-item";
    img.alt = "ArcPunk";

    track.appendChild(img);

  });

}