-- DropForeignKey
ALTER TABLE "tariffe" DROP CONSTRAINT "tariffe_dittaId_fkey";

-- DropForeignKey
ALTER TABLE "tariffe" DROP CONSTRAINT "tariffe_figuraProfessionaleId_fkey";

-- AlterTable
ALTER TABLE "ditte" ADD COLUMN     "tariffe" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "tariffe";
