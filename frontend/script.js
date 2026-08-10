const leetMap = {
  'a': '[a4@]',
  's': '[s5$]',
  'i': '[i1!]',
  'o': '[o0]',
  'e': '[e3]',
  't': '[t7]',
  'g': '[g9]',
  'c': '[cC]',
  'b': '[bB]',
  'd': '[dD]',
  'f': '[fF]',
  'h': '[hH]',
  'j': '[jJ]',
  'k': '[kK]',
  'l': '[lL1]',
  'm': '[mM]',
  'n': '[nN]',
  'p': '[pP]',
  'r': '[rR]',
  'u': '[uU]',
  'v': '[vV]',
  'w': '[wW]',
  'x': '[xX]',
  'y': '[yY]',
  'z': '[zZ]'
};

function censorBadWords(text, badwords) {
  if (!text) return text;
  let censoredText = text;

  // Sort badwords from longest to shortest to avoid substring collision (e.g. "anjinggg" before "anjing")
  const sortedBadwords = [...badwords].sort((a, b) => b.length - a.length);

  for (const word of sortedBadwords) {
    if (!word) continue;

    const patternParts = [];
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const map = leetMap[char] || char;
      patternParts.push(`${map}+`);
    }
    let patternStr = patternParts.join('[^a-zA-Z0-9]*');

    // Enforce word boundaries for short words (length <= 4) to avoid false positives (e.g. "tai" in "pantai")
    if (word.length <= 4) {
      patternStr = `(?<=^|[^a-zA-Z0-9])${patternStr}(?=$|[^a-zA-Z0-9])`;
    }

    const regex = new RegExp(patternStr, 'gi');
    censoredText = censoredText.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  return censoredText;
}

document.getElementById("next").addEventListener("click", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const comment = document.getElementById("comment").value.trim();

  if (!name || !comment) {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Isi semua kolom terlebih dahulu!",
    });
    return;
  }

  let badwords = [];
  try {
    const res = await fetch("/badwords");
    badwords = await res.json();
    console.log("Badwords:", badwords);
  } catch (error) {
    console.error("Gagal memuat data.json", error);
  }

  const censoredName = censorBadWords(name, badwords);
  const censoredComment = censorBadWords(comment, badwords);
  const hasBadwords = (censoredName !== name || censoredComment !== comment);

  document.getElementById("p2").style.display = "block";
  document.getElementById("p1").style.display = "none";

  if (hasBadwords) {
    Swal.fire({
      icon: "info",
      title: "Pemberitahuan",
      text: "Beberapa kata dalam nama atau komentar Anda telah disensor otomatis demi kenyamanan bersama.",
      confirmButtonText: "OK",
      confirmButtonColor: "#ff7c00",
      timer: 3000,
      timerProgressBar: true
    });
  } else {
    Swal.fire({
      html: `
      <div style="
        background-color: #f0f28c;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          background-color: #ff8c00;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        ">
          <i class="fa-solid fa-check" style="color: #fff; font-size: 14px;"></i>
        </div>
        <div style="color: #00796B; font-size: 1.5rem; font-weight: bold;">
          Berhasil
        </div>
      </div>
    `,
      showConfirmButton: false,
      background: 'transparent',
      timer: 1500,
      customClass: {
        popup: 'no-border-shadow'
      }
    });
  }

  await submit(censoredName, char, censoredComment);
});

async function submit(name, char, comment) {
  try {
    const response = await fetch("/submit-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, char, comment }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorMessage}`
      );
    }

    const responseData = await response.json();
    console.log("Response Data:", responseData);

    showThankYouScreen({ name, char });

  } catch (error) {
    console.error("Error submitting data:", error.message || error);
  }
}


function showThankYouScreen(data) {
  const { name, char } = data;

  // Tampilkan gambar karakter
  const imageUrl = `/images/${char}.png`;
  const charImg = document.createElement('img');
  charImg.src = imageUrl;
  charImg.alt = char;
  charImg.style.width = '400px';
  charImg.style.display = 'block';
  charImg.style.margin = '0 auto 20px';

  const charContainer = document.getElementById('char-container');
  charContainer.innerHTML = '';
  charContainer.appendChild(charImg);

  // Set nama user di tengah
  const userName = document.getElementById('user-name');
  userName.textContent = name;

  // Tampilkan layar
  const p2 = document.getElementById('p2');
  p2.style.display = 'flex';
  p2.style.flexDirection = 'column';
  p2.style.alignItems = 'center';
}

// const svg = document.getElementById("wave-container");
// let width = window.innerWidth;
// let height = window.innerHeight;
// const numberOfLines = 120; // Jumlah garis
// const waveAmplitude = 20; // Amplitudo gelombang
// const waveLength = 120; // Panjang gelombang
// const speed = 0.01; // Kecepatan animasi
// let time = 0;

