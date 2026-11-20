export function renderVideoSpeed() {
  document.querySelectorAll('video[data-speed]').forEach((v) => {
    const speed = Number(v.dataset.speed) || 1;
    v.defaultPlaybackRate = speed;  
    v.playbackRate = speed;
  });
}