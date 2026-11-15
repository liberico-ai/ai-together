-- Slice 3: document review. Five tables: review_delegations (who may comment, by designation of a project manager, revocable), review_comments,
-- review_decisions, document_dependencies, review_events; four guards; the guard on the canonical «approved» pointer of document_records.
-- Z1 owned records. Pointers, hashes and short texts only: no bytes, no file content. Nothing here approves anything by itself: the right to approve
-- stays with the approval grant of migration 019 and with the access-change ballot behind it.
-- Guards run as the writing role and are not SECURITY DEFINER; the operational login (a superuser) skips the authority checks that say so (S7, S34, S61).
-- SQLSTATE LTR01 (decision: no authority), LTR02 (designation: granter or delegate not eligible), LTR03 (revoke: revoker not a manager) let the service
-- answer «not found / out of scope» instead of a server error. Integrity refusals carry no LTR code.
-- Rollback: migrations/rollback/020_document_review.sql (refuses while a later migration is recorded and while an approval decision exists).
-- Lock: CREATE TRIGGER on document_records takes SHARE ROW EXCLUSIVE; after 5 s the file (one transaction) fails and is retried.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS review_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  delegate_id uuid NOT NULL, doc_types text[] NOT NULL, granted_by uuid NOT NULL,
  basis text NOT NULL,
  revoked_at timestamptz, revoked_by uuid, revoke_basis text,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT review_delegations_basis_check CHECK(length(btrim(basis)) BETWEEN 5 AND 500),
  CONSTRAINT review_delegations_revoke_basis_check CHECK(revoke_basis IS NULL OR length(btrim(revoke_basis)) BETWEEN 5 AND 500),
  CONSTRAINT review_delegations_version_check CHECK(version > 0),
  CONSTRAINT review_delegations_doc_types_check CHECK(cardinality(doc_types) BETWEEN 1 AND 8
    AND doc_types <@ ARRAY['project_index','change_brief','requirements','design','plan','verification','guide','other']::text[]),
  CONSTRAINT review_delegations_no_self_grant CHECK(delegate_id <> granted_by),
  CONSTRAINT review_delegations_revoke_complete CHECK((revoked_at IS NULL) = (revoked_by IS NULL) AND (revoked_at IS NULL) = (revoke_basis IS NULL)),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(id,tenant_id,project_id,delegate_id)
);
CREATE TABLE IF NOT EXISTS review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, document_revision_id uuid NOT NULL, parent_id uuid,
  kind text NOT NULL CHECK(kind IN ('comment','addressed','resolved')),
  anchor text NOT NULL DEFAULT '' CHECK(length(anchor) <= 200),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  actor_id uuid NOT NULL, request_id uuid NOT NULL, trace_id uuid NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  FOREIGN KEY(document_revision_id,document_id) REFERENCES document_revisions(id,document_id),
  UNIQUE(id,tenant_id,project_id),
  UNIQUE(id,document_id,document_revision_id),
  FOREIGN KEY(parent_id,tenant_id,project_id) REFERENCES review_comments(id,tenant_id,project_id),
  -- a reply belongs to the document and the revision of the comment it answers (S50)
  FOREIGN KEY(parent_id,document_id,document_revision_id) REFERENCES review_comments(id,document_id,document_revision_id),
  CHECK((kind = 'comment') = (parent_id IS NULL))
);
CREATE TABLE IF NOT EXISTS review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, document_revision_id uuid NOT NULL, revision_no integer NOT NULL,
  revision_hash text CHECK(revision_hash IS NULL OR revision_hash ~ '^[a-f0-9]{64}$'),
  record_version integer NOT NULL CHECK(record_version > 0),
  result text NOT NULL CHECK(result IN ('approved','changes_requested')),
  scope_note text NOT NULL CHECK(length(btrim(scope_note)) BETWEEN 5 AND 1000),
  exceptions jsonb NOT NULL DEFAULT '[]',
  authority text NOT NULL CHECK(authority IN ('review_delegation','approval_grant')),
  delegation_id uuid,
  decided_by uuid NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  command_key text NOT NULL, request_id uuid NOT NULL, trace_id uuid NOT NULL,
  CONSTRAINT review_decisions_authority_delegation CHECK((authority = 'review_delegation') = (delegation_id IS NOT NULL)),
  CONSTRAINT review_decisions_approval_needs_grant CHECK(result <> 'approved' OR authority = 'approval_grant'),
  CONSTRAINT review_decisions_approval_needs_hash CHECK(result <> 'approved' OR revision_hash IS NOT NULL),
  CONSTRAINT review_decisions_exceptions_array CHECK(jsonb_typeof(exceptions) = 'array'),
  -- bounds are a backstop; a non-array never reaches jsonb_array_length
  CONSTRAINT review_decisions_exceptions_bounds CHECK(CASE WHEN jsonb_typeof(exceptions) = 'array'
    THEN jsonb_array_length(exceptions) <= 10 AND octet_length(exceptions::text) <= 16384 ELSE false END),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  FOREIGN KEY(document_revision_id,document_id) REFERENCES document_revisions(id,document_id),
  FOREIGN KEY(delegation_id,tenant_id,project_id,decided_by) REFERENCES review_delegations(id,tenant_id,project_id,delegate_id),
  UNIQUE(document_revision_id)
);
CREATE TABLE IF NOT EXISTS document_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  upstream_document_id uuid NOT NULL, upstream_revision_id uuid NOT NULL, dependent_document_id uuid NOT NULL,
  note text NOT NULL DEFAULT '' CHECK(length(note) <= 500),
  confirmed_by uuid NOT NULL,
  needs_review boolean NOT NULL DEFAULT false, flagged_revision_id uuid, flagged_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  CONSTRAINT document_dependencies_not_self CHECK(upstream_document_id <> dependent_document_id),
  CONSTRAINT document_dependencies_flag_pair CHECK(needs_review = (flagged_revision_id IS NOT NULL)),
  CONSTRAINT document_dependencies_flagged_at_pair CHECK((flagged_at IS NULL) = (flagged_revision_id IS NULL)),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(upstream_document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  FOREIGN KEY(dependent_document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  FOREIGN KEY(upstream_revision_id,upstream_document_id) REFERENCES document_revisions(id,document_id),
  FOREIGN KEY(flagged_revision_id,upstream_document_id) REFERENCES document_revisions(id,document_id),
  UNIQUE(tenant_id,project_id,upstream_document_id,dependent_document_id)
);
CREATE TABLE IF NOT EXISTS review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL CHECK(entity_type IN ('review_decision','review_comment','document_dependency','review_delegation')),
  entity_id uuid NOT NULL, actor_id uuid NOT NULL, kind text NOT NULL,
  request_id uuid NOT NULL, trace_id uuid NOT NULL, payload jsonb NOT NULL,
  CONSTRAINT review_events_kind_length CHECK(length(kind) BETWEEN 1 AND 64),
  CONSTRAINT review_events_payload_size CHECK(octet_length(payload::text) <= 8192),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)
);

