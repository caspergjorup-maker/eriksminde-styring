import { auth, defineMcp } from "@lovable.dev/mcp-js";
import readData from "./tools/read-data";
import createTask from "./tools/create-task";
import recordStraw from "./tools/record-straw-sale";
import createInvoice from "./tools/create-invoice-draft";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "eriksminde-farm-hub",
  title: "Eriksminde Farm Hub",
  version: "0.1.0",
  instructions:
    "Værktøjer til Eriksmindes gårdstyring: læs marker, matrikler, bygninger, budget, lån, halm, opgaver og kontakter; opret opgaver, halmbevægelser og fakturakladder. Beløb er i DKK.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [readData, createTask, recordStraw, createInvoice],
});
