import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddedToRemove1672140548750 implements MigrationInterface {
  name = 'AddedToRemove1672140548750';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_media_recommended" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "imdbId" varchar, "tvdbId" varchar, "mediaType" varchar NOT NULL, "fileSize" integer DEFAULT (0), "dateAdded" datetime NOT NULL, "keep" boolean DEFAULT (0), "userId" integer, "toRemove" boolean DEFAULT (0), CONSTRAINT "FK_207911e2f02ce67bec28491c67b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_recommended"("id", "tmdbId", "imdbId", "tvdbId", "mediaType", "fileSize", "dateAdded", "keep", "userId") SELECT "id", "tmdbId", "imdbId", "tvdbId", "mediaType", "fileSize", "dateAdded", "keep", "userId" FROM "media_recommended"`
    );
    await queryRunner.query(`DROP TABLE "media_recommended"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_recommended" RENAME TO "media_recommended"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_recommended" RENAME TO "temporary_media_recommended"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_recommended" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "imdbId" varchar, "tvdbId" varchar, "mediaType" varchar NOT NULL, "fileSize" integer DEFAULT (0), "dateAdded" datetime NOT NULL, "keep" boolean DEFAULT (0), "userId" integer, CONSTRAINT "FK_207911e2f02ce67bec28491c67b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_recommended"("id", "tmdbId", "imdbId", "tvdbId", "mediaType", "fileSize", "dateAdded", "keep", "userId") SELECT "id", "tmdbId", "imdbId", "tvdbId", "mediaType", "fileSize", "dateAdded", "keep", "userId" FROM "temporary_media_recommended"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_recommended"`);
  }
}
