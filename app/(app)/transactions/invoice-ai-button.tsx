"use client";
import { useState } from "react";
export function InvoiceAIButton({ id }: { id: string }) {
  const [state,setState]=useState<"idle"|"loading"|"error">("idle");
  async function analyze(){setState("loading");try{const r=await fetch(`/api/ai/purchase-invoices/${id}/analyze`,{method:"POST"});if(!r.ok){const d=await r.json();throw new Error(d.error)}window.location.reload()}catch(e){console.error(e);setState("error")}}
  return <button className="icon-link" type="button" onClick={analyze} disabled={state==="loading"}>{state==="loading"?"Analyse…":state==="error"?"Réessayer":"Analyser IA"}</button>;
}
