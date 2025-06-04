
function getAdHighlightStatus(ad) {
    if (!ad.wasHighlighted) {
      return {
        status: 'none',
        displayText: 'Brak'
      };
    }
  
    const now = new Date();
    if (ad.highlightExpiresAt && ad.highlightExpiresAt > now) {
      return {
        status: 'active',
        displayText: `W trakcie do ${ad.highlightExpiresAt.toLocaleDateString()}`,
        expiresAt: ad.highlightExpiresAt
      };
    }
  
    return {
      status: 'expired',
      displayText: 'Zakończone'
    };
  }
  
  export{
    getAdHighlightStatus,
  }