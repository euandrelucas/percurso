-- CreateTable
CREATE TABLE "voice_previews" (
    "voice" TEXT NOT NULL,
    "phrase_sha" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_previews_pkey" PRIMARY KEY ("voice")
);
