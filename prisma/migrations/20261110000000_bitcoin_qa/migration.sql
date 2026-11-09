CREATE TYPE "BitcoinQuestionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

CREATE TABLE "BitcoinQuestion" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "body" TEXT NOT NULL,
  "authorName" VARCHAR(60) NOT NULL,
  "authorHash" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "BitcoinQuestionStatus" NOT NULL DEFAULT 'PENDING',
  "score" INTEGER NOT NULL DEFAULT 0,
  "answerCount" INTEGER NOT NULL DEFAULT 0,
  "views" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BitcoinQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BitcoinQuestion_status_createdAt_idx" ON "BitcoinQuestion"("status","createdAt");
CREATE INDEX "BitcoinQuestion_status_score_idx" ON "BitcoinQuestion"("status","score");

CREATE TABLE "BitcoinAnswer" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorName" VARCHAR(60) NOT NULL,
  "authorHash" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "isAccepted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BitcoinAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BitcoinAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BitcoinQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BitcoinAnswer_questionId_score_idx" ON "BitcoinAnswer"("questionId","score");

CREATE TABLE "BitcoinVote" (
  "id" TEXT NOT NULL,
  "questionId" TEXT,
  "answerId" TEXT,
  "voterHash" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BitcoinVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BitcoinVote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BitcoinQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BitcoinVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "BitcoinAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BitcoinVote_one_target_check" CHECK (("questionId" IS NOT NULL)::int + ("answerId" IS NOT NULL)::int = 1),
  CONSTRAINT "BitcoinVote_value_check" CHECK ("value" IN (-1, 1))
);
CREATE UNIQUE INDEX "BitcoinVote_questionId_voterHash_key" ON "BitcoinVote"("questionId","voterHash");
CREATE UNIQUE INDEX "BitcoinVote_answerId_voterHash_key" ON "BitcoinVote"("answerId","voterHash");
CREATE INDEX "BitcoinVote_voterHash_createdAt_idx" ON "BitcoinVote"("voterHash","createdAt");
