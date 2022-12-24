import TheMovieDb from '@server/api/themoviedb';
import type { TmdbMovieResult } from '@server/api/themoviedb/interfaces';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRecommended from '@server/entity/MediaRecommended';
import MediaWatched from '@server/entity/MediaWatched';
import { User } from '@server/entity/User';
import type { ItemWeights } from '@server/lib/recommend/interface';
import RecommendMovieRequests from '@server/lib/recommend/movies/requests';
import type { RecommendedSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

class RecommendMovie {
  mediaWatchedRepository = getRepository(MediaWatched);
  mediaRecommendedRepository = getRepository(MediaRecommended);
  mediaRespository = getRepository(Media);

  private moviesRecommendation: RecommendMovieRequests;
  private tmdb: TheMovieDb;

  constructor() {
    this.moviesRecommendation = new RecommendMovieRequests();
    this.tmdb = new TheMovieDb();
  }

  private async recommendBasedOnPopularity(
    mediaDownloaded: number[],
    chosenMoviesToRecommend: TmdbMovieResult[],
    movieRecommend: RecommendedSettings,
    weightedGenres: ItemWeights
  ): Promise<TmdbMovieResult[]> {
    logger.debug(
      `Recommend Movies Based Popularity - Total To Recommend ${
        movieRecommend.totalToRecommend *
        movieRecommend.discoverBasedOnPopularityPercentage
      }`
    );
    const moviesBasedOnPopularity =
      await this.moviesRecommendation.discoverNewMoviesBasedOnPopularity(
        mediaDownloaded,
        movieRecommend.discoverBasedOnPopularityPercentage,
        movieRecommend.totalToRecommend,
        {
          page: 1,
          genreId: weightedGenres.genre.map((genre) =>
            genre.tmdbId ? genre.tmdbId : 0
          ),
        }
      );

    logger.debug(`Total Recommended ${moviesBasedOnPopularity.length}`);

    return chosenMoviesToRecommend.concat(moviesBasedOnPopularity);
  }

  private async recommendBasedOnGenre(
    mediaDownloaded: number[],
    mediaWatched: MediaWatched[],
    chosenMoviesToRecommend: TmdbMovieResult[],
    movieRecommend: RecommendedSettings,
    weightedGenres: ItemWeights
  ): Promise<TmdbMovieResult[]> {
    logger.debug(
      `Recommend Movies Based Genre - Total To Recommend ${
        movieRecommend.totalToRecommend *
        movieRecommend.discoverBasedOnGenrePercentage
      }`
    );
    const totalWeightForTop3Genre = weightedGenres.genre
      .slice(0, 3)
      .reduce((total, genre) => total + genre.score, 0);

    const initalValue = chosenMoviesToRecommend.length;

    for (let index = 0; index < weightedGenres.genre.length; index++) {
      if (index == 3) break;
      const pickedGenre = weightedGenres.genre[index];
      const percentage = pickedGenre.score / totalWeightForTop3Genre;

      const moviesBasedOnGenre =
        await this.moviesRecommendation.discoverNewMoviesBasedOnGenre(
          mediaDownloaded,
          percentage,
          movieRecommend.totalToRecommend *
            movieRecommend.discoverBasedOnGenrePercentage,
          {
            page: 1,
            genreId: [pickedGenre.tmdbId ? pickedGenre.tmdbId : 0],
          }
        );

      chosenMoviesToRecommend =
        chosenMoviesToRecommend.concat(moviesBasedOnGenre);
      logger.info(`test ${chosenMoviesToRecommend.length}`);

      for (let index = 0; index < chosenMoviesToRecommend.length; index++) {
        const movie = chosenMoviesToRecommend[index];
        mediaDownloaded.push(movie.id);
      }
    }

    logger.debug(
      `Total Recommended ${chosenMoviesToRecommend.length - initalValue}`
    );

    return chosenMoviesToRecommend;
  }

  // 100
  // watched is 60%
  // popular is 20%
  // genre is 20%

  // 120 /
  //

  private async recommendBasedOnWatched(
    mediaDownloaded: number[],
    mediaWatched: MediaWatched[],
    chosenMoviesToRecommend: TmdbMovieResult[],
    movieRecommend: RecommendedSettings
  ): Promise<TmdbMovieResult[]> {
    const currentDate = new Date();
    const aFewMontAgo = new Date(
      currentDate.setMonth(currentDate.getMonth() - 1)
    );
    const mediaWatchedWithinLastFewMonths = mediaWatched.filter(
      (media) => media.lastPlayDate >= aFewMontAgo
    );
    const loopThroughMovieIds = async (mediaToRecommend: MediaWatched[]) => {
      const splitPercentage = 1 / mediaToRecommend.length;
      const totalToDownload =
        movieRecommend.totalToRecommend *
        movieRecommend.discoverBasedOnWatchedPercentage;

      for (let index = 0; index < mediaToRecommend.length; index++) {
        const pickedMovie = mediaToRecommend[index];
        const moviesBasedOnWatched =
          await this.moviesRecommendation.discoverNewMoviesBasedOnWatched(
            mediaDownloaded,
            splitPercentage,
            totalToDownload,
            {
              page: 1,
              genreId: [0],
              movieId: pickedMovie.media.tmdbId,
            }
          );

        chosenMoviesToRecommend =
          chosenMoviesToRecommend.concat(moviesBasedOnWatched);

        for (let index = 0; index < chosenMoviesToRecommend.length; index++) {
          const movie = chosenMoviesToRecommend[index];
          mediaDownloaded.push(movie.id);
        }
      }
    };

    if (mediaWatchedWithinLastFewMonths.length <= 5) {
      await loopThroughMovieIds(mediaWatchedWithinLastFewMonths);
    } else {
      const result: MediaWatched[] = [];
      let pickCount = 5;

      const highestRatingItems = mediaWatchedWithinLastFewMonths.filter(
        (media) => media.rating >= 4
      );
      if (highestRatingItems.length <= 2) {
        result.push(...highestRatingItems);
        pickCount = -highestRatingItems.length;
      } else {
        highestRatingItems.sort(() => Math.random() - 0.5);
        result.push(...highestRatingItems.slice(0, 2));
      }

      logger.info(`HIGHEST ${result.length}`);

      const highestPlayCountItems = mediaWatchedWithinLastFewMonths.filter(
        (media) => media.playCount >= 1 && !result.includes(media)
      );
      if (highestPlayCountItems.length <= 2) {
        result.push(...highestPlayCountItems);
        pickCount = -highestPlayCountItems.length;
      } else {
        highestPlayCountItems.sort((a, b) => b.playCount - a.playCount);
        result.push(...highestPlayCountItems.slice(0, pickCount - 2));
      }

      pickCount = -highestPlayCountItems.length;

      const remainingMedia = mediaWatchedWithinLastFewMonths.filter(
        (media) => !result.includes(media)
      );
      remainingMedia.sort(() => Math.random() - 0.5);

      result.push(...remainingMedia.slice(0, pickCount));

      logger.info(`result size ${result.length}`);

      await loopThroughMovieIds(result);
    }

    return chosenMoviesToRecommend;
  }

  public async recommend(): Promise<void> {
    const settings = getSettings();

    // Delete already recommended movies
    await this.mediaRecommendedRepository.delete({ keep: false });

    // Media user already watched
    const mediaWatched: [MediaWatched[], number] =
      await this.mediaWatchedRepository
        .createQueryBuilder('mediawatched')
        .leftJoinAndSelect('mediawatched.media', 'media')
        .where('mediawatched.playCount > 0')
        .orderBy('mediawatched.lastPlayDate', 'DESC')
        .getManyAndCount();

    // All
    const userMediaInLibrary = await this.mediaRespository.find();
    const usersMediaTmbdbId = userMediaInLibrary.map((media) => media.tmdbId);

    // Weight genres based on what the user has watched and favourited.
    const weightedGenres =
      await this.moviesRecommendation.weightGenresAndProductionYear(
        mediaWatched[0]
      );

    let chosenMoviesToRecommend: TmdbMovieResult[] = [];

    chosenMoviesToRecommend = await this.recommendBasedOnGenre(
      usersMediaTmbdbId,
      mediaWatched[0],
      chosenMoviesToRecommend,
      settings.flixarr.movieRecommend,
      weightedGenres
    );

    chosenMoviesToRecommend = await this.recommendBasedOnPopularity(
      usersMediaTmbdbId,
      chosenMoviesToRecommend,
      settings.flixarr.movieRecommend,
      weightedGenres
    );

    chosenMoviesToRecommend = await this.recommendBasedOnWatched(
      usersMediaTmbdbId,
      mediaWatched[0],
      chosenMoviesToRecommend,
      settings.flixarr.movieRecommend
    );

    logger.info(`length ${chosenMoviesToRecommend.length}`);

    for (let index = 0; index < chosenMoviesToRecommend.length; index++) {
      const movie = chosenMoviesToRecommend[index];
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

    logger.info(`COMPLETED - Recommended : ${chosenMoviesToRecommend.length}`);
  }
}

export const recommend = new RecommendMovie();

export default RecommendMovie;
