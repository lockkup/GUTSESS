import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Request geolocation once on app start and persist to localStorage so that
// every API call (via api.config.js getAuthHeader) can include the position.
function captureGeolocation() {
  if (!navigator.geolocation) {
    localStorage.setItem("geo_status", "Geolocation not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      localStorage.setItem("geo_lat", String(pos.coords.latitude));
      localStorage.setItem("geo_lng", String(pos.coords.longitude));
      localStorage.removeItem("geo_status");
    },
    (err) => {
      localStorage.removeItem("geo_lat");
      localStorage.removeItem("geo_lng");
      localStorage.setItem("geo_status", err.message); // e.g. "User denied the request for Geolocation."
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

captureGeolocation();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker to make the app installable (PWA) on supported browsers
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Service worker registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
