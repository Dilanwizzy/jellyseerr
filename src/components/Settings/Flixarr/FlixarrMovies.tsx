import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import { SaveIcon } from '@heroicons/react/solid';
import type { FlixarrSettings, RadarrSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages({
  flixarr: 'Movies',
  flixarrSettings: 'Flixarr Settings',
  flixarrSettingsDescription: 'Setup movie recommendation',
  toastSettingsSuccess: 'Flixarr settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  toastPercentageError: 'Total discovery percentage MUST equal to 100%',
  totalToRecommend: 'No. Movies To Recommend',
  totalToRecommendTip: 'How many movies you would be recommended',
  maxQuota: 'Max Quota',
  maxQuotaTip: 'Set the Total Size Quota, use (GB|TB). Set 0 for unlimited',
  popularityPercentage: 'Popularity Percentage (%)',
  popularityPercentageTip: 'Discovery based on Popularity',
  genrePercentage: 'Genre Percentage (%)',
  genrePercentageTip: 'Discovery based on top 3 watched Genres',
  watchedPercentage: 'Watched Percentage (%)',
  watchedPercentageTip:
    'Discovery based on watched and favourites within the last month',
  enable: 'Enable Movie Recommendations',
  serviceId: 'Radarr Profile',
  serviceIdTip: 'Radarr profile for flixarr to use',
});

const FlixarrMovies = () => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<FlixarrSettings>('/api/v1/settings/flixarr');

  const { data: radarrData, error: radarrError } = useSWR<RadarrSettings[]>(
    '/api/v1/settings/radarr'
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.flixarr),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.flixarr)}</h3>
        <p className="description">
          {intl.formatMessage(messages.flixarrSettingsDescription)}
        </p>
      </div>

      <div className="section">
        <Formik
          initialValues={{
            totalToDownload: data?.movieRecommend.totalToRecommend,
            maxQuota: data?.movieRecommend.maxQuota,
            popularityPercentage: data?.movieRecommend
              .discoverBasedOnPopularityPercentage
              ? data.movieRecommend.discoverBasedOnPopularityPercentage * 100
              : 0,
            watchedPercentage: data?.movieRecommend
              .discoverBasedOnWatchedPercentage
              ? data.movieRecommend.discoverBasedOnWatchedPercentage * 100
              : 0,
            genrePercentage: data?.movieRecommend.discoverBasedOnGenrePercentage
              ? data?.movieRecommend.discoverBasedOnGenrePercentage * 100
              : 0,
            enabled: data?.movieRecommend.enabled,
            serviceId: data?.movieRecommend.serviceId,
          }}
          enableReinitialize
          onSubmit={async (values) => {
            try {
              if (
                Number(values.genrePercentage) +
                  Number(values.popularityPercentage) +
                  Number(values.watchedPercentage) !=
                100
              ) {
                addToast(intl.formatMessage(messages.toastPercentageError), {
                  autoDismiss: true,
                  appearance: 'error',
                });
              } else {
                await axios.post('/api/v1/settings/flixarr', {
                  movieRecommend: {
                    enabled: values.enabled,
                    totalToRecommend: Number(values.totalToDownload),
                    maxQuota: values.maxQuota,
                    discoverBasedOnGenrePercentage:
                      Number(values.genrePercentage) / 100,
                    discoverBasedOnPopularityPercentage:
                      Number(values.popularityPercentage) / 100,
                    discoverBasedOnWatchedPercentage:
                      Number(values.watchedPercentage) / 100,
                    serviceId: Number(values.serviceId),
                  },
                });

                mutate('/api/v1/settings/public');

                addToast(intl.formatMessage(messages.toastSettingsSuccess), {
                  autoDismiss: true,
                  appearance: 'success',
                });
              }
            } catch (e) {
              addToast(intl.formatMessage(messages.toastSettingsFailure), {
                autoDismiss: true,
                appearance: 'error',
              });
            } finally {
              revalidate();
            }
          }}
        >
          {({ isSubmitting }) => {
            return (
              <Form className="section">
                <div className="form-row">
                  <label htmlFor="enabled" className="checkbox-label">
                    {intl.formatMessage(messages.enable)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <Field type="checkbox" id="enabled" name="enabled" />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="totalToDownload" className="text-label">
                    {intl.formatMessage(messages.totalToRecommend)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="totalToDownload"
                      name="totalToDownload"
                      inputMode="numeric"
                      className="short"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="maxQuota" className="text-label">
                    {intl.formatMessage(messages.maxQuota)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.maxQuotaTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="maxQuota"
                      name="maxQuota"
                      className="short"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="serviceId" className="text-label">
                    {intl.formatMessage(messages.serviceId)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.serviceIdTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      as="select"
                      id="serviceId"
                      name="serviceId"
                      className="short"
                    >
                      {radarrData && !radarrError && (
                        <>
                          {radarrData.length > 0 &&
                            radarrData.map((radarr) => (
                              <option value={radarr.id} key={radarr.id}>
                                {radarr.name}
                              </option>
                            ))}
                        </>
                      )}
                    </Field>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="popularityPercentage" className="text-label">
                    {intl.formatMessage(messages.popularityPercentage)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.popularityPercentageTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="popularityPercentage"
                      name="popularityPercentage"
                      inputMode="numeric"
                      className="short"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="watchedPercentage" className="text-label">
                    {intl.formatMessage(messages.watchedPercentage)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.watchedPercentageTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="watchedPercentage"
                      name="watchedPercentage"
                      inputMode="numeric"
                      className="short"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="genrePercentage" className="text-label">
                    {intl.formatMessage(messages.genrePercentage)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.genrePercentageTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="genrePercentage"
                      name="genrePercentage"
                      inputMode="numeric"
                      className="short"
                    />
                  </div>
                </div>
                <div className="actions">
                  <div className="flex justify-end">
                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        buttonType="primary"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        <SaveIcon />
                        <span>
                          {isSubmitting
                            ? intl.formatMessage(globalMessages.saving)
                            : intl.formatMessage(globalMessages.save)}
                        </span>
                      </Button>
                    </span>
                  </div>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </>
  );
};

export default FlixarrMovies;
