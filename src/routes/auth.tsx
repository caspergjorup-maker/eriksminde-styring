import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { EriksmindeLogo } from "@/components/eriksminde-logo";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/overblik" });
    });
  }, [navigate]);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/overblik",
      });
      if (result?.error) throw result.error;
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
