// ============================================================
// Asset Loader — preloads images and audio
// ============================================================

const Loader = (() => {
  const assets = {
    images: {},
    audio: {},
  };

  let totalItems = 0;
  let loadedItems = 0;

  function onProgress() {
    loadedItems++;
  }

  function loadImage(key, url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        assets.images[key] = img;
        onProgress();
        resolve(true);
      };
      img.onerror = () => {
        console.warn(`Failed to load image: ${url}`);
        onProgress();
        resolve(false);
      };
      img.src = url;
    });
  }

  function loadAudio(key, url) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';
      const handler = () => {
        assets.audio[key] = audio;
        onProgress();
        resolve(true);
      };
      audio.addEventListener('canplaythrough', handler, { once: true });
      audio.addEventListener('error', () => {
        console.warn(`Failed to load audio: ${url}`);
        onProgress();
        resolve(false);
      });
      audio.src = url;
      audio.load();
    });
  }

  async function loadAll(onProgressCb) {
    loadedItems = 0;

    // Collect all image & audio paths
    const imageTasks = [
      loadImage('background', CONFIG.IMAGES.background),
      loadImage('backgroundStart', CONFIG.IMAGES.backgroundStart),
      loadImage('bubble', CONFIG.IMAGES.bubble),
      ...['button','1st','2nd','3rd','rank','restart'].map(key => loadImage(key, `assets/${key}.png`)),
      loadImage('clip', CONFIG.IMAGES.clip),
      loadImage('warning', CONFIG.IMAGES.warning),
      loadImage('line', CONFIG.IMAGES.line),
    ];

    const audioTasks = [
      loadAudio('background', CONFIG.AUDIO.background),
      loadAudio('start', CONFIG.AUDIO.start),
      loadAudio('countdown', CONFIG.AUDIO.countdown),
      loadAudio('goWhistle', CONFIG.AUDIO.goWhistle),
      loadAudio('click', CONFIG.AUDIO.click),
      loadAudio('ending', CONFIG.AUDIO.ending),
    ];

    // Jellyfish sprites
    for (let i = 1; i <= 11; i++) {
      imageTasks.push(
        loadImage(`fish${i}`, `assets/jellyfish/fish${i}.png`)
      );
    }

    // Merge sound effects
    for (let i = 1; i <= 10; i++) {
      audioTasks.push(
        loadAudio(`form${i}`, `assets/audio/form${i}.MP3`)
      );
    }

    totalItems = imageTasks.length + audioTasks.length;

    // Load everything in parallel
    await Promise.all([...imageTasks, ...audioTasks]);

    if (onProgressCb) onProgressCb(1);
    return assets;
  }

  function getProgress() {
    return totalItems > 0 ? loadedItems / totalItems : 0;
  }

  return { loadAll, getAssets: () => assets, getProgress };
})();
