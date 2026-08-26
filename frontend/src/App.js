import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import MapPage from "./pages/MapPage";
import TrendingPage from "./pages/TrendingPage";
import TopicDetailPage from "./pages/TopicDetailPage";
import UpgradePage from "./pages/UpgradePage";
import { TierProvider } from "./lib/tierContext";
import { SignUpProvider } from "./components/SignUpModal";

function App() {
  return (
    <div className="App">
      <TierProvider>
        <BrowserRouter>
          {/* SignUpProvider must live inside BrowserRouter — it uses
              useNavigate to send signed-in users to /upgrade. */}
          <SignUpProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/topic/:id" element={<TopicDetailPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="*" element={<LandingPage />} />
            </Routes>
          </SignUpProvider>
        </BrowserRouter>
      </TierProvider>
    </div>
  );
}

export default App;
