-- Category <-> Bouquet many-to-many (CategoryBouquet).
-- O schema passou da relação 1:N (categories.bouquetId) para M:N
-- (category_bouquets). Esta migração cria a tabela, copia os dados
-- existentes e remove a coluna antiga.

-- 1) Criar a tabela M:N.
CREATE TABLE "category_bouquets" (
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "bouquetId" TEXT NOT NULL,

    CONSTRAINT "category_bouquets_pkey" PRIMARY KEY ("categoryId","bouquetId")
);

-- 2) Migrar dados existentes (categoria que tinha um bouquet aponta para ele).
INSERT INTO "category_bouquets" ("categoryId", "bouquetId", "sortOrder")
SELECT "id", "bouquetId", "sortOrder"
FROM "categories"
WHERE "bouquetId" IS NOT NULL;

-- 3) FKs.
ALTER TABLE "category_bouquets"
  ADD CONSTRAINT "category_bouquets_categoryId_fkey" FOREIGN KEY ("categoryId")
  REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_bouquets"
  ADD CONSTRAINT "category_bouquets_bouquetId_fkey" FOREIGN KEY ("bouquetId")
  REFERENCES "bouquets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Remover a coluna antiga e sua FK.
ALTER TABLE "categories" DROP CONSTRAINT "categories_bouquetId_fkey";
ALTER TABLE "categories" DROP COLUMN "bouquetId";