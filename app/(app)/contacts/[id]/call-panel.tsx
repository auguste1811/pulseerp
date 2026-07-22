"use client";
import { useEffect, useMemo, useState } from "react";
import { logCrmCall } from "../actions";

function nowLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0,16);
}

export function CallPanel({contactId,phone,contactName}:{contactId:string;phone:string;contactName:string}) {
  const [seconds,setSeconds] = useState(0);
  const [running,setRunning] = useState(false);
  const [startedAt,setStartedAt] = useState(nowLocal());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const display = useMemo(() => `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`, [seconds]);

  function start() {
    setStartedAt(nowLocal());
    setSeconds(0);
    setRunning(true);
  }

  return (
    <article className="dashboard-panel crm-call-panel">
      <div className="panel-header">
        <div><h2>Téléphone</h2><p>Appelez le contact et consignez le résultat.</p></div>
        {phone
          ? <a className="primary-action" href={`tel:${phone}`} onClick={start}>Appeler {contactName}</a>
          : <span className="status-pill overdue">Aucun numéro</span>}
      </div>

      <div className="crm-call-timer">
        <span>{running ? "Appel en cours" : "Chronomètre"}</span>
        <strong>{display}</strong>
        {!running
          ? <button className="secondary-action" type="button" onClick={start}>Démarrer</button>
          : <button className="danger-action" type="button" onClick={() => setRunning(false)}>Terminer</button>}
      </div>

      <form action={logCrmCall} className="premium-form">
        <input type="hidden" name="contactId" value={contactId}/>
        <input type="hidden" name="startedAt" value={startedAt}/>
        <input type="hidden" name="durationMinutes" value={Math.floor(seconds/60)}/>
        <input type="hidden" name="durationSeconds" value={seconds%60}/>

        <div className="form-row">
          <label>Sens<select name="direction" defaultValue="OUTBOUND"><option value="OUTBOUND">Appel sortant</option><option value="INBOUND">Appel entrant</option></select></label>
          <label>Statut<select name="status" defaultValue="COMPLETED"><option value="COMPLETED">Terminé</option><option value="NO_ANSWER">Pas de réponse</option><option value="BUSY">Occupé</option><option value="VOICEMAIL">Message vocal</option><option value="FAILED">Échec</option></select></label>
        </div>

        <div className="form-row">
          <label>Résultat<select name="outcome" defaultValue=""><option value="">Non renseigné</option><option value="QUALIFIED">Lead qualifié</option><option value="FOLLOW_UP">À relancer</option><option value="MEETING_BOOKED">Rendez-vous pris</option><option value="NOT_INTERESTED">Non intéressé</option><option value="SALE">Vente conclue</option><option value="OTHER">Autre</option></select></label>
          <label>Numéro appelé<input name="phoneNumber" defaultValue={phone}/></label>
        </div>

        <label>Résumé<textarea name="summary" placeholder="Points abordés, objections, décision…"/></label>
        <label>Prochaine action<input name="nextAction" placeholder="Rappeler, envoyer un devis…"/></label>
        <label>Date de relance<input name="followUpAt" type="datetime-local"/></label>
        <label className="crm-call-checkbox"><input name="createFollowUpTask" type="checkbox"/><span>Créer aussi une tâche de relance</span></label>
        <button className="primary-action" type="submit">Enregistrer l’appel</button>
      </form>
    </article>
  );
}
