import { auth, defineMcp } from "@lovable.dev/mcp-js";
import readData from "./tools/read-data";
import getRecord from "./tools/get-record";
import farmOverview from "./tools/farm-overview";
import createTask from "./tools/create-task";
import updateTask from "./tools/update-task";
import completeTask from "./tools/complete-task";
import createMaintenanceTask from "./tools/create-maintenance-task";
import updateMaintenanceTask from "./tools/update-maintenance-task";
import updateBuilding from "./tools/update-building";
import createContact from "./tools/create-contact";
import updateContact from "./tools/update-contact";
import recordStraw from "./tools/record-straw-sale";
import createInvoice from "./tools/create-invoice-draft";
import updateInvoiceDraft from "./tools/update-invoice-draft";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "eriksminde-farm-hub",
  title: "Eriksminde Farm Hub",
  version: "0.2.0",
  instructions:
    "Værktøjer til Eriksmindes gårdstyring: hent gårdoverblik; læs marker, matrikler, bygninger, budget, lån, halm, opgaver og kontakter; opret og opdatér opgaver, vedligehold, bygninger, kontakter, halmbevægelser og fakturakladder. Der findes ingen sletteværktøjer. Beløb er i DKK.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    farmOverview,
    readData,
    getRecord,
    createTask,
    updateTask,
    completeTask,
    createMaintenanceTask,
    updateMaintenanceTask,
    updateBuilding,
    createContact,
    updateContact,
    recordStraw,
    createInvoice,
    updateInvoiceDraft,
  ],
});
