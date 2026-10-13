-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "feedback_at" TIMESTAMP(3),
ADD COLUMN     "feedback_note" TEXT,
ADD COLUMN     "feedback_rating" INTEGER;