// // Fungsi untuk memperbarui ukuran SVG
// function resize() {
//   width = window.innerWidth;
//   height = window.innerHeight;
//   svg.setAttribute("width", width);
//   svg.setAttribute("height", height);
//   svg.innerHTML = ""; // Hapus garis lama agar tidak ada bug saat ukuran berubah
//   createWaves(); // Buat ulang garis
// }

// // Membuat garis gelombang
// function createWaveLine(yOffset) {
//   const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
//   path.setAttribute("stroke", "black");
//   path.setAttribute("stroke-width", "1");
//   path.setAttribute("fill", "none");
//   svg.appendChild(path);
//   return { path, yOffset };
// }

// let waves = [];
// function createWaves() {
//   waves = Array.from({ length: numberOfLines }, (_, i) =>
//     createWaveLine(i * 30)
//   );
// }

// // Animasi gelombang
// function animateWave() {
//   time += speed;
//   waves.forEach((wave, index) => {
//     const points = [];
//     for (let x = 0; x <= width; x += 20) {
//       const y =
//         wave.yOffset + Math.sin(x / waveLength + time + index) * waveAmplitude;
//       points.push(`${x},${y}`);
//     }
//     wave.path.setAttribute("d", `M${points.join(" L")}`);
//   });
//   requestAnimationFrame(animateWave);
// }

// // Inisialisasi
// resize();
// animateWave();
// window.addEventListener("resize", resize); // Perbarui ukuran saat jendela berubah

// async function updateData(key, name, email, char, comment) {
//     try {
//         const response = await fetch('https://imajiwa-x-argo-visual.vercel.app/update-form', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ key, name, email, char, comment })
//         });

//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }

//         const responseData = await response.json();
//         console.log('Response Data:', responseData.msg);

//     } catch (error) {
//         console.error('Error:', error);
//         console.log('Error submitting data');
//     }
// }

const wrapper = document.querySelector(".carousel-wrapper");
const carousel = document.querySelector(".carousel");
const firstCardWidth = carousel.querySelector(".card").offsetWidth;
const arrowBtns = document.querySelectorAll(".carousel-wrapper i");
const carouselChildrens = [...carousel.children];

let char = 1;
let isDragging = false,
  startX,
  startScrollLeft,
  timeoutId;

// Get the number of cards that can fit in the carousel at once
let cardPerView = Math.round(carousel.offsetWidth / firstCardWidth);

// Infinite scrolling setup
carouselChildrens
  .slice(-cardPerView)
  .reverse()
  .forEach((card) => {
    carousel.insertAdjacentHTML("afterbegin", card.outerHTML);
  });
carouselChildrens.slice(0, cardPerView).forEach((card) => {
  carousel.insertAdjacentHTML("beforeend", card.outerHTML);
});

carousel.classList.add("no-transition");
carousel.scrollLeft = carousel.offsetWidth;
carousel.classList.remove("no-transition");

// Update char function
const updateChar = () => {
  char =
    Math.round(carousel.scrollLeft / firstCardWidth) %
    carouselChildrens.length || carouselChildrens.length;
  console.log("Current char after scroll/drag:", char);
};

// Arrow button click events
arrowBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    carousel.scrollLeft += btn.id === "left" ? -firstCardWidth : firstCardWidth;

    if (char > 1 && char < 10) {
      char += btn.id === "left" ? -1 : 1;
    } else if (char === 1) {
      char = btn.id === "left" ? 10 : 2;
    } else if (char === 10) {
      char = btn.id === "left" ? 9 : 1;
    }

    updateChar();
  });
});

// Drag events
const dragStart = (e) => {
  isDragging = true;
  carousel.classList.add("dragging");
  startX = e.pageX;
  startScrollLeft = carousel.scrollLeft;
};

const dragging = (e) => {
  if (!isDragging) return;
  carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
};

const dragStop = () => {
  if (isDragging) updateChar();
  isDragging = false;
  carousel.classList.remove("dragging");
};

const infiniteScroll = () => {
  if (carousel.scrollLeft === 0) {
    carousel.classList.add("no-transition");
    carousel.scrollLeft = carousel.scrollWidth - 2 * carousel.offsetWidth;
    carousel.classList.remove("no-transition");
  } else if (
    Math.ceil(carousel.scrollLeft) ===
    carousel.scrollWidth - carousel.offsetWidth
  ) {
    carousel.classList.add("no-transition");
    carousel.scrollLeft = carousel.offsetWidth;
    carousel.classList.remove("no-transition");
  }
  updateChar();
};

// Event listeners
carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop);
carousel.addEventListener("scroll", infiniteScroll);
wrapper.addEventListener("mouseenter", () => clearTimeout(timeoutId));
