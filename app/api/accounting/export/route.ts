import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPENSE_ACCOUNTS: Record<string, [string, string]> = {
  PURCHASES: ["607000", "Achats de marchandises"],
  SUPPLIES: ["606000", "Achats non stockes"],
  SOFTWARE: ["651100", "Redevances logiciels"],
  TELECOM: ["626000", "Frais postaux et telecom"],
  VEHICLE: ["613000", "Locations"],
  TRAVEL: ["625000", "Deplacements et missions"],
  ADVERTISING: ["623000", "Publicite"],
  INSURANCE: ["616000", "Primes d assurance"],
  BANK: ["627000", "Services bancaires"],
  RENT: ["613200", "Locations immobilieres"],
  OTHER: ["606000", "Achats non stockes"],
  TO_CLASSIFY: ["471000", "Compte d attente"],
};

function frAmount(value: number): string {
  return Number(value || 0)
    .toFixed(2)
    .replace(".", ",");
}

function yyyymmdd(value: Date | string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const member = await currentContext();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "fec";
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 });
  }

  const companies = await query<any>(
    `SELECT name, siret FROM companies WHERE id = $1 LIMIT 1`,
    [member.company_id],
  );
  const company = companies[0] || { name: "Export", siret: "" };

  if (format === "csv-ventes" || format === "csv-achats") {
    const isSales = format === "csv-ventes";
    const rows = isSales
      ? await query<any>(
          `
          SELECT d.document_number, d.issue_date, d.status,
                 d.subtotal, d.vat_amount, d.total, d.document_type,
                 COALESCE(c.company_name, CONCAT(c.first_name,' ',c.last_name), 'Client') AS tiers
          FROM sales_documents d
          LEFT JOIN contacts c ON c.id = d.contact_id
          WHERE d.company_id = $1
            AND d.document_type IN ('INVOICE','CREDIT_NOTE')
            AND EXTRACT(YEAR FROM d.issue_date) = $2
          ORDER BY d.issue_date, d.created_at
          `,
          [member.company_id, year],
        )
      : await query<any>(
          `
          SELECT supplier_name, invoice_number, issue_date, category, status,
                 subtotal, vat_amount, total
          FROM purchase_invoices
          WHERE company_id = $1
            AND EXTRACT(YEAR FROM issue_date) = $2
          ORDER BY issue_date, created_at
          `,
          [member.company_id, year],
        );

    const header = isSales
      ? ["Type", "Numero", "Client", "Date", "HT", "TVA", "TTC", "Statut"]
      : ["Fournisseur", "N facture", "Date", "Categorie", "HT", "TVA", "TTC", "Statut"];
    const lines = [header.map(csvCell).join(";")];
    for (const row of rows) {
      lines.push(
        isSales
          ? [
              row.document_type === "CREDIT_NOTE" ? "Avoir" : "Facture",
              row.document_number,
              row.tiers,
              new Date(row.issue_date).toLocaleDateString("fr-FR"),
              frAmount(Number(row.subtotal) * (row.document_type === "CREDIT_NOTE" ? -1 : 1)),
              frAmount(Number(row.vat_amount) * (row.document_type === "CREDIT_NOTE" ? -1 : 1)),
              frAmount(Number(row.total) * (row.document_type === "CREDIT_NOTE" ? -1 : 1)),
              row.status,
            ]
              .map(csvCell)
              .join(";")
          : [
              row.supplier_name,
              row.invoice_number || "",
              new Date(row.issue_date).toLocaleDateString("fr-FR"),
              row.category,
              frAmount(Number(row.subtotal)),
              frAmount(Number(row.vat_amount)),
              frAmount(Number(row.total)),
              row.status,
            ]
              .map(csvCell)
              .join(";"),
      );
    }

    const filename = `${isSales ? "ventes" : "achats"}-${year}.csv`;
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (format !== "fec") {
    return NextResponse.json({ error: "Format inconnu" }, { status: 400 });
  }

  // --- FEC : Fichier des Ecritures Comptables ---
  const transactions = await query<any>(
    `
    SELECT type, status, date, label, category,
           amount_excluding_tax, vat_amount, amount_including_tax
    FROM transactions
    WHERE company_id = $1
      AND EXTRACT(YEAR FROM date) = $2
    ORDER BY date, created_at
    `,
    [member.company_id, year],
  );

  const header =
    "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
  const lines = [header];
  let seqVT = 0;
  let seqAC = 0;
  let auxSeq = 0;

  const pushLine = (fields: (string | number)[]) => {
    lines.push(fields.map((f) => String(f).replace(/\|/g, " ")).join("|"));
  };

  for (const [index, tx] of transactions.entries()) {
    const ht = Number(tx.amount_excluding_tax);
    const vat = Number(tx.vat_amount);
    const ttc = Number(tx.amount_including_tax);
    const date = yyyymmdd(tx.date);
    const label = String(tx.label || "").slice(0, 100);
    auxSeq += 1;

    if (tx.type === "INCOME") {
      seqVT += 1;
      const num = `VT${String(seqVT).padStart(5, "0")}`;
      const aux = `CLI${String(auxSeq).padStart(5, "0")}`;
      const sign = ttc < 0 || ht < 0 ? "avoir" : "";
      pushLine(["VT", "Ventes", num, date, "411000", "Clients", aux, label, `VTE-${year}-${index + 1}`, date, `${label}${sign ? " (avoir)" : ""}`, ttc < 0 ? 0 : frAmount(ttc), ttc < 0 ? frAmount(-ttc) : 0, "", "", date, "", ""]);
      pushLine(["VT", "Ventes", num, date, "701000", "Ventes de produits", "", "", `VTE-${year}-${index + 1}`, date, label, ht < 0 ? frAmount(-ht) : 0, ht < 0 ? 0 : frAmount(ht), "", "", date, "", ""]);
      if (vat !== 0) {
        pushLine(["VT", "Ventes", num, date, "445710", "TVA collectee", "", "", `VTE-${year}-${index + 1}`, date, label, vat < 0 ? frAmount(-vat) : 0, vat < 0 ? 0 : frAmount(vat), "", "", date, "", ""]);
      }
    } else {
      seqAC += 1;
      const num = `AC${String(seqAC).padStart(5, "0")}`;
      const aux = `FOU${String(auxSeq).padStart(5, "0")}`;
      const [account, accountLabel] = EXPENSE_ACCOUNTS[tx.category] || EXPENSE_ACCOUNTS.OTHER;
      pushLine(["AC", "Achats", num, date, account, accountLabel, "", "", `ACH-${year}-${index + 1}`, date, label, frAmount(ht), 0, "", "", date, "", ""]);
      if (vat !== 0) {
        pushLine(["AC", "Achats", num, date, "445660", "TVA deductible", "", "", `ACH-${year}-${index + 1}`, date, label, frAmount(vat), 0, "", "", date, "", ""]);
      }
      pushLine(["AC", "Achats", num, date, "401000", "Fournisseurs", aux, label, `ACH-${year}-${index + 1}`, date, label, 0, frAmount(ttc), "", "", date, "", ""]);
    }
  }

  const siren = String(company.siret || "").replace(/\D/g, "").slice(0, 9) || "EXPORT";
  const filename = `${siren}FEC${year}.txt`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
