let mapsPromise;

export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary)
    return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key)
    return Promise.reject(
      new Error(
        "Set VITE_GOOGLE_MAPS_API_KEY in the frontend .env.local and restart Vite.",
      ),
    );
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Google Maps did not load. Check your connection, key restrictions and enabled APIs.",
          ),
        ),
      25000,
    );
    window.__bookTheDayMapsReady = () => {
      clearTimeout(timer);
      resolve(window.google.maps);
    };
    const params = new URLSearchParams({
      key,
      v: "weekly",
      loading: "async",
      callback: "__bookTheDayMapsReady",
      language: "en",
      region: "IN",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error(
          "Google Maps could not load. Check the browser console and your key settings.",
        ),
      );
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}
