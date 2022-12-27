import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRecommended from '@server/entity/MediaRecommended';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import type { MediaRequestBody } from '@server/interfaces/api/requestInterfaces';
import type { DVRSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { randomUUID as uuid } from 'crypto';

const UPDATE_RATE = 35 * 1000;
const SLEEP_TIME = 10 * 1000;
const CHECK_QUEUE_LIMIT = 3;

interface DownloadStatus {
  running: boolean;
  progress: number;
  total: number;
}

class FlixarrAutoDownload {
  private running = false;
  private progress = 0;
  private sessionId: string;
  private items: MediaRecommended[] = [];
  private recommendedSize = 0;
  private totalSize = 0;
  private totalSizeLimit = 0;
  private serviceProfile: DVRSettings | undefined;
  private user: User;
  private radarrApi: RadarrAPI;
  private sonarrApi: SonarrAPI;

  private async setTotalSizeLimit(maxQuota: string) {
    if (maxQuota.split('GB').length > 0) {
      this.totalSizeLimit = parseInt(maxQuota.split('GB')[0]);
    } else if (maxQuota.split('TB').length > 0) {
      this.totalSizeLimit = parseInt(maxQuota.split('TB')[0]) * 1024;
    } else {
      this.totalSizeLimit = 0;
    }
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

  private async setCurrentTotalSize(medias: MediaRecommended[]) {
    await Promise.all(
      medias.map(async (media) => {
        this.totalSize += media.fileSize ? media.fileSize : 0;
      })
    );
  }

  private async processMovie(mediaRecommended: MediaRecommended) {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const mediaRecommendedRepository = getRepository(MediaRecommended);

    const mediaRequestBody: MediaRequestBody = {
      mediaId: mediaRecommended.tmdbId,
      mediaType: MediaType.MOVIE,
      serverId: this.serviceProfile?.id,
      profileId: this.serviceProfile?.activeProfileId,
      rootFolder: this.serviceProfile?.activeDirectory,
      userId: this.user.id,
      tags: this.serviceProfile?.tags,
      is4k: this.serviceProfile?.is4k,
    };

    // Send a request
    const request = await MediaRequest.request(mediaRequestBody, this.user);

    let count = 0;
    let isMovieDownloading = false;

    while (count < CHECK_QUEUE_LIMIT) {
      this.log(`${mediaRecommended.tmdbId} : Waiting`);
      const radarrMovie = await this.radarrApi.getMovieByTmdbId(
        mediaRecommended.tmdbId
      );
      const radarrQueueItems = await this.radarrApi.getQueue();
      radarrQueueItems.forEach(async (queueItem) => {
        if (queueItem.movieId == radarrMovie.id) {
          const sizeInGB =
            Math.round(
              (queueItem.size / (1024 * 1024 * 1024) + Number.EPSILON) * 100
            ) / 100;
          isMovieDownloading = true;
          mediaRecommended.fileSize = sizeInGB;
          this.totalSize += sizeInGB;
        }
      });

      if (isMovieDownloading) {
        break;
      }

      await this.sleep(SLEEP_TIME);
      count++;
    }

    if (!isMovieDownloading) {
      this.log(
        `Movie : ${mediaRecommended.tmdbId} failed to download : Removing from Request and Radarr`,
        'info'
      );
      await requestRepository.delete(request.id);
      await mediaRepository.delete(request.media.id);

      const radarrMovie = await this.radarrApi.getMovieByTmdbId(
        mediaRecommended.tmdbId
      );

      if (
        request.media.externalServiceId &&
        this.serviceProfile?.activeProfileId
      ) {
        if (
          radarrMovie.monitored &&
          radarrMovie.qualityProfileId == this.serviceProfile.activeProfileId
        ) {
          await this.radarrApi.deleteMovieById(request.media.externalServiceId);
        }
      }

      return;
    }

    await mediaRecommendedRepository.save(mediaRecommended);
    this.log(`Successfully added movie ${mediaRecommended.tmdbId}`);
  }

  private async processShow(mediaRecommended: MediaRecommended) {
    this.log(`MEDIA ${mediaRecommended.imdbId}`);
  }

  private async processItems(slicedItems: MediaRecommended[]) {
    await Promise.resolve(
      slicedItems.map(async (item) => {
        if (item.mediaType === 'MOVIE') {
          await this.processMovie(item);
        } else if (item.mediaType === 'SERIES') {
          await this.processShow(item);
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
      throw new Error('Downloader was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    this.log(`START ${start} END ${end}`);

    if (
      start < this.recommendedSize &&
      (this.totalSize <= this.totalSizeLimit || this.totalSizeLimit == 0)
    ) {
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

  private log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, { label: 'Flixarr Downloader', ...optional });
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const userRespository = getRepository(User);
    const user = await userRespository.findOne({ where: { id: 1 } });
    this.user = user ? user : new User();

    if (this.user.id == null || this.user.id == undefined) {
      return this.log(`Admin user does not exist`, 'info');
    }

    if (
      !settings.flixarr.movieRecommend.enabled &&
      !settings.flixarr.tvRecommend.enabled
    ) {
      return;
    }

    const sessionId = uuid();
    this.sessionId = sessionId;
    logger.info('Flixarr Auto Download', {
      sessionId,
      label: 'Flixarr Downloader',
    });

    this.recommendedSize = 0;
    try {
      this.running = true;
      const mediaRecommendedRepository = getRepository(MediaRecommended);

      if (settings.flixarr.movieRecommend.enabled) {
        this.serviceProfile = await this.findServiceProfile(
          settings.flixarr.movieRecommend.serviceId,
          'Radarr'
        );

        if (!this.serviceProfile) {
          return this.log('No Radarr Profile Provided', 'warn');
        }

        const media = await mediaRecommendedRepository.find({
          where: { mediaType: 'MOVIE', toRemove: false, keep: false },
        });

        if (!media) {
          return this.log('No movies have been recommended', 'warn');
        }

        this.items = media;
        this.recommendedSize = settings.flixarr.movieRecommend.totalToRecommend;
        await this.setTotalSizeLimit(settings.flixarr.movieRecommend.maxQuota);
        await this.setCurrentTotalSize(media);
        this.radarrApi = new RadarrAPI({
          apiKey: this.serviceProfile.apiKey,
          url: RadarrAPI.buildUrl(this.serviceProfile, '/api/v3'),
        });

        if (this.totalSize >= this.totalSizeLimit) {
          return this.log(
            `Total Media Size ${this.totalSize} exceeds size limit ${this.totalSizeLimit} - Not going to run`,
            'info'
          );
        }

        this.log(
          `total Size : ${this.totalSize} size limit : ${this.totalSizeLimit}`
        );

        this.log(`Start`);

        await this.loop({ sessionId });
      }

      if (settings.flixarr.tvRecommend.enabled) {
        this.serviceProfile = await this.findServiceProfile(
          settings.flixarr.tvRecommend.serviceId,
          'Sonarr'
        );

        if (!this.serviceProfile) {
          return this.log('No Sonarr Profile Provided', 'warn');
        }

        const media = await mediaRecommendedRepository.find({
          where: { mediaType: 'SERIES', toRemove: false, keep: false },
        });

        if (!media) {
          return this.log('No series have been recommended', 'warn');
        }

        this.items = media;
        this.recommendedSize = settings.flixarr.movieRecommend.totalToRecommend;
        await this.setTotalSizeLimit(settings.flixarr.movieRecommend.maxQuota);
        await this.setCurrentTotalSize(media);
        this.sonarrApi = new SonarrAPI({
          apiKey: this.serviceProfile.apiKey,
          url: RadarrAPI.buildUrl(this.serviceProfile, '/api/v3'),
        });

        if (this.totalSize >= this.totalSizeLimit) {
          return this.log(
            `Total Media Size ${this.totalSize} exceeds size limit ${this.totalSizeLimit} - Not going to run`,
            'info'
          );
        }

        await this.loop({ sessionId });
      }

      this.log('Flixarr Auto Download Complete', 'info');
    } catch (e) {
      logger.error('Downloader interrupted', {
        label: 'Flixarr Downloader',
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
      total: this.recommendedSize,
    };
  }

  public cancel(): void {
    this.running = false;
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const flixarrAutoDownload = new FlixarrAutoDownload();
