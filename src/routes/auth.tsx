import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { EriksmindeLogo } from "@/components/eriksminde-logo";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Log ind — Eriksminde" },
      { name: "description", content: "Log ind på Eriksminde med din Google-konto." },
      { property: "og:title", content: "Log ind — Eriksminde" },
      { property: "og:description", content: "Log ind på Eriksminde med din Google-konto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) void navigate({ to: "/overblik", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result?.error) throw result.error;
      if (result?.redirected) return;
      const { data, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !data.user) {
        throw new Error("Login blev ikke gennemført. Prøv igen med Google.");
      }
      await navigate({ to: "/overblik", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--brand-50)]/40">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <EriksmindeLogo />
        </div>
        <h1 className="text-center text-lg font-semibold text-[var(--brand-900)] mb-1">
          Log ind
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Adgang til gårdens styringssystem
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
          Fortsæt med Google
        </Button>
        {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
      </div>
    </div>
  );
}
