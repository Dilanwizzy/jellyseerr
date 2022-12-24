import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbSearchMovieResponse,
} from '@server/api/themoviedb/interfaces';
import type MediaWatched from '@server/entity/MediaWatched';
import type {
  ItemWeights,
  RecommendRequest,
  Weights,
} from '@server/lib/recommend/interface';
import logger from '@server/logger';

class RecommendMovieRequests {
  private tmdb: TheMovieDb;

  constructor() {
    this.tmdb = new TheMovieDb();
  }

  public async discoverNewMoviesBasedOnWatched(
    mediaWatchedTmdbIds: number[],
    percentage: number,
    totalToRecommend: number,
    movieRecommendRequest: RecommendRequest
  ): Promise<TmdbMovieResult[]> {
    const chosenMovies = await this.discoverNewMovies(
      percentage,
      totalToRecommend,
      movieRecommendRequest,
      mediaWatchedTmdbIds,
      'RECOMMEND'
    );

    if (chosenMovies.length > totalToRecommend * percentage) {
      chosenMovies.sort(() => Math.random() - 0.5);
      return chosenMovies.slice(0, totalToRecommend * percentage);
    }

    return chosenMovies;
  }

  public async discoverNewMoviesBasedOnGenre(
    mediaWatchedTmdbIds: number[],
    percentage: number,
    totalToRecommend: number,
    movieRecommendRequest: RecommendRequest
  ): Promise<TmdbMovieResult[]> {
    const chosenMovies = await this.discoverNewMovies(
      percentage,
      totalToRecommend,
      movieRecommendRequest,
      mediaWatchedTmdbIds,
      'GENRE'
    );

    if (chosenMovies.length > totalToRecommend * percentage) {
      chosenMovies.sort(() => Math.random() - 0.5);
      return chosenMovies.slice(0, totalToRecommend * percentage);
    }

    return chosenMovies;
  }

  public async discoverNewMoviesBasedOnPopularity(
    mediaWatchedTmdbIds: number[],
    percentage: number,
    totalToRecommend: number,
    movieRecommendRequest: RecommendRequest
  ): Promise<TmdbMovieResult[]> {
    const chosenMovies = await this.discoverNewMovies(
      percentage,
      totalToRecommend,
      movieRecommendRequest,
      mediaWatchedTmdbIds,
      'POPULAR'
    );

    if (chosenMovies.length > totalToRecommend * percentage) {
      chosenMovies.sort(() => Math.random() - 0.5);
      return chosenMovies.slice(0, totalToRecommend * percentage);
    }

    return chosenMovies;
  }

  private async discoverNewMovies(
    percentage: number,
    totalToRecommend: number,
    movieRecommendRequest: RecommendRequest,
    userMoviesTmdbIds: number[],
    discoverType: string
  ): Promise<TmdbMovieResult[]> {
    // Discover more movies than what the totalRecommend is
    const totalToDiscover = totalToRecommend * percentage * 1.5;
    const totalOtherPageDiscover = totalToRecommend * percentage * 0.5;
    const chosenMovies: TmdbMovieResult[] = [];

    let currentPage = movieRecommendRequest.page;
    let totalPageCount = 100;
    let totalMoviesPicked = 0;

    while (totalMoviesPicked < totalToDiscover) {
      if (currentPage > totalPageCount) break;

      movieRecommendRequest.page = currentPage;

      const discoverNewMovies: TmdbSearchMovieResponse =
        await this.requestNewMovies(discoverType, movieRecommendRequest);

      totalPageCount = discoverNewMovies.total_pages;
      // Filter already downloaded movies
      const filteredMovies: TmdbSearchMovieResponse = {
        results: discoverNewMovies.results.filter(
          (movie) =>
            !userMoviesTmdbIds.includes(movie.id) &&
            movie.original_language == 'en' &&
            movie.popularity > 5
        ),
        total_pages: totalPageCount,
        page: currentPage,
        total_results: 0,
      };

      if (filteredMovies.results.length > 0) {
        for (let index = 0; index < filteredMovies.results.length; index++) {
          if (totalMoviesPicked < totalToDiscover) {
            const movie = filteredMovies.results[index];
            chosenMovies.push(movie);
            totalMoviesPicked++;
          }
        }
      }

      currentPage++;
    }

    // Disocver other movies that are not in the top result
    // Allows for a bit of varience
    totalMoviesPicked = 0;
    const totalPages = totalPageCount > 50 ? 50 : totalPageCount;
    if (totalPages - currentPage > 0) {
      const ignorePages: number[] = [];
      while (totalMoviesPicked < totalOtherPageDiscover) {
        try {
          const page = await this.selectARandomNumberAndIgnoreSomeNumbers(
            currentPage,
            totalPages,
            ignorePages
          );
          ignorePages.push(page);
          movieRecommendRequest.page = page;

          const discoverNewMovies: TmdbSearchMovieResponse =
            await this.requestNewMovies(discoverType, movieRecommendRequest);

          // Filter already downloaded movies
          const filteredMovies: TmdbSearchMovieResponse = {
            results: discoverNewMovies.results.filter(
              (movie) =>
                !userMoviesTmdbIds.includes(movie.id) &&
                movie.original_language == 'en' &&
                movie.popularity > 5
            ),
            total_pages: totalPages,
            page: currentPage,
            total_results: 0,
          };

          if (filteredMovies.results.length > 0) {
            for (
              let index = 0;
              index < filteredMovies.results.length;
              index++
            ) {
              if (totalMoviesPicked < totalToDiscover) {
                const movie = filteredMovies.results[index];
                chosenMovies.push(movie);
                totalMoviesPicked++;
              }
            }
          }
        } catch (err) {
          break;
        }
      }
    }

    return chosenMovies;
  }

