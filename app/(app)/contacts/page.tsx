import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { createContact, importContactsCsv, createContactGroup, deleteContactGroup } from "./actions";
const statuses:Record<string,string>={PROSPECT:"Prospect",CONTACTED:"Contacté",MEETING:"Rendez-vous",NEGOTIATION:"Négociation",CUSTOMER:"Client",LOST:"Perdu"};
const importErrors:Record<string,string>={file:"Aucun fichier CSV sélectionné.",size:"Le fichier doit faire moins de 2 Mo.",format:"Le fichier doit être au format CSV.",rows:"Le fichier est vide ou dépasse 5 000 lignes.",invalid:"Aucune ligne valide.",database:"Échec de l’enregistrement.",group:"Le groupe sélectionné est invalide."};
export default async function Contacts({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const member=await currentContext(),params=await searchParams,q=(params.q||"").trim(),groupId=params.group||"",like=`%${q}%`;
 const [groups,rows]=await Promise.all([query<any>(`SELECT g.*,COUNT(gm.contact_id)::int contact_count FROM contact_groups g LEFT JOIN contact_group_members gm ON gm.group_id=g.id WHERE g.company_id=$1 GROUP BY g.id ORDER BY g.name`,[member.company_id]),query<any>(`SELECT c.*,COALESCE(json_agg(json_build_object('id',g.id,'name',g.name,'color',g.color)) FILTER (WHERE g.id IS NOT NULL),'[]') groups FROM contacts c LEFT JOIN contact_group_members gm ON gm.contact_id=c.id LEFT JOIN contact_groups g ON g.id=gm.group_id WHERE c.company_id=$1 AND ($2='' OR c.first_name ILIKE $3 OR c.last_name ILIKE $3 OR c.company_name ILIKE $3 OR c.email ILIKE $3) AND ($4='' OR EXISTS(SELECT 1 FROM contact_group_members x WHERE x.contact_id=c.id AND x.group_id=$4)) GROUP BY c.id ORDER BY c.created_at DESC`,[member.company_id,q,like,groupId])]);
 const importSucceeded=params.imported!==undefined||params.updated!==undefined;
 return <><section className="page-heading"><div><p className="eyebrow">CRM Pro</p><h1>Contacts et groupes</h1><p>Centralisez vos prospects, clients et listes de contacts.</p></div><div className="heading-actions"><Link className="secondary-action" href="/contacts/pipeline">Voir le pipeline</Link><button className="primary-action" form="contact-form" type="submit"><Icon name="plus" size={17}/> Nouveau contact</button></div></section>
 <section className="crm-stats-grid"><div><span>Contacts affichés</span><strong>{rows.length}</strong></div><div><span>Groupes</span><strong>{groups.length}</strong></div><div><span>Clients</span><strong>{rows.filter(x=>x.status==="CUSTOMER").length}</strong></div><div><span>Pipeline</span><strong>{euro(rows.filter(x=>!["CUSTOMER","LOST"].includes(x.status)).reduce((s,x)=>s+Number(x.value),0))}</strong></div></section>
 {(importSucceeded||params.groupCreated||params.groupDeleted)&&<div className="import-alert success"><strong>Enregistré.</strong><span>{importSucceeded?`${params.imported||0} ajouté(s), ${params.updated||0} mis à jour, ${params.rejected||0} rejeté(s).`:"Les groupes ont été mis à jour."}</span></div>}{(params.importError||params.groupError)&&<div className="import-alert error"><strong>Action impossible.</strong><span>{params.importError?importErrors[params.importError]:(params.groupError==="duplicate"?"Un groupe porte déjà ce nom.":"Vérifiez les informations.")}</span></div>}
 <section className="contact-groups-panel dashboard-panel">
  <div className="panel-header contact-groups-header">
    <div>
      <h2>Groupes de contacts</h2>
      <p>Organisez vos contacts par campagne, équipe, segment ou liste.</p>
    </div>
  </div>

  <div className="contact-groups-content">
    <form action={createContactGroup} className="contact-group-form">
      <div className="contact-group-field contact-group-name-field">
        <label htmlFor="contact-group-name">Nom du groupe</label>
        <input
          id="contact-group-name"
          name="name"
          placeholder="Ex. Prospects salon"
          required
        />
      </div>

      <div className="contact-group-field contact-group-description-field">
        <label htmlFor="contact-group-description">
          Description
          <span>Facultatif</span>
        </label>
        <input
          id="contact-group-description"
          name="description"
          placeholder="Ex. Contacts rencontrés au salon 2026"
        />
      </div>

      <div className="contact-group-field contact-group-color-field">
        <label htmlFor="contact-group-color">Couleur</label>
        <input
          id="contact-group-color"
          name="color"
          type="color"
          defaultValue="#6653E8"
          aria-label="Couleur du groupe"
        />
      </div>

      <button
        className="primary-action contact-group-submit"
        type="submit"
      >
        Créer le groupe
      </button>
    </form>

    <div className="contact-groups-list-section">
      <div className="contact-groups-list-heading">
        <strong>Filtrer par groupe</strong>
        <span>{groups.length} groupe(s)</span>
      </div>

      <div className="contact-group-list">
        <Link
          className={!groupId ? "active" : ""}
          href="/contacts"
        >
          <i className="contact-group-all-dot" />
          <span className="contact-group-label">Tous</span>
          <span className="contact-group-count">{rows.length}</span>
        </Link>

        {groups.map((group) => (
          <div className="contact-group-chip-wrapper" key={group.id}>
            <Link
              className={groupId === group.id ? "active" : ""}
              href={`/contacts?group=${group.id}`}
            >
              <i style={{ background: group.color }} />
              <span className="contact-group-label">{group.name}</span>
              <span className="contact-group-count">
                {group.contact_count}
              </span>
            </Link>

            <form action={deleteContactGroup}>
              <input type="hidden" name="groupId" value={group.id} />
              <button
                type="submit"
                title={`Supprimer le groupe ${group.name}`}
                aria-label={`Supprimer le groupe ${group.name}`}
              >
                ×
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
 <section className="crm-import-panel dashboard-panel"><div className="csv-import-copy"><span className="csv-icon">CSV</span><div><h2>Importer des contacts</h2><p>Choisissez directement le groupe de destination. Les doublons email sont mis à jour.</p></div></div><form action={importContactsCsv} className="csv-import-form"><label className="csv-file-picker"><input name="csvFile" type="file" accept=".csv,text/csv" required/><span>Sélectionner un CSV</span></label><select name="groupId" defaultValue=""><option value="">Sans groupe</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select><button className="secondary-action" type="submit">Importer</button><a className="text-link" href="/modele-contacts.csv" download>Modèle CSV</a></form></section>
 <section className="module-grid"><article className="dashboard-panel form-panel"><div className="panel-header"><div><h2>Ajouter un contact</h2><p>Créez une opportunité et classez-la immédiatement.</p></div></div><form id="contact-form" action={createContact} className="premium-form"><div className="form-row"><label>Prénom<input name="firstName" required/></label><label>Nom<input name="lastName" required/></label></div><label>Entreprise<input name="companyName"/></label><label>Email<input name="email" type="email"/></label><label>Téléphone<input name="phone"/></label><label>Groupe<select name="groupId" defaultValue=""><option value="">Sans groupe</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label>Source<select name="source" defaultValue=""><option value="">Non renseignée</option>{["Ads","Clipping","UGC / Affilié","Influenceur","Organique","Site comparatif"].map(x=><option key={x}>{x}</option>)}</select></label><label>Étape<select name="status">{Object.entries(statuses).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Valeur estimée (€)<input name="value" type="number" min="0"/></label><button className="primary-action full-width" type="submit">Ajouter au CRM</button></form></article>
 <article className="dashboard-panel list-panel"><div className="panel-header"><div><h2>Contacts</h2><p>{rows.length} résultat(s)</p></div><form className="compact-search" method="get"><Icon name="search" size={16}/><input name="q" defaultValue={q} placeholder="Nom, email, entreprise..."/>{groupId&&<input type="hidden" name="group" value={groupId}/>}</form></div><div className="contact-list">{rows.map(c=><div className="contact-row" key={c.id}><span className="contact-avatar">{c.first_name[0]}{c.last_name[0]}</span><div className="contact-main"><a href={`/contacts/${c.id}`}><strong>{c.first_name} {c.last_name}</strong></a><small>{c.company_name||c.email||"Sans entreprise"}</small><div className="contact-group-badges">{c.groups.map((g:any)=><span style={{borderColor:g.color,color:g.color}} key={g.id}>{g.name}</span>)}</div></div><span className={`status-pill ${c.status.toLowerCase()}`}>{statuses[c.status]||c.status}</span><strong className="contact-value">{euro(Number(c.value))}</strong></div>)}{!rows.length&&<div className="empty-state">Aucun contact ne correspond aux filtres.</div>}</div></article></section></>;
}
