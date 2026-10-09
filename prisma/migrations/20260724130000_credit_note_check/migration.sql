-- Nouveau type CREDIT_NOTE (avoirs) : élargit les CHECK existants
ALTER TABLE sales_documents DROP CONSTRAINT IF EXISTS sales_documents_document_type_check;
ALTER TABLE sales_documents ADD CONSTRAINT sales_documents_document_type_check
  CHECK (document_type IN ('QUOTE', 'INVOICE', 'CREDIT_NOTE'));

ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_check;
ALTER TABLE document_sequences ADD CONSTRAINT document_sequences_document_type_check
  CHECK (document_type IN ('QUOTE', 'INVOICE', 'CREDIT_NOTE'));