  private async requestNewMovies(
    requestType: string,
    movieRecommendRequest: RecommendRequest
  ): Promise<TmdbSearchMovieResponse> {
    switch (requestType) {
      case 'GENRE':
        return await this.tmdb.getDiscoverMovies({
          page: movieRecommendRequest.page,
          genres: movieRecommendRequest.genreId,
          primaryReleaseDateGte: movieRecommendRequest.minReleaseDate,
          primaryReleaseDateLte: movieRecommendRequest.maxReleaseDate,
          includeAdult: true,
          releaseType: 4,
        });
      case 'POPULAR':
        return await this.tmdb.getMoviePopular({
          page: movieRecommendRequest.page,
        });
      case 'RECOMMEND':
        return await this.tmdb.getMovieRecommendations({
          page: movieRecommendRequest.page,
          movieId: movieRecommendRequest.movieId
            ? movieRecommendRequest.movieId
            : 0,
        });
      default:
        return await this.tmdb.getMoviePopular({
          page: movieRecommendRequest.page,
        });
    }
  }

  private async selectARandomNumberAndIgnoreSomeNumbers(
    min: number,
    max: number,
    ignore: number[]
  ): Promise<number> {
    let randomNumber = Math.floor(Math.random() * (max - min + 1) + min);
    if (ignore.length > 0) {
      let count = 0;
      const stop = 5;
      while (ignore.includes(randomNumber)) {
        randomNumber = Math.floor(Math.random() * (max - min + 1) + min);
        if (count > stop) {
          logger.error('No new numbers to picked from as they are all ignored');
          logger.error('Throwing error to stop an infinite loop');
          throw new Error();
        }
        count++;
      }
    }

    return randomNumber;
  }

  // Scores the genres based on watched and rating. And will then use the most scored genres to recommend movies
  public async weightGenresAndProductionYear(
    mediaWatched: MediaWatched[]
  ): Promise<ItemWeights> {
    const weightedGenreMap = new Map();
    const weightedYearMap = new Map();

    for (let index = 0; index < mediaWatched.length; index++) {
      const movie = mediaWatched[index];
      const genres = movie.genres.split(',');

      for (let genreIndex = 0; genreIndex < genres.length; genreIndex++) {
        const genre = genres[genreIndex];
        const weightedGenre = weightedGenreMap.get(genre);

        if (!weightedGenre) {
          weightedGenreMap.set(
            genre,
            movie.playCount * 0.2 + (movie.rating >= 4 ? 0.5 : 0.1)
          );
        } else {
          weightedGenreMap.set(
            genre,
            weightedGenre +
              movie.playCount * 0.2 +
              (movie.rating >= 4 ? 0.5 : 0.1)
          );
        }
      }

      const weightedYear = weightedYearMap.get(movie.releaseYear);

      if (!weightedYear) {
        weightedYearMap.set(movie.releaseYear, 1);
      } else {
        weightedYearMap.set(movie.releaseYear, weightedYear + 1);
      }
    }

    const weightedGenreList: Weights[] = Array.from(weightedGenreMap).map(
      ([name, score]) => ({
        name,
        score,
      })
    );

    const sortedWeightedGenreList = weightedGenreList.sort(
      (a, b) => b.score - a.score
    );

    const weightedYearList: Weights[] = Array.from(weightedYearMap).map(
      ([name, score]) => ({
        name,
        score,
      })
    );

    const sortedWeightedYearList = weightedYearList.sort(
      (a, b) => b.score - a.score
    );

    const weightedItems: ItemWeights = {
      genre: sortedWeightedGenreList,
      productionYear: sortedWeightedYearList,
    };

    return await this.assignGenreTmdbIdToWeights(weightedItems);
  }

  private async assignGenreTmdbIdToWeights(
    itemWeights: ItemWeights
  ): Promise<ItemWeights> {
    const genreIds = await this.tmdb.getMovieGenres();
    const weightedGenre = itemWeights;

    for (let index = 0; index < weightedGenre.genre.length; index++) {
      const weightGenre = weightedGenre.genre[index];
      for (
        let tmdbiIdGenreIndex = 0;
        tmdbiIdGenreIndex < genreIds.length;
        tmdbiIdGenreIndex++
      ) {
        const genre = genreIds[tmdbiIdGenreIndex];
        if (weightGenre.name == genre.name) {
          weightGenre.tmdbId = genre.id;
        }
      }
      weightedGenre.genre[index] = weightGenre;
    }

    return weightedGenre;
  }
}

export default RecommendMovieRequests;
