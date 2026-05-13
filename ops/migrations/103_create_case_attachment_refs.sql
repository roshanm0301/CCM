-- =============================================================================
-- Migration 103: Create case_attachment_refs table
--
-- PostgreSQL-side metadata index for attachments uploaded against resolution
-- activities. The binary content is stored in MongoDB (case_attachments
-- collection). This table allows PostgreSQL queries to discover attachments
-- by case or step without touching MongoDB.
--
-- When an attachment is uploaded:
--   1. Binary is saved to MongoDB case_attachments collection.
--   2. A metadata row is inserted here with the MongoDB document ID.
--
-- Retrieval:
--   - Use mongo_id to fetch the full document (including base64 content) from MongoDB.
--   - This table is used for listing/counting only; base64 is never stored here.
--
-- Source: CCM_Phase6_Resolution_Activities.md — Feature 4 (Attachment Rules)
-- =============================================================================

CREATE TABLE IF NOT EXISTS case_attachment_refs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to MongoDB cases collection (ISR-001 format)
  case_id              VARCHAR(20)  NOT NULL,

  -- Step number the attachment belongs to (matches resolution_activities.step_no)
  step_no              INTEGER      NOT NULL,

  -- Original filename as supplied by the uploader
  original_filename    VARCHAR(500) NOT NULL,

  -- MIME type (e.g. application/pdf, image/jpeg, image/png)
  content_type         VARCHAR(100) NOT NULL,

  -- File size in bytes (validated ≤ 5 MB = 5,242,880 bytes before storage)
  size_bytes           INTEGER      NOT NULL,

  -- MongoDB ObjectId of the corresponding case_attachments document
  -- This is the key used to retrieve the binary content
  mongo_id             VARCHAR(100) NOT NULL,

  -- User who uploaded this attachment
  uploaded_by_user_id  UUID         NOT NULL REFERENCES users(id),

  -- Immutable audit timestamp
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT case_attachment_refs_content_type_check
    CHECK (content_type IN (
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    )),

  CONSTRAINT case_attachment_refs_size_check
    CHECK (size_bytes > 0 AND size_bytes <= 5242880)
);

-- Primary access pattern: all attachments for a case
CREATE INDEX IF NOT EXISTS idx_case_attachment_refs_case_id
  ON case_attachment_refs (case_id);

-- Secondary: attachments for a specific step within a case
CREATE INDEX IF NOT EXISTS idx_case_attachment_refs_case_step
  ON case_attachment_refs (case_id, step_no);

COMMENT ON TABLE case_attachment_refs IS
  'Metadata index for resolution activity attachments. Binary content is stored in MongoDB case_attachments collection. Use mongo_id to retrieve the full document.';
COMMENT ON COLUMN case_attachment_refs.mongo_id IS
  'MongoDB ObjectId (string) of the corresponding case_attachments document. Used to retrieve base64 binary content.';
COMMENT ON COLUMN case_attachment_refs.size_bytes IS
  'File size validated at upload time. Maximum 5 MB (5,242,880 bytes) enforced by CHECK constraint and Zod schema.';
