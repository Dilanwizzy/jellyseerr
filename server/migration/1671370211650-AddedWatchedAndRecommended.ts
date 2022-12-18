import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedWatchedAndRecommended1671370211650 implements MigrationInterface {
    name = 'AddedWatchedAndRecommended1671370211650'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_media_watched" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "playCount" integer NOT NULL DEFAULT (1), "rating" integer NOT NULL, "lastPlayDate" datetime NOT NULL, "releaseYear" integer, "genres" varchar NOT NULL, "userId" integer, "mediaId" integer, CONSTRAINT "FK_bd71c2aa828f5c381807a0d6318" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5d0b55001697d49695743e804c8" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_media_watched"("id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId") SELECT "id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId" FROM "media_watched"`);
        await queryRunner.query(`DROP TABLE "media_watched"`);
        await queryRunner.query(`ALTER TABLE "temporary_media_watched" RENAME TO "media_watched"`);
        await queryRunner.query(`CREATE TABLE "temporary_media_watched" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "playCount" integer NOT NULL DEFAULT (1), "rating" integer NOT NULL, "lastPlayDate" datetime, "releaseYear" integer, "genres" varchar NOT NULL, "userId" integer, "mediaId" integer, CONSTRAINT "FK_bd71c2aa828f5c381807a0d6318" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5d0b55001697d49695743e804c8" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_media_watched"("id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId") SELECT "id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId" FROM "media_watched"`);
        await queryRunner.query(`DROP TABLE "media_watched"`);
        await queryRunner.query(`ALTER TABLE "temporary_media_watched" RENAME TO "media_watched"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_watched" RENAME TO "temporary_media_watched"`);
        await queryRunner.query(`CREATE TABLE "media_watched" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "playCount" integer NOT NULL DEFAULT (1), "rating" integer NOT NULL, "lastPlayDate" datetime NOT NULL, "releaseYear" integer, "genres" varchar NOT NULL, "userId" integer, "mediaId" integer, CONSTRAINT "FK_bd71c2aa828f5c381807a0d6318" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5d0b55001697d49695743e804c8" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "media_watched"("id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId") SELECT "id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId" FROM "temporary_media_watched"`);
        await queryRunner.query(`DROP TABLE "temporary_media_watched"`);
        await queryRunner.query(`ALTER TABLE "media_watched" RENAME TO "temporary_media_watched"`);
        await queryRunner.query(`CREATE TABLE "media_watched" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "playCount" integer NOT NULL DEFAULT (1), "rating" integer NOT NULL, "lastPlayDate" datetime NOT NULL, "releaseYear" integer, "genres" varchar NOT NULL, "userId" integer, "mediaId" integer, CONSTRAINT "FK_bd71c2aa828f5c381807a0d6318" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5d0b55001697d49695743e804c8" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "media_watched"("id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId") SELECT "id", "playCount", "rating", "lastPlayDate", "releaseYear", "genres", "userId", "mediaId" FROM "temporary_media_watched"`);
        await queryRunner.query(`DROP TABLE "temporary_media_watched"`);
    }

}
