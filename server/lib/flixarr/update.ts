import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRecommended from '@server/entity/MediaRecommended';
import { User } from '@server/entity/User';
import type { DVRSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { randomUUID as uuid } from 'crypto';

const UPDATE_RATE = 2 * 1000;

interface DownloadStatus {
  running: boolean;
  progress: number;
  total: number;
}

class FlixarrUpdate {
  private running = false;
  private progress = 0;
  private sessionId: string;
  private items: MediaRecommended[] = [];
  private recommendedSize = 0;
  private user: User;
  private radarrApi: RadarrAPI;
  private sonarrApi: SonarrAPI;
  private movieIsEnabled = false;
  private seriesIsEnabled = false;

  private log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, { label: 'Flixarr Updater', ...optional });
  }

  private async findServiceProfile(
    servicdId: number,
    type: string
  ): Promise<DVRSettings | undefined> {
    let serviceSetting;
    let chosenService;

    if (type === 'Radarr') {
      serviceSetting = getSettings().radarr;
    } else if (type === 'Sonarr') {
      serviceSetting = getSettings().sonarr;
    } else {
      throw new Error(
        'Did not provide the correct service type - choices - "Sonarr" "Radarr"'
      );
    }

    serviceSetting.forEach((service) => {
      if (service.id == servicdId) {
        chosenService = service;
      }
    });

    return chosenService;
  }

  private async processDeletion(mediaRecommended: MediaRecommended) {
    const mediaRepository = getRepository(Media);
    const mediaRecommendedRepository = getRepository(MediaRecommended);

    if (mediaRecommended.mediaType == 'MOVIE' && this.movieIsEnabled) {
      await mediaRepository.delete({ tmdbId: mediaRecommended.tmdbId });
      await mediaRecommendedRepository.delete(mediaRecommended.id);

      const radarrMovie = await this.radarrApi.getMovieByTmdbId(
        mediaRecommended.tmdbId
      );

      if (radarrMovie.id) {
        const radarrQueueItems = await this.radarrApi.getQueue();
        radarrQueueItems.forEach(async (queueItem) => {
          if (queueItem.movieId == radarrMovie.id) {
            await this.radarrApi.deleteMovieFromDownloadQueue(queueItem.id);
          }
        });

        await this.radarrApi.deleteMovieById(radarrMovie.id);
      }
    } else if (mediaRecommended.mediaType == 'SERIES' && this.movieIsEnabled) {
      await mediaRepository.delete({ tvdbId: mediaRecommended.tvdbId });
      await mediaRecommendedRepository.delete(mediaRecommended.id);

      // const sonarrSeries = await this.sonarrApi.getSeriesByTvdbId(
      //   mediaRecommended.tvdbId
      // );
      //Delete
    }
  }

  private async updateFileSize(mediaRecommended: MediaRecommended) {
    const mediaRecommendedRepository = getRepository(MediaRecommended);

    if (mediaRecommended.mediaType === 'MOVIE' && this.movieIsEnabled) {
      const movie = await this.radarrApi.getMovieByTmdbId(
        mediaRecommended.tmdbId
      );

      if (movie.hasFile) {
        mediaRecommended.fileSize =
          Math.round(
            (movie.sizeOnDisk / (1024 * 1024 * 1024) + Number.EPSILON) * 100
          ) / 100;
      }
    } else if (
      mediaRecommended.mediaType === 'SERIES' &&
      this.seriesIsEnabled
    ) {
      // const series = await this.sonarrApi.getSeriesByTvdbId(
      //   mediaRecommended.tvdbId
      // );
      // update size
    }

    mediaRecommendedRepository.save(mediaRecommended);
  }

  private async processItems(slicedItems: MediaRecommended[]) {
    await Promise.resolve(
      slicedItems.map(async (item) => {
        if (item.toRemove) {
          await this.processDeletion(item);
        } else if (!item.toRemove) {
          await this.updateFileSize(item);
        }
      })
    );
  }

  private async loop({
    start = 0,
    end = 1,
    sessionId,
  }: {
    start?: number;
    end?: number;
    sessionId?: string;
  } = {}) {
    const slicedItems = this.items.slice(start, end);

    if (!this.running) {
      throw new Error('Updater was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    if (start < this.items.length) {
      this.progress = start;
      await this.processItems(slicedItems);

      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          this.loop({
            start: start + 1,
            end: end + 1,
            sessionId,
          })
            .then(() => resolve())
            .catch((e) => reject(new Error(e.message)));
        }, UPDATE_RATE)
      );
    }
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const userRespository = getRepository(User);
    const user = await userRespository.findOne({ where: { id: 1 } });
    this.user = user ? user : new User();

    if (this.user.id == null || this.user.id == undefined) {
      return this.log(`Admin user does not exist`, 'info');
    }

    const sessionId = uuid();
    this.sessionId = sessionId;
    logger.info('Flixarr Auto Updater', {
      sessionId,
      label: 'Flixarr Updater',
    });

    if (
      !settings.flixarr.movieRecommend.enabled &&
      !settings.flixarr.tvRecommend.enabled
    ) {
      return;
    }

    try {
      this.running = true;
      const mediaRecommendedRepository = getRepository(MediaRecommended);

      const media = await mediaRecommendedRepository.find();

      if (!media) {
        return this.log('No recommendations', 'warn');
      }

      this.items = media;

      if (settings.flixarr.movieRecommend.enabled) {
        const radarrProfile = await this.findServiceProfile(
          settings.flixarr.movieRecommend.serviceId,
          'Radarr'
        );
        if (radarrProfile) {
          this.radarrApi = new RadarrAPI({
            apiKey: radarrProfile?.apiKey,
            url: RadarrAPI.buildUrl(radarrProfile, '/api/v3'),
          });
          this.movieIsEnabled = true;
        }
      }

      if (settings.flixarr.tvRecommend.enabled) {
        const sonarrProfile = await this.findServiceProfile(
          settings.flixarr.tvRecommend.serviceId,
          'Sonarr'
        );
        if (sonarrProfile) {
          this.sonarrApi = new SonarrAPI({
            apiKey: sonarrProfile?.apiKey,
            url: SonarrAPI.buildUrl(sonarrProfile, '/api/v3'),
          });
          this.seriesIsEnabled = true;
        }
      }

      await this.loop({ sessionId });

      this.log('Flixarr Auto Updater Complete', 'info');
    } catch (e) {
      logger.error('Updater interrupted', {
        label: 'Flixarr Updater',
        errorMessage: e.message,
      });
    } finally {
      // If a new scanning session hasnt started, set running back to false
      if (this.sessionId === sessionId) {
        this.running = false;
      }
    }
  }

  public status(): DownloadStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
    };
  }

  public cancel(): void {
    this.running = false;
  }
}

export const flixarrUpdate = new FlixarrUpdate();
