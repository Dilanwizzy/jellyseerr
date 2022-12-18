import TheMovieDb from '@server/api/themoviedb';
import type { TmdbMovieResult } from '@server/api/themoviedb/interfaces';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRecommended from '@server/entity/MediaRecommended';
import MediaWatched from '@server/entity/MediaWatched';
import { User } from '@server/entity/User';
import RecommendMovie from '@server/lib/recommend/movies';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

class Recommend {
  mediaWatchedRepository = getRepository(MediaWatched);
  mediaRecommendedRepository = getRepository(MediaRecommended);
  mediaRespository = getRepository(Media);

  private moviesRecommendation: RecommendMovie;
  private tmdb: TheMovieDb;

  constructor() {
    this.moviesRecommendation = new RecommendMovie();
    this.tmdb = new TheMovieDb();
  }

  public async recommendMovie(): Promise<void> {
    await this.mediaRecommendedRepository.delete({ keep: false });

    const mediaWatched: [MediaWatched[], number] =
      await this.mediaWatchedRepository
        .createQueryBuilder('mediawatched')
        .leftJoinAndSelect('mediawatched.media', 'media')
        .where('mediawatched.playCount > 0')
        .getManyAndCount();

    const allMedia = await this.mediaRespository.find();

    const settings = getSettings();
    const mediaDownloaded = allMedia.map((media) => media.tmdbId);

    const weightedGenres =
      await this.moviesRecommendation.weightGenresAndProductionYear(
        mediaWatched[0]
      );

    const totalWeightForTop3Genre = weightedGenres.genre
      .slice(0, 3)
      .reduce((total, genre) => total + genre.score, 0);

    logger.info(`TOTAL ${totalWeightForTop3Genre}`);

    let chosenMovies: TmdbMovieResult[] = [];

    for (let index = 0; index < weightedGenres.genre.length; index++) {
      if (index == 3) break;
      const pickedGenre = weightedGenres.genre[index];
      const percentage = pickedGenre.score / totalWeightForTop3Genre;
      logger.info(
        `picked ${JSON.stringify(pickedGenre.tmdbId)} ${percentage} Recommend ${
          settings.main.movieRecommend.totalToRecommend *
          settings.main.movieRecommend.discoverBasedOnWatchedPercentage
        }`
      );

      const moviesBasedOnWatched =
        await this.moviesRecommendation.discoverNewMoviesBasedOnWatched(
          mediaDownloaded,
          percentage,
          settings.main.movieRecommend.totalToRecommend *
            settings.main.movieRecommend.discoverBasedOnWatchedPercentage,
          {
            page: 1,
            genreId: [pickedGenre.tmdbId ? pickedGenre.tmdbId : 0],
          }
        );

      logger.info(`TOTTAL ${moviesBasedOnWatched.length}`);

      chosenMovies = chosenMovies.concat(moviesBasedOnWatched);

      for (let index = 0; index < chosenMovies.length; index++) {
        const movie = chosenMovies[index];
        mediaDownloaded.push(movie.id);
      }
    }

    logger.info(`${chosenMovies.length}`);

    // // const chosenMovies: TmdbMovieResult[] = moviesBasedOnWatched;
    // for (let index = 0; index < chosenMovies.length; index++) {
    //   const movie = chosenMovies[index];
    //   mediaDownloaded.push(movie.id);
    // }

    const moviesBasedOnPopularity =
      await this.moviesRecommendation.discoverNewMoviesBasedOnPopularity(
        mediaDownloaded,
        settings.main.movieRecommend.discoverBasedOnPopularityPercentage,
        settings.main.movieRecommend.totalToRecommend,
        {
          page: 1,
          genreId: weightedGenres.genre.map((genre) =>
            genre.tmdbId ? genre.tmdbId : 0
          ),
        }
      );

    logger.info(`POPULAR ${moviesBasedOnPopularity.length}`);

    chosenMovies = chosenMovies.concat(moviesBasedOnPopularity);

    for (let index = 0; index < chosenMovies.length; index++) {
      const movie = chosenMovies[index];
      const alreadyRecommended = await this.mediaRecommendedRepository.findOne({
        where: { tmdbId: movie.id },
      });

      if (alreadyRecommended) {
        logger.info(`Skipping ${movie.title} already recommended`);
      } else {
        const recommend: MediaRecommended = new MediaRecommended();
        const imdbId = await this.tmdb.getExternalIds({
          id: movie.id,
          language: 'en',
        });
        const user = new User();
        user.id = 1;

        recommend.tmdbId = movie.id;
        recommend.imdbId = imdbId.imdb_id;
        recommend.dateAdded = new Date();
        recommend.mediaType = 'MOVIE';
        recommend.user = user;
        this.mediaRecommendedRepository.save(recommend);

        logger.info(`Added ${movie.title} to recommended`);
      }
    }

    logger.info(`Recommended Movies ${chosenMovies.length}`);
  }
}

export const recommend = new Recommend();

export default Recommend;
