import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class MediaWatched {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, (user) => user.mediaWatched, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public user: User;

  @ManyToOne(() => Media, (media) => media.mediaWatched, {
    eager: true,
    onDelete: 'CASCADE',
  })
  public media: Media;

  @Column({ type: 'int', default: 1 })
  public playCount: number;

  @Column()
  public rating: number;

  @Column({ type: 'datetime', nullable: true })
  public lastPlayDate: Date;

  @Column({ nullable: true })
  public releaseYear: number;

  @Column()
  public genres: string;
}

export default MediaWatched;
