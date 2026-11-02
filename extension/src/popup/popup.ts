// Popup logic for Clipper Extension

interface PopupStorageData {
  syncEnabled?: boolean;
  recentSaves?: any[];
}

document.addEventListener('DOMContentLoaded', async () => {
  const syncToggle = document.getElementById('syncToggle') as HTMLInputElement;
  const recentList = document.getElementById('recentList') as HTMLElement;

  // Load saved state
  const data: PopupStorageData = await chrome.storage.local.get([
    'syncEnabled',
    'recentSaves',
  ]);

  if (data.syncEnabled !== undefined) {
    syncToggle.checked = Boolean(data.syncEnabled);
  }

  // Render recent captures
  if (Array.isArray(data.recentSaves) && data.recentSaves.length > 0) {
    while (recentList.firstChild) {
      recentList.removeChild(recentList.firstChild);
    }
    data.recentSaves.forEach((item: any) => {
      const a = document.createElement('a');
      a.className = 'video-item';
      a.href = item.clean_url;
      a.target = '_blank';

      let badgeClass = 'badge-youtube';
      let badgeText = 'YT';

      if (item.platform === 'instagram') {
        badgeClass = 'badge-instagram';
        badgeText = 'IG';
      } else if (item.platform === 'twitter') {
        badgeClass = 'badge-twitter';
        badgeText = '𝕏';
      } else if (item.platform === 'facebook') {
        badgeClass = 'badge-facebook';
        badgeText = 'FB';
      }

      const img = document.createElement('img');
      img.className = 'thumbnail';
      img.src = item.thumbnail_url || 'https://via.placeholder.com/50x38';
      img.alt = '';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'video-info';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'video-title';
      titleDiv.textContent = item.title || 'Untitled Clip';

      const metaDiv = document.createElement('div');
      metaDiv.className = 'video-meta';

      const badgeSpan = document.createElement('span');
      badgeSpan.className = `badge ${badgeClass}`;
      badgeSpan.textContent = badgeText;

      metaDiv.appendChild(badgeSpan);
      metaDiv.appendChild(document.createTextNode(` ${item.creator_name || ''}`));

      infoDiv.appendChild(titleDiv);
      infoDiv.appendChild(metaDiv);

      a.appendChild(img);
      a.appendChild(infoDiv);

      recentList.appendChild(a);
    });
  }

  // Sync Toggle Handler
  syncToggle.addEventListener('change', () => {
    chrome.storage.local.set({ syncEnabled: syncToggle.checked });
  });
});
