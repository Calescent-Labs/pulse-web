import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";
import { ClerkAuthBridge, markClerkDisabled } from "./lib/clerkBridge";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Clerk is opt-in: if REACT_APP_CLERK_PUBLISHABLE_KEY is not set, the app
// runs anonymously with no sign-in affordance, exactly like before Clerk
// landed. The moment the key is injected into /app/frontend/.env, the
// ClerkProvider mounts, the bridge starts publishing tokens to the fetch
// wrapper, and the sign-in / user-button chrome appears in the nav.
const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "";

const root = ReactDOM.createRoot(document.getElementById("root"));

if (publishableKey) {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
        <ClerkAuthBridge />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    </React.StrictMode>,
  );
} else {
  markClerkDisabled();
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
