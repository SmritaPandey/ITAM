-- Persist first-boot install identity and air-gap activation challenge state.
ALTER TABLE "instance_entitlements"
  ALTER COLUMN "payload" DROP NOT NULL,
  ALTER COLUMN "signed_blob" DROP NOT NULL,
  ALTER COLUMN "activated_at" DROP NOT NULL,
  ALTER COLUMN "activated_at" DROP DEFAULT,
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ADD COLUMN "challenge_nonce" TEXT,
  ADD COLUMN "challenge_expires_at" TIMESTAMP(3),
  ADD COLUMN "activation_mode" TEXT,
  ADD COLUMN "last_validated_at" TIMESTAMP(3);
