-- AlterTable
ALTER TABLE "agent_settings" ADD COLUMN     "agent_gender" TEXT NOT NULL DEFAULT 'f',
ADD COLUMN     "patient_gender" TEXT NOT NULL DEFAULT 'n';

-- Agentes já existentes: deduz o gênero pela voz que o paciente escolheu (cedar, ash e verse eram as vozes masculinas).
UPDATE "agent_settings" SET "agent_gender" = CASE WHEN "voice" IN ('cedar', 'ash', 'verse') THEN 'm' ELSE 'f' END;