-- One live designation per person per project; a revoked row does not block a new designation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_delegations_active ON review_delegations(tenant_id,project_id,delegate_id) WHERE revoked_at IS NULL;
-- Foreign keys led by a UNIQUE (review_decisions.document_revision_id, document_dependencies' pair, review_comments' own id) are covered by it
-- (pattern of migrations/016_intake_inbox.sql); every other foreign key and created_at has an index below.
CREATE INDEX IF NOT EXISTS idx_review_delegations_scope_created ON review_delegations(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_delegations_project_fk ON review_delegations(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_scope_created ON review_comments(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_comments_project_fk ON review_comments(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_revision_fk ON review_comments(document_revision_id,document_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_document_fk ON review_comments(document_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_parent_fk ON review_comments(parent_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_scope_created ON review_decisions(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_decisions_project_fk ON review_decisions(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_document_fk ON review_decisions(document_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_delegation_fk ON review_decisions(delegation_id,tenant_id,project_id,decided_by);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_scope_created ON document_dependencies(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_project_fk ON document_dependencies(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_dependent_fk ON document_dependencies(dependent_document_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_upstream_fk ON document_dependencies(upstream_document_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_upstream_revision_fk ON document_dependencies(upstream_revision_id,upstream_document_id);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_flagged_revision_fk ON document_dependencies(flagged_revision_id,upstream_document_id);
CREATE INDEX IF NOT EXISTS idx_document_dependencies_needs_review ON document_dependencies(tenant_id,project_id) WHERE needs_review;
CREATE INDEX IF NOT EXISTS idx_review_events_scope_created ON review_events(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_events_project_fk ON review_events(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_events_entity ON review_events(entity_type,entity_id,created_at);

ALTER TABLE review_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_delegations FORCE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_dependencies FORCE ROW LEVEL SECURITY;
ALTER TABLE review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_events FORCE ROW LEVEL SECURITY;

-- Scope condition on every policy: tenant and projects from the transaction context (set_config(...,true)), never from the row's caller.
DROP POLICY IF EXISTS runtime_select ON review_delegations;
CREATE POLICY runtime_select ON review_delegations FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON review_delegations;
CREATE POLICY runtime_insert ON review_delegations FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND granted_by = nullif(current_setting('app.person_id',true),'')::uuid
    AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_basis IS NULL);
-- Revoke only (OQ-34 a): a revoked row is no longer a target; the new row must carry a revoke by the acting person with a basis.
DROP POLICY IF EXISTS runtime_update ON review_delegations;
CREATE POLICY runtime_update ON review_delegations FOR UPDATE TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND revoked_at IS NULL)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND revoked_at IS NOT NULL AND revoke_basis IS NOT NULL
    AND revoked_by = nullif(current_setting('app.person_id',true),'')::uuid);

DROP POLICY IF EXISTS runtime_select ON review_comments;
CREATE POLICY runtime_select ON review_comments FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON review_comments;
CREATE POLICY runtime_insert ON review_comments FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND actor_id = nullif(current_setting('app.person_id',true),'')::uuid);

DROP POLICY IF EXISTS runtime_select ON review_decisions;
CREATE POLICY runtime_select ON review_decisions FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON review_decisions;
CREATE POLICY runtime_insert ON review_decisions FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND decided_by = nullif(current_setting('app.person_id',true),'')::uuid);

DROP POLICY IF EXISTS runtime_select ON document_dependencies;
CREATE POLICY runtime_select ON document_dependencies FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON document_dependencies;
CREATE POLICY runtime_insert ON document_dependencies FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND confirmed_by = nullif(current_setting('app.person_id',true),'')::uuid
    AND needs_review = false AND flagged_revision_id IS NULL);
DROP POLICY IF EXISTS runtime_update ON document_dependencies;
CREATE POLICY runtime_update ON document_dependencies FOR UPDATE TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

DROP POLICY IF EXISTS runtime_select ON review_events;
CREATE POLICY runtime_select ON review_events FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON review_events;
CREATE POLICY runtime_insert ON review_events FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND actor_id = nullif(current_setting('app.person_id',true),'')::uuid);

-- Designation guard (S34). Not SECURITY DEFINER: bom_eligible_members (006) is the definer-side reader of identity and answers only for the project in scope.
-- The granter must be a manager of this very project (project role first, as in 006), the delegate an active member there with a reading role.
CREATE OR REPLACE FUNCTION public.review_delegations_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF coalesce((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bom_eligible_members(NEW.project_id, ARRAY[NEW.granted_by]) g WHERE g.project_role = 'manager')
    OR NOT EXISTS (SELECT 1 FROM public.bom_eligible_members(NEW.project_id, ARRAY[NEW.delegate_id]) d
      WHERE d.project_role IN ('manager','engineer','technical','business')) THEN
    RAISE EXCEPTION 'A reviewer is designated by a manager of the project, among its members' USING ERRCODE = 'LTR02';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS review_delegations_guard ON review_delegations;
CREATE TRIGGER review_delegations_guard BEFORE INSERT ON review_delegations
  FOR EACH ROW EXECUTE FUNCTION public.review_delegations_guard();

-- Revoke guard (OQ-34 a, S61). Applies to every role. A delegation moves once, from live to revoked, and only the revoke columns change; the
-- time, the version and updated_at are stamped here so the runtime role needs no right to write them and cannot back-date a revoke.
CREATE OR REPLACE FUNCTION public.review_delegations_revoke_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL THEN
    RAISE EXCEPTION 'A delegation is revoked once and a revoke cannot be undone';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.delegate_id IS DISTINCT FROM OLD.delegate_id OR NEW.doc_types IS DISTINCT FROM OLD.doc_types OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
    OR NEW.basis IS DISTINCT FROM OLD.basis OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the revoke columns of a delegation change';
  END IF;
  IF NOT coalesce((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false) THEN
    IF NOT EXISTS (SELECT 1 FROM public.bom_eligible_members(NEW.project_id, ARRAY[NEW.revoked_by]) g WHERE g.project_role = 'manager') THEN
      RAISE EXCEPTION 'A delegation is revoked by a manager of the project' USING ERRCODE = 'LTR03';
    END IF;
  END IF;
  NEW.revoked_at := pg_catalog.now();
  NEW.version := OLD.version + 1;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS review_delegations_revoke_guard ON review_delegations;
CREATE TRIGGER review_delegations_revoke_guard BEFORE UPDATE ON review_delegations
  FOR EACH ROW EXECUTE FUNCTION public.review_delegations_revoke_guard();

-- Decision guard (S38). Authority first (LTR01), then the revision, then freshness, then the freezing rule for an approval. Sentences carry no names.
-- The document row is read FOR NO KEY UPDATE: a revision proposed concurrently waits for this decision to commit instead of slipping past the freshness
-- check, and two deciders serialise here instead of both holding a share lock and deadlocking when each updates the row.
CREATE OR REPLACE FUNCTION public.review_decisions_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE rec record; rev record; authorised boolean;
BEGIN
  SELECT d.doc_type, d.latest_revision_id, d.version INTO rec FROM public.document_records d
    WHERE d.id = NEW.document_id AND d.tenant_id = NEW.tenant_id AND d.project_id = NEW.project_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A decision names a document of the project'; END IF;
  IF NEW.authority = 'review_delegation' THEN
    authorised := EXISTS (SELECT 1 FROM public.review_delegations g WHERE g.id = NEW.delegation_id AND g.tenant_id = NEW.tenant_id
      AND g.project_id = NEW.project_id AND g.delegate_id = NEW.decided_by AND g.revoked_at IS NULL AND rec.doc_type = ANY(g.doc_types))
      -- the delegate must still be an active member with a reading role (S51), as the approval branch re-checks through document_approvers
      AND EXISTS (SELECT 1 FROM public.bom_eligible_members(NEW.project_id, ARRAY[NEW.decided_by]) e
        WHERE e.project_role IN ('manager','engineer','technical','business'));
  ELSIF NEW.authority = 'approval_grant' THEN
    authorised := EXISTS (SELECT 1 FROM public.document_approvers(NEW.project_id) a WHERE a.user_id = NEW.decided_by AND rec.doc_type = ANY(a.doc_types));
  ELSE
    authorised := false;
  END IF;
  IF NOT coalesce(authorised, false) THEN
    RAISE EXCEPTION 'The decider has no authority for this document type' USING ERRCODE = 'LTR01';
  END IF;
  SELECT v.document_id, v.proposed_by, v.revision_no, v.source_hash, v.snapshot_ref, v.hash_verification INTO rev
    FROM public.document_revisions v WHERE v.id = NEW.document_revision_id;
  IF NOT FOUND OR rev.document_id <> NEW.document_id THEN RAISE EXCEPTION 'A decision names a revision of its document'; END IF;
  IF rev.proposed_by = NEW.decided_by THEN RAISE EXCEPTION 'The author of a revision does not decide it'; END IF;
  IF rev.revision_no IS DISTINCT FROM NEW.revision_no OR rev.source_hash IS DISTINCT FROM NEW.revision_hash THEN
    RAISE EXCEPTION 'A decision names the number and the hash of the revision';
  END IF;
  IF rec.latest_revision_id IS DISTINCT FROM NEW.document_revision_id OR rec.version IS DISTINCT FROM NEW.record_version THEN
    RAISE EXCEPTION 'A decision names the latest revision and the current record version';
  END IF;
  IF NEW.result = 'approved' AND (rev.snapshot_ref IS NULL OR rev.hash_verification <> 'verified' OR rev.source_hash IS NULL) THEN
    RAISE EXCEPTION 'An approval needs a verified, snapshotted revision';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS review_decisions_guard ON review_decisions;
CREATE TRIGGER review_decisions_guard BEFORE INSERT ON review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.review_decisions_guard();

-- Approved pointer guard (S7). The operational login keeps the direct path of slice 1. Every other role moves the pointer only (a) to the revision that
-- was the document's latest before this statement (OLD, so one UPDATE cannot move both pointers), (b) when that revision carries an approval decision recorded by the
-- person named in app.person_id AND inserted in THIS transaction, (c) when that revision is frozen. «This transaction»: the guard reads the decision through the
-- caller's own snapshot, where a row whose inserting transaction (xmin, a system column the runtime role cannot write) is still in progress can only be the caller's own,
-- or one inserted inside one of its savepoints; a decision committed earlier has a finished xmin and is refused. This holds across savepoints and needs no clock
-- (PGlite's clock has millisecond resolution, so transaction_timestamp() could not tell two quick transactions apart). xmin is 32 bits, so the full id is built
-- around the CURRENT one: candidate = current + (((xmin - current mod 2^32 + 3*2^31) mod 2^32) - 2^31), the nearest id with that low half (a sub-transaction id, a little
-- above the top-level one, stays in the current epoch; an id from the previous epoch lands below it); anything below 3 is no transaction.
-- Setting the pointer back to NULL, or back to an older approved revision, is refused for them.
CREATE OR REPLACE FUNCTION public.document_records_approval_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE cur numeric; cm numeric;
BEGIN
  IF coalesce((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false) THEN RETURN NEW; END IF;
  IF NEW.approved_revision_id IS DISTINCT FROM OLD.approved_revision_id THEN
    cur := pg_catalog.pg_current_xact_id()::pg_catalog.text::pg_catalog.numeric;
    cm := pg_catalog.mod(cur, 4294967296);
    IF NEW.approved_revision_id IS NULL
      OR NEW.approved_revision_id IS DISTINCT FROM OLD.latest_revision_id
      OR NOT EXISTS (
      SELECT 1 FROM public.review_decisions d
      JOIN public.document_revisions v ON v.id = d.document_revision_id AND v.document_id = d.document_id
      WHERE d.document_revision_id = NEW.approved_revision_id AND d.document_id = NEW.id AND d.result = 'approved'
        AND d.decided_by = nullif(pg_catalog.current_setting('app.person_id', true), '')::uuid
        AND pg_catalog.pg_xact_status((CASE WHEN cur + pg_catalog.mod(d.xmin::pg_catalog.text::pg_catalog.numeric - cm + 6442450944, 4294967296) - 2147483648 >= 3
              THEN cur + pg_catalog.mod(d.xmin::pg_catalog.text::pg_catalog.numeric - cm + 6442450944, 4294967296) - 2147483648 END)::pg_catalog.text::pg_catalog.xid8) = 'in progress'
        AND v.snapshot_ref IS NOT NULL AND v.hash_verification = 'verified' AND v.source_hash IS NOT NULL) THEN
      RAISE EXCEPTION 'Approved pointer requires an approval decision on a frozen revision';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS document_records_approval_guard ON document_records;
CREATE TRIGGER document_records_approval_guard BEFORE UPDATE OF approved_revision_id ON document_records
  FOR EACH ROW EXECUTE FUNCTION public.document_records_approval_guard();

-- Author of a revision (Codex round 2, D4). The decision guard and the latest-pointer guard trust document_revisions.proposed_by ("the author does not decide
-- their own revision"), so the runtime insert policy of 014 gets one more condition: the author is the person named in the transaction (app.person_id, set by
-- the service from the session). Same name, same scope and self-declared conditions as 014; only proposed_by is added. Rolled back to 014's text by the rollback file.
DROP POLICY IF EXISTS scope_insert ON document_revisions;
CREATE POLICY scope_insert ON document_revisions FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND hash_verification = 'self_declared' AND snapshot_ref IS NULL
    AND proposed_by = nullif(current_setting('app.person_id',true),'')::uuid);

-- Latest-revision pointer guard. The decision guard and the approved-pointer guard trust document_records.latest_revision_id, so the runtime role may
-- only move it forward: to a revision of this document with a higher revision_no than the current one. The operational login keeps its direct path.
CREATE OR REPLACE FUNCTION public.document_records_latest_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF coalesce((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false) THEN RETURN NEW; END IF;
  IF NEW.latest_revision_id IS DISTINCT FROM OLD.latest_revision_id THEN
    IF NEW.latest_revision_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.document_revisions v
      WHERE v.id = NEW.latest_revision_id AND v.document_id = NEW.id
        AND (OLD.latest_revision_id IS NULL
          OR v.revision_no > (SELECT o.revision_no FROM public.document_revisions o WHERE o.id = OLD.latest_revision_id))) THEN
      RAISE EXCEPTION 'The latest revision of a document only moves forward';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS document_records_latest_guard ON document_records;
CREATE TRIGGER document_records_latest_guard BEFORE UPDATE OF latest_revision_id ON document_records
  FOR EACH ROW EXECUTE FUNCTION public.document_records_latest_guard();

-- Flag guard (slice 3 builds no un-flagging). For every role the identity of a dependency is frozen and the version moves by exactly one; for every
-- role but the operational login a flag can be set or moved to a newer revision, never cleared; the two stamps are written here.
CREATE OR REPLACE FUNCTION public.document_dependencies_flag_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.upstream_document_id IS DISTINCT FROM OLD.upstream_document_id OR NEW.upstream_revision_id IS DISTINCT FROM OLD.upstream_revision_id
    OR NEW.dependent_document_id IS DISTINCT FROM OLD.dependent_document_id OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.note IS DISTINCT FROM OLD.note OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the flag columns of a dependency change';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'A dependency version moves by exactly one';
  END IF;
  IF NOT coalesce((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false) THEN
    IF NEW.needs_review IS NOT TRUE OR NEW.flagged_revision_id IS NULL THEN
      RAISE EXCEPTION 'A dependency flag is set or advanced, not cleared';
    END IF;
    -- the flag only moves to a newer revision of the upstream document than the one flagged now (or, with no flag, than the confirmed one)
    IF NEW.flagged_revision_id IS DISTINCT FROM OLD.flagged_revision_id AND NOT EXISTS (
      SELECT 1 FROM public.document_revisions v
      WHERE v.id = NEW.flagged_revision_id AND v.document_id = NEW.upstream_document_id
        AND v.revision_no > (SELECT o.revision_no FROM public.document_revisions o
          WHERE o.id = coalesce(OLD.flagged_revision_id, OLD.upstream_revision_id))) THEN
      RAISE EXCEPTION 'A dependency flag moves to a newer revision of the upstream document';
    END IF;
  END IF;
  -- stamps are the database's, whatever the statement supplied
  NEW.updated_at := pg_catalog.now();
  IF NEW.flagged_revision_id IS NOT NULL THEN
    IF NEW.flagged_revision_id IS DISTINCT FROM OLD.flagged_revision_id THEN NEW.flagged_at := pg_catalog.now();
    ELSE NEW.flagged_at := OLD.flagged_at; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS document_dependencies_flag_guard ON document_dependencies;
CREATE TRIGGER document_dependencies_flag_guard BEFORE UPDATE ON document_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.document_dependencies_flag_guard();

-- History: comments, decisions and events never change; delegations and dependencies are never deleted.
DROP TRIGGER IF EXISTS review_comments_immutable ON review_comments;
CREATE TRIGGER review_comments_immutable BEFORE UPDATE OR DELETE ON review_comments FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS review_decisions_immutable ON review_decisions;
CREATE TRIGGER review_decisions_immutable BEFORE UPDATE OR DELETE ON review_decisions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS review_events_immutable ON review_events;
CREATE TRIGGER review_events_immutable BEFORE UPDATE OR DELETE ON review_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS review_delegations_no_delete ON review_delegations;
CREATE TRIGGER review_delegations_no_delete BEFORE DELETE ON review_delegations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS document_dependencies_no_delete ON document_dependencies;
CREATE TRIGGER document_dependencies_no_delete BEFORE DELETE ON document_dependencies FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- Grants: SELECT on all five; column-level INSERT (id, timestamps, decided_at, version, revoke columns and flags come from defaults);
-- UPDATE only on the columns a service legitimately moves. No DELETE anywhere. libetech_ai gets nothing (Z4 is not enabled).
GRANT SELECT ON review_delegations, review_comments, review_decisions, document_dependencies, review_events TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,delegate_id,doc_types,granted_by,basis) ON review_delegations TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,document_id,document_revision_id,parent_id,kind,anchor,body,actor_id,request_id,trace_id) ON review_comments TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,document_id,document_revision_id,revision_no,revision_hash,record_version,result,scope_note,exceptions,authority,delegation_id,decided_by,command_key,request_id,trace_id) ON review_decisions TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,note,confirmed_by) ON document_dependencies TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) ON review_events TO libetech_runtime;
GRANT UPDATE(revoked_at,revoked_by,revoke_basis) ON review_delegations TO libetech_runtime;
GRANT UPDATE(needs_review,flagged_revision_id,flagged_at,version,updated_at) ON document_dependencies TO libetech_runtime;
GRANT UPDATE(approved_revision_id) ON document_records TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES('020') ON CONFLICT(version) DO NOTHING;
COMMIT;
