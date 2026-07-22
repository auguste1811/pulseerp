import Link from "next/link";
import { currentContext } from "@/lib/auth";
import {
  ACQUISITION_SOURCES,
  ensureAcquisitionChannels,
  monthInputValue,
  monthStart,
} from "@/lib/acquisition";
import { euro } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { saveAcquisitionMetric } from "./actions";

function sourceMatches(value: string | null, aliases: readonly string[]) {
  const normalized = (value || "").trim().toLowerCase();
  return aliases.some((alias) => normalized === alias || normalized.includes(alias));
}

export default async function AcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const member = await currentContext();
  const params = await searchParams;
  const selectedMonth = monthStart(params.month);
  const monthValue = monthInputValue(selectedMonth);
  const nextMonth = new Date(Date.UTC(
    selectedMonth.getUTCFullYear(),
    selectedMonth.getUTCMonth() + 1,
    1,
  ));

  await ensureAcquisitionChannels(member.company_id);

  const [channels, contacts, members] = await Promise.all([
    prisma.acquisitionChannel.findMany({
      where: {
        companyId: member.company_id,
        isActive: true,
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        metrics: {
          where: { month: selectedMonth },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      where: {
        companyId: member.company_id,
        createdAt: {
          gte: selectedMonth,
          lt: nextMonth,
        },
      },
      select: {
        id: true,
        source: true,
        status: true,
        value: true,
      },
    }),
    prisma.companyMember.findMany({
      where: { companyId: member.company_id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
      orderBy: { user: { lastName: "asc" } },
    }),
  ]);

  const data = channels.map((channel) => {
    const source = ACQUISITION_SOURCES.find((item) => item.code === channel.code);
    const related = contacts.filter((contact) =>
      sourceMatches(contact.source, source?.aliases || [channel.name.toLowerCase()]),
    );
    const leads = related.length;
    const customers = related.filter((contact) => contact.status === "CUSTOMER").length;
    const metric = channel.metrics[0];
    const spend = Number(metric?.spend || 0);
    const attributedRevenue = Number(metric?.attributedRevenue || 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const conversion = leads > 0 ? (customers / leads) * 100 : 0;
    const roas = spend > 0 ? attributedRevenue / spend : 0;

    return {
      channel,
      metric,
      leads,
      customers,
      spend,
      attributedRevenue,
      cpl,
      conversion,
      roas,
    };
  });

  const totals = data.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      customers: acc.customers + row.customers,
      spend: acc.spend + row.spend,
      revenue: acc.revenue + row.attributedRevenue,
    }),
    { leads: 0, customers: 0, spend: 0, revenue: 0 },
  );

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Marketing & croissance</p>
          <h1>Sources d’acquisition</h1>
          <p>
            Suivez les leads, les dépenses, les responsables et la rentabilité
            de chaque canal.
          </p>
        </div>

        <form className="acquisition-month-picker">
          <label>
            Période
            <input name="month" type="month" defaultValue={monthValue} />
          </label>
          <button className="secondary-action" type="submit">
            Afficher
          </button>
        </form>
      </section>

      {params.saved && (
        <div className="import-alert success">
          <strong>Canal mis à jour.</strong>
          <span>Les dépenses et revenus ont été enregistrés.</span>
        </div>
      )}

      {params.error && (
        <div className="import-alert error">
          <strong>Enregistrement impossible.</strong>
          <span>Vérifiez les informations saisies.</span>
        </div>
      )}

      <section className="acquisition-kpi-grid">
        <article>
          <span>Leads</span>
          <strong>{totals.leads}</strong>
        </article>
        <article>
          <span>Dépenses</span>
          <strong>{euro(totals.spend)}</strong>
        </article>
        <article>
          <span>Coût moyen par lead</span>
          <strong>
            {totals.leads > 0 ? euro(totals.spend / totals.leads) : euro(0)}
          </strong>
        </article>
        <article>
          <span>Revenus attribués</span>
          <strong>{euro(totals.revenue)}</strong>
        </article>
      </section>

      <section className="acquisition-channel-grid">
        {data.map((row) => (
          <article className="dashboard-panel acquisition-channel-card" key={row.channel.id}>
            <div className="panel-header">
              <div>
                <h2>{row.channel.name}</h2>
                <p>
                  Responsable :{" "}
                  {row.channel.manager
                    ? `${row.channel.manager.firstName} ${row.channel.manager.lastName}`
                    : "Non attribué"}
                </p>
              </div>
              <span className="module-count-badge">{row.leads} lead(s)</span>
            </div>

            <div className="acquisition-card-stats">
              <div><span>Coût / lead</span><strong>{euro(row.cpl)}</strong></div>
              <div><span>Clients</span><strong>{row.customers}</strong></div>
              <div><span>Conversion</span><strong>{row.conversion.toFixed(1)} %</strong></div>
              <div><span>ROAS</span><strong>{row.roas.toFixed(2)}x</strong></div>
            </div>

            <form action={saveAcquisitionMetric} className="premium-form">
              <input type="hidden" name="channelId" value={row.channel.id} />
              <input type="hidden" name="month" value={monthValue} />

              <label>
                Responsable du canal
                <select
                  name="managerUserId"
                  defaultValue={row.channel.managerUserId || ""}
                >
                  <option value="">Non attribué</option>
                  {members
                    .filter((memberRow) => memberRow.user.isActive)
                    .map((memberRow) => (
                      <option value={memberRow.user.id} key={memberRow.user.id}>
                        {memberRow.user.firstName} {memberRow.user.lastName}
                      </option>
                    ))}
                </select>
              </label>

              <div className="form-row">
                <label>
                  Dépenses du mois
                  <input
                    name="spend"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.spend}
                  />
                </label>
                <label>
                  Revenus attribués
                  <input
                    name="attributedRevenue"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.attributedRevenue}
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  name="notes"
                  defaultValue={row.metric?.notes || ""}
                  placeholder="Campagnes lancées, créas, ciblage, résultats..."
                />
              </label>

              <button className="primary-action full-width" type="submit">
                Enregistrer ce canal
              </button>
            </form>
          </article>
        ))}
      </section>

      <section className="dashboard-panel acquisition-help-panel">
        <div>
          <h2>Comment sont calculés les leads ?</h2>
          <p>
            Chaque contact créé dans le CRM est rattaché à une source. Les
            nouveaux contacts du mois alimentent automatiquement les indicateurs
            ci-dessus.
          </p>
        </div>
        <Link className="secondary-action" href="/contacts">
          Ouvrir le CRM
        </Link>
      </section>
    </>
  );
}
