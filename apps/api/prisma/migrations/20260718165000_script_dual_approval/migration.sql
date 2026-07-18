ALTER TABLE "script_library"
  ADD COLUMN "requires_dual_approval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "second_approved_by_id" UUID,
  ADD COLUMN "second_approved_at" TIMESTAMP(3);

COMMENT ON COLUMN "script_library"."requires_dual_approval"
  IS 'High-risk scripts require approvals by two distinct admins; authors cannot approve.';
