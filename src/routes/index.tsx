import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gårdstyring — Eriksminde" },
      { name: "description", content: "Eriksmindes samlede overblik over drift, ejendom og økonomi." },
      { property: "og:title", content: "Gårdstyring — Eriksminde" },
      { property: "og:description", content: "Eriksmindes samlede overblik over drift, ejendom og økonomi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/overblik" });
  },
  component: () => null,
});
