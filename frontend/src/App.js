import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
import TrendingPage from "./pages/TrendingPage";
import TopicDetailPage from "./pages/TopicDetailPage";
import { TierProvider } from "./lib/tierContext";

function App() {
  return (
    <div className="App">
      <TierProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/topic/:id" element={<TopicDetailPage />} />
            <Route path="*" element={<MapPage />} />
          </Routes>
        </BrowserRouter>
      </TierProvider>
    </div>
  );
}

export default App;
