export function getSessionId(): string {
  const urlParams = new URLSearchParams(window.location.search);
  let sessionId = urlParams.get('session');
  
  if (sessionId) {
    localStorage.setItem('zolan8_session', sessionId);
    return sessionId;
  }
  
  sessionId = localStorage.getItem('zolan8_session');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('zolan8_session', sessionId);
  }
  
  // Update URL without reloading
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('session', sessionId);
  window.history.replaceState({}, '', newUrl.toString());
  
  return sessionId;
}
