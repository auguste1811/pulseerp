# PulseERP v4.3.0 — PulseAI Gemini

- Remplacement de PulseAI OpenAI par Gemini pour le chat d’entreprise.
- Appels REST serveur vers Gemini, sans dépendance npm supplémentaire.
- Modèle configurable avec `GEMINI_MODEL`.
- Limite quotidienne configurable par entreprise.
- Historique des conversations conservé.
- Analyse du CRM, des finances, des factures, des tâches et de l’acquisition.
- Gestion propre des quotas Gemini et des erreurs HTTP 429.
- Diagnostic Gemini ajouté à `/api/health/config`.
- La clé Gemini n’est jamais exposée au navigateur.
- L’ancien fournisseur OpenAI reste uniquement présent pour les fonctions OCR historiques non migrées.
