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
        .orderBy('mediawatched.lastPlayDate', 'DESC')
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

      const moviesBasedOnGenre =
        await this.moviesRecommendation.discoverNewMoviesBasedOnGenre(
          mediaDownloaded,
          percentage,
          settings.flixarr.movieRecommend.totalToRecommend *
            settings.flixarr.movieRecommend.discoverBasedOnGenrePercentage,
          {
            page: 1,
            genreId: [pickedGenre.tmdbId ? pickedGenre.tmdbId : 0],
          }
        );

      chosenMovies = chosenMovies.concat(moviesBasedOnGenre);

      for (let index = 0; index < chosenMovies.length; index++) {
        const movie = chosenMovies[index];
        mediaDownloaded.push(movie.id);
      }
    }

    logger.info(`BASED ON GENRE ${chosenMovies.length}`);

    // // const chosenMovies: TmdbMovieResult[] = moviesBasedOnWatched;
    // for (let index = 0; index < chosenMovies.length; index++) {
    //   const movie = chosenMovies[index];
    //   mediaDownloaded.push(movie.id);
    // }

    const moviesBasedOnPopularity =
      await this.moviesRecommendation.discoverNewMoviesBasedOnPopularity(
        mediaDownloaded,
        settings.flixarr.movieRecommend.discoverBasedOnPopularityPercentage,
        settings.flixarr.movieRecommend.totalToRecommend,
        {
          page: 1,
          genreId: weightedGenres.genre.map((genre) =>
            genre.tmdbId ? genre.tmdbId : 0
          ),
        }
      );

    logger.info(`BASED ON POPULARITY ${moviesBasedOnPopularity.length}`);

    chosenMovies = chosenMovies.concat(moviesBasedOnPopularity);

    //Movie Based on watched
    //Start
    const currentDate = new Date();
    const aFewMontAgo = new Date(
      currentDate.setMonth(currentDate.getMonth() - 1)
    );
    const mediaWatchedWithinLastFewMonths = mediaWatched[0].filter(
      (media) => media.lastPlayDate >= aFewMontAgo
    );
    const loopThroughMovieIds = async (mediaToRecommend: MediaWatched[]) => {
      const splitPercentage = 1 / mediaToRecommend.length;
      const totalToDownload =
        settings.flixarr.movieRecommend.totalToRecommend *
        settings.flixarr.movieRecommend.discoverBasedOnWatchedPercentage;

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

        chosenMovies = chosenMovies.concat(moviesBasedOnWatched);

        for (let index = 0; index < chosenMovies.length; index++) {
          const movie = chosenMovies[index];
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

    /// END

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
