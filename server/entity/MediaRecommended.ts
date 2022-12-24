import { User } from '@server/entity/User';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class MediaRecommended {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, (user) => user.mediaRecommended, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public user: User;

  @Column({ type: 'int' })
  public tmdbId: number;

  @Column({ nullable: true })
  public imdbId?: string;

  @Column({ nullable: true })
  public tvdbId?: string;

  @Column({ nullable: false })
  public mediaType: 'MOVIE' | 'SERIES';

  @Column({ default: 0, nullable: true })
  public fileSize?: number;

  @Column({ type: 'datetime', nullable: false })
  public dateAdded: Date;

  @Column({ default: false, nullable: true })
  public keep?: boolean;

  constructor(init?: Partial<MediaRecommended>) {
    Object.assign(this, init);
  }
}

export default MediaRecommended;
